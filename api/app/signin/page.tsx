import { redirect } from "next/navigation";
import type { OrganisationSummary } from "@rift-cmp/shared";
import { requestOrigin } from "@/lib/dashboard/api";
import { writeSessionKey } from "@/lib/dashboard/session";

export const metadata = { title: "Sign in · Rift-CMP" };

/**
 * Sign-in.
 *
 * The dashboard authenticates with the organisation secret key. It is submitted
 * to a server action and validated against the platform API; what reaches the
 * browser afterwards is an opaque session token, not the secret. See
 * `lib/dashboard/session.ts`.
 */
async function signIn(formData: FormData) {
  "use server";

  const secretKey = String(formData.get("secret_key") ?? "").trim();
  if (!secretKey) {
    redirect("/signin?error=missing");
  }

  // Validate before storing, so a wrong key fails here rather than on every
  // subsequent page. The response also names the organisation the session
  // belongs to, which the session row needs.
  const response = await fetch(`${await requestOrigin()}/api/v1/organisation`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    redirect("/signin?error=invalid");
  }

  const organisation = (await response.json().catch(() => null)) as OrganisationSummary | null;
  if (!organisation?.organisation_id) {
    redirect("/signin?error=invalid");
  }

  await writeSessionKey(organisation.organisation_id, secretKey);
  redirect("/dashboard");
}

export default async function SignInPage({
  searchParams,
}: PageProps<"/signin">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="signin">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Rift-CMP</h1>
      <p className="hint" style={{ marginTop: 0, marginBottom: 20 }}>
        Sign in with your organisation secret key to view consent, transfers and
        activity for your sites.
      </p>

      <form action={signIn} className="card">
        <label htmlFor="secret_key">Organisation secret key</label>
        <input
          id="secret_key"
          name="secret_key"
          type="password"
          placeholder="sk_…"
          autoComplete="off"
          required
          style={{ width: "100%", marginBottom: 12 }}
        />

        {error === "invalid" ? (
          <p className="error-text" role="alert">
            That key was not recognised.
          </p>
        ) : null}
        {error === "missing" ? (
          <p className="error-text" role="alert">
            Enter your organisation secret key.
          </p>
        ) : null}

        <button type="submit" className="primary" style={{ width: "100%" }}>
          Sign in
        </button>
      </form>

      <p className="hint" style={{ marginTop: 16 }}>
        The key is printed once by <code>npm run seed</code> in <code>database/</code>.
        It is exchanged for a revocable session; the cookie holds an opaque token,
        never the key itself, and no page script can read either.
      </p>
    </main>
  );
}
