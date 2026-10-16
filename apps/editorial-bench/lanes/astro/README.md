# editorial-bench lane: astro

- Versions: `astro` 7.3.8, `marked` 18.1.0 (`package.json` + `package-lock.json`). The brief named Astro 5; 7.3.8 is the latest stable on 2026-10-11.
- `build.sh <fixture dir>` → `astro build` → `dist/`. `output: "static"`, `trailingSlash: "always"`, `prefetch: false`, no integrations (zero client JS).
- Content collection `articles` with an inline loader over `fixture/load.mjs`; bodies rendered with `marked.parse` + `set:html` (not Astro's remark pipeline: same Markdown library as the other JS lanes).
