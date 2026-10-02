// Tests for the rtk plugin hook contract.
//
// Uses a fake `rtk` executable (via the `binary` option) so the suite runs
// without rtk installed. The critical regression: `rtk rewrite` exits 3 with
// the rewrite on stdout — the plugin must key on stdout, not exit status.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import plugin from "../index.js";

/** Write an executable fake `rtk` that prints `stdout` and exits `code`. */
async function fakeRtk({ stdout = "", code = 0, ignoreSigterm = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "rtk-fake-"));
  const path = join(dir, "rtk");
  const script = [
    "#!/bin/sh",
    ignoreSigterm ? "trap '' TERM" : ":",
    stdout ? `printf '%s\\n' ${JSON.stringify(stdout)}` : ":",
    ignoreSigterm ? "sleep 3" : ":",
    `exit ${code}`,
    "",
  ].join("\n");
  await writeFile(path, script);
  await chmod(path, 0o755);
  return path;
}

/** Run the plugin with given options and return the captured shell hook. */
async function captureHook(options) {
  let hook;
  const ctx = {
    options,
    shell: {
      hook: async (name, cb) => {
        assert.equal(name, "create.before");
        hook = cb;
      },
    },
  };
  await plugin.setup(ctx);
  return hook;
}

async function runHook(hook, command) {
  const event = { command };
  await hook(event);
  return event.command;
}

test("rewrites when rtk exits 3 with stdout (the real rtk contract)", async () => {
  const binary = await fakeRtk({ stdout: "rtk git status", code: 3 });
  const hook = await captureHook({ binary });
  assert.equal(await runHook(hook, "git status"), "rtk git status");
});

test("passes through when rtk exits 0 with no output", async () => {
  const binary = await fakeRtk({ stdout: "", code: 0 });
  const hook = await captureHook({ binary });
  assert.equal(await runHook(hook, "echo hi"), "echo hi");
});

test("passes through when output equals the input (no-op)", async () => {
  const binary = await fakeRtk({ stdout: "git status", code: 3 });
  const hook = await captureHook({ binary });
  assert.equal(await runHook(hook, "git status"), "git status");
});

test("passes through when the binary does not exist", async () => {
  const hook = await captureHook({ binary: "/nonexistent-rtk-xyz" });
  assert.equal(await runHook(hook, "ls"), "ls");
});

test("does not reject on malformed options (bad timeoutMs)", async () => {
  const missing = "/nonexistent-rtk-xyz";
  for (const timeoutMs of [-1, 2.5, 0, 1e12, "5000", null, undefined]) {
    const hook = await captureHook({ binary: missing, timeoutMs });
    assert.equal(await runHook(hook, "ls"), "ls");
  }
});

test("kills a SIGTERM-ignoring rtk and passes through within the deadline", async () => {
  const binary = await fakeRtk({ stdout: "rtk ls", code: 3, ignoreSigterm: true });
  const hook = await captureHook({ binary, timeoutMs: 500 });
  const started = Date.now();
  assert.equal(await runHook(hook, "ls"), "ls");
  assert.ok(Date.now() - started < 3000, "hook returned promptly");
});

test("disabled plugin registers no hook", async () => {
  let called = false;
  const ctx = {
    options: { enabled: false },
    shell: {
      hook: async () => {
        called = true;
      },
    },
  };
  await plugin.setup(ctx);
  assert.equal(called, false);
});
