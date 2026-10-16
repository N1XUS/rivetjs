# Stable framework benchmark toolchains

This private workspace isolates the stable releases from the existing Solid 2 and Qwik 2 preview dependencies. Versions were checked against the official npm registry on 2026-10-04 and are pinned in `package.json` and the workspace lockfile.

| Package | Version | Purpose |
| --- | --- | --- |
| `solid-js` | 1.9.15 | Current stable Solid runtime, including `solid-js/web` |
| `@builder.io/qwik` | 1.20.1 | Current stable Qwik runtime and optimizer |
| `babel-preset-solid` | 1.9.15 | Stable Solid JSX compiler |
| `@babel/core` | 7.29.7 | Compatible compiler core required by the Solid preset |
| `vite-plugin-solid` | 2.11.14 | Stable Solid production client/SSR builds |
| `vite` | 7.3.6 | Compatible with Qwik 1's `>=5 <8` peer range |

The existing comparison lanes retain Solid 2.0.0-rc.13 and Qwik 2.0.0-rc.0. The additional lanes are named `solid-stable` and `qwik-stable`; build manifests record exact versions. Stable builds must resolve their runtime and transitive imports through this workspace, rather than mixing Solid 1 and Solid 2 instances.

Use the repository root's `npm ci` to install all toolchains. No existing locked package version was changed to add this workspace.
