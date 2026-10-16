# Resume-static subtrees — design + ceiling (2026-10-09)

- Status: **REJECTED (2026-10-09, coordinator ruling at the gate).** User approved the redesign (2026-10-09) behind a gate: build only if a hand-converted prototype reaches ≥ 1.3× on dashboard resume SSR CPU. The prototype (static parts compiled to the plain server target) measured **1.03–1.10×** median (optimistic: includes modules whose plain output was not byte-identical). This file records the design, the measurement, where the cost really is, and the follow-up evaluation of component encode plans (§10, also below the bar).
- Lane RESUME-COMPILE. Harness `$S/perf/RESUME-COMPILE/` (in-process, `ssr.tsx` / `ceil.tsx` / `ab.sh`, built on IMPL-ENCODE's `register-ab.mjs`).

## 1. Problem

- Resumable SSR of component-heavy pages ≈ 3× the static render (HEAD 98862cd1, in-process ms/render median: dashboard 1.66 vs 0.56, mail 1.15 vs 0.30, chat 0.61 vs 0.14, settings 1.10 vs 0.28).
- Idea under test: components / JSX subtrees that can never need client code compile to the plain server target (no `_r*` recording, no `_rFn` / `_rProps` recipes, no live-props getters) while HTML + resume state stay byte-identical.

## 2. Definitions

- **Resume-inert render** of a subtree S: during S's server render nothing is recorded or reachable by records — no `data-r` id, no `<!--rN…-->` marker, no handler / binding / model / ref / effect / client event record, no `_rFn` / `_rProps` / `_rComputed` recipe that any record's captures reach, no `_regionState` value, no provider token entry (`[12]`), no Show / For / Async claim on an enclosing scope (`adopts`, `rows`, `shows`, `claimed`), no forward (`_onForward`) a recorded capture follows. Same notion as render-cache "inert" (`2026-10-07-render-cache-design.md` §Resume), extended to values escaping S.
- **Resumably static component** C (compile-time property, relative to an assumption about its props): every render of C whose props are *plain data* (no getters, no functions, no signals / accessors, no slot thunks except static ones) is resume-inert, and replacing C's resume-target code with its plain server-target code is byte-identical (HTML + state) for every such props value.
- **Static call site**: `<C …/>` where C is resumably static (known by facts) AND every attribute / child value is static: literal, module `const` with constant initializer, i18n static call, a local derived only from those, static native JSX, or static component JSX (recursively). Anything else (`x={v()}`, `{...p}`, `props.x` of a live props object, a function value, a non-static child) → the resume variant (today's code).
- **Static subtree** (inside a non-static component): a JSX expression whose elements hold no site (`resume.rs` `has_site_within` = false, Props sites included) and whose component elements are static call sites. Already plain today: native-only site-free templates lower to fragments without `_r*`; the new part would be component calls in them.
- Not static, by rule (sufficient, not necessary): any site of kind Event, Model, Ref, Effect, ClientEvent, Computed, Equals, Element, Slot with a client body, `r:slot` / `<slot>`; imports of `signal` / `computed` / `useContext` / `_regionState` / `clientEffect` / `clientEvent` / `clientOnly` / `lazyComponent` / `Async` / `Suspense` / `ErrorBoundary` / `Provider` (resumable tokens) / `Portal` / `Dynamic`; reading a props member as a function (`props.onX()`); passing any function or props member to a non-static child; returning / providing a function. Purity rules for helpers = render-cache §"Pure iff" (allow-listed builtins, module constants, pure same-module helpers; fixpoint).

## 3. Emission (as designed; not built)

- Server resume target only; DOM / plain server targets unchanged (zero-cost: non-resume output byte-identical).
- Per eligible component C in a resume module: emit a second body `C$static` = C lowered with the plain server target (same module, same hoists — `__rivetFragmentsN` shared where identical). No resume sites are allocated for `C$static`: symbol ids (source order, `<module>#<C>$<n>`) unchanged, DOM chunks unchanged.
- Static call sites call `C$static(props)`; others call `C` (today's code). Inside `C$static`, child calls are always the static variants (C static ⇒ its children are static call sites by the fixpoint).
- Cross-module knowledge: `moduleFacts` (`rust/src/facts.rs`) exports `staticComponents: string[]` per module (fixpoint over same-module calls; imports resolved by the Vite plugin like render-cache phase 2 `pureImports`); the importer's compile gets `staticImports: { "<specifier>": ["Name", …] }` and emits `import { C$static }`. Exported marker = the `$static` export itself (no manifest needed at runtime).
- Unknown / third-party / non-resume modules: not in `staticImports` → resume variant (today). Non-resume modules are already plain (no `_r*`), so nothing is lost.
- Prefer new Rust modules: `rust/src/compile/resume_static.rs` (analysis + twin emission), facts in `facts.rs`; compile.rs hook at the component-call lowering.

## 4. Interactions

- **Props from a resumable parent**: static only when every prop is static at the call site; a live props object (`_rProps` / `splitProps` / `mergeProps` outputs, forward boxes) is never static (its getters / forwards are what resumed descendants capture). Measured failure of the per-module shortcut (§6): `ui` `button.tsx`, `search-field.tsx`, `native-select.tsx`, `label.tsx` own no used symbol, yet compiling them plain changed the state (−50…−300 B): their `_rProps` recipes / forwarded getters are captured by cdk descendants' handlers. Staticness must be subtree-transitive, never "this component recorded nothing".
- **Contexts**: a static component may not read context (`useContext` → value may be a signal / client token) nor provide one (providers feed `[12]` of regions below and `resumableContext` tokens). Static children passed into a provider are fine (the provider is in the caller).
- **Show / For / Switch / Match**: runtime components; their resume hooks (`_onBranch`, `_onForEach`, `_onForRow`) run from the runtime, not compiled code, so a plain twin behaves the same *when `when` / `each` are static*. The resume target lowers dynamic `when` / `each` to getters (`resume_structural.rs`) — those are dynamic ⇒ not static anyway. Keyed `<For>` rows: plain target may use list mounts (`serverListMounts`) where resume used row hooks; HTML identical, but `_onForRow` tagging (preload `LIST` counting) must not change → rows of a static For hold no sites, so no `ElementRecord.list`; OK.
- **Slots / children render functions**: `__rivetSlot` thunks are compiled in the caller's module (resume target). A static component receiving slot children is a static call site only if the children are a static subtree; `_rChild` (`{props.children}` → own site for an `_rFn` slot function) differs from the plain value path → children must not be functions.
- **i18n**: static calls inline per variant (same on both targets); `t()` with params from static props is static; variant tables are process-global (`registerTable`), unaffected.
- **cdk components with client effects** (SharedElement, ScrollAreaScrollbar, TabPanel — the 8c9caaf3 / 61e803bf lesson: client behaviour lives in component bodies that the browser re-runs on region re-creation): never static by rule (`clientEffect`, `_regionState`, `signal`, `useContext`). Measured: plain `shared-element-transition/index.tsx` changed the HTML on dashboard / mail / settings even though its symbols were unused on those pages.
- **Region re-creation**: unaffected — the browser re-creates a region through its DOM symbol (client code), never the server twin. Static subtrees inside a region are re-rendered by DOM code as today.
- **Dev mode**: `resume.dev` compiles the same; dev façade wraps the ABI identically (`C$static` is a plain server function). **HMR**: an edit flips a module's `staticComponents` → its importers' server modules must recompile (Vite: invalidate importers when facts change); the first component edit already switches the page to client rendering, so only the next SSR request is affected. **DevTools**: static subtrees show no resume regions / sites — same as today (they recorded nothing).
- **Ids** (`useId` / `createId`): deterministic per render scope, independent of the compile target. (The harness saw `rvsN` differences only from the process-wide counter outside any scope, i.e. module evaluation order — not page output.)

## 5. Invariants + tests (for any future implementation)

- Byte-identical HTML + state with twins on vs off, every showcase / docs page (differential test like `tests/server-rowfn.test.ts`: compile each module with and without `staticImports`, render, compare after nothing — no normalisation).
- Symbol ids and DOM chunks unchanged (oracle corpus 227/227 unchanged, zero-cost runtime + lanes identical).
- Client behaviour: the 8c9caaf3 regression set (radio-group, dom-events-forms, scroll-area, selection-indicator, tabs, fields-ssr) + ui / cdk showcase resume suites.
- Failure modes: (a) a static-classified component whose output a resumed site captures → state diff (caught by the differential test); (b) context read through a helper the purity check missed → HTML diff on pages with providers; (c) stale facts after HMR → importer calls a `$static` export that no longer exists (build error, not silent).

## 6. Measurement (the gate)

Harness: IMPL-ENCODE in-process (`resumableToString`, server target compiled on the fly), HEAD 98862cd1, interleaved processes, 5 rounds × 7 samples, ms/render min / median. Load during runs: see table.

### 6.1 Where static parts are

- Per page, sites called vs symbols used in the state (instrumented runtime copy): dashboard 1,565 site calls, 29.5% in components with no used symbol (charts 262, Chip 48, Kpi 36, SharedElement 36, Icon 12, …); interactive components dominate the rest (DataGrid 427 calls / 64 used symbols, ToggleButton 200 / 16, Dashboard 179 / 13).
- Static share at module granularity (modules none of whose symbols the state uses): dashboard 446 / 1,565 calls, mail 80 / 704, chat 17 / 449, settings 111 / 769.

### 6.2 Prototype: static modules compiled to the plain server target

- Per page, every module whose symbols the page's state never uses compiles with the plain server target (`PLAIN=` list in `register-ab.mjs`); everything else resume. Optimistic: dashboard / mail / settings lists include modules whose plain output is *not* byte-identical (shared-element-transition, button, search-field, native-select, label, dom-tags, description), i.e. more work removed than a correct analysis could.
- Byte-identical subset (dashboard: chart, kpi, chip, trend-chip): identical HTML + state (ids normalised for the process counter).

| page | static | resume HEAD | resume + static modules plain | gain (median) |
| --- | --- | --- | --- | --- |
| dashboard | 0.600 / 0.719 | 1.823 / 2.161 | 1.686 / 1.964 | 1.10× |
| mail | 0.339 / 0.437 | 1.277 / 1.660 | 1.287 / 1.533 | 1.08× |
| chat | 0.141 / 0.213 | 0.660 / 0.804 | 0.615 / 0.780 | 1.03× |
| settings | 0.291 / 0.364 | 1.203 / 1.488 | 1.129 / 1.396 | 1.07× |

(load 5.5–7.6 during this run — see §6.4 for the re-run.)

### 6.3 Bounds (same harness, one process, interleaved)

- Runtime skip of every `_r*` site in static components (plain path at the call): 1.00× dashboard, 0.97–1.05× others → the `_r*` calls of static components cost nothing measurable.
- Runtime skip of *every site whose symbol is unused* (66% of distinct site ids, all components; output not identical — a bound, not a design): 1.05× dashboard, 1.06× mail, 0.98× chat, 1.08× settings.
- Encode share of resume CPU (`encodeState`): dashboard 31%, mail 40%, chat 41%, settings 44%.
- All modules plain under `resumableToString` (recorder present, nothing recorded): dashboard 0.683 vs static 0.746 → the recorder itself is free.
- All modules resume-compiled, every site skipped (output broken; isolates the resume compile shape — live-props getters, props helpers / forwards, R2 code in hooks): dashboard 1.06 ms vs plain 0.68 → **≈ 0.38 ms (19%) is compile shape**, in interactive components (DataGrid, Segment, ToggleButton, SearchField); mail / chat / settings ≈ 0.1–0.2 ms.

### 6.4 Clean re-run

- Byte-identical subset only (modules whose plain output keeps HTML + state identical, verified per page and combined): dashboard chart / chip / kpi / trend-chip / icon / dom-tags / toggle-button-group behaviour; mail resizable / icon / animation / behaviour / dom-tags; chat chip / textfield / textarea / dom-tags; settings field-error ×2 / collections components / input / textarea / separator ×2 / icon.
- 5 rounds; each round starts at load < 4, later rounds ran into load 6–7.5 (other lanes): dashboard 1.795 / 2.005 → 1.618 / 1.966 (median 1.02×, min 1.11×); mail 0.97×; settings 0.95×; chat noise (one 1.9 ms outlier sample). The correct static share is within noise. Verdict unchanged.

## 7. Why the ceiling is low

- Static subtrees record nothing, so they add nothing to encode (the largest item, 31–44%).
- Their render-side resume overhead is small: no getters at static call sites (static props are already data properties), `_r*` calls that record nothing are cheap (§6.3).
- The overhead lives in interactive components: encode of what they really need, their compile shape (live props through `splitProps` / `mergeProps` / `_spreadProps`, cdk `hasLive` / `live`, `_rFn` in hook code), and recording of used sites.

## 8. What would move the needle instead (candidates, each its own lane)

1. Encode (31–44%): captures encoded at record time / once per distinct captures array (IMPL-ENCODE candidate 2), uniform sibling packing without re-walking `needs`.
2. Resume compile shape of interactive components (≈ 19% on dashboard): eager props on the server resume target for props no resumed site of the callee can read live (needs callee facts: which props reach sites), cheaper forward tracking in `props.ts` under a recorder.
3. Static twins (this spec) only after 1–2, if a page class appears where static content dominates (docs / marketing pages: already mostly site-free native templates).

## 9. Open questions

- None blocking for static twins (rejected).

## 10. Follow-up: component encode plans (evaluated 2026-10-09, below the bar)

- Idea (coordinator, after the §6 ruling): generalise R-PLAN row plans (50bca975) to components — the compiler emits a per-component encode plan (site layout, capture slots, symbol ids, needs / chunk sets, binding packing); each instance records only its dynamic values into a flat array; the encoder writes entries by template (no per-site record objects, no reach walk per instance, no `packBindings` detection). Plus a leaner resume shape: live-props helpers resolved at compile time where props are static at the call site.
- Profile (dashboard resume, 50 µs sampling, 600 renders, shares of `resumableToString` time):
  - encode 35.1% = value-dependent 14.6% (interning captures: `encode` / `ref` / `object` / `special` / `refsOf` / forwards, `stateJSON`) + structural 20.5% (`needs` 4.8, `packBindings` flush 4.1, `planPreload` 3.0, `compactTable` 2.9, `encodeRecords` self 2.3, `wireSymbols` 1.3, rest 2.1).
  - render-side recorder self time (server-resume, outside encode) 8.3%; `props.ts` self 8.9% (static render: ≈ 1.7% of resume time → resume-specific ≈ 7%); cdk `live` / `hasLive` 2.8%; GC 6.4%; static traversal ≈ 28%.
- Oracle prototype (runtime copy `$S/perf/RESUME-COMPILE/oracle/`, one process, 9 interleaved rounds; load 8–9, other lanes): the first render records each `needs` result (+ the `chunk` calls it made), every `packBindings` decision and the `compactTable` output; later renders replay them, so these cost ≈ 0 — strictly more than any compile-time plan can precompute (`needs` follows runtime capture values: forwards, props recipes, contexts; mail / settings stayed byte-identical, dashboard / chat differ only in interning order because `needs` also interns forward sources).
  - Result (median): dashboard 2.087 → 1.874 (1.11×), mail 1.18×, chat 1.14×, settings 1.14×.
- Ceiling for component plans + lean shape, adding the oracle to profile-based upper bounds for the parts not prototyped: recorder self −½ (values must still be stored per instance: ~4%), props / cdk live −⅓ (interactive components mostly get live props from their parents: ~3%), `planPreload` / `wireSymbols` −½ (per-element / per-page: ~2%) → dashboard ≈ 1 / (1/1.11 − 0.09) ≈ **1.23×**, and lower once `needs` is held to what a static plan can know (own chunk + compile-time-known non-function captures: −⅓ of 4.8%) → ≈ 1.19×. Even with every structural item at 0 (not reachable by plans) the bound is ≈ 1.35×.
- Verdict: < 1.3× realistic → recorded, not built. Cheaper wins inside this budget (each < 10%, IMPL-ENCODE rule): `needs` memo keyed on capture refs per symbol within a render, `planPreload` allocation diet, `compactTable` per-component repeat hints.
