# @rivetjs/compiler/images

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Build-time image optimisation: `?image` / `?jsx` / `?svg` imports (Vite plugin) and `getImage()` for files known only at build/prerender time. Raster encoding via `sharp` (optional peer); SVG via `svgo` (dependency, lazy-loaded); content-addressed disk cache.

## Entry points

- `@rivetjs/compiler/images` → `index.ts`: `getImage(file, { outDir, base?, assetsDir?, config?, directives? })` → `ImageDescriptor` (same shape as `?image`), writes assets to `outDir`; re-exports `sharpProcessor`, `ImageProcessor`, `ImageMetadata`, `EncodeOptions`, `ImagesConfig`, `Directives`, `svgoPlugins`, `SvgoOptions`, `SvgDirectives`.
- `@rivetjs/compiler/images/client` → `client.d.ts`: ambient `*?image` / `*&image` (default `ImageDescriptor`), `*?jsx` / `*&jsx` (default `Picture`-like component) and `*?svg` / `*&svg` (inline component: svg intrinsic attributes + `size` + `title`). Consumers add it to tsconfig `types`. One wildcard per ambient module → only imports whose keyword is the LAST query key are typed; `parseImageId` sets `warning` otherwise and `plugin.ts` `load` passes it to `this.warn` (P5, `tests/images-query-order.test.ts`).
- `rivet({ images })` (`../vite.ts`) → `plugin.ts` `imagesPlugin(config | true)`; not a public subpath.

## Layout

- `plugin.ts` — `vite-plugin-rivet-images` (`enforce: pre`, `sharedDuringBuild`): builds only, `transform` (`order: "pre"`, project `.[cm]?[jt]sx?` modules): default `import x from "…?image"` lines whose descriptor JSON is ≤ `IMAGE_INLINE_LIMIT` (1024) become `const x = <frozen descriptor>` on the same line (brand key `Symbol.for("rivet.image")` inline; assets registered as in `load`) → no per-image client chunk (ZERO B4'(a): 72 ui-docs pages loaded 240 descriptor chunks, up to 12/page); larger descriptors, `?jsx`, `?svg`, dev keep the module; `load` of `?svg` ids → `pipeline.inline` TSX compiled with `compile()` for the environment (server / DOM, never resume mode — the component is static), warnings via `this.warn`; `load` of `?image` / `?jsx` ids → descriptor JSON (`?jsx` wraps it in a `Picture` component from `@rivetjs/runtime/image`, resolved to `/dom` on the client); registers planned assets; client build emits them, dev serves `<base>@rivet/image/<key>.<ext>`. `buildApp` (pre) builds ssr before client so server-only images register first; warns `SERVER_ONLY_WARNING` otherwise.
- `pipeline.ts` — `createPipeline(ctx)`: `describe(file, directives)` → `{ descriptor, assets, warnings }` using `@rivetjs/runtime/image-plan` (`planWidths`, `describe`, `single`); `encode(asset)`; `EXT` / `MIME_BY_EXT`; placeholders (blur / dominant-color) cached as `<hash>.placeholder.json`. `.svg` files take the SVG path before sharp (`svgDimensions` → width / height, planned asset `{ svg: true }`, key = source digest + `svgoKey`; `svgFile` optimises once and caches `<key>.svg`); `inline(file, directives)` → cached `<hash>.svg.tsx`. Animated inputs (and non-`.svg` files sharp reads as SVG) are copied, not encoded; animated TIFF throws.
- `options.ts` — `ImagesConfig` (layout, formats, densities, breakpoints, quality, placeholder, presets, processor, cacheDir, `svgo: false | SvgoOptions`), `Directives` (per import: layout, width, height, formats, quality, densities, placeholder, fit, position, preset), `parseImageId` (keywords `image` / `jsx` / `svg`, exactly one; `?svg` only on `.svg`; `VITE_KEYS` ignored; `warning` when the keyword is not the last non-Vite key), `parseSvgDirectives` (`currentColor`, `prefixIds`), `validateConfig`, `checkDirectives`, `resolveOptions`, `IMAGE_FILE`, `DEFAULT_QUALITY`.
- `svg.ts` — svgo glue: `svgoPlugins(kind)` (default: `preset-default` with `cleanupIds { remove: false, minify: false }`; inline adds `inlineStyles { onlyMatchedOnce: false }` + `convertStyleToAttrs`), `optimizeSvg` (asset: optimise + sanitise), `inlineSvg` (optimise + sanitise + `prefixIds` + `currentColor` → TSX module: root attrs, `{...props}`, `{...own(props)}` for size / title / aria), `svgDimensions`, `svgoKey`, `svgoVersion`. Sanitiser `rivet-sanitize`: drops `script` / embedded documents (and `style` when inline), `on*` attributes, `javascript:` / `vbscript:` URLs (+ `data:` when inline; a `data:image` `<image href>` throws), editor namespaces / `xmlns*` when inline.
- `processor.ts` — `ImageProcessor` interface (`id`, `metadata`, `encode`, `placeholder`); `sharpProcessor()` lazy-loads sharp, id `sharp@<version>` (walks up from the resolved entry for `package.json`; `missing` when absent).
- `cache.ts` — `hash(...parts)` sha256, `diskCache(dir)` (atomic temp+rename writes), `pool(limit)` concurrency (default `availableParallelism()`).
- `client.d.ts` — ambient types (above).

## Rules / invariants

- Cache keys include the processor id: swapping encoders or sharp versions invalidates entries. Default cache dir `node_modules/.rivet/images` (root-relative, `cacheDir` overrides).
- Asset file names: `<assetsDir>/<stem>-<width>-<key8>.<ext>`; URLs `base + fileName` in builds, `<base>@rivet/image/<key>.<ext>` in dev.
- i18n per-locale client builds (C1; detected via the `i18n()` plugin's `api.locale`): base without the `<locale>/` suffix, files written once (fs, skip when present) into the parent of the locale outDir (`dist/client/assets/`) instead of `emitFile`. Test `libs/i18n/tests/vite.test.ts` (images).
- Descriptors are emitted deep-frozen (`Object.freeze` nested) with `[brand]: true` on top (`const brand = Symbol.for("rivet.image")`; every call `/* @__PURE__ */`, so an unused import tree-shakes to 0 B — `tests/vite-images.test.ts` zero-cost case) (`plugin.ts` `frozen`), so `pictureHtml` may cache their markup (`tests/vite-images.test.ts` asserts); otherwise plain data; the runtime (`@rivetjs/runtime/image`) renders them — no image code in resume chunks when props are constant (docs/guides/vite-integration.md).
- `sharp` is optional: importing this module never loads it; the first `metadata`/`encode` does and throws `` `images` needs `sharp`: npm i -D sharp `` when missing. SVG never touches sharp.
- `svgo` loads on the first SVG only (`import("svgo")`); its version is part of every SVG cache key. Inline `?svg` output must stay a static template: attribute values are JSX string literals (`&amp;` / `&quot;` escaped), text JSX text with `& < > { }` entities (whitespace collapsed); anything the compiler rejects (style strings, `<style>`, unsafe URLs) is removed or converted before compile.
- Inline component props are snapshots (DOM components): a different `class` / `size` needs a re-created element.

## Commands

- Tests: `npx vitest run --project compiler libs/compiler/tests/images-*.test.ts libs/compiler/tests/vite-images*.test.ts libs/compiler/tests/svg-inline-browser.test.ts` (unit: options, pipeline, api, svg; Vite: build + browser; inline SVG in Chromium).
- Typecheck: part of `nx run compiler:typecheck`.

## See also

- `../CLAUDE.md`, `../../runtime` (`image`, `image-plan`), `../../../docs/guides/vite-integration.md` (Images section)
