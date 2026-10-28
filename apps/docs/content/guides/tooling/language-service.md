---
title: Language service
description: Get Rivet compiler errors, quick fixes and hints about where code runs directly in your editor, and run the same checks in CI with rivet-check.
template: guide
status: experimental
related: [start/editor-setup, guides/tooling/vite, gotchas/window-is-not-defined, learn/resuming]
---

Rivet files are normal TypeScript JSX, so your editor already gives you types, completion, rename and go to definition. The Rivet language service adds what only the Rivet compiler knows: its errors while you type, quick fixes, and hints that show which code runs in the browser.

It has three parts:

- `@rivetjs/typescript-plugin`: a TypeScript plugin, loaded by any editor that uses the TypeScript language server.
- `@rivetjs/language-core`: the editor-independent core, with the `rivet-check` command for CI.
- A VS Code extension (optional) with a few extras.

After reading this page you can turn it on in your editor and in CI, and you know what it shows.

## Turn it on

The Rivet starters already install the plugin. In an existing app, run `npm install -D @rivetjs/typescript-plugin @rivetjs/language-core`.

Add the plugin to `compilerOptions.plugins` in your `tsconfig.json`:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@rivetjs/runtime",
    "plugins": [{ "name": "@rivetjs/typescript-plugin" }]
  }
}
```

The `tsc` command ignores plugins; only editors load them. Editors load them only with the **workspace TypeScript**, the version in your project's `node_modules`:

- **VS Code**: run "TypeScript: Select TypeScript Version" and choose "Use Workspace Version". You can set `"typescript.tsdk": "node_modules/typescript/lib"` in `.vscode/settings.json` so the editor asks for you.
- **WebStorm**: Settings → TypeScript → use the project's `node_modules/typescript`.
- **Neovim, Zed, Helix**: use typescript-language-server or vtsls with the workspace TypeScript. They load tsconfig plugins automatically.

See also [Editor setup](../../start/editor-setup.md).

### Run Vite once

Some features need information that only the build knows: which modules resume and your routes. The Vite plugins write it to `.rivet/editor.json` every time `vite` or `vite build` runs. Without that file, the compiler checks still run, but in plain mode, and route features are off.

Route types in `.rivet/routes.d.ts` also come from Vite. The editor never generates them.

## What you get

### Compiler errors while you type

The editor shows the same errors as the build, at the exact place, for both the server and the browser version of the file. They have codes like `RV2001` and the source `rivet`. For example, reading `document` in code that runs during server rendering:

```tsx
export default function Page() {
  const width = document.body.clientWidth; // RV2001: browser global read during server rendering
  return <p>{width}</p>;
}
```

### Quick fixes

- A browser global read during server rendering ([RV2001](../../errors/RV2001.md)): wrap it in `clientEffect(() => { … })` and add the import.
- An invalid `preload` value ([RV1102](../../errors/RV1102.md)): replace it with the closest valid one.
- Children inside a void element like `<input>` ([RV1008](../../errors/RV1008.md)) or a `<textarea>` with `model:value` ([RV1009](../../errors/RV1009.md)): make it self-closing.
- A signal self-write in an effect: use `.update` to avoid subscribing to the value being written. This language-service warning still runs with `--no-types`; writes inside a computed value have no automatic fix.
- A handler expression that reads state when it binds ([RV1016](../../errors/RV1016.md)): wrap it in an arrow.
- A namespace import of a target helper ([RV3002](../../errors/RV3002.md)): import the helper as a named binding.

### Where code runs

On a resumed page, only some code runs in the browser. The language service shows it:

- An inlay hint at each browser-only function, for example `client · count, step`. The names after the dot are the component values it uses.
- Hover over `onClick` or `clientEffect` to see where it runs and which component values it uses.
- Hover over a variable to see which browser code uses it.

### Preload values

The `preload="…"` attribute is typed as `eager | idle | visible | intent | interaction`, so the editor completes and checks it. These values have no effect on derived loading; use the server's [preload options](../performance/preloading.md).

### Route links

For a `Link` component whose `to` prop takes a route path, the plugin completes route paths, warns with `RV3101` when a literal path matches no route, and offers go to route file and hover with the route id, file and params. The plugin option `linkModules` lists the modules whose `Link` export it checks. When `to` is typed with the generated route union (`rivet sync` writes it to `.rivet/routes.d.ts`), TypeScript itself rejects a path that matches no route (TS2820) and `RV3101` stays silent, so run `tsc` too: the starters' `npm run check` is `rivet sync && rivet-check && tsc`.

## Plugin options

Options go into the plugin entry in `tsconfig.json`:

```json
{ "name": "@rivetjs/typescript-plugin", "inlayHints": "all", "typeAware": false }
```

| Option | Default | Meaning |
| --- | --- | --- |
| `inlayHints` | `"client"` | `"client"`: hints at browser-only functions. `"all"`: more hints. `false`: none. |
| `typeAware` | `true` | Type-based warnings: route links (`RV3101`) |
| `linkModules` | the router's | Modules whose `Link` takes a route path |

## VS Code extension

The extension works with the bundled TypeScript too. It adds:

- the command **Rivet: Doctor**, which explains setup problems (wrong TypeScript, file not in any tsconfig, missing `.rivet/editor.json`),
- a status bar item showing the file's mode: `Rivet: resume`, `dom` or `off`,
- settings `rivet.inlayHints`, `rivet.typeAware` and `rivet.regions` (colors code by where it runs; off by default).

The extension is not on the Marketplace yet. The TypeScript plugin and language core are published on npm; install them with `npm install -D @rivetjs/typescript-plugin @rivetjs/language-core`.

## Check in CI

`rivet-check` runs the same checks over whole projects, without an editor:

```bash
rivet-check -p tsconfig.json
```

- `-p` takes a tsconfig; repeat it for several projects.
- `--no-types` turns off the type-based warnings (route links, `RV3101`).
- `rivet-check` does not run TypeScript's own type check: run `tsc` after it (typed route links fail there, TS2820).

Each diagnostic starts with a line like `src/routes/index.tsx:4:17 - error RV2001: …`, followed by a code frame, a `fix:` line and a `docs:` link (`--format json` adds a `fix` field). The command exits with code 1 when there are errors; warnings do not fail it.

Warnings with the same code and file share one report with an occurrence count. The summary counts every occurrence. `--json` (alias of `--format json`) writes one object to stdout with `files`, `errors`, `warnings`, `skipped` and `diagnostics`; a grouped diagnostic has `count` and, when repeated, `occurrences` containing its locations and messages. `--quiet` prints only errors; with JSON it filters the diagnostic list but keeps the totals. Usage/setup failures return `{ error, fix, exitCode }`.

Use `--verbose` or `DEBUG=rivet` to include an error stack. Exit codes: **0** for success or warnings, **1** for diagnostics with errors or a setup/operational failure (including an unreadable tsconfig or missing compiler), **2** for invalid arguments. A missing `-p` value is a usage error.

### Generate route types without a build

```bash
rivet sync --root ./my-app
rivet sync --json
rivet migrate server-exports --dry-run
```

`rivet sync` uses the app's Vite config to generate `.rivet/`. `--config <file>` selects a config relative to `--root`; `--mode <mode>` defaults to `production`. `rivet migrate server-exports` converts legacy route server exports; `--routes <dir>` defaults to `src/routes`, and `--dry-run` previews changes. Both accept `--quiet`, `--json` and `--verbose`. `rivet --help` lists commands, options and examples. These commands exit **0** on success, **1** on failure (including a missing config/plugin), and **2** for invalid arguments.

Progress uses one updating line on a terminal, periodic plain lines in CI/pipes, and a final duration. `NO_COLOR` disables color; `FORCE_COLOR` enables it outside CI unless `NO_COLOR` is set. `rivet mcp` reserves stdout for the MCP protocol and forwards its arguments to the installed server.

### Create and prerender output

`create-rivet` accepts `--quiet` (errors only), `--json` (one result), and `--verbose` (error stacks and successful install output). Quiet/JSON modes take defaults without asking questions, like `--yes`. With npm, put flags after `--`:

```bash
npm create rivet@latest my-app -- --template server --yes --json
```

Install and git steps show progress and elapsed time. Exit codes: 0 success, 1 operational failure (including install/git failure), 2 invalid arguments, 130 cancellation. A failed install keeps the created project so you can retry there. JSON reports the directory, template, install status, error/warning counts and duration; argument/setup failures include `error`, `fix`, and `exitCode`.

`prerenderBuild` and `prerender` report the current page and its running count, then a final page count and duration. Dynamic `entries()` results are discovered while rendering, so no total is guessed in advance. Pass `progress: false` when a custom logger owns the output. CI/pipes receive plain periodic lines; interactive terminals use one updating line.

## Error codes

Every code has its own page with the message, the fix, a before / after pair and the quick fix, if there is one: [Diagnostic codes](../../errors/index.md) lists them all, and the `docs:` link of each diagnostic opens its page. Most codes come from the compiler; the language service adds [RV3101](../../errors/RV3101.md), and `rivet-check` adds [RV7101](../../errors/RV7101.md) and [RV7102](../../errors/RV7102.md).

For any code, `explain_diagnostic` in the [Rivet MCP server](ai.md) returns the same explanation.

## Limits

- TypeScript 7 (the native `tsgo`) does not load JavaScript plugins. Use TypeScript 5.x or 6.x in the editor. A standalone language server is planned.
- i18n `t()` checks run only in the build, not in the editor.
- Region coloring is available only in VS Code.
- A file that belongs to no tsconfig shows "Cannot use JSX unless the '--jsx' flag is provided". Include it in a tsconfig; Rivet: Doctor reports this.

## See also

- [Editor setup](../../start/editor-setup.md)
- [Vite](vite.md)
- [AI assistants](ai.md)
- [window is not defined](../../gotchas/window-is-not-defined.md)
