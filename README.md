# opencode-rtk

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

### From GitHub

```bash
opencode plugin add github:nabheet/opencode-rtk
```

Or add it to `opencode.json(c)` directly:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:nabheet/opencode-rtk"]
}
```

### Manual

Copy this directory to `.opencode/plugins/opencode-rtk/` (project) or
`~/.config/opencode/plugins/opencode-rtk/` (global), then list it:

```jsonc
{
  "plugins": [{ "package": "./.opencode/plugins/opencode-rtk" }]
}
```

## Options

```jsonc
{
  "plugins": [
    {
      "package": "github:nabheet/opencode-rtk",
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

## License

MIT — see [LICENSE](./LICENSE). `rtk` itself is Apache-2.0 and is **not**
bundled or vendored here.
