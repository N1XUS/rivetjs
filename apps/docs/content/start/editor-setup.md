---
title: Editor setup
description: Set up VS Code, WebStorm or another editor for Rivet TSX files, with TypeScript checks today and the experimental Rivet language service plugin.
template: guide
status: experimental
related: [guides/tooling/language-service, start/project-structure, guides/tooling/devtools]
---

Rivet components are plain TypeScript JSX. Any editor with TypeScript support gives you types, completion, rename and go to definition. After this page your editor understands Rivet's JSX, and you know how to add the experimental Rivet plugin, which shows compiler errors while you type.

## Set the JSX options

Your `tsconfig.json` needs two JSX settings. The starters already have them:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@rivetjs/runtime",
    "noUncheckedSideEffectImports": false
  },
  "include": ["src", "*.ts", ".rivet/routes.d.ts"]
}
```

- `jsx: "preserve"`: TypeScript checks the JSX but does not compile it. The Rivet compiler does that in Vite.
- `jsxImportSource: "@rivetjs/runtime"`: the editor takes the JSX types (elements, attributes such as `class` and `model:value`) from Rivet.
- `noUncheckedSideEffectImports: false`: TypeScript 6 and later report `import "./styles.css"` as an error (TS2882) by default. Vite handles these imports, so the starters turn the check off.
- `.rivet/routes.d.ts`: the types of your routes. This file exists only after you run `vite` or `vite build` once.

If the editor says "Cannot use JSX unless the '--jsx' flag is provided", the file belongs to no `tsconfig.json`. Check that the `include` list covers it.

## Use the project's TypeScript

Point your editor at the TypeScript version in the project's `node_modules`, not the one bundled with the editor. The Rivet plugin below only loads this way.

- **VS Code**: open a `.tsx` file, run the command "TypeScript: Select TypeScript Version", then choose "Use Workspace Version". To make it the default for a project, add this to `.vscode/settings.json`:

  ```json title=".vscode/settings.json"
  {
    "typescript.tsdk": "node_modules/typescript/lib",
    "typescript.enablePromptUseWorkspaceTsdk": true
  }
  ```

- **WebStorm**: Settings → Languages & Frameworks → TypeScript, then choose the project's `node_modules/typescript`.
- **Neovim, Zed, Helix**: use `typescript-language-server` or `vtsls` with the project's TypeScript (`tsdk`). Plugins in `tsconfig.json` load on their own.

## Tailwind classes

The starters use Tailwind CSS. Install the official Tailwind CSS IntelliSense extension for class name completion and hover previews. It works in Rivet's `class` attribute.

## Add the Rivet language service (experimental)

:::warning[Experimental]
The Rivet language service is experimental. The TypeScript plugin and language core are available on npm as `0.1.0-alpha.1`. The optional VS Code extension is not published to the Marketplace yet.
:::

The plugin `@rivetjs/typescript-plugin` adds what only the Rivet compiler knows. The starters already install and configure it. In other projects, install it and add it to `tsconfig.json`:

```bash
npm install -D @rivetjs/typescript-plugin @rivetjs/language-core
```

```json title="tsconfig.json"
{
  "compilerOptions": {
    "plugins": [{ "name": "@rivetjs/typescript-plugin" }]
  }
}
```

`tsc` ignores this entry. Editors that use the project's TypeScript load the plugin. With it, you get:

- Compiler errors while you type, with the same text as the build. For example, reading `document` during server rendering is marked at the exact place.
- Quick fixes, such as wrapping browser-only code in `clientEffect`.
- Hints that show which code runs in the browser and which values a handler captures.
- A warning when a handler captures a value that cannot be written into the page, such as a class instance.

[Language service](../guides/tooling/language-service.md) explains the setup steps, the VS Code extension shell and the `rivet-check` command for CI.

:::note
TypeScript 7 (the native `tsgo`) does not load JavaScript plugins. Use TypeScript 5 or 6 in the editor for now.
:::

## Common mistakes

- **Editor uses its bundled TypeScript.** JSX types may still work, but the Rivet plugin never loads. Switch to the workspace version.
- **No route types.** `.rivet/routes.d.ts` is missing until Vite has run once. Run `npm run dev` or `npm run build`.
- **A file outside every `tsconfig.json`.** The editor then shows JSX errors that the build does not have. Add the folder to `include`.

## See also

- [Language service](../guides/tooling/language-service.md)
- [DevTools](../guides/tooling/devtools.md): inspect components and signals in the dev server.
- [Project structure](project-structure.md)
