import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma client is generated to a custom output directory inside the
  // `database` workspace package rather than to `@prisma/client`, which Next
  // externalises automatically. Without this, the bundler inlines the client
  // and Prisma can no longer locate its native query engine at runtime,
  // failing with "could not locate the Query Engine for runtime". Using a
  // native require keeps the client's own filesystem paths intact.
  serverExternalPackages: ["database", "@prisma/client"],
};

export default nextConfig;
