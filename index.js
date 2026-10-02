// opencode-rtk — OpenCode v2 plugin
//
// Rewrites shell commands through `rtk rewrite` so command output reaches the
// model in a token-efficient form. All rewrite logic lives in rtk itself; this
// plugin is a thin delegating adapter for OpenCode's shell hook.
//
// Requires: rtk >= 0.23.0 on PATH (https://github.com/rtk-ai/rtk)

import { execFile } from "node:child_process";

/** Run `rtk rewrite <command>`; resolve to the rewritten command or null. */
function rewriteCommand(binary, command, timeoutMs) {
  return new Promise((resolve) => {
    const child = execFile(
      binary,
      ["rewrite", command],
      { timeout: timeoutMs },
      (err, stdout) => {
        if (err) return resolve(null);
        const rewritten = String(stdout).trim();
        resolve(rewritten && rewritten !== command ? rewritten : null);
      }
    );
    // execFile can emit before the callback; never let it surface.
    child.on("error", () => resolve(null));
  });
}

export default {
  id: "rtk",

  async setup(ctx) {
    const options = ctx.options ?? {};
    if (options.enabled === false) return;

    const binary = typeof options.binary === "string" ? options.binary : "rtk";
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 5000;

    await ctx.shell.hook("create.before", async (event) => {
      if (!event || typeof event.command !== "string" || !event.command) return;
      const rewritten = await rewriteCommand(binary, event.command, timeoutMs);
      if (rewritten) event.command = rewritten;
    });
  },
};
