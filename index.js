// opencode-rtk — OpenCode v2 plugin
//
// Rewrites shell commands through `rtk rewrite` so command output reaches the
// model in a token-efficient form. All rewrite logic lives in rtk itself; this
// plugin is a thin delegating adapter for OpenCode's shell hook.
//
// Requires: rtk (https://github.com/rtk-ai/rtk)

import { execFile } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 600_000;

/**
 * Run `rtk rewrite <command>` and resolve to the rewritten command, or null.
 *
 * rtk signals the result on STDOUT, not via exit status: since v0.34.0
 * `rtk rewrite` exits 3 with the rewritten command on stdout (its
 * permission-verdict protocol). So the exit code must be ignored and the
 * decision made on stdout alone.
 *
 * Never rejects and never hangs: a spawn failure, timeout, or empty/unchanged
 * output resolves to null so the original command runs.
 */
function rewriteCommand(binary, command, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const done = (value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };

    let child;
    try {
      // timeout: 0 disables execFile's own SIGTERM-only timeout; we enforce a
      // hard SIGKILL deadline below so a SIGTERM-ignoring rtk cannot hang.
      child = execFile(
        binary,
        ["rewrite", command],
        { timeout: 0, encoding: "utf8" },
        (_err, stdout) => {
          const out = String(stdout ?? "").trim();
          done(out && out !== command ? out : null);
        }
      );
    } catch {
      return done(null);
    }

    child.on("error", () => done(null));

    timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      done(null);
    }, timeoutMs + 250);
  });
}

function resolveBinary(value) {
  return typeof value === "string" && value.trim() !== "" ? value : "rtk";
}

function resolveTimeout(value) {
  if (Number.isInteger(value) && value >= 1 && value <= MAX_TIMEOUT_MS) return value;
  return DEFAULT_TIMEOUT_MS;
}

export default {
  id: "rtk",

  async setup(ctx) {
    const options = ctx.options ?? {};
    if (options.enabled === false) return;

    const binary = resolveBinary(options.binary);
    const timeoutMs = resolveTimeout(options.timeoutMs);

    await ctx.shell.hook("create.before", async (event) => {
      try {
        if (!event || typeof event.command !== "string" || !event.command) return;
        const rewritten = await rewriteCommand(binary, event.command, timeoutMs);
        if (rewritten) event.command = rewritten;
      } catch {
        // Never fail the shell call: any error leaves the command unchanged.
      }
    });
  },
};
