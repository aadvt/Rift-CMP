import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Everything the product needs to run locally, in one command.
 *
 * Three processes, because they are three different things and pretending
 * otherwise would hide a real failure mode:
 *
 *   api        the platform — `/api/v1`, the SDK bundle, the database
 *   worker     performs queued scans; without it a scan sits at "queued" forever
 *   dashboard  the product UI, which reads the platform over HTTP like any
 *              other integrator
 *
 * The worker is the one people forget. A dashboard with no worker looks broken
 * in a specific and confusing way — the scan starts, the stepper appears, and
 * nothing ever advances — so it is started here rather than left as a line in a
 * README that someone will skip.
 *
 * Output is prefixed per process. Ctrl-C stops all three.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontend = path.join(root, "rift-frontend-main");

const COLOURS = { api: "[36m", worker: "[33m", dashboard: "[35m" };
const RESET = "[0m";

const PROCESSES = [
  { name: "api", cwd: root, args: ["-w", "api", "run", "dev"] },
  { name: "worker", cwd: root, args: ["-w", "@rift-cmp/crawler", "run", "worker"] },
  { name: "dashboard", cwd: frontend, args: ["run", "dev", "-w", "@rift/dashboard"] },
];

const children = new Map();
const restarts = new Map();
let stopping = false;

/** How many times one process may die before the whole thing gives up. */
const MAX_RESTARTS = 5;

function prefix(name, chunk) {
  const colour = COLOURS[name] ?? "";
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.trim() === "") continue;
    process.stdout.write(`${colour}[${name}]${RESET} ${line}\n`);
  }
}

/**
 * Start one process, and put it back if it falls over.
 *
 * A managed database resets a connection, a dev server chokes on a bad edit —
 * and the process that goes is usually the worker, which fails invisibly from
 * the outside: scans simply stop advancing while the UI keeps saying "queued".
 * Restarting it is more useful than either ignoring the exit or killing
 * everything else along with it. A process that will not stay up is said out
 * loud after `MAX_RESTARTS`, because by then it is a fault rather than a hiccup.
 */
function start(proc) {
  const child = spawn("npm", proc.args, {
    cwd: proc.cwd,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (c) => prefix(proc.name, c));
  child.stderr.on("data", (c) => prefix(proc.name, c));

  child.on("exit", (code) => {
    if (stopping) return;

    const count = (restarts.get(proc.name) ?? 0) + 1;
    restarts.set(proc.name, count);

    if (count > MAX_RESTARTS) {
      prefix(proc.name, `exited with code ${code} and will not stay up — stopping.`);
      stop(code ?? 1);
      return;
    }

    prefix(proc.name, `exited with code ${code} — restarting (${count}/${MAX_RESTARTS}).`);
    setTimeout(() => {
      if (!stopping) start(proc);
    }, 2_000);
  });

  children.set(proc.name, child);
}

for (const proc of PROCESSES) start(proc);

/**
 * Kill a child and everything it started.
 *
 * `shell: true` means the child is a shell, and on Windows `child.kill()` ends
 * the shell while leaving `next dev` and its workers holding ports 3000 and
 * 3100. The next `npm run dev` then fails with EADDRINUSE against servers
 * nobody can see, which is a genuinely baffling way to spend ten minutes.
 * `taskkill /T` takes the whole tree; on POSIX a process group does the same
 * job.
 */
function killTree(child) {
  if (child.killed || child.pid === undefined) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children.values()) killTree(child);
  // Give taskkill a moment to land before the parent goes.
  setTimeout(() => process.exit(code), 500);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

console.log(
  [
    "",
    "  Rift is starting.",
    "",
    "    dashboard   http://localhost:3100/dashboard   ← open this",
    "    platform    http://localhost:3000/api/v1",
    "",
    "  The worker performs queued scans; leave it running or scans never start.",
    "",
  ].join("\n"),
);
