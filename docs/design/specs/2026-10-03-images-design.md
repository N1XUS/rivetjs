# Image optimisation (design)

Reference: [Qwik image optimisation](https://qwik.dev/docs/integrations/image-optimization/) (`vite-imagetools` + `?jsx`). Goal: same zero-config import, plus layouts, DPR, art direction, container-aware `sizes`, CDN builders, and a raw API for anything the component can't express. No new package: build side extends `@rivetjs/compiler/vite`, render side is subpath `@rivetjs/runtime/image`.

## Goals
- `import x from "./a.jpg?image"` → optimised variants (AVIF/WebP + fallback), intrinsic dims, placeholder; no config needed.
- Cover modern `<picture>`/`<img>` surface: `<source type media srcset sizes width height>`, `w` + `x` descriptors, `sizes="auto"`, `loading`, `decoding`, `fetchpriority`, preload `<link imagesrcset imagesizes>`, CSS `image-set()`.
- Less config than imagetools directives: layout model derives widths + `sizes`.
- Raw escape hatch: plain JSON descriptor + helpers; users build own markup.
- Zero client JS: pure SSR markup, no resume symbols.
- Same component for local and CDN images.

## Non-goals (v1)
- Remote fetch at build; CSS `url()` rewriting in stylesheets; video/poster; runtime image endpoint (`/_image?…` — server CPU, breaks static adapter).

## Decisions
- Encoder: `sharp` as optional `peerDependency` of `@rivetjs/compiler`; loaded lazily only when `images` used. `processor` interface swappable.
- Processing at build in plugin; dev encodes on demand via middleware.
- Import result: data descriptor (default) + `?jsx` component sugar.
- One `Picture` component, auto-collapses to bare `<img>` when `<picture>` adds nothing.

## Config (`rivet({ images })`)
```ts
rivet({
  images: {
    formats: ["avif", "webp"],        // fallback = source format, appended automatically
    densities: [1, 2],                 // fixed layout x-descriptors; also max DPR cap for w-planning
    breakpoints: [640, 768, 1024, 1280, 1536, 1920, 2560], // variant widths
    quality: { avif: 50, webp: 75, jpeg: 78, png: 80 },
    placeholder: "blur",               // "blur" | "dominant-color" | "none"
    presets: { hero: { layout: "full-width", formats: ["avif", "webp"] } },
    processor: sharpProcessor(),       // default when omitted
  },
});
```
- `images: true` = all defaults. Omitted = feature off, `?image` not handled.
- Build-time only (serialisable). Render-time settings (CDN builders, breakpoint names) live in app code — vite config functions can't reach the browser bundle.

## Import directives
- Keyword **last** (TS ambient modules allow one `*`): `./a.jpg?image`, `./a.jpg?layout=fixed&width=320&image`, `./a.jpg?preset=hero&image`, `./logo.png?width=120&jsx`.
- Directives: `layout`, `width`, `height` (crop to aspect, `fit=cover`), `formats` (`;`-separated), `quality`, `densities`, `placeholder`, `preset`, `fit`, `position`.
- Merge: per-import > preset > global. Unknown directive/preset/format → build error.
- Vite-internal query keys (`import`, `t`, `v`) ignored by the parser.
- `@rivetjs/compiler/images`: node API (`getImage`, `sharpProcessor`). `@rivetjs/compiler/images/client`: ambient types (script file; wildcard modules can't live in a module file) — `*?image`, `*&image` → `ImageDescriptor`; `*?jsx`, `*&jsx` → `(props: Omit<PictureProps, "image">) => unknown`. Apps add `@rivetjs/compiler/images/client` to `types`.

## Layouts (drive srcset + sizes)
- `fixed` — CSS width = `width` or intrinsic; `x` descriptors from `densities` (clamped to intrinsic); no `sizes`.
- `constrained` (default) — max = `width` or intrinsic; `w` widths = breakpoints ≤ max × maxDensity, plus max and max × densities; `sizes="(min-width: {max}px) {max}px, 100vw"`.
- `full-width` — all breakpoints ≤ intrinsic (+ intrinsic); `sizes="100vw"`.
- Never upscale: requested > intrinsic → clamp + build warning.

## Descriptor (raw API)
```ts
interface ImageDescriptor {
  src: string;                 // fallback URL (largest fallback-format variant ≤ display max)
  width: number; height: number; // display dims (CLS)
  layout: "fixed" | "constrained" | "full-width";
  sizes?: string;
  placeholder?: { kind: "blur"; src: string } | { kind: "color"; value: string };
  sources: { type?: string; srcset: string }[]; // ordered best → fallback; last = fallback; type absent = CDN-negotiated
}
```
- Plain JSON, serialisable, usable in server code, CSS, custom markup.
- Helpers (`@rivetjs/runtime/image`): `srcset(descriptor, type?)`, `imageSet(descriptor)` → CSS `image-set(...)` string, `preloadLink(descriptor, { sizes?, media? })` → link attrs object (`rel=preload as=image href imagesrcset imagesizes type fetchpriority=high`); `<ImagePreload image sizes? media?/>` renders it (`<link rel=preload>` is valid in `<body>`, so no head API needed).
- `getImage(file, opts)` (`@rivetjs/compiler/images` node API) → same descriptor for files known only in server code (e.g. CMS uploads at build/prerender).

## `<Picture>`
```tsx
<Picture image={hero} alt="…" />
<Picture image={hero} alt="…" sizes={{ md: "50vw", lg: "33vw" }} />          // breakpoint map → sizes
<Picture image={hero} alt="…" sizes="auto" />                                // emits "auto, <computed>", forces lazy
<Picture alt="…" image={{ "(max-width: 640px)": mobile, default: hero }} />  // art direction
<Picture image={cdn("photos/cat.jpg", { width: 1600, height: 900 })} alt="…" priority />
```
- Props: `image` (descriptor | media map), `alt` (required; `""` = decorative), `sizes` (string | breakpoint map | `"auto"`), `priority`, `loading`, `decoding`, `fetchpriority`, `as` (`"picture" | "img"` force), `class`/`style`/other `<img>` attrs passthrough to `<img>`, `pictureClass`.
- Breakpoint map keys: Tailwind default names (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536) or numbers → `(min-width: Npx)`, emitted largest first; raw media strings (start with `(`) emitted first in insertion order; `default` key (else layout-derived) = final fallback.
- Output:
  - `<picture>` + `<source type srcset sizes>` per non-fallback type, and per media (art direction: each media source carries own `width`/`height`), then `<img>`.
  - Collapses to bare `<img srcset sizes>` when one type and no media (CDN `autoFormat`, SVG/GIF passthrough, single format).
  - `<img width height>` always; defaults `loading="lazy" decoding="async"`.
  - `priority` → `loading="eager" fetchpriority="high"`. Preload is explicit: render `<ImagePreload image={hero}/>` (no hidden head side effects). `priority` + `sizes="auto"` → TypeError (`auto` requires lazy).
  - `as="img"` with art direction → TypeError.
  - Placeholder values validated (blur `data:image/(webp|png|jpeg);base64,…`, color hex) → hand-built descriptors can't inject CSS.
  - Placeholder → inline `style="background:… center/cover no-repeat"`; no JS to remove (image paints over).
- One pure markup builder (`pictureHtml`) shared by both targets: server wraps in `template([html])`, DOM in `template({ html, slots: [], context: "html" })`. Escaping via runtime `encodeAttributeValue`.
- Target split: `@rivetjs/runtime/image` = server (default, works without Vite); `@rivetjs/runtime/image/dom` = DOM. The Vite plugin resolves `@rivetjs/runtime/image` → `/image/dom` in client environments (same role as the compiler's `/dom` → `/server` rewrite).

## CDN builders
```ts
interface ImageCdn {
  url(src: string, o: { width: number; height?: number; format?: string; quality?: number; fit?: "cover" | "contain" }): string;
  autoFormat?: boolean; // CDN negotiates by Accept → single type → bare <img srcset>
}
```
- Ship: `urlTemplate("https://x/{src}?w={width}&fm={format}")`, `cloudinary`, `imgix`, `cloudflare` (from `@rivetjs/runtime/image`).
- `cdn(src, { width, height, layout?, formats?, cdn? })` → `ImageDescriptor` via same planner; pure string ops at render, no fetch, no processing.
- Missing `width`/`height` → throws (CLS guarantee). Builder passed explicitly (`cdn: cloudinary({ cloud })`); apps wrap once: `const img = (src, o) => cdn(src, { cdn: myCdn, ...o })`.
- Max variant width = `maxWidth` option, else `width × max(densities)` (CDN may upscale; caller decides).
- `autoFormat` without explicit `formats` → one untyped source → bare `<img>`.

## Pipeline (`libs/compiler/images/*.ts`, wired from `vite.ts`)
- Planner + descriptor types live in runtime `image-plan.ts` (needed at render by `cdn()`); compiler imports `@rivetjs/runtime/image-plan` (new compiler dependency on runtime).
- `resolveId`/`load`: image ext (`jpg jpeg png webp avif gif svg tiff`) + `image`/`jsx` keyword.
- `processor.metadata()` → width, height, format, hasAlpha, animated; EXIF orientation applied before dims.
- Planner (pure: metadata + options → variants, sizes, descriptor skeleton):
  - widths per layout; dedupe; clamp ≤ intrinsic.
  - alpha → PNG fallback (not JPEG).
  - animated GIF → passthrough single source; SVG → passthrough, dims from `width`/`height`/`viewBox`.
- Plugin shape: `rivet({ images })` returns `[rivetPlugin, imagesPlugin]` (overload; without `images` still one `Plugin`). Images plugin: `enforce: "pre"`, `sharedDuringBuild: true` (one registry across environments); resume plugin untouched.
- Emission (SSR-first: most images live only in the server graph; resumed pages have no client entry importing them):
  - Every environment's `load` registers planned variants in the shared registry; nothing emitted in `load`.
  - Client environment `generateBundle` emits every registered variant (dedupe by fileName).
  - Plugin `buildApp` hook (order pre) builds `ssr` then `client` → server-only images registered before client emits. Apps build with `createBuilder({ builder: {}, environments: {...} }).buildApp()` (= `vite build --app`).
  - Separate `build()` calls (no app builder): server environment `generateBundle` warns "image variants referenced from server code may be missing from the client build; build with createBuilder().buildApp()".
- Build: encode with pool (`os.availableParallelism()`); disk cache `node_modules/.rivet/images/<sha256(bytes + variant + processor id/version)>.<ext>`; fileName `<assetsDir>/<name>-<width>-<key8>.<ext>`; URL = `base + fileName` string literal. Deterministic names → client and SSR environments agree without asset-ref placeholders. SSR environment computes descriptors (metadata + placeholder) but does not encode or emit.
- Dev: descriptor URLs `/@rivet/image/<key>.<ext>`; `configureServer` middleware encodes on demand (same cache), serves only keys in planned map (no arbitrary file reads), `Cache-Control: no-cache` + ETag.
- Placeholder: blur = ~16px-wide WebP data URI (target ≤ 400 B); dominant-color from processor stats.
- `?jsx` → generated module: `import { Picture } from "@rivetjs/runtime/image"; const image = {…}; export default (props) => Picture({ ...props, image });`.

## Errors
- `sharp` missing when `images` enabled → "`images` needs `sharp`: npm i -D sharp".
- Unknown directive/preset/format, corrupt/unsupported file → build error with module id.
- Upscale request → warning, clamped.
- `cdn()` without dims → throw with src.

## Testing
- Planner table-driven: layout × densities × intrinsic size; no-upscale; alpha fallback; SVG/GIF passthrough; `sizes` strings incl. breakpoint maps and `auto`.
- Directive parser + merge precedence; unknown keys error.
- `Picture` SSR snapshots: multi-format, collapse to `<img>`, `as` force, art direction with per-media dims, priority, placeholder, attr escaping; DOM target parity.
- CDN builders: URL output per provider; `autoFormat` collapse.
- Vite integration: fixture images generated by sharp in test → build emits expected assets; SSR and client URLs equal; rebuild hits cache; dev middleware serves planned key, 404 otherwise; `?jsx` module renders.
- Chromium (Playwright): AVIF source chosen; `currentSrc` width at DPR 1 vs 2; no layout shift (CLS 0) with placeholder.
- Playground: hero via `?image` + `priority` preload; Lighthouse "properly size images" + "modern formats" pass.
