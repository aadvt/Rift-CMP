import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.join(process.cwd(), "..");

const nextConfig: NextConfig = {
  // The Prisma client is generated to a custom output directory inside the
  // `database` workspace package rather than to `@prisma/client`, which Next
  // externalises automatically. Without this, the bundler inlines the client
  // and Prisma can no longer locate its native query engine at runtime,
  // failing with "could not locate the Query Engine for runtime". Using a
  // native require keeps the client's own filesystem paths intact.
  //
  // `playwright` is here because the crawler package's entry point re-exports
  // `crawl()`, so importing `diffScans` or `checkUrlShape` from it drags
  // Playwright into the bundle. The API never launches a browser — the worker
  // does — but a bundler cannot know that, and on a serverless target the
  // result is a function carrying a browser automation library it will never
  // call, which is both enormous and fragile.
  serverExternalPackages: ["database", "@prisma/client", "playwright"],

  /**
   * The app lives in `api/` but its dependencies live in the workspace above
   * it, so tracing has to start at the repository root. Without this, anything
   * outside `api/` is invisible to the trace and simply does not travel to the
   * deployment.
   */
  outputFileTracingRoot: repoRoot,

  /**
   * Externalising `database` is what keeps Prisma able to find its own engine —
   * and is also why nothing traces into it, so the engine binary never gets
   * copied. The build produces it and then leaves it behind, which fails only
   * at runtime, on the server, with "could not locate the Query Engine".
   *
   * Naming the generated client explicitly is the documented fix. The glob
   * covers every engine variant rather than one filename, so a change of
   * platform target does not quietly reintroduce the same failure.
   */
  // Two details from `node_modules/next/dist/docs/.../output.md`, both easy to
  // get wrong and both silent when wrong:
  //
  //   Keys are **route globs** matched against the route path (`/api/v1/sites`),
  //   not file globs. A key like `/**/*` matches no route at all.
  //
  //   Values are resolved from the **Next.js project root** — this `api/`
  //   directory — not from `outputFileTracingRoot`. So reaching the sibling
  //   `database` package is `../database/...` even though tracing is rooted
  //   above both.
  outputFileTracingIncludes: {
    "/api/**": ["../database/generated/client/**/*"],
    "/*": ["../database/generated/client/**/*"],
  },
};

export default nextConfig;
