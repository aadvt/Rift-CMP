/**
 * Creates the first user for an organisation.
 *
 * There is deliberately no self-service sign-up: an account grants access to an
 * organisation's data, so somebody who already holds that organisation's secret
 * key has to create it. That key is the proof of authority here, which is why
 * this is a script an operator runs rather than a public endpoint.
 *
 *   npx tsx database/scripts/create-user.mjs <sk_...> <email> [password]
 */
import { createInterface } from "node:readline/promises";
import { prisma, createUser, hashSecretKey } from "../index.ts";

const [secretKey, email, passwordArg] = process.argv.slice(2);

if (!secretKey || !email) {
  console.error("usage: npx tsx database/scripts/create-user.mjs <sk_...> <email> [password]");
  process.exit(1);
}

const organisation = await prisma.organisation.findUnique({
  where: { secretKeyHash: hashSecretKey(secretKey) },
  select: { id: true, name: true },
});

if (!organisation) {
  console.error("No organisation matches that secret key.");
  process.exit(1);
}

let password = passwordArg;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Password: ");
  rl.close();
}

if (password.length < 12) {
  console.error("Use at least 12 characters. Short passwords are the whole attack.");
  process.exit(1);
}

const user = await createUser(prisma, { email, password, organisationId: organisation.id });
console.log(`Created ${user.email} (${user.role}) in ${organisation.name}.`);
await prisma.$disconnect();
