# editorial-bench lane: next

- Versions: `next` 16.4.0 (Turbopack build), `react` / `react-dom` 19.3.0, `marked` 18.1.0.
- `build.sh <fixture dir>`: `next build` with `output: "export"`, `trailingSlash: true`, `images.unoptimized` → `out/` moved to `dist/`.
- App Router server components read the fixture (`lib/site.js` → `fixture/load.mjs`), `generateStaticParams` + `dynamicParams = false`; body via `dangerouslySetInnerHTML` of `marked.parse`. Plain `<a>` links (no `<Link>` prefetch). The React runtime + RSC payload ship by design (no zero-JS mode).
