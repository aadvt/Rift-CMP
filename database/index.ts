export { Prisma, PrismaClient } from "./generated/client";

import { PrismaClient as PrismaClientType } from "./generated/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientType;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClientType({
    // Tests deliberately trigger constraint violations; logging them would make
    // a passing run look like a failing one.
    log: process.env.NODE_ENV === "test" ? [] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "./keys";
export * from "./tenancy";
export * from "./consent";
export * from "./transfers";
export * from "./authorisation";
export * from "./audit";
export * from "./analytics";
