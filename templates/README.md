# Starter templates

What `npm create rivet@latest` copies (`libs/create-rivet` bundles this folder into its npm package) and what the docs offer ("Try in browser", examples). Outside the npm workspaces: each template depends on published `@rivetjs/*` versions (`experimental` here; `create-rivet` rewrites them to the release it belongs to).

| Template          | `--template` | What it is                                                                                                                                                                  |
| ----------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `starter-static`  | `static`     | Static site: pages prerendered at build, Tailwind, two routes, a counter and a build-time loader with a store-backed reading checklist. Docs examples use its config files. |
| `starter-server`  | `server`     | Node server: loader + form action, signal-backed note draft, `serve.js`, Dockerfile.                                                                                        |
| `starter-ui`      | `ui`         | Static site with `@rivetjs/ui` (Card, Avatar, Chip, Button, Switch) + Tailwind v4 + `@rivetjs/ui/styles` (Rivet theme).                                                     |
| `starter-minimal` | `minimal`    | One route, one signal, no Tailwind.                                                                                                                                         |

```sh
npm create rivet@latest my-app                              # asks for missing folder/template, deploy target, install, git
npm create rivet@latest my-app -- --template ui --yes       # no questions
```

- Inside this repo (packages not on npm yet): `node libs/create-rivet/cli.ts my-app --template static --no-install --no-git` from the repo root; the project resolves the workspace packages through the root `node_modules` (do not `npm install` in it).
- Inside this repo the templates build against the workspace packages (`apps/docs/tests/templates.test.ts`); `scripts/package/create-e2e.ts` runs the published flow from packed tarballs.
- StackBlitz and `npm install` work once the packages are published to npm.
