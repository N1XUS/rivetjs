# Rivet UI starter

A static site built with [`@rivetjs/ui`](https://github.com/rivetjs/rivet/tree/main/libs/ui) (styled, resumable components) and Tailwind CSS v4. Pages in `src/routes` become HTML files at build time; the button keeps working in the browser without re-running your components.

```sh
npm install
npm run dev       # dev server with hot reload
npm run build     # HTML files in dist/client
npm run preview   # serve dist/client
npm run check     # Rivet compiler diagnostics (CI)
```

- Components come from their subpaths (`@rivetjs/ui/button`, `@rivetjs/ui/card`, …); the root `@rivetjs/ui` re-exports all of them.
- `src/styles.css` imports Tailwind first, then `@rivetjs/ui/styles`: the Rivet UI styles with the Rivet theme (light and dark). Other looks (the Classic theme included) are `@rivetjs/ui/theme` presets: paste their variables after the import (same components and class names). Theme variables (`--accent`, `--background`, …) can be overridden in your CSS.
- Icons: lucide through `@rivetjs/kit/icon` (`<Icon icon={Sparkles} />`).
- Deploy `dist/client` to any static host.

## Next steps

- Edit `src/routes/index.tsx` and `src/components/LikeButton.tsx`. `npm run dev` reloads them.
- Add components from `@rivetjs/ui/<name>` (button, card, dialog, tabs, …): docs "UI components" (`ui/components`).
- Add a page: a new file in `src/routes/`. Docs "File routes" (`guides/routing/file-routes`).
- Deploy: `npm run build`, then upload `dist/client` to any static host (docs `guides/deploy/static-hosts`).
- Learn the model: docs "Signals" (`learn/signals`), "Resuming" (`learn/resuming`), "Server first" (`learn/server-first`).
- Docs: https://github.com/rivetjs/rivet/tree/main/apps/docs/content (guides, reference, recipes).

## Tooling

- Node.js 24 or newer (`engines` in `package.json`).
- `npm run check` runs `rivet sync` (writes the gitignored `.rivet/` route types + editor manifest from `vite.config.ts`; also run it before `tsc` on a fresh clone) then `rivet-check`: the Rivet compiler's diagnostics for every `.tsx` file of `tsconfig.json`. Exits 1 on an error; use it in CI.
- `@rivetjs/devtools` is a dev dependency, so `npm run dev` shows the DevTools panel (Alt+Shift+R). Builds never include it.
- `tsconfig.json` lists `@rivetjs/typescript-plugin`: editors that use the project's TypeScript show compiler errors while you type.
