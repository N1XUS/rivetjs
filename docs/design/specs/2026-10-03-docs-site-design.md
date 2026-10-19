# Documentation site (design)

Status: proposed 2026-10-03. Engine extracted to `libs/docs-kit` (`@rivetjs/docs-kit`) 2026-10-05: tools, components, shared routes; apps hold `site.config.ts`, `api.config.ts`, `content/`, `examples/`, own routes. Site at `apps/docs`, built with Rivet: file routes, static prerender, Tailwind. Inputs:
- [router](2026-10-03-router-design.md)
- [resumability](../../guides/resumability.md)
- [Vite](../../guides/vite-integration.md)
- [routing](../../guides/routing.md)
- [i18n](2026-10-03-i18n-design.md)
- [images](2026-10-03-images-design.md)
- [async streaming](2026-10-03-async-streaming-design.md)
- [dev builds](2026-10-03-dev-builds-design.md)
- [SSR-first restart](2026-10-02-rivet-ssr-first-restart-design.md) (Lighthouse 100 target, JSDoc on every public export)
- `apps/playground` (document shell, routes, Tailwind, Lighthouse/latency scripts)

## Goals
- Plain-language docs. Every concept is explained before its name is used. Examples come first.
- Live examples run as real Rivet production builds in iframes. Each one opens in StackBlitz. Starter templates exist.
- Sections: learn, guides, recipes, best practices, gotchas, errors, generated API reference, examples gallery.
- The site dogfoods Rivet: static prerender for every page, resumable widgets, no client app runtime on content pages.
- The site has room for upcoming features: slots, images, i18n, DevTools, component kit, CDK, accessible primitives, scoped styles.
- Budgets are measured, not claimed: Lighthouse 100 ×4 on representative pages, and only the resume loader runs before the first interaction.
- Each claim on the site is backed by a test (example behaviour, byte counts, links, snippets compile).

## Non-goals (v1)
- Comments, accounts, a feedback backend (link to GitHub issues instead).
- Translated docs. Later, as an i18n dogfood (Phase 4).
- Hosted server-side example runner. Examples that need a server run in StackBlitz only (see Examples).
- Versioned archives before the first npm release.

## Information architecture
- Top bar: Learn · Guides · UI · Reference · Examples · Search (`/`) · version · theme · GitHub.
- Left nav per top section. Right "On this page" table of contents. Prev/next at the page foot.
- Status badge on every page and nav item: `stable` | `experimental` | `planned`. Planned pages are short stubs: what the feature will do, a link to its spec/issue, and no invented API.

### Nav tree (MVP pages = **M**)
- `/` Home **M**: one-sentence pitch, live counter example with a "what loaded" strip, three ideas in plain words, "Try in browser" (StackBlitz starter), install command.
- Start
  - `/start/what-is-rivet` **M**: the problem, how Rivet answers it, when not to use it.
  - `/start/quick-start` **M**: `npm create rivet` / StackBlitz, first edit, build, preview.
  - `/start/tutorial/` **M** (1–6), later 7–10. One small app ("Reading list"); each step has a start StackBlitz link and a checkpoint example.
    1. A page
    2. Components and props
    3. State that changes (signals)
    4. Lists
    5. Input and forms
    6. Pages and layouts
    7. Loading data
    8. Saving data (actions)
    9. Styling
    10. Publishing
  - `/start/project-structure` **M**
  - `/start/editor-setup`: `jsx: preserve`, `jsxImportSource`, types.
  - `/start/coming-from/{react,vue,solid,qwik,svelte}`: mapping tables, differences, gotchas.
- Learn (concepts: how Rivet works)
  - `/learn/server-first` **M**: HTML comes finished from the server.
  - `/learn/resuming` **M**: the browser picks up where the server stopped. Explains hydration only as the contrast.
  - `/learn/signals` **M**: values that remember who reads them. Components run once.
  - `/learn/rendering-modes` **M**: server, static, browser-only (CSR); a decision table.
  - `/learn/loading-code`: when code loads (intent, visible, idle); prefetch vs run.
  - `/learn/compiler`: what compile does, two outputs (server/browser), why the output is opaque.
  - `/learn/ownership`: lifetimes and cleanup; why context does not cross `await`.
  - `/learn/server-and-browser-code`: `.server.ts`, service pairs, what may cross.
- Guides (tasks)
  - Components: `components` **M**, `events` **M**, `lists` **M** (`For`), `conditional`, `forms-and-input` **M** (`model:`), `refs`, `context`, `async` (`Async`, `lazyComponent`, streaming), `browser-only` (`clientOnly`, `clientEffect`, `clientEvent`, `window:`/`document:`), `slots` (planned).
  - State: `signals`, `computed`, `effects`, `batching`, `equality`.
  - Routing: `file-routes` **M**, `layouts` **M**, `params`, `links-and-navigation`, `loading-data` **M**, `guards`, `actions-and-forms` **M**, `errors-and-404`, `head-and-seo`, `headers-and-caching`, `typed-routes`.
  - Styling: `css-and-tailwind` **M**, `scoped-styles` (planned).
  - Assets: `images` (planned → experimental).
  - Languages: `i18n/translating-text`, `i18n/plurals-and-formatting`, `i18n/locale-urls`, `i18n/static-multilingual` (planned).
  - Performance: `preloading`, `chunks` (`component`/`island`/`route`), `streaming`, `measuring`.
  - Security: `csp`, `trusted-types`, `server-only-code`.
  - Tooling: `dev-server-and-hot-reload`, `devtools` (planned), `debugging-resume`, `testing`.
  - Deploy: `node` **M**, `docker`, `static-hosts` **M**, `single-page-apps`.
- UI (planned; one section with three tabs that share the component page template)
  - `/ui/kit/*`: styled components (Button, Dialog, Menu, Tabs, Combobox, Toast…).
  - `/ui/accessible/*`: unstyled accessible components and behaviours (react-aria-like). Each page has a keyboard table, roles, and screen-reader notes.
  - `/ui/cdk/*`: low-level primitives (overlay/portal, focus trap, live announcer, selection model, keyboard list navigation, virtual scroll, drag and drop, breakpoints).
  - `/ui/overview`: which layer to pick (kit = ready-made; accessible = bring your styles; CDK = build your own).
- Recipes `/recipes/*` (task-sized, one example each): dark-mode toggle, search with debounce, paginated list from URL params, infinite list, modal dialog, toast, protected pages (guard + cookie), login form, file upload, optimistic like, form validation, REST service pair with cancel, live updates (WebSocket in `clientEffect`), sticky header on scroll, canvas chart, analytics page views, markdown blog (static), sitemap and RSS, language switcher (planned), responsive hero image (planned).
- Best practices `/best-practices/*`: keep secrets in `.server.ts`; pass data, not services; small state close to use; keep captures serializable; pick preload by impact; links and forms work without JS; accessibility checklist; performance budgets; structuring large apps; error handling.
- Gotchas `/gotchas/*`. One short page each, linked from errors and search. **M** = first 8.
  - "My component didn't run again" (components run once) **M**
  - "Function is not serializable" **M**
  - "`window` is not defined" (browser globals in component body) **M**
  - "Context is gone after `await`" **M**
  - "Dev server pages don't resume" **M**
  - "`history.pushState` doesn't update the router" **M**
  - "Spread props / `style` attribute not supported" **M**
  - "A promise child needs `Async`" **M**
  - "HTML changed before resume (drift)"
  - "New deploy while a page is open (skew)"
  - "`computed` outside a resumed module"
  - "Translated value used as a string on the server"
  - "Changing built-ins is unsupported"
- Errors `/errors/<code>`: one page per compiler diagnostic and dev hint (code, the message as printed, cause, fix, before/after). Dev hints link here (dogfood item D14).
- Reference
  - `/api/<package>/<entry>/<symbol>` **M** (generated, see API reference).
  - `/reference/file-conventions` **M**: route file names, `_layout`, `_404`, `_error`, `.server.ts` exports.
  - `/reference/jsx` **M**: attributes, `model:`, `window:`/`document:`, `preload=`, `ref`; unsupported forms.
  - `/reference/config`: `rivet()`, `rivetRouter()`, `resume`, `images`, `i18n` options (generated from option interfaces).
  - `/reference/cli` (`create-rivet`), `/reference/browser-support`.
  - `/reference/glossary` **M**: every term with a plain definition, linked on first use.
- Examples `/examples` **M**: gallery of every example, filterable by tag/status.
- Project `/about/*`: roadmap (status of upcoming features), benchmarks (summary with links to raw results; losses shown), changelog, versioning policy, contributing.

## Content pipeline
- Prose is Markdown in `apps/docs/content/**.md`. Frontmatter schema (TS type, validated at build):
  - `title`, `description` (≤ 160 chars; used as meta description), `template`, `status`, `since?`, `order`, `tags[]`, `related[]`.
- `@docs/content` Vite plugin (in `libs/docs-kit/tools/content`):
  - parses the Markdown (remark + `remark-directive`), checks it, and emits a **TSX module** (static JSX plus imports of docs components). The Rivet compiler then hoists the whole page into static fragments, so pages ship no JS for prose.
  - Directives:
    - `::example{id=counter height=sm files="src/routes/index.tsx"}`
    - `:::note` / `:::warning` / `:::gotcha{id=…}`
    - `::api{symbol="@rivetjs/reactivity#signal"}` inline signature card
    - `:term[resume]` glossary link with hover definition
    - `::status{planned}`
  - Code blocks are highlighted at build with Shiki and emitted as JSX `<span class="tok-…">` tokens. No `style` attributes: the compiler rejects them (D4). Theme colours come from a generated CSS file, with light/dark variants as CSS variables on classes. Line highlight and diff notation use `// [!code highlight]` / `// [!code ++]`.
  - Headings get stable slugs, collected into the TOC and the search metadata.
  - `title`/`description`/canonical/`og:*` come from the route `head` export.
- Routes: one route module per Markdown file. Two options exist:
  - Router `pageExtensions: [".md"]` plus compiler `include` (D1, D2). Recommended: real routes, per-file chunks, codegen types.
  - Fallback without router changes: `[...slug].tsx` + `[...slug].server.ts` `entries()` over the content glob.
- Navigation data: `content/_nav.ts` holds an explicit order. Build fails on orphans (a file not in nav) and on dangling nav entries.
- Downloadable Markdown: `/<path>.md` raw copy for every page, plus `/llms.txt` (index) and `/llms-full.txt`. Cheap, and useful for AI tools.

## Page templates
Required sections per template are checked by the content lint. Every template ends with "Related" and "Next".
- **Home**: hero line, live example, 3 ideas, start links.
- **Tutorial step**:
  - goal (1 sentence)
  - "Start here" StackBlitz link (state of the previous step)
  - numbered steps, each with code
  - checkpoint example (finished state)
  - what you learned (≤ 3 bullets)
  - next step
- **Concept** (Learn): example → plain explanation → term named → how it works (diagram optional, inline SVG) → limits → related guides.
- **Guide**: task title ("Load data for a page") → smallest example → steps → options → gotchas → API links.
- **Recipe**: problem (1–2 sentences) → example → how it works → variations → related.
- **Best practice**: rule (1 sentence) → why → do/don't code pair → exceptions.
- **Gotcha**: symptom (what you see) → why it happens → fix (before/after) → related error code.
- **Error**: code + message as printed → meaning → common causes → fixes → example.
- **API symbol** (generated):
  - summary
  - "runs on" badge (server / browser / both)
  - status, since
  - signature
  - parameters table, returns
  - examples (linked example ids)
  - related guides (reverse links from `::api` usage)
  - source link
- **Component** (UI): live demo → anatomy → usage → variants → accessibility (keyboard table, roles, labels) → styling hooks → API table.
- **Planned stub**: what it will let you do → current status → spec link → "what to use today".

## Content style guide
- Audience: web developers who know HTML/JS. They may not know SSR, signals or bundlers.
- Tone: direct, calm, second person ("you"), present tense. No hype: no "blazing", "magic", "simply", "just", "obviously", "easy".
- Sentences:
  - one idea each, about 15 words on average and at most 25;
  - active voice;
  - the subject comes first;
  - paragraphs are at most 3 sentences;
  - use lists for steps.
- Concept before term: describe what happens in plain words first, then name it in bold, then link the glossary. Example: "The browser picks up where the server stopped and doesn't run your components again. Rivet calls this **resuming**."
- Term rules:
  - first use per page links to the glossary;
  - expand acronyms on first use ("rendered on the server (SSR)");
  - one name per concept, site-wide (glossary is canonical: "resume", not "rehydrate"; "signal", not "atom").
- Example-first: every Concept/Guide/Recipe page shows a runnable example in its first screen, before any explanation.
- Code:
  - complete and runnable, or clearly marked a fragment;
  - real names (`count`, `items`), no `foo`;
  - comments say why, not what;
  - TS by default.
- Honesty:
  - performance statements link to measured data;
  - experimental and planned features are labelled;
  - limits are stated on the page that sells the feature;
  - losses in benchmarks are shown.
- Headings: sentence case; task headings start with a verb ("Protect a page").
- Links: descriptive text (no "click here"). Internal links are relative to the version root.
- Readability gate: grade ≤ 9 (Start/Learn), ≤ 11 (Guides/Reference prose). Checked by the lint, which warns and does not block until the baseline is clean.
- Lint: Vale with a project style (banned words, acronym expansion, sentence length, heading case, glossary terms) plus a custom check that terms are defined before use.
- Glossary seed (plain definitions; the glossary page holds the canonical wording):
  - signal (a value that tells its readers when it changes)
  - computed (a value worked out from signals, recomputed only when they change)
  - effect
  - component (a function that returns markup; runs once)
  - server rendering / SSR
  - static prerender (pages rendered to files at build)
  - browser-only rendering / CSR
  - resume (the browser continues from server HTML without re-running components)
  - hydration (the approach Rivet avoids: re-running components in the browser)
  - loader (code that fetches page data on the server)
  - guard (code that decides if a request may continue)
  - action (server code that handles a form post)
  - layout, route, chunk (a file of code the browser loads on demand)
  - preload (fetching code before it is needed)
  - capture (a value a handler remembers from the server)
  - region, island (a group of components whose code ships together)
  - owner (what cleans up effects and listeners)

## Example system
### Authoring (one source → code view + live iframe + StackBlitz)
- `apps/docs/examples/<id>/`: a complete Rivet app, minus the shared template:
  - `example.ts` → `defineExample({...})`:
    - `title`, `summary`, `tags[]`, `status`
    - `mode: "static" | "csr" | "server"`
    - `frame: { height: "xs"|"sm"|"md"|"lg"|"xl" | number, auto?: boolean, width?: "full"|"phone", theme?: boolean }` (`auto`, 2026-10-08: the frame follows its page's posted content height, starting from `height`)
    - `show: string[]`: files in the code tabs, in order
    - `focus?: { [file]: "region-name" }`
    - `test: Step[]`
    - `stackblitz?: { file, start: "dev"|"preview" }`
  - `src/routes/**`, `src/**`: example code; only what the example teaches.
  - `// #region demo` … `// #endregion` marks focus regions. The code tab shows the region first, with an expander to the full file.
- `apps/docs/examples/_template/`: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/document.ts`, `src/styles.css`, `serve.js`, `.stackblitzrc`, `README.md`. These are merged under each example and are never shown in the code tabs. A file in the example dir overrides the template file.
- Multi-step tutorials: `examples/tutorial-03-start`, `examples/tutorial-03-done`; the generator diffs them to emit the "changes in this step" view.
- Fenced code blocks that are not examples are typechecked (`tsx` blocks by default; `nocheck` opts out) and compiled through the Rivet compiler to catch unsupported syntax.

### Build (`libs/docs-kit/tools/examples.ts`, Nx target `docs:examples`, cached per example input hash)
- For each example:
  1. materialize template + example into `.artifacts/docs/examples/<id>/`
  2. `vite build` (client + SSR) with `base: "/<id>/"` (D6)
  3. `prerenderBuild` → `dist/examples/<id>/`
  4. Playwright run: the `test` steps, plus measurement.
- One build per example (not one combined app). The iframe runs exactly the project StackBlitz opens. Builds run in parallel up to `availableParallelism()`.
- Emits `examples.json` per example:
  - files (path, source, highlighted tokens, focus ranges)
  - frame size
  - measured facts
  - StackBlitz URL / payload
  - status
- `mode: "server"` examples (guards, actions, cookies): build + test run against the node adapter in CI. The docs show Code + StackBlitz. In place of the preview, the page says "This example needs a server. Run it in StackBlitz". Static hosting cannot run it (open question Q4).

### Docs-side frame (`<Example>` component, resumable)
- Tabs: Preview | Code (one tab per `show` file) | Server HTML (formatted prerendered HTML, so readers can see the markers and state script).
- Toolbar: reset (reloads the iframe), width toggle (full / 375 px), open in new tab, open in StackBlitz, copy code.
- iframe:
  - `loading="lazy"`
  - height from `frame` (xs 96, sm 180, md 320, lg 480, xl 640 px) reserved before load, so there is no layout shift; `auto` frames then follow their content (2026-10-08, `libs/docs-kit/frame-theme.ts`)
  - `title` = example title
  - `sandbox="allow-scripts allow-forms allow-popups allow-same-origin"`, served from a **separate origin** (`examples.<domain>`, Q3), so example code can't reach the docs origin's storage or DOM
  - `referrerpolicy="no-referrer"`; cross-origin, so no shared cookies with the docs origin.
- Above-the-fold examples (home) use `loading="eager"` and count in the Lighthouse budget.
- Without JS:
  - tabs are server-rendered with the Preview panel visible;
  - the code panels are `<details>` fallbacks;
  - the StackBlitz button is a plain link.

### Showing resumability honestly
- The "What loaded" strip under each preview shows numbers **measured at build** in Chromium (Playwright, cold cache, brotli):
  - before interaction: inline bytes (loader + state), module requests (expected 0);
  - after the first scripted interaction: requests and bytes, by file kind (runtime / shared / component chunk);
  - CSR examples: JS before first paint.
- The text says "measured at build in Chromium, cold cache; your browser may already have these files cached". Numbers are never hand-written.
- Test gates for claims: a resume example fails the build if it makes module requests before interaction or runs a component in the browser (`__componentRuns` counter, as in playground tests). A CSR example is labelled "browser-rendered".
- Reset reloads the iframe, which does not clear the HTTP cache. The strip notes that, and "open in new tab" plus DevTools Network is the suggested manual check (linked guide `/guides/performance/measuring`).
- Dev-vs-prod: previews are always production builds. StackBlitz `dev` starts the dev server, where pages don't resume. The template README and the frame tooltip say so, and `npm run preview` shows resuming.

### Frame height check
- Playwright measures the example's `scrollHeight` at 375/768/1280 widths. The build fails if content overflows the declared frame (no inner scrollbars by accident).

## StackBlitz integration
### Launch
- Released docs: plain link `https://stackblitz.com/github/<org>/rivet-examples/tree/v<version>/<id>?file=<focus file>`. Zero JS, version-pinned, works without JS.
- `next` docs (unreleased): a resumable click handler fetches `/<id>/stackblitz.json` and posts a form to StackBlitz's POST project API (`https://stackblitz.com/run`, files + `package.json` pinned to the preview package build). The GitHub link stays as the fallback href. No `@stackblitz/sdk` dependency; revisit if embeds are wanted.
- No inline StackBlitz embeds: they are heavy, they hurt the Lighthouse budget, and the iframe preview covers "see it run".
- `.stackblitzrc`: `{ "installDependencies": true, "startCommand": "npm run dev" }`. Per-example `start: "preview"` runs `npm run build && npm run preview` so the reader sees resuming.

### Templates and mirror repo
- Source of truth in monorepo `templates/` (outside workspace globs; depends on published versions), Q10.
  - `templates/starter-static`: static adapter, Tailwind, 2 routes, one interactive island. Default for "Try in browser".
  - `templates/starter-server`: node adapter, loader + action, `serve.js`, Dockerfile.
  - `templates/starter-spa`: csr adapter.
  - `templates/starter-minimal`: one route, no Tailwind.
- The same templates are used by `create-rivet` (D20) and by the docs examples' `_template` (the static starter's config files).
- CI on release tag: generate `<org>/rivet-examples` (`examples/<id>/` materialized, `starters/<name>/`), commit, and tag `v<version>`.
- Mirror repo layout:
  - `README.md` (index with StackBlitz links)
  - `starters/*`
  - `examples/<id>/{package.json, vite.config.ts, tsconfig.json, .stackblitzrc, README.md, src/**}`

### WebContainers constraints and feasibility (Phase 0 spike S1)
- Rust/WASM compiler:
  - the compiler is a prebuilt `rivet_compiler.wasm` (2.6 MB, no WASI imports, `new WebAssembly.Module(readFileSync(...))` in `libs/compiler/wasm.ts`);
  - WebContainers run Node in web workers with full WebAssembly, and synchronous compile of large modules is allowed off the main thread → expected to work;
  - no Docker or Rust toolchain needed (prebuilt artifact ships in the package);
  - verify: sync module creation for the 2.6 MB module, and cold transform time.
- Blockers to fix before any StackBlitz link works:
  - Packages are `private: true` and unpublished: publish under an npm dist-tag `experimental` (or pkg.pr.new per commit for `next` docs). Q9.
  - Package `exports` point at `.ts` sources. Node refuses type stripping inside `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), and WebContainer Node may predate type stripping. So publish compiled `.js` + `.d.ts` (D19). `#dev` conditional imports must survive the build.
  - `engines.node >= 24`: the WebContainer Node version is fixed by StackBlitz (historically 18/20; verify current). Audit the runtime/router/compiler for Node 24-only APIs on the build/dev path, or document a lower supported floor for tooling. CI smoke runs on the WebContainer Node version.
  - Starters' server entry must be plain JS (`serve.js`). The playground runs `server.ts` through type stripping.
- Third-party native code (verify each in S1):
  - Vite 8 / Rolldown: native binding → `@rolldown/binding-wasm32-wasi` fallback (needs SharedArrayBuffer; WebContainers are cross-origin isolated).
  - Tailwind v4 oxide → WASI fallback.
  - esbuild → `esbuild-wasm` (StackBlitz substitutes).
  - `sharp` (images): native. Needs `@img/sharp-wasm32`, or a passthrough `processor` when `process.versions.webcontainer` is set (D17). Image examples may run degraded in StackBlitz; say so in the frame.
  - Brotli in `node:zlib` (node adapter compression): verify; `compress: false` fallback.
- Spike S1 exit:
  - starter-static and one resume example install, `dev` with HMR, `build` + `preview` resume (zero module requests before click), in Chromium, Firefox and Safari via StackBlitz;
  - cold install + first page time recorded.
- CI (nightly, non-blocking at first): Playwright page using `@webcontainer/api` boots each starter from the packed tarballs and runs `build`. WebContainer API licensing for OSS to be confirmed. Fallback: manual release checklist.

## Search
- Pagefind over the prerendered `dist` (post-build step).
  - Static chunked index plus a WASM search core, both loaded only when search opens.
  - Index weights: `title` > headings > body.
  - Filters: section, package, status.
  - API symbols carry `data-pagefind-meta` (kind, package).
  - Example iframes, nav and footers are excluded (`data-pagefind-ignore`).
- UI is a Rivet component (dialog), not Pagefind UI.
  - Trigger button + `/` and Cmd/Ctrl-K via `document:onKeydown` (resumable).
  - The search module is `clientOnly(..., { when: "interaction" })`, prefetched on intent over the search button.
  - Results are keyboard navigable (listbox pattern; later reuses the CDK/accessible primitives).
- Excerpts: Pagefind returns HTML with `<mark>`. Render by splitting on the mark tokens into text + `<mark>` JSX nodes (no raw HTML sink, D3).
- Per-version index (each version build has its own `/pagefind/`).
- Without JS: the search button links to `/search?q=` with a no-JS fallback page (a site-scoped web search link). Low priority.

## Versioning
- Now (pre-release): one build from `main`.
- From the first npm release:
  - `<domain>` = latest release (built from the tag);
  - `next.<domain>` = `main`;
  - both show a version badge; `next` has an "unreleased" banner.
- From 1.0:
  - each major is frozen at `/v<N>/` (path prefix via router base, D6);
  - `/versions.json` drives the switcher;
  - the switcher maps to the same path if it exists, else to the section root;
  - old versions show a banner and `rel=canonical` to the latest equivalent page;
  - old builds are kept as static folders, never rebuilt.
- Page-level: frontmatter `since`, `status`. API: JSDoc `@since`, `@experimental`, `@deprecated` (D15). Changelog page from release notes.
- Examples and StackBlitz links are pinned to the docs version (mirror repo tag).

## API reference generation
- Source: TS types + JSDoc (every public export already needs JSDoc, per the restart spec).
- Tool: TypeDoc `--json` (packages mode; entry points = each package's `exports` map) → normalizer (`tools/api-model.ts`) → compact `api.json`. Q6.
  - Model fields:
    - `package`, `entry` (`@rivetjs/runtime/dom`)
    - `name`, `kind`, `signatures[]` (formatted text with linked type refs)
    - `summary` (first sentence), `remarks`
    - `params[] {name, type, optional, default, doc}`
    - `returns`
    - `examples[]` (example ids via `@example <id>`, or inline code)
    - `runsOn` (derived from the entry: `/server` → server, `/dom`/`/client` → browser, others → both)
    - `status`, `since`, `deprecated`
    - `source` (repo URL + line)
- Excluded: `_`-prefixed exports (`_warmLazy`, `_adopt`, `_withNode`…) and `@internal`. Lint fails if an un-prefixed export lacks a summary.
- Pages: route `api/[...symbol].tsx` + `.server.ts` with `entries()` from `api.json`. Package and entry index pages list symbols grouped by kind, with summaries.
- Config reference from option interfaces (`RivetRouterOptions`, `RivetResumeOptions`, images/i18n config), rendered as option tables with defaults (`@default`).
- `api.json` is snapshotted in the repo. Changes show in PR diffs as a public-API report (API Extractor-like, without that tool).
- `@example` code blocks are typechecked like other snippets.
- Errors catalogue generated from compiler diagnostic codes + `DEV.hint` keys (D14). Hand-written explanation per code; build fails when a code has no page.

## Visual design and site shell
- Tailwind v4 via `@tailwindcss/vite` (as in the playground). System font stacks (no web-font bytes). Content max ~70ch. Light/dark from `prefers-color-scheme`.
- Theme toggle: a resumable handler stores the choice in `localStorage`. A small inline no-flash script in the document shell is covered by the static CSP hash.
- Layout:
  - desktop: three columns;
  - mobile: nav in a `popover`/`<details>` drawer (works without JS), TOC collapsed.
- Navigation between pages: full document loads (MPA), plus:
  - Speculation Rules (`<script type="speculationrules">`) for prerender on hover (D8);
  - CSS cross-document view transitions;
  - no client router runtime on content pages (Q2).
- Interactive parts (all resumable, code loads on intent):
  - theme toggle, search, example tabs/toolbar, copy buttons, TOC active heading (`clientEffect` with IntersectionObserver at `idle`), mobile nav.
- Diagrams: inline SVG JSX (supported). Screenshots: image optimisation once it ships (`?image`); until then, pre-optimised WebP/AVIF with width/height.

## App location and structure
```
apps/docs/
  package.json, project.json, vite.config.ts, tsconfig.json, README.md
  content/**.md, content/_nav.ts
  src/document.ts, src/styles.css
  src/routes/            index.tsx, api/[...symbol].tsx(+.server.ts), examples/index.tsx, search.tsx, _layout.tsx, _404.tsx (+ .md pages via D1)
  src/components/        Example, CodeBlock, Callout, ApiCard, Term, Nav, Toc, Search, ThemeToggle, StatusBadge
  examples/_template/, examples/<id>/
  tools/                 content/ (md → tsx plugin), examples.ts, api-model.ts, check-links.ts, check-content.ts, lighthouse.ts, mirror.ts
  tests/                 *.test.ts (node --test + Playwright)
templates/               starters (Q10)
```
- Router `mode: "static"`. Output: `dist/client` (site) + `dist/examples` (examples origin) + `dist/pagefind`.
- Nx targets (all `nx:run-commands`, `implicitDependencies: compiler, runtime, reactivity, router` + later libs):
  - `docs:dev`, `docs:examples`, `docs:api`, `docs:build` (depends on examples + api)
  - `docs:check` (links, content lint, snippets, nav)
  - `docs:test` (Playwright), `docs:lighthouse`, `docs:mirror` (release only)
- Root scripts: `dev:docs`, `build:docs`.

## Deployment
- Static host with custom headers, redirects, brotli, PR previews, and two origins: Cloudflare Pages recommended (Q7).
  - Docs project → `<domain>`; examples project → `examples.<domain>`.
  - `_headers`:
    - `/assets/*` `Cache-Control: public, max-age=31536000, immutable`
    - HTML `no-cache`
    - `X-Content-Type-Options`, `Referrer-Policy`
    - examples origin adds `Cross-Origin-Resource-Policy: cross-origin` for framing and a `frame-ancestors <domain>` CSP
  - CSP: per-page `<meta>` from `hashCSP` (already in the static adapter). `frame-src examples.<domain>`. Also `https://stackblitz.com` in `form-action`.
  - `_redirects`: moved pages (kept forever), `/docs/* → /*` style aliases. Generated from frontmatter `aliases[]` (D10).
  - `404.html` from the router `_404` (exists).
- CI (GitHub Actions):
  - PR: build + check + test + Lighthouse on the preview URL.
  - `main` → `next.<domain>`.
  - Release tag → `<domain>` + mirror repo + version folder (post-1.0).
- Trailing slash: canonical `/path/` (prerender writes `path/index.html`). Internal links are normalized by the link checker. The host redirects `/path` → `/path/`.

## Testing
- Build gates (fail the build):
  - any compiler diagnostic
  - frontmatter schema
  - unknown example id / API symbol / glossary term
  - nav orphans
  - missing template sections
  - missing error-code pages
- Links: crawler over `dist` checks internal links + `#anchors` + iframe `src` + StackBlitz URLs (format). External links checked weekly in a non-blocking job (allowlist + retry).
- Snippets: every `tsx`/`ts` block and `@example` is typechecked (tsc against workspace packages) and compiled with the Rivet compiler (both targets).
- Examples:
  - each builds;
  - Playwright `test` steps pass;
  - no console errors;
  - resume claims verified (no module requests before interaction, no component runs);
  - frame height fits at 3 widths;
  - measured numbers written to the manifest;
  - template materialization installs from packed tarballs and builds in plain Node (blocking);
  - WebContainer boot (nightly).
- API: doc coverage gate, `api.json` snapshot diff, example type checks.
- Accessibility: axe-core on one page per template plus the search dialog. Keyboard tests: skip link, nav drawer, search open/navigate/close, tabs (arrow keys), focus return.
- Lighthouse (`tools/lighthouse.ts`, reuses `apps/playground/lighthouse.ts` approach): pinned Chrome + Lighthouse, 3 cold runs, median, mobile + desktop.
  - Pages: home, one guide with 2 examples, one API page, examples gallery, 404.
  - Budgets:
    - Performance / Accessibility / Best Practices / SEO = 100 (fail < 100 on the median)
    - LCP ≤ 1.8 s mobile (simulated) / ≤ 0.8 s desktop
    - TBT ≤ 50 ms, CLS ≤ 0.01
  - Byte budgets (brotli, checked from build output, deterministic, blocking):
    - JS before interaction ≤ 2.5 KB (resume loader inline; no module requests)
    - CSS ≤ 20 KB
    - HTML ≤ 40 KB per guide page (API index pages ≤ 80 KB)
    - search on first open ≤ 120 KB (Pagefind core + first index chunks)
- Visual regression: not in v1 (later, per template, Playwright screenshots).

## Phased plan
- **Phase 0, spikes (each with a go/no-go note):**
  - S1 WebContainer boot (section above)
  - S2 Markdown → TSX through the compiler (Shiki class tokens, 500-page build time, page HTML size)
  - S3 example build with `base` path + prerender + measurement harness
  - S4 Pagefind on prerendered output + Rivet dialog
  - S5 TypeDoc JSON from `.ts` export maps (current packages)
- **Phase 1, MVP:**
  - shell (layout, nav, TOC, theme, search, 404)
  - content pipeline, example system (~15 examples), API reference for `reactivity`, `runtime`, `router`, `compiler/vite` options
  - **M** pages (~35): home, Start (what-is, quick start, tutorial 1–6, structure), Learn ×4, Guides ×12, gotchas ×8, file conventions, JSX reference, glossary, examples gallery
  - CI gates (build, links, snippets, examples, byte budgets, Lighthouse), deploy `next.<domain>`
  - StackBlitz via POST against pkg.pr.new (or experimental npm tag)
- **Phase 2, depth:**
  - recipes ×12, best practices ×10, all remaining guides, errors catalogue (needs D14)
  - tutorial 7–10, coming-from pages
  - starters + `create-rivet` + mirror repo + GitHub-link StackBlitz, first release → latest/next split
  - `llms.txt`, Markdown copies
- **Phase 3, upcoming features (as each lands, docs ship in the same PR series; stub pages exist from Phase 1):**
  - images, i18n, slots, scoped styles, DevTools
  - UI section: overview + component template; CDK, accessible primitives and kit pages, each component with live examples and keyboard tables
  - search results move to the accessible listbox primitive
- **Phase 4, scale:**
  - versioned archives at 1.0
  - translated docs (dogfood i18n: `[[lang]]` routes, static multilingual, hreflang)
  - visual regression
  - optional hosted runner for `mode: "server"` examples

## Dogfooding: framework features the site needs (may not exist yet)
| # | Need | Today | Used for |
|---|---|---|---|
| D1 | Router page extensions (`.md` pages) or programmatic routes | scanner accepts `.tsx`/`.jsx` only | content routes |
| D2 | Compiler plugin `include` (compile transformed non-`.tsx` ids) | compiles `.jsx`/`.tsx` by filename | md → tsx |
| D3 | Rich text without raw HTML: JSX from tokens, or an explicit trusted-HTML sink (Trusted Types aware) | raw HTML is a diagnostic | Pagefind excerpts, possibly Shiki |
| D4 | `style` attribute (object or string, escaped) | rejected as unsafe | frame sizes, syntax colours; image placeholders need it too |
| D5 | Spread props/attributes | diagnostic | docs components; critical for UI kit/aria pass-through |
| D6 | Router/static `base` path | none | examples at `/<id>/`, `/v<N>/` archives |
| D7 | Global "no client navigation" (MPA) mode | per-link `data-rivet-reload` only | content pages without the router runtime |
| D8 | `hashCSP` covers `speculationrules` scripts (or emits `'inline-speculation-rules'`) | hashes executable scripts only | prerender on hover |
| D9 | Head: JSON-LD, `og:image`, robots per page; sitemap + robots.txt from the static adapter | meta/links only; no sitemap | SEO |
| D10 | Static adapter emits host files (`_headers` from route `headers()`, `_redirects` from aliases) | none | deploy |
| D11 | Parallel prerender | sequential loop | ~500-page build time |
| D12 | Named slots (layout regions: sidebar, toc, actions) | planned | page templates, component docs |
| D13 | Library helper for artifact/byte reports (now in `apps/playground/build.ts`) | app code | "what loaded" strip, budgets |
| D14 | Stable diagnostic codes + doc URLs in compiler diagnostics and `DEV.hint` | free-text messages | errors catalogue |
| D15 | JSDoc convention: `@since`, `@experimental`, `@internal`, `@example <id>` | not defined | API status badges |
| D16 | Test utilities (render + interact, resume assertions like `__componentRuns`) as a package | per-repo test code | example tests, Guides/testing page |
| D17 | Images `processor` fallback without `sharp` | sharp required | StackBlitz image examples |
| D18 | Accessible primitives (dialog, listbox, tabs, popover) | planned (CDK/aria) | search, tabs, nav; docs use local versions until then |
| D19 | Published packages: compiled JS + `.d.ts`, `#dev` preserved, npm dist-tag | private, `.ts` exports | StackBlitz, starters |
| D20 | `create-rivet` CLI | none | quick start |
| D21 | Node version floor for tooling compatible with WebContainers | `>=24` | StackBlitz |
| D22 | DevTools (inspect regions, signals, chunks) | planned | debugging guide, "what loaded" deep-dive |
| D23 | i18n (static multilingual + `[[lang]]`) | planned | translated docs (Phase 4) |

## Open questions
- **Q1 Content format.**
  - Options: (A) Markdown → TSX build plugin; (B) MDX (output relies on spreads and a `components` object, both unsupported); (C) TSX-only pages.
  - Rec: A.
- **Q2 Page navigation.**
  - Options: (A) MPA + speculation rules + view transitions (zero runtime); (B) router client navigation (dogfoods the router; the App chunk loads eagerly for link interception).
  - Rec: A for content. The tutorial and examples show B.
- **Q3 Example isolation.**
  - Options: (A) separate origin `examples.<domain>`; (B) same origin, `sandbox` without `allow-same-origin` (opaque origin breaks module chunk loading without CORS, and CSP `'self'`); (C) same origin, no sandbox.
  - Rec: A.
- **Q4 Server-mode examples live.**
  - Options: (A) StackBlitz only; (B) hosted node runner; (C) a Workers adapter (handler is web-standard; no adapter yet).
  - Rec: A now, C later.
- **Q5 Search.**
  - Options: (A) Pagefind; (B) MiniSearch + custom JSON index; (C) Algolia DocSearch (external service).
  - Rec: A.
- **Q6 API extraction.**
  - Options: (A) TypeDoc JSON + own renderer; (B) TS compiler API custom extractor; (C) API Extractor (needs a `.d.ts` rollup per entry).
  - Rec: A, falling back to B if S5 fails on `.ts` export maps.
- **Q7 Host.**
  - Options: (A) Cloudflare Pages; (B) Netlify; (C) GitHub Pages (no custom headers: no immutable caching, no CSP headers).
  - Rec: A.
- **Q8 StackBlitz launch.**
  - Options: (A) GitHub-import links to the mirror repo (zero JS) + POST for `next`; (B) `@stackblitz/sdk` everywhere; (C) inline embeds.
  - Rec: A.
- **Q9 Packages for StackBlitz before 1.0.**
  - Options: (A) npm dist-tag `experimental`; (B) pkg.pr.new previews only.
  - Rec: A for released docs, B for `next`/PR previews.
- **Q10 Starter location.**
  - Options: (A) repo-root `templates/`; (B) `apps/docs/templates`; (C) a separate repo.
  - Rec: A (shared by docs, `create-rivet`, mirror; outside workspaces).
- **Q11 Domain and name.** "Rivet" collides with other projects (e.g. rivet.gg). Decided 2026-10-19: docs at `rivetjs.severyn.pro` (cdk / ui subdomains); diagnostic `docs:` links (`libs/compiler/codes.json`) use it. Mirror repo org still open.
- **Q12 Benchmarks page.**
  - Options: (A) a summary page with links to raw results, losses shown; (B) none until the Razor goal is met.
  - Rec: A (matches the honesty rule).
- **Q13 Prose lint.**
  - Options: (A) Vale (Go binary in CI); (B) textlint (Node-only).
  - Rec: A.

## Decisions (user, 2026-10-03)
- Name / domain: "rivetjs" for now (no final name yet); keep the name in one config value so a rename is cheap.


## Decisions — open questions resolved (user, 2026-10-03)
Unpicked questions take the recommended answer.
- docs-site-1 · Content format: Markdown compiled to TSX — Build plugin turns Markdown into Rivet pages.
- docs-site-2 · Page navigation: Full loads + prefetch + view transitions — Zero runtime for content; tutorial and examples still show client navigation.
- docs-site-3 · Example isolation: Separate origin (examples.<domain>) — Strong isolation, works with module loading.
- docs-site-4 · Live server examples: StackBlitz now, Workers adapter later — No hosting cost now; a web-standard adapter later.
- docs-site-5 · Search: Pagefind — Static index built at build time, no service.
- docs-site-6 · API reference extraction: TypeDoc JSON + own renderer — Falls back to a custom extractor if TypeDoc fails on .ts exports.
- docs-site-7 · Hosting: Cloudflare Pages — Custom headers, fast global network.
- docs-site-8 · StackBlitz launch: Plain import links to mirror repo — Zero JS; POST for the 'next' docs.
- docs-site-9 · Pre-1.0 packages for StackBlitz: npm 'experimental' tag + PR previews — Released docs use the tag; next/PR previews use pkg.pr.new.
- docs-site-10 · Starter templates location: Repo-root templates/ — Shared by all users, outside workspaces.
- docs-site-12 · Benchmarks page: Summary with raw links, losses shown — Matches the honesty rule.
- docs-site-13 · Prose lint tool: Vale — Widely used style linter; Go binary in CI.

## Implementation notes (2026-10-03)

### Commands (from the repo root)
- `node libs/docs-kit/cli.ts build apps/docs` — full build: examples → content routes → Vite build → prerender → Pagefind → host files → link check. Output `apps/docs/dist/client` (docs origin) + `apps/docs/dist/examples` (examples origin). `--no-examples` reuses built examples; `--no-search` skips Pagefind.
- `node libs/docs-kit/cli.ts serve apps/docs` — preview: docs http://127.0.0.1:4321, examples http://127.0.0.1:4322. `--dev`: Vite dev server (http://127.0.0.1:4320, content hot-regenerates) + built examples.
- `node libs/docs-kit/cli.ts check-content apps/docs [--strict]` — validate all content, no writes; lists placeholder pages.
- `node libs/docs-kit/cli.ts examples apps/docs [ids…]` — build + browser-check examples, update `src/generated/examples.ts`.
- `node libs/docs-kit/cli.ts api apps/docs` — regenerate `src/generated/api.json` (committed; diff = public API change).
- Nx: `docs:build`, `docs:test` (depends on build), `docs:typecheck`, `docs:dev`, `docs:serve`, `docs:examples`, `docs:api`.
- Origins: `DOCS_ORIGIN`, `DOCS_EXAMPLES_ORIGIN` env vars (defaults in `apps/docs/site.config.ts`; site name lives there too).

### Add a page
- Create `apps/docs/content/<section>/<name>.md` with frontmatter: `title`, `description` (≤160 chars), `template` (concept | guide | tutorial | recipe | best-practice | gotcha | reference | stub | page), optional `status` (stable | experimental | planned; planned needs `template: stub` + `spec:` URL), `related` (content paths), `tags`, `since`.
- Add its path to `apps/docs/content/_nav.ts` (order = reading order, prev/next). Build fails on orphans, missing files, duplicates.
- Body: Markdown + GFM; no h1, raw HTML, images. Links to `.md` paths are checked. Directives: `:::note|tip|warning|gotcha[title]`, `::example{id=…}`, `::api{symbol="@rivetjs/pkg/entry#name"}`, `::starter{template=starter-static}`, `:term[text]{id=…}` (ids = `##` headings in `content/reference/glossary.md`), `:kbd[…]`. Code fences need a language; `title="file"`; `// [!code highlight|++|--]`.
- Voice: plain language, short sentences, explain or glossary-link every term, no invented APIs (writer brief used for the first content pass: same rules).
- Check: `node libs/docs-kit/cli.ts check-content apps/docs`; pages become `src/routes/(docs)/<path>.tsx` (generated, gitignored).

### Add an example
- `apps/docs/examples/<id>/example.ts` (`defineExample({ title, summary, tags, mode?, frame?, show, test?, stackblitz? })`, see `examples/define.ts`) + app files (`src/routes/index.tsx`, …), laid over `templates/starter-static` (default; prerendered, live in an iframe) or `templates/starter-server` (`mode: "server"`: code + StackBlitz only).
- `// #region demo` / `// #endregion` marks the part shown first. `test` steps run in Chromium on the production build; console errors fail. Actions: `click`, `fill`, `press` (focus + key), `key` (key on the focused element). Assertions (wait up to 5 s): `expect` (text), `attr` (attribute value, `null` = absent), `name` / `described` (accessible name, `aria-describedby` text), `focused`, `matches` / `absent` (CSS selector incl. `:popover-open`, `:modal`, `:checked`). Widget examples assert keyboard behaviour and ARIA state, not only text.
- Build: `node libs/docs-kit/cli.ts examples apps/docs <id>` → prints scripts loaded before/after the first interaction (shown under the frame as "What loaded").
- Embed with `::example{id=<id>}`; the gallery (`/examples/`) and `/examples/<id>/` list it automatically.

### Deviations from this spec (and why)
- Content routes are generated `.tsx` files in `src/routes/(docs)/` (no Markdown support in the router plugin; no zero-cost slot API yet).
- StackBlitz: form POST of the project files (zero JS) for examples and starters; mirror repo + import links deferred.
- Speculation Rules sent as a `Speculation-Rules` header + `/speculation-rules.json` (inline rules would need a CSP hash the static adapter does not emit).
- Examples are built with a Vite `base` per id and wired to `createApp` manually (the router plugin assumes base `/` for styles).
- Deferred: Vale, snippet type-check, Lighthouse CI, axe, versioning, llms.txt, errors catalogue, mirror repo, per-example Nx caching.
