---
title: Command line
description: Every Rivet command, its options and exit codes: rivet sync / migrate / mcp, rivet-check, create-rivet and the Nx check executor.
template: reference
status: experimental
related: [guides/tooling/language-service, start/quick-start, guides/tooling/nx, guides/tooling/ai]
---

Rivet installs four commands: `rivet` (from `@rivetjs/router`), `rivet-check` (from `@rivetjs/language-core`), `create-rivet` (run through `npm create rivet@latest`) and `rivet-mcp` (from `@rivetjs/mcp`, usually started as `rivet mcp`). This page lists their options. The [language service](../guides/tooling/language-service.md#check-in-ci) guide shows how to use them in CI.

All of them print one updating progress line on a terminal and plain periodic lines in CI or a pipe. `NO_COLOR` turns color off; `FORCE_COLOR` turns it on outside CI unless `NO_COLOR` is set. `--verbose` or `DEBUG=rivet` adds error stacks.

## rivet

```bash
rivet sync --root ./my-app
rivet sync --json
rivet migrate server-exports --dry-run
rivet mcp
```

| Command | What it does |
| --- | --- |
| `sync` | Generates `.rivet/` (route types `.rivet/routes.d.ts` and the editor manifest `.rivet/editor.json`) from the app's Vite config, without a build. |
| `migrate server-exports` | Rewrites legacy route server exports. |
| `mcp` | Starts the installed `@rivetjs/mcp` server over stdio. stdout is reserved for the MCP protocol; other arguments go to the server. Fails with a hint when `@rivetjs/mcp` is not installed. |

| Option | Default | Use |
| --- | --- | --- |
| `--root <dir>` | current directory | App root for `sync` |
| `--config <file>` | Vite's lookup | Vite config for `sync`, relative to the root |
| `--mode <mode>` | `production` | Vite mode for `sync` |
| `--routes <dir>` | `src/routes` | Routes directory for `migrate` |
| `--dry-run` | off | Preview `migrate` without writing files |
| `--quiet` | off | Errors only (`sync`, `migrate`) |
| `--json` | off | One JSON result on stdout (`sync`, `migrate`) |
| `--verbose` | off | Error stacks |
| `-h`, `--help` | | Commands, options and examples |

Exit codes: **0** success, **1** failure (including a missing config or plugin), **2** invalid arguments.

## rivet-check

```bash
rivet-check -p tsconfig.json
rivet-check --json --quiet
```

Runs the Rivet compiler diagnostics for both targets plus the language service's type-aware checks over every `.tsx` / `.jsx` file of the given projects and the projects they reference. It does not run TypeScript's own type check: run `tsc` after it. An app whose `.rivet/editor.json` is missing is an error ([RV7101](../errors/RV7101.md)), a stale one a warning ([RV7102](../errors/RV7102.md)): run `rivet sync` first.

| Option | Default | Use |
| --- | --- | --- |
| `-p`, `--project <path>` | `tsconfig.json` | tsconfig file or a directory holding one; repeat for several projects |
| `--no-types` | | Skip the type-aware checks (route links, [RV3101](../errors/RV3101.md)) |
| `--no-manifest` | | Skip the `.rivet/editor.json` checks |
| `--format text\|json` | `text` | Output format |
| `--json` | | Alias of `--format json` |
| `--quiet` | off | Errors only; JSON keeps the totals |
| `--verbose` | off | Error stacks |
| `-h`, `--help` | | Usage |

Each text diagnostic is a `file:line:column - error RVnnnn: …` line, a code frame, a `fix:` line and a `docs:` link. Warnings with the same code and file are grouped with an occurrence count. JSON output is one object with `files`, `errors`, `warnings`, `skipped` and `diagnostics`; usage and setup failures return `{ error, fix, exitCode }`.

Exit codes: **0** no errors (warnings do not fail), **1** errors or a setup failure (unreadable tsconfig, missing compiler), **2** invalid arguments or a project path that is not a tsconfig.

## create-rivet

```bash
npm create rivet@latest my-app -- --template server --yes
npm create rivet@latest my-app -- --no-install --no-git --json
pnpm create rivet my-app --template ui
```

With npm, options go after `--`.

| Option | Default | Use |
| --- | --- | --- |
| `[dir]` | asked | Folder to create |
| `-t`, `--template <id>` | asked, else `static` | `static`, `server`, `ui` or `minimal` |
| `-d`, `--deploy <target>` | none (Node server or static files) | `vercel`, `netlify`, `cloudflare`, `bun` or `deno` |
| `-n`, `--name <name>` | the folder name | `package.json` name |
| `-y`, `--yes` | off | Accept the defaults, ask nothing |
| `--install` / `--no-install` | install | Install dependencies |
| `--git` / `--no-git` | git | `git init` and a first commit |
| `--pm <name>` | the one running create, else npm | `npm`, `pnpm`, `yarn` or `bun` |
| `--rivet-version <spec>` | this release | `@rivetjs/*` dependency spec |
| `--quiet` | off | Errors only; takes the defaults without prompts |
| `--json` | off | One JSON result; takes the defaults without prompts |
| `--verbose` | off | Error stacks and the install output |
| `-f`, `--force` | off | Write into a folder that is not empty |
| `-h`, `--help` / `-v`, `--version` | | Usage, version |

Exit codes: **0** success, **1** failure (including a failed install or git step; the created project is kept), **2** invalid arguments, **130** cancelled. See [quick start](../start/quick-start.md).

## Nx check executor

The `@rivetjs/nx:check` executor runs `rivet sync` (routed apps) and `rivet-check` for a project. Options: `tsConfig` (string or list, default `tsconfig.json`), `types` (default `true`), `manifest` and `sync` (default: routed apps only), `format` (`text` / `json`), `quiet`, `verbose`. See [Nx](../guides/tooling/nx.md).

## Environment variables

| Variable | Read by | Effect |
| --- | --- | --- |
| `RIVET_CACHE_DIR` | builds | Root of the persistent build caches (default `rivet-cache` in the OS temp directory); see [Cache builds in CI](../guides/deploy/overview.md#cache-builds-in-ci) |
| `RIVET_COMPILE_CACHE` | builds | `0` turns the compiler cache off |
| `RIVET_COMPILE_CACHE_MB` | builds | Size limit of the compiler cache (default 512) |
| `RIVET_NATIVE_LITE` | production builds | `0`: no native Button rewrite; `all`: every proven site. See [What ships no JavaScript](../guides/performance/zero-js.md#buttons-with-a-simple-handler) |
| `DEBUG=rivet` | every command | Error stacks, like `--verbose` |
| `NO_COLOR`, `FORCE_COLOR` | every command | Color output |
