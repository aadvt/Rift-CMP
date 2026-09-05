import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  createDashboardSession,
  createOrganisation,
  createUser,
  createWebsite,
  findUserByEmail,
  prisma,
} from "database";
import { managementError } from "@/lib/cors";

/**
 * Creating an account, and the organisation it owns.
 *
 * Signing up necessarily provisions an organisation: a user with none owns
 * nothing, cannot be scoped to anything, and every read downstream is scoped by
 * organisation. So the two are made together, in one transaction-shaped step,
 * and the first user is its `owner`.
 *
 * ## The organisation key is generated and then deliberately discarded
 *
 * `createOrganisation` mints an `sk_` and returns it once. Nothing here stores
 * it, shows it, or puts it in the response. That is not an oversight:
 *
 *   A person signing up did not ask for a machine credential and has nowhere
 *   safe to put one. Handing it over at the exact moment somebody is least
 *   prepared to look after it is how keys end up in screenshots.
 *
 *   Only its digest is kept, so this endpoint could not show it again later
 *   even if it wanted to — which is the same property that makes a database
 *   leak survivable, and is worth preserving rather than working around.
 *
 * The account works without it: the session this returns authenticates the
 * management plane on its own. An `sk_` is for server-to-server integrations,
 * and issuing one should be a deliberate act with somewhere to put the result.
 *
 * ## Why a website is optional here
 *
 * The landing page asks for a website before it asks for an account, because
 * "scan my site" is the thing a person came to do and "make an account" is the
 * tax. Carrying the address through means the first thing they see after
 * signing up is their own site being scanned, rather than an empty dashboard
 * asking them to start over.
 */

const Body = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(12).max(512),
  /** Optional: the address typed on the landing page, carried through. */
  website: z.string().max(2048).optional(),
});

/** `acme.com` and `Ada Lovelace <ada@acme.com>` both become something sluggable. */
function slugFrom(seed: string): string {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  // A suffix rather than a uniqueness loop: `slug` is unique across the table,
  // and two people signing up from the same company domain in the same second
  // is a collision nobody should have to think about.
  return `${base || "org"}-${randomBytes(3).toString("hex")}`;
}

export async function POST(request: NextRequest): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return managementError("invalid_request", "Body must be JSON.", [], 400);
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return managementError(
      "invalid_request",
      "An email and a password of at least 12 characters are required.",
      [],
      400,
    );
  }

  const { email, password, website } = parsed.data;

  // Checked before anything is created, so a duplicate does not leave an
  // orphaned organisation behind. This does disclose that an address is taken,
  // which sign-in refuses to do — the difference is deliberate: a signup form
  // that will not say "already registered" sends people in circles, and the
  // same fact is discoverable by trying to sign up anyway.
  if (await findUserByEmail(prisma, email)) {
    return managementError(
      "conflict",
      "An account already exists for that email. Sign in instead.",
      [],
      409,
    );
  }

  let host: string | null = null;
  if (website?.trim()) {
    try {
      const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("scheme");
      host = url.hostname;
    } catch {
      return managementError("invalid_request", "That website address is not valid.", [], 400);
    }
  }

  const organisation = await createOrganisation(prisma, {
    name: host ?? email.split("@")[1] ?? email,
    slug: slugFrom(host ?? email),
  });

  const user = await createUser(prisma, {
    email,
    password,
    organisationId: organisation.organisation_id,
    role: "owner",
  });

  const site = host
    ? await createWebsite(prisma, {
        organisationId: organisation.organisation_id,
        name: host,
        domain: host,
      })
    : null;

  const session = await createDashboardSession(prisma, {
    organisationId: organisation.organisation_id,
    userId: user.id,
  });

  return Response.json(
    {
      session_token: session.token,
      expires_at: session.expiresAt.toISOString(),
      user: {
        user_id: user.id,
        email: user.email,
        role: user.role,
        organisation_id: user.organisationId,
      },
      organisation: {
        organisation_id: organisation.organisation_id,
        name: organisation.name,
        slug: organisation.slug,
      },
      site: site ? { site_id: site.site_id, domain: site.domain } : null,
    },
    { status: 201 },
  );
}
