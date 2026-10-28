# Scoped styles

Compile-time scoped CSS: `css` tagged templates and stylesheet imports go through Vite's CSS pipeline. No runtime style injection, no CSS-in-JS runtime. Design: [spec](../design/specs/2026-10-03-kit-and-scoped-styles-design.md).

## css``

```tsx
import { css, cx } from "@rivetjs/runtime/css";

const styles = css`
  .card { border: 1px solid; }
  .active { background: canvas; }
  .card :global(code) { font-weight: 600; }
`;

export const Card = (props: { active: boolean }) => <div class={cx(styles.card, props.active && styles.active)} />;
```

- Top-level `const x = css\`…\`` only. No interpolation (v1). Non-top-level, interpolated, unknown class (`styles.nope`), assignment → compile errors.
- Instead of interpolation: literal values; dynamic value → custom property on the element (`style={{ "--x": value }}`) read as `var(--x)` in the block; one class per state via `class:active={on}` or `cx(styles.base, on && styles.active)`; or a selector on a `data-*` attribute (`.card[data-size="lg"]` + `data-size={size()}`). Diagnostic text says the same.
- Compiler (Rust, hand-written tokenizer): class + keyframe names scoped, `:global()` / `:local()`, `animation` / `animation-name` rewritten. `@import` / `@charset` / `@reference` hoisted out of the layer.
- `styles.card` folds to a string literal; static `class={styles.card}` becomes part of the template. The object stays only when used as a value (`Object.freeze` map, pure).
- Sheet = virtual module `<file>.rivet.css`, imported by the compiled module: Vite processes it (PostCSS, Tailwind, Lightning CSS, minify), so it ships as part of the route's CSS chunk.
- Names: FNV-1a 64 over `scope\0local`. Dev `readable` `<local>_<hash5>`; build `short` `r<hash6>`. Registry error on collision.
- Output wrapped in `@layer components`; sheets start with `@layer theme, base, components, utilities;` (Tailwind order: utilities beat component styles).
- Uncompiled `css` call throws (`@rivetjs/runtime/css` without the plugin).
- HMR: CSS-only edit → stylesheet update, component state kept; class set change → module update.

## class / style attributes (G10)

- `class:name={cond}`: toggles one class. Server: merged into one `class` attribute. DOM: `classList.toggle`. Resume: one element binding (spread-site protocol, no resume runtime bytes).
- Combines with static / dynamic `class` (or `className`, not both: compile error) and spreads (`_spreadClass` applies toggles to the spread's class). A `style` key inside a spread (`{...{ style: obj }}`, cdk `globalDOMProps`) is a style object with the same semantics as `style={obj}` on server / DOM / resume; style strings in spreads throw at runtime.
- Toggle rule: truthy adds name once; falsy removes every occurrence (`classList.toggle` semantics), applied after the base.
- Literal class objects / arrays in the attribute: `class={{ active: on(), big: true }}`, `class={["a", on() && "b", { c: x }]}`. Normalization (all targets): falsy / `true` skipped, arrays flattened, object → truthy keys; empty → no attribute. Static-key objects compile to toggles; literal-only values fold to a static string.
- `class={string}` output byte-identical to before. A class object passed as a non-literal value (variable, prop) is not normalized → `[object Object]`; dev warning on DOM; use `cx(value)`.
- `cx(...parts)` accepts class values (arrays, objects); string behaviour unchanged.
- `style:prop={v}` (kebab-case or camelCase prop) and `style={{ color: c, marginTop: "1px", "--x": n }}` objects. Later writes win (directives and object keys in source order).
- Custom properties: `style={{ "--x": v }}` only. `style:--x` not parseable as TSX (JSX name segment cannot start with `-`).
- Values: null / undefined / false / true / "" skip the property; numbers get `px` like React (C14, 2026-10-06) except `0`, `--custom` and the unitless list (`style.ts` `UNITLESS` = `styling.rs` `UNITLESS`, React `isUnitlessNumber`, vendor prefixes stripped; literals folded at compile time); strings attribute-escaped on the server.
- DOM / resume: CSSOM `setProperty` / `removeProperty` per property (object keys diffed per run) → works under a strict `style-src` CSP (no `style` attributes from markup). Server: one `style` attribute.
- Style strings (`style="color:red"`, `style={str}`) stay rejected: compile error for literals, runtime `TypeError` for dynamic non-objects; no string parser to validate, CSP-hostile on the client.

### Safety (K3)

- Property names: CSS ident (`-?[a-z][a-z0-9-]*` after camel → kebab) or custom property (`--[\w-]+`). Anything else → compile error (literal key) / `TypeError` (dynamic key).
- Refused values (case / whitespace / control chars ignored): `url(`, `src(`, `image-set(` (incl. `-webkit-`), `expression(`, `javascript:`, `\`, `;`, `{`, `}`, `/*`.
- Static unsafe value → compile error. Dynamic → property dropped at runtime; dev build warns once per property + value.
- Images belong in CSS (a class, or a custom property holding a plain value).

### Pay-per-use

- Helpers in `@rivetjs/runtime/style` (`_class`, `_style`, `_styleValue`, `_bindClass`, `_bindStyle`, `_applyStyle`, `_spreadClass`, …), imported only by modules that use directives / objects — and by the spread helpers (`server-spread.ts`, `_spread` in `dom-v2-spread.ts`), so a bundle pays for them only with spreads. ssr-bench lanes identical.
- Public: `classNames(value)`, `unsafeStyle(value)`, types `ClassValue`, `StyleObject` (also re-exported from `/css`).

## Stylesheet files

- `import "./x.css"` / `.scss` / `.sass` / `.less` / `.styl`: plain Vite CSS (global). Preprocessor = app's own dependency (`sass`, `less`, `stylus`); optional peers.
- `*.module.<ext>`: CSS modules named with the css`` scheme (`css.modules.generateScopedName` set by `rivet()`; app's own setting wins).

## Options

`rivet({ css })` / `rivetRouter({ css })`:

| Option | Default | |
|---|---|---|
| `layer` | `"components"` | Cascade layer of css`` output; `false` unlayered |
| `layers` | Tailwind order | Layer order statement per sheet; `false` none |
| `names` | dev `readable`, build `short` | Class name scheme |
| `reference` | — | Root-relative sheet `@reference`d by every css`` sheet (Tailwind `@apply` / theme) |
| `modules` | `true` | Name `*.module.*` classes like css`` |

## Per-route CSS

- Client build writes `.vite/rivet-route-css.json`: route id → CSS of the route modules' chunk closure (app entry CSS excluded; compiler resume chunks are entries too, but their CSS stays per route). `loadBuild` links it per route (`DocumentInput.styles`: global, then route).
- Inline stylesheets (`rivetRouter({ inlineStylesheets })`, Astro model, default `"auto"`, per page on compressed bytes): client build writes `.vite/rivet-inline-css.json` (candidate sheets with raw + brotli sizes); `auto` inlines all of a page's sheets when their brotli total ≤ 6 KB (`{ maxTotalBrotli }` tunes it), else each sheet ≤ `build.assetsInlineLimit` (4096 raw); `"always"` all, `"never"` none; relative `url()` / `@import` → stays linked. `headTags(head, input)` writes them as `<style data-href nonce>` in their link's place (`data-href` = the URL: preload lists naming the sheet skip it). Inline CSS is re-sent per page (no cross-page cache). CSP: nonce (server) / hashes (static) added to an app-set `style-src(-elem)` without `'unsafe-inline'`.
- Route sheet: a route with several stylesheets (per-component CSS, e.g. `@rivetjs/ui`) links ONE merged asset `assets/route-<hash>.css` (files joined in link order, repeated top-level `@property` / `@keyframes` / `@layer` statements dropped; routes with the same content share it); under route chunks (the default) the route's components share one chunk whose single CSS asset (`assets/routes-<hash>.css`) is the route sheet, no merge needed: a page has 2 render-blocking sheets (global + route).
- Preload lists vs route sheets (ROUTE-CSS 2026-10-28, `build/route-css.ts` `cssDepsPlan` / `rewriteCSSDeps`): a dynamic import's Vite CSS deps drop the host chunk's static-closure CSS; a route page import lists the route's merged sheet instead of the files inside it → resumed first interaction fetches no CSS it was served (linked: Vite's `link[href]` dedupe; inline: `<style data-href>` helper), client navigation fetches the target's ONE route sheet (SSR cascade order), lazily loaded parts still fetch their own CSS before running. Only with the router's default `build.modulePreload`. Navbar story first press, 400 ms RTT: 830 → 75 ms.
- Lazy parts vs route sheets (CSS-LAZY 2026-10-28): a lazy import's remaining CSS that a merged route sheet of a route reaching the importer holds is checked at run time (`__rivet_sheets__`: skipped when the page has that sheet as `<link rel=stylesheet>` / `<style data-href>`, by file name; ≤ 4 sheets per call, most-shared first) → no duplicate fetch / cascade re-append on the route that has it, still fetched on routes (or after client navigation) that do not. Fixture layout drawer, 400 ms RTT, JS warm: 471 → 64–78 ms, CSS 2 → 0. Route module owners prefer the module over its `?rivet-lite` copy (the copy once dropped that module's CSS from the route list).
- Dev: route's SSR-graph stylesheets linked with `?direct` (no FOUC); dev entry removes them after mount (Vite injects its own).
- Client navigation: Vite's CSS preload for the route chunk.
- Apps without css`` / modules: no manifest, output unchanged.

## Deferred

- Compile-time constants in css``, `@scope`, class-table inlining of `.module` maps, library sidecar CSS.
- Critical CSS inlining for apps (compiler / router build). The docs sites already do it as a docs-kit build step on their prerendered pages (`libs/docs-kit/tools/critical-css.ts`), not through this pipeline.
