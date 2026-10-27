# create-rivet

Create a [Rivet](https://github.com/N1XUS/rivetjs) app.

```sh
npm create rivet@latest my-app
cd my-app
npm run dev
```

It asks for a project name, a template, whether to install dependencies and whether to create a git repository. Other package managers: `pnpm create rivet`, `yarn create rivet`, `bun create rivet`.

## Templates

| `--template` | What you get |
| --- | --- |
| `static` (default) | Static site: pages prerendered to HTML, Tailwind CSS, two routes, an interactive counter. |
| `server` | Node.js server: a loader and a form action per request, Tailwind CSS, a Dockerfile. |
| `ui` | Static site with `@rivetjs/ui` components and Tailwind CSS v4. |
| `minimal` | One page, one signal, no Tailwind. |

All templates use TypeScript and need Node.js 24 or newer.

## Options

```sh
npm create rivet@latest my-app -- --template server --yes --no-git
```

| Option | |
| --- | --- |
| `-t`, `--template <id>` | `static`, `server`, `ui` or `minimal` |
| `-d`, `--deploy <target>` | `vercel`, `netlify`, `cloudflare` (any template), `bun`, `deno` (`server` template): sets the router adapter and the platform files |
| `-n`, `--name <name>` | `package.json` name (default: the folder name) |
| `-y`, `--yes` | ask nothing, take the defaults |
| `--no-install` | skip installing dependencies |
| `--no-git` | skip `git init` |
| `--pm <name>` | `npm`, `pnpm`, `yarn` or `bun` (default: the one running the command) |
| `-f`, `--force` | write into a folder that is not empty |
| `--quiet` | errors only, no questions |
| `--json` | one JSON result, no questions |
| `--verbose` | error stacks and successful install output (also `DEBUG=rivet`) |
| `-h`, `--help` | all options |

With npm, options go after `--`.

Install and git steps show progress and duration. CI/pipes use plain periodic lines; `NO_COLOR` disables color and wins over `FORCE_COLOR`. Exit codes: 0 success, 1 failure (including install/git failure), 2 invalid arguments, 130 cancelled. The created folder remains available after a failed install. `installDependencies()` is asynchronous and returns `Promise<boolean>`.

## Nx monorepos

The same templates as Nx projects, with cached `build` / `test` / `check` targets: [`@rivetjs/nx`](https://github.com/N1XUS/rivetjs/tree/main/libs/nx) (`npx create-nx-workspace@latest my-org --preset=@rivetjs/nx`, or `npx nx add @rivetjs/nx` in an existing workspace).
