# opencode-rtk-plugin

> An [OpenCode](https://opencode.ai) **v2** plugin that routes every shell
> command through [`rtk`](https://github.com/rtk-ai/rtk), cutting LLM token
> usage by **60-90%** on common dev commands.

OpenCode sends tool output back to the model. `rtk` compresses that output
(git, grep, ls, test runners, build logs, and more) into a token-efficient
form before the model ever sees it. This plugin wires the two together.

## Why

- **Smaller context, lower cost.** Command output is the biggest hidden token
  sink in an agent loop.
- **No prompt changes.** Rewriting happens in the shell hook, transparently.
- **Single source of truth.** All rewrite rules live in `rtk rewrite`; this
  plugin is a thin delegating adapter, so rules never drift.

## Requirements

- OpenCode **v2** (`opencode --version` reports 2.x).
- `rtk` >= 0.23.0 on `PATH` — see [rtk-ai/rtk](https://github.com/rtk-ai/rtk):
  `brew install rtk`

## Install

### From npm

```bash
opencode plugin add opencode-rtk-plugin
```

### From GitHub

```bash
opencode plugin add github:nabheet/opencode-rtk-plugin
```

Or add it to `opencode.json(c)` directly:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-rtk-plugin"]
}
```

### Manual

Copy this directory to `.opencode/plugins/opencode-rtk-plugin/` (project) or
`~/.config/opencode/plugins/opencode-rtk-plugin/` (global), then list it:

```jsonc
{
  "plugins": [{ "package": "./.opencode/plugins/opencode-rtk-plugin" }]
}
```

## Options

```jsonc
{
  "plugins": [
    {
      "package": "opencode-rtk-plugin",
      "options": {
        "binary": "rtk",
        "timeoutMs": 5000,
        "enabled": true
      }
    }
  ]
}
```

| Option      | Default | Description                          |
| ----------- | ------- | ------------------------------------ |
| `binary`    | `"rtk"` | Path or name of the rtk executable.  |
| `timeoutMs` | `5000`  | Per-rewrite timeout in milliseconds. |
| `enabled`   | `true`  | Set `false` to disable the plugin.   |

## How it works

The plugin registers one OpenCode v2 shell hook:

```js
ctx.shell.hook("create.before", (event) => {
  // event.command is the command about to run; mutate it to rewrite
})
```

For each shell command it runs `rtk rewrite <command>` and replaces the command
with rtk's output when it differs. If `rtk` is missing, times out, or errors,
the original command runs unchanged.

## Compatibility

- Targets **OpenCode v2** (`plugins` config + `id`/`setup` plugin definition).
  OpenCode v1 used a different plugin API and is not supported.
- `rtk` ships hooks for Claude Code, Codex, Cursor, Gemini CLI, Copilot and
  others. OpenCode is not among them, so this plugin fills that gap.

## Prereleases

Every push to a PR publishes an installable beta to the npm `beta` dist-tag:

```bash
opencode plugin add opencode-rtk-plugin@beta
```

## Releases (maintainers)

All publishing happens in GitHub Actions via npm **trusted publishing** (OIDC
provenance). Never publish from a local shell.

`.github/workflows/ci.yml` is the single workflow file (npm allows one trusted
publisher per package; the workflow filename must stay `ci.yml`):

- `test` — lint + plugin-export smoke check on `main` and PRs (Node 24).
- push to `main` → `publish` job publishes the next patch to `latest`, pushes a
  `vX.Y.Z` tag, and opens a GitHub release. The version is derived from the
  last published `latest`, so repeated merges never collide; an intentional
  minor/major bump in `package.json` is honored.
- tag `v*-beta*` → `publish` job publishes `beta` + a prerelease GitHub release.
- every PR push → `prerelease` job publishes `<version>-beta.<run_number>` to
  `beta` (same-repo, non-draft, non-dependabot PRs; re-runs deduped).
- manual dispatch → next `-beta.X` staging publish from `main`, no git change.

## License

MIT — see [LICENSE](./LICENSE). `rtk` itself is Apache-2.0 and is **not**
bundled or vendored here.
