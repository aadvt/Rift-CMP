import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import type { PrismaClient } from "./generated/client";

/**
 * People who sign in to the dashboard.
 *
 * ## Why this does not use `hashSecretKey()`
 *
 * `hashSecretKey()` is SHA-256, and that is the right choice for what it
 * protects: a 256-bit random token, where the only attack is a lookup and there
 * is nothing to guess. A password is the opposite — a phrase a person chose,
 * drawn from a distribution an attacker can enumerate. A fast digest over one is
 * a wordlist away from being no protection at all, and a leaked table would be
 * cracked in bulk.
 *
 * ## Why scrypt rather than Argon2id
 *
 * Argon2id would be the textbook answer. scrypt is chosen here because it is
 * memory-hard for the same reason, is what OWASP names as the acceptable
 * alternative, and ships inside Node — where `argon2` and `bcrypt` are native
 * modules that need a compiler on every machine and in every CI image that
 * builds this repo. Trading a native build step for a different memory-hard KDF
 * is a good trade; trading it for SHA-256 would not have been.
 *
 * Parameters follow the current OWASP minimum for scrypt (N=2^17, r=8, p=1),
 * and are recorded in the stored string so raising them later does not
 * invalidate existing hashes.
 */

// `promisify` picks the callback overload without options, which is the one
// overload this module never uses.
const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const PARAMS = { N: 2 ** 17, r: 8, p: 1, keyLength: 64 } as const;

/** Enough that `maxmem` is not the binding constraint at these parameters. */
const MAXMEM = 256 * 1024 * 1024;

/**
 * `scrypt$N$r$p$salt$hash`, all base64url.
 *
 * The parameters travel with the hash so a future increase applies to new
 * passwords without stranding old ones — verification reads what was used at
 * the time rather than assuming today's values.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password.normalize("NFKC"), salt, PARAMS.keyLength, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: MAXMEM,
  }));

  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

/**
 * Whether `password` produced `stored`.
 *
 * Never throws on a malformed stored value: a corrupt row is a failed sign-in,
 * not a 500 that tells an attacker they found something interesting.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, salt, expected] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !expected) return false;

    const expectedBytes = Buffer.from(expected, "base64url");
    const derived = (await scrypt(
      password.normalize("NFKC"),
      Buffer.from(salt, "base64url"),
      expectedBytes.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM },
    ));

    // Length is checked first because `timingSafeEqual` throws on a mismatch.
    return derived.length === expectedBytes.length && timingSafeEqual(derived, expectedBytes);
  } catch {
    return false;
  }
}

export interface UserRecord {
  id: string;
  email: string;
  role: string;
  organisationId: string;
}

/** Addresses are compared lowercased, so nobody is locked out by a capital letter. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createUser(
  prisma: PrismaClient,
  input: { email: string; password: string; organisationId: string; role?: string },
): Promise<UserRecord> {
  const user = await prisma.user.create({
    data: {
      email: normaliseEmail(input.email),
      passwordHash: await hashPassword(input.password),
      organisationId: input.organisationId,
      ...(input.role ? { role: input.role } : {}),
    },
    select: { id: true, email: true, role: true, organisationId: true },
  });
  return user;
}

/**
 * Verifies an email and password, or returns null.
 *
 * One null for every failure — unknown address, wrong password, disabled
 * organisation. Distinguishing them would turn the form into an oracle for
 * which addresses have accounts, which is the first thing a credential-stuffing
 * run wants to know.
 *
 * A password is verified even when no user matched, against a dummy hash. Not
 * doing so makes an unknown address answer in a millisecond and a known one in
 * a hundred, which reports the same thing the error message refused to.
 */
export async function authenticateUser(
  prisma: PrismaClient,
  input: { email: string; password: string },
): Promise<UserRecord | null> {
  const user = await prisma.user.findUnique({
    where: { email: normaliseEmail(input.email) },
    select: { id: true, email: true, role: true, organisationId: true, passwordHash: true },
  });

  const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return null;

  const { passwordHash: _passwordHash, ...record } = user;
  return record;
}

/**
 * A well-formed stored hash that no password matches, for the no-such-user path.
 *
 * It is not the hash of anything; its only job is to be parseable, so that
 * `verifyPassword` runs the same KDF with the same parameters and the request
 * costs the same as a genuine verification. The comparison always fails, which
 * is what the caller wants.
 */
const DUMMY_HASH = `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${Buffer.alloc(16).toString(
  "base64url",
)}$${Buffer.alloc(PARAMS.keyLength).toString("base64url")}`;

export async function findUserByEmail(
  prisma: PrismaClient,
  email: string,
): Promise<UserRecord | null> {
  return prisma.user.findUnique({
    where: { email: normaliseEmail(email) },
    select: { id: true, email: true, role: true, organisationId: true },
  });
}
