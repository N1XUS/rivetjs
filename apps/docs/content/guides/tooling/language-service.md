---
title: Language service
description: Get Rivet compiler errors, quick fixes and hints about where code runs directly in your editor, and run the same checks in CI with rivet-check.
template: guide
status: experimental
related: [start/editor-setup, guides/tooling/vite, gotchas/window-is-not-defined, best-practices/serializable-captures]
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

Some features need information that only the build knows: which modules resume, your preload rules and your routes. The Vite plugins write it to `.rivet/editor.json` every time `vite` or `vite build` runs. Without that file, the compiler checks still run, but in plain mode, and route features are off.

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

- A browser global read during server rendering: wrap it in `clientEffect(() => { … })` and add the import.
- An invalid `preload` value: replace it with the closest valid one.
- Children inside a void element (like `<input>`): make it self-closing.
- A ref callback in the wrong form: rewrite it to `ref={(el) => (local = el)}` with `let local!: …`.
- A capture-phase handler: switch it to a bubbling one.
- A captured class instance that cannot be sent (`RV2003`, `RV2102`): build it in the browser with `const m = reconstruct(() => new WeakMap())` and read it as `m()` (adds the import).

### Where code runs

On a resumed page, only some code runs in the browser. The language service shows it:

- An inlay hint at each browser-only function, for example `client · count, step`. The names after the dot are the values it captures; they are written into the page.
- Hover over `onClick` or `clientEffect` to see the symbol id, where it runs and what it captures.
- Hover over a captured variable to see that it is :term[serializable]{id=serializable} state sent to the browser.

### Values that cannot be sent

`RV2101` is a warning that uses types. It appears when a handler captures a value the page state cannot carry: a class instance, a `Promise`, a DOM node, a `WeakMap`, a symbol. It also catches cases the compiler cannot see from syntax alone:

```tsx
const store = makeStore(); // returns a class instance
return <button onClick={() => store.add()}>Add</button>; // RV2101
```

Functions are not reported, because signals and other compiled functions work at runtime. Instances of classes the compiler resumes as data (a data class or a class with `static [revive]` in a resumed module) are not reported either. See [Serializable captures](../../best-practices/serializable-captures.md).

### Preload values

The `preload="…"` attribute is typed as `eager | idle | visible | intent | interaction`, so the editor completes and checks it.

### Route links

For a `Link` component whose `to` prop takes a route path, the plugin completes route paths, warns with `RV3101` when a literal path matches no route, and offers go to route file and hover with the route id, file and params. The plugin option `linkModules` lists the modules whose `Link` export it checks.

## Plugin options

Options go into the plugin entry in `tsconfig.json`:

```json
{ "name": "@rivetjs/typescript-plugin", "inlayHints": "all", "typeAware": false }
```

| Option | Default | Meaning |
| --- | --- | --- |
| `inlayHints` | `"client"` | `"client"`: hints at browser-only functions. `"all"`: more hints. `false`: none. |
| `typeAware` | `true` | Type-based warnings (`RV2101`) |
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
- `--no-types` turns off the type-based warnings.

Each diagnostic starts with a line like `src/routes/index.tsx:4:17 - error RV2001: …`, followed by a code frame, a `fix:` line and a `docs:` link (`--format json` adds a `fix` field). The command exits with code 1 when there are errors; warnings do not fail it.

## Error codes

| Code | Meaning |
| --- | --- |
| `RV1000` | Parse error |
| `RV1002` | Spread children |
| `RV1008` | Children inside a void element |
| `RV1012`, `RV1013` | Unknown event, global event attribute |
| `RV1101`, `RV1102` | Unsafe attribute, invalid `preload` value |
| `RV2001` | Browser global read during server rendering |
| `RV2002`, `RV2005` | Ref callback must assign a local (quick fix: use `ref()`); ref-bound local assigned elsewhere |
| `RV2003`, `RV2007` | Capturing `new …`, capturing `this` |
| `RV2102` | Capturing an instance of a class that cannot resume as data (`#private` field, non-data base class, resource read while constructing) |
| `RV2006` | JSX inside a handler |
| `RV2009` | Two module references share a browser name (rename one import) |
| `RV2011` | Mutually recursive functions separated by an early exit (move them together) |
| `RV2012`–`RV2014` | `.bind` that may not resume: spread `this`, a target Rivet cannot resume, inside an object literal a handler reaches. Warnings (the module still compiles: the receiver may be an object with its own `bind`); `RV2012` / `RV2013` are errors when the callee is provably a function (declared in the component or module, or an import) |
| `RV2015` | A component returns a function that cannot resume (an anonymous default export, a wrapper call such as `memo(…)`, a returned `let`): return an inline arrow from a named component (warning) |
| `RV2101` | Captured value cannot be serialized (warning) |
| `RV2105`, `RV2106` | A `For` row that cannot render lazily: it reads the clock or a random value while rendering, or holds a `clientOnly` component, `<Async>`, a `Portal` or a `ref` to a variable outside the row. Warnings: the page works the same |
| `RV3101` | Link matches no route (warning) |
| `RV4001`–`RV4005` | i18n `t()` calls: keys, params, arguments, tags, config |

For any code, `explain_diagnostic` in the [Rivet MCP server](ai.md) returns what it means, the fix, and a before / after pair.

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
