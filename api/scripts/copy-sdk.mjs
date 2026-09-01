import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Publishes the built browser SDK at a URL the API actually serves.
 *
 * The integration page tells an operator to add
 * `<script src="/js/rift-cmp.js">`, so that file has to exist. Copying the
 * bundle into `public/` at build time keeps the instruction honest without
 * committing build output — `api/public/js` is gitignored, and the root build
 * script builds the SDK before this runs.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, "../../sdk/dist/index.global.js");
const targetDir = path.resolve(here, "../public/js");
const target = path.join(targetDir, "rift-cmp.js");

if (!existsSync(source)) {
  console.warn(
    `[rift-cmp] SDK bundle not found at ${source}.\n` +
      "           Run `npm run build --workspace sdk` first; the dashboard's " +
      "install snippet will 404 until you do.",
  );
  process.exit(0);
}

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);
console.log("[rift-cmp] published SDK bundle to public/js/rift-cmp.js");
