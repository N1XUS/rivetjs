# island-bench lane: next

- Next.js 16.4.0, React / React DOM 19.3.0 — the install of `apps/editorial-bench/lanes/next` (pins in its `package.json` + `package-lock.json`), reused through an **untracked symlink**: `node_modules -> ../../../editorial-bench/lanes/next/node_modules`. Create it once: `ln -s ../../../editorial-bench/lanes/next/node_modules apps/island-bench/lanes/next/node_modules` (after `npm ci --workspaces=false` in the editorial lane). `build.sh` and `run.ts` stop with that instruction when it is missing.
- App Router, `export const dynamic = "force-dynamic"` (per-request SSR like the other lanes); the 1000 rows and the badge are server components, counter / picker / chart client components (`app/islands.jsx`).
- `next.config.mjs`: `compress: false` (no lane compresses), `experimental.cpus: 2` (build RSS), turbopack + tracing root = repo root (the shared components live outside the lane).
