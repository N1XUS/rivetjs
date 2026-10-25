# Vite authoring

Rivet's experimental compiler plugin runs before Vite's normal JSX transform. It selects DOM output for browser modules and server output for SSR modules. Ordinary CSS imports and deferred CSS chunks pass through Vite; the Rivet runtime contains no CSS processor.

```js
// vite.config.mjs
import { defineConfig } from 'vite';
import { rivet } from '@rivetjs/compiler/vite';

export default defineConfig({ plugins: [rivet()] });
```

Use TypeScript's `jsx: "preserve"` and `jsxImportSource: "@rivetjs/runtime"` for editor checks. The plugin compiles `.jsx` and `.tsx` project files and reports unsupported syntax with source locations. It skips dependency modules and asset requests such as `?raw` and `?url`. Transformed modules carry source maps in dev and when `build.sourcemap` is set (copied source maps exactly; lowered JSX maps to the nearest source position; maps add ~30% compile time and change no emitted code). On the dev server, client modules hot-replace exported components in place and keep component state: `signal`s created while a component renders take their previous values by creation order (all reset when the count changes; a `@refresh reset` comment opts a module out), wrapped child components keep theirs by position. Modules whose other exports change, or with export forms the plugin does not recognize (re-exports `export … from`), update their importers as usual. Resume modules compile in resume mode on the dev client too (`resume.dev`, set by `rivetRouter`): the extra exports of module-level locals that symbol chunks import are ignored by the hot-replace comparison, and `<module>?rivet-chunk=<Component>` serves one component's symbols as a chunk. Framework modules requested with only a `?t=` cache-buster answer `export * from "<plain url>"`, so the browser never holds a second runtime copy; edits to framework sources full-reload. Development only: builds and SSR are unchanged. With `rivetRouter`, server and browser route errors open the same overlay and unmatched URLs list the routes ([dev errors](routing.md#file-routes-dev-errors-vite-serve)). `<Icon>` from `@rivetjs/kit/icon` with a lucide import and constant props compiles to its inline `<svg>` before the compile (`static-icons.ts`; same markup, applied on both targets so resume ids agree; lucide data from the importer's Node resolution; `rivet({ staticIcons: false })` / `rivetRouter({ staticIcons: false })` keeps the component call). With `@rivetjs/devtools` installed, dev pages also load the [DevTools](devtools.md) agent and serve its panel under `<base>__rivet/devtools/` (`Alt+Shift+R`; `rivet({ devtools: false })` opts out; never in builds).

Source packages: a dependency whose `package.json` has `"rivet": { "source": true }` ships `.tsx` source (e.g. `@rivetjs/cdk`) and is compiled like project files, from `node_modules` or a workspace link:

- resume symbols get package-relative ids (`@rivetjs/cdk/listbox/index.tsx#ListBox$1`), stable across install paths;
- its `.tsx` modules reachable from the app's imports join the resume module set automatically (no `resume.modules` entry);
- files inside the Vite root are project files as before; plain dependencies are still skipped (and externalized for SSR).

Shared JSX can import target helpers from `@rivetjs/runtime/dom`; server compilation rewrites that entry to the server target. Ordinary service imports are never rewritten. Keep server-only data tooling in the server entry and provide browser data access separately, for example through REST. The framework requires no particular transport.

Tailwind can use its ordinary Vite plugin alongside Rivet:

```js
import tailwindcss from '@tailwindcss/vite';
// Add both build-time plugins:
export default defineConfig({ plugins: [rivet(), tailwindcss()] });
```

```css
/* Imported by the application entry. */
@import "tailwindcss";
```

Tailwind remains an application build dependency; it is not a Rivet runtime dependency. The plain-CSS Vite integration is exercised by production and dev graph tests. The Tailwind application example and Lighthouse measurements remain pending. See the official [Vite plugin API](https://vite.dev/guide/api-plugin.html) and [Tailwind Vite installation](https://tailwindcss.com/docs/installation/using-vite).

## URL attributes

- Checked attributes: `href`, `src`, `action`, `formaction` (any element), `poster`, `xlink:href`, `data` (`<object>`), SVG animation `to`/`from`/`by`; lists with every entry checked: `ping`, `srcset`, `imagesrcset`, `values` (split on whitespace, `,`, `;`). Name-based, any element/namespace; `values`/`to`/`from`/`by` checked whatever `attributeName` is.
- Unsafe: `javascript:`, `vbscript:`, `data:` — after removing controls/spaces (`\u0000`–`\u0020`, `\u007f`), case-insensitive; static literals are entity-decoded first.
- `data:` allowed only on media sources — `img`/`source` `src`/`srcset`, `video` `src`/`poster`, `audio` `src` — and only `data:image/*` (not `image/svg+xml`), `data:video/*`, `data:audio/*`. `track`, `iframe`, `embed`, `link imagesrcset`, `a href`: never.
- Static literal → compile error `Unsafe URL attribute` (RV1101), both targets.
- Dynamic value (server `attribute`/compiled slots/list mounts/resume bindings/`Dynamic`/spread `{...x}`, DOM `bindAttribute`/spread keys) → rendered as `about:invalid#rivet`; no throw, SSR completes (no 500 from user-controlled hrefs), DOM effect does not fail.
- `#dev` (`development` condition): `console.warn` once per attribute + scheme (DOM: + component name); spread values too (DOM: accessor values checked when read). Production: silent, no extra code (DOM check lives in the dev façade `dev/dom.ts`).
- Server media context: the compiler emits the attribute namespace `"media"` for media source attributes (`attribute("src", v, "media")`); other output unchanged.
- Shared rule: [url.ts](../../libs/runtime/url.ts) (runtime) and [html.rs](../../libs/compiler/rust/src/html.rs) (compiler); tests: [url.test.ts](../../libs/runtime/tests/url.test.ts).

## Images

`rivet({ images: true })` (needs `npm i -D sharp`) turns image imports into optimised responsive variants. Build with the app builder (`createBuilder({ builder: {}, environments }).buildApp()` / `vite build --app`) so images used only in server code reach the client output.

```tsx
import { Picture, ImagePreload } from "@rivetjs/runtime/image";
import hero from "./hero.jpg?image";                        // AVIF + WebP + JPEG/PNG fallback, constrained layout
import logo from "./logo.png?layout=fixed&width=120&image"; // 1x/2x
import Icon from "./icon.svg?jsx";                          // component sugar

<ImagePreload image={hero} />
<Picture image={hero} alt="…" priority sizes={{ md: "50vw" }} />
```

- Directives go before the keyword (`?width=320&image`); presets: `?preset=hero&image`. The keyword must be last for the types (`client.d.ts` ambient modules match `*?image` / `*&image` only); `?image&width=320` builds, but the plugin warns and TypeScript reports "Cannot find module".
- Layouts: `fixed` (x descriptors), `constrained` (default), `full-width`.
- `sizes`: string, `"auto"`, or `{ sm…2xl | px | "(media)": value, default }`.
- Art direction: `image={{ "(max-width: 640px)": mobile, default: hero }}`.
- CDN: `cdn("cat.jpg", { cdn: cloudinary({ cloud }), width, height })`.
- Builds inline small `?image` descriptors (JSON ≤ `IMAGE_INLINE_LIMIT` = 1024 chars) into each importing project module (`const x = <frozen descriptor>` on the import line, pre-order transform) → no per-image client chunk; larger ones keep their module. `?jsx` / `?svg` are components, never inlined. Dev unchanged.
- Raw API: descriptors are JSON; `srcset()`, `imageSet()`, `preloadLink()`, `getImage()` (`@rivetjs/compiler/images`).
- Types: add `"@rivetjs/compiler/images/client"` to `compilerOptions.types`.
- Router apps: `rivetRouter({ images })` passes the option through.
- Resume modules: `<Picture …/>` / `<ImagePreload …/>` with constant props compile to plain calls (no region symbol, no image code in resume chunks); props with calls or non-constant bindings (`image={props.image}`, `alt={t()}`) keep a region symbol, whose chunk ships the image markup code ([resumability](resumability.md) "What resumes").
- No client JS otherwise: `Picture` output is static markup; `@rivetjs/runtime/image` resolves to `@rivetjs/runtime/image/dom` in client environments.

### SVG

SVG goes through the same plugin; svgo (a `@rivetjs/compiler` dependency, loaded on the first SVG only) replaces sharp, which SVG never needs.

```tsx
import logo from "./logo.svg?image";            // descriptor: optimised hashed asset + width/height
import LogoImg from "./logo.svg?jsx";            // <img> component (Picture sugar)
import Logo from "./logo.svg?svg";               // inline component
import Mark from "./mark.svg?currentColor&svg";  // paints → currentColor

<Picture image={logo} alt="Acme" />              // <img src="/assets/logo-120-<hash>.svg" width="120" height="40">
<Logo class="h-6 w-auto" title="Acme" />         // <svg viewBox="…" class="…" width="120" height="40" role="img"><title>Acme</title>…
<Mark size={20} style={{ color: "var(--brand)" }} />
```

- Assets (`?image` / `?jsx`): svgo `preset-default`, `multipass`, `floatPrecision: 3`; viewBox kept; ids neither removed nor renamed (external `<use href="sprite.svg#id">` keeps working); `<script>`, `on*` attributes and `javascript:` / `vbscript:` URLs removed (an asset opened directly runs on the page origin). File `<stem>-<width>-<key8>.svg`, key = source + svgo setup. Size: root `width` / `height` (unitless or px), else `viewBox`; `?width=` / `?height=` scale; none → 300×150 + warning. Dev: optimised on request, cached in `node_modules/.rivet/images`.
- Inline (`?svg`): the optimised, sanitised SVG becomes a Rivet component with one static template (server fragment, DOM v2 `_tpl` in client builds and the dev server). Also removed: `<style>` (svgo first inlines its rules into attributes; leftovers such as media queries are dropped with a warning — an in-body stylesheet would need a CSP nonce), `<iframe>` / `<object>` / `<embed>` / …, editor namespaces, `xmlns*`; a `data:` raster in `<image href>` fails the import (Rivet's URL rule) — use `?image`. Ids (and their references) are prefixed `<stem>-<hash5>_` so two inlined SVGs never collide (`?prefixIds=false&svg` keeps them, `?prefixIds=<p>&svg` sets the prefix; class names are never prefixed).
- Inline props: every `<svg>` attribute (`class`, `style` object, `aria-*`, `data-*`, …) after the file's own root attributes; `size` = width + height (viewBox keeps the aspect); `title` → `<title>` + `role="img"`; without `title` / `aria-label` / `aria-labelledby` the SVG is `aria-hidden="true"`. Props are live like every component's (getters, live-props spec): the DOM element spreads `props` in one binding and `title` is a reactive child, so a changing `class` / `size` / `title` updates the element in place.
- `?currentColor&svg`: `fill` / `stroke` / `stop-color` / `flood-color` / `lighting-color` / `color` values other than `none` / `transparent` / `url(…)` become `currentColor`; a root without `fill` gets `fill="currentColor"`.
- Config: `rivet({ images: { svgo } })` / `rivetRouter({ images: { svgo } })` — `false` = sanitise only, or `{ plugins?, multipass?, floatPrecision?, prefixIds? }` (`plugins` replaces the default list; extend it with `svgoPlugins("file" | "inline")` from `@rivetjs/compiler/images`).
- Zero cost: apps importing no SVG load no svgo and ship no extra bytes; an inline SVG costs only its markup + one spread.
- Types: `?svg` / `&svg` modules in `@rivetjs/compiler/images/client`.
- Icons are not SVG imports: use lucide through `@rivetjs/kit/icon` ([kit](kit.md)).
