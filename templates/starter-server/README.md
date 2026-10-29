# Rivet server starter

Pages render on the server for each request. `src/routes/index.tsx` loads data (`load(…)`) and handles the form (`actions(…)`) next to the page; the build removes that server code from the browser bundle.

```sh
npm install
npm run dev     # dev server with hot reload
npm run build   # dist/client (browser files) and dist/server (server code)
npm start       # production server on http://127.0.0.1:3000
npm run check   # Rivet compiler diagnostics + tsgo (CI)
```

- `docker build -t notes . && docker run -p 3000:3000 notes` runs the production server in a container.
- `npm run dev` resumes pages by default; a code edit reloads a resumed page. DevTools inspection or `dev: { resume: false }` switches to client rendering, where components can hot-replace with state kept. Dev serves unbundled modules; production builds optimize the same DOM lowering. `npm run build && npm start` shows the production behaviour.

## Next steps

- Edit `src/routes/index.tsx`: the `load(…)` export reads data, the `actions(…)` export handles the form, the component renders both. Swap the in-memory notes for your database there.
- Notes are shared in this process and reset when it restarts. The page has nothing interactive, so it ships no JavaScript; the form posts natively.
- Add a page or an API route: a new file in `src/routes/`. Docs "File routes" (`guides/routing/file-routes`), "Actions and forms" (`guides/routing/actions-and-forms`).
- Deploy: `npm run build && npm start` on any Node 24 host, or the `Dockerfile` (docs `guides/deploy/node`, `guides/deploy/docker`). Vercel / Netlify / Cloudflare / Bun / Deno: docs `guides/deploy/<target>` (one `adapter` option in `vite.config.ts`; new projects: `npm create rivet@latest -- --deploy <target>`).
- Learn the model: docs "Signals" (`learn/signals`), "Resuming" (`learn/resuming`), "Server first" (`learn/server-first`).
- Docs: https://github.com/N1XUS/rivetjs/tree/main/apps/docs/content (guides, reference, recipes).

## Tooling

- Node.js 24 or newer (`engines` in `package.json`).
- `npm run check` runs `rivet sync` (writes the gitignored `.rivet/` route types + editor manifest from `vite.config.ts`; also run it before `tsgo` on a fresh clone), `rivet-check` the Rivet compiler's diagnostics (browser globals read during server rendering, non-deterministic renders, …) for every `.tsx` / `.jsx` file of `tsconfig.json`, then `tsgo` (TypeScript 7 native type check, incl. typed route links: a `Link` path that matches no route is TS2820). Exits 1 on an error; use it in CI.
- `@rivetjs/devtools` is a dev dependency, so `npm run dev` shows the DevTools panel (Alt+Shift+R or the round **R** button). Builds never include it. Turn it off with `rivetRouter({ devtools: false })`.
- `tsconfig.json` lists `@rivetjs/typescript-plugin`: editors that use the project's TypeScript show compiler errors while you type. `tsgo` ignores the entry (it loads no plugins); editors run the plugin on the `typescript` 5.9 package, which is why the starter keeps both.
- `vite.config.ts` passes options to `rivetRouter()`: `mode`, `styles`, `resume`, `devtools`, `dev.resume`, `transitions`, … All options: the docs page "Configuration" (`reference/config`).
