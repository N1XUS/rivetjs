# Live component props — design (2026-10-07)

- Status: approved direction (user decision 2026-10-07: props live, Solid model); runtime helpers landed (`libs/runtime/props.ts`); **P1 + P2 landed 2026-10-08** (`live-props-1/2`: DOM v2 getters + `mergeProps` spreads, `./props` export, `_cp` no longer emitted; RV1014 retired, `when` / `each` value-or-accessor on DOM + server) + live-props-3 (component spreads use `_spreadProps` = object-spread semantics, server twin — an own `undefined` overrides, unlike `mergeProps` defaults; lone spread `p || {}`; no getter over `this` / `arguments` / `await` / `yield`). **P3 landed 2026-10-08** (`live-props-p3` + `p3b`: server-resume `_rProps` recipes (`Props` site, symbol via `_propsOf`), props-helper forwards (`_onForward` → `{k:"props"}` / `{k:"m"}`), member boxes (`_rMember` + `_members` prologues), no Props site for local components destructuring their first param; `card.test.ts` resume `.fails` removed; runtime fixture `libs/runtime/tests/resume-live-props-browser.test.ts`; not covered: projection captures `globalDOMProps(props)` read every getter on the server, `props.x` in a native attribute / text without a call is no site, author getter objects (context values) encode by value — region fallback stays for those). **Hardening `live-props-p4` 2026-10-08** (HeroUI lane gaps): identifier spreads live (§4); resume registration of functions / getter objects escaping as values (const aliases `c ? f : f()`, function arguments of local / relative helpers, getter objects in conditional initializers); spread `ref()` objects recorded like `ref={r}` (`_rSpread`); dev `_c(_propsOf, …)` no longer warns; server `bindRef` twin; open: a region holding several component-level `Show`s keeps only the first one's server branch on re-creation (ui AvatarGroup, `libs/runtime/tests/resume-p4-browser.test.ts` gap 6 `test.fails`). Open: P4 (destructure rewrite), P5 (cdk / ui / docs migration), P6 (delete `_cp` + dev snapshot warnings).
- Goal: `<Card variant={v()}>` updates when `v` changes — only bindings reading `props.variant` re-run, component body never re-runs, on every target (DOM v2, resume, i18n, dev).
- Breaking: yes (experimental rule) — no `_cp` alias, no snapshot opt-in; every in-repo consumer migrates in the phase that breaks it.

## 1. Today (what changes)

- DOM v2: `_c(C, props)` = `untrack(() => C(props))`; compiler emits `_cp(C, () => props)` (= `untrack(() => C(props()))`) when any prop is `dynamic()` → props **snapshot**; later `v` changes are lost, bindings inside never see them.
- Server: plain eager values (correct: one render).
- Resume: component element with dynamic props = Region site (`_rBind` region + markers); first change re-creates the component on the client (`_regionState`, `_serverBranch` workarounds; `card.test.ts` `test.fails` "resumed direct signal prop — second change").
- RV1014: errors on `each={xs()}` / `when={on()}` (called accessor would snapshot) → authors write `each={xs}`.
- cdk: `T | Signal<T>` / `T | (() => T)` props + `read()` everywhere as a workaround for snapshot props.

## 2. ABI — chosen representation: getter object

- Compiler output: `_c(Card, { get "variant"() { return v(); }, "size": "sm", children: () => … })`.
  - Getter only for entries that are dynamic and not already lazy (arrow / fn values stay values).
  - Static props stay data properties → objects with no dynamic prop compile identically to today (0 delta).
- `_c` unchanged (untrack around call). `_cp` no longer emitted (P1); deleted P6.
- Why getters (measured, §9): same author model as Solid (`props.x` anywhere, `splitProps`/`mergeProps`), own-key semantics (`Object.keys`, `{...props}` read once = explicit snapshot), mount cost +4% at 1000 rows vs snapshot.
- 2026-10-08 (props-layout, §2.2): the getter object is built as a slot object (`_p` / `_pg` factory per layout) instead of a getter literal — same own-key semantics, fast map.
- Rejected:
  - Prototype-getter class per call site: fast map, but own keys gone (`Object.keys`, `{...props}`, `in` vs `hasOwn` break) — cdk / RA helpers rely on own keys.
  - Accessor-per-prop (`props.variant()`): fastest creation (13 ns vs 194) but every consumer API changes (RA/RAC parity lost, `T` vs `() => T` types everywhere); mount gain −7% not worth it.
  - Compiled direct passing (component inlined args): only for leaf components; no gain over getter (mount 2.115 = snapshot, update 0.199 ≥ getter).
  - Shared-descriptor `defineProperty`: −28% heap but +14% mount at 1000 rows; kept as P7 follow-up for list rows only (§10).
- Server (non-resume): plain values, no getters (`renderToString` getters 2× slower: 0.218 → 0.427 ms / 1000 rows). Server component sees values; same author code works (`props.x` reads).

## 2.1 Heap investigation (2026-10-07, root ruling: heap gate ≤ +25% vs snapshot, mount ≤ +3% before P5)

- Root cause (Node heap snapshot, getter literal props of 3 keys / 2 getters): ~490 B/object = dictionary-mode property store 289 B (any object literal with `get` goes dictionary; quoted keys / getter order irrelevant) + 2 getter closures 112 B + 2 AccessorPairs 50 B + getter Context ~40 B. Snapshot props object 56 B.
- Shared-getter layouts (getter fns at module level per call site, captures in a symbol slot `this[S]`): 48–64 B/object, fast map, creation 122–166 ns (literal getters 185 ns) — `defineProperty` runtime calls are the creation cost (`Object.defineProperties` / `Object.create(proto, descs)` slower: 290 / 390 ns; `__defineGetter__` 132 ns).
- Chromium 1000 rows × 30, median, Card on OPT-D `_fx1` bindings:

| lane | mount ms | updAll ms | upd10% ms | heap KB |
| --- | --- | --- | --- | --- |
| snap (no live bindings) | 2.060 | 0.025 | 0.010 | 197 |
| inline floor (Card reads row signals, no props object) | 2.075 | 0.159 | 0.050 | 674 |
| getter literal | 2.165 | 0.175 | 0.062 | 911 |
| slot: class per call site + `defineProperty` shared descriptors | 2.440 | 0.156 | 0.051 | 700 |
| defget: literal + `__defineGetter__` shared fns | 2.305 | 0.164 | 0.055 | 714 |
| accessor per prop | 1.935 | 0.181 | 0.061 | 773 |

- Snapshot heap is not a valid floor: its bindings read plain values and are released. Any live scheme pays the live bindings (inline floor 674 KB = +477 KB / 1000 rows = 2 `_fx1` effects + dep links per row); props layout overhead over the floor: getter +237 KB, slot +26 KB, defget +40 KB.
- Gate `heap ≤ +25% vs snapshot` is unreachable by any live layout (floor alone +242%); proposed gate: heap ≤ floor + 10%, mount ≤ +3% vs snapshot. Neither measured layout meets both: getter fails heap (+35% over floor), slot / defget fail mount (+18% / +12%).
- Next (not done, usage cap): (1) lower-cost shared-getter install — per-call-site prebuilt map via a constructor that assigns a data placeholder then one `defineProperty` per getter key only on first instance + `Object.setPrototypeOf`-free clone tricks; (2) hybrid: getter literal for components with ≤1 dynamic prop, slot for list rows (`For` children) where heap dominates; (3) reduce floor: binding effect node size (reactivity lane) — that is where 70% of live heap sits; (4) re-run with OPT-D compiler output. §P1 shape stays getter literal until one layout passes both gates.

## 2.2 Layout v2: slot objects (props-layout, 2026-10-08)

- Probe (Node 26 / V8, `%HasFastProperties`): every object literal with `get` is dictionary mode (1 getter, quoted keys, getter order, `get`+`set` — all); per-object `defineProperty` with fresh closures normalizes on the 2nd accessor (AccessorPair mismatch). Shared getter functions keep one fast map per key layout, but per-instance state must then be reachable through `this`.
- Chosen: plain `{}` + ONE hidden slot + own enumerable configurable accessors from SHARED getters. Slot = private field stamped through a return-override base constructor (`class Base { constructor(o) { return o } }`, `class Slot extends Base { #slot }`): prototype stays `Object.prototype`, `Object.keys` / `Reflect.ownKeys` / spread / `JSON` / descriptors see only the props. Accessors installed with `__defineGetter__` (no descriptor parsing; `defineProperty` with a frozen shared descriptor ~111 vs 81 ns/object, `Object.defineProperties` / `Object.create(proto, d)` slower still; starting from a computed-key literal `{ [S]: e }` doubles creation).
- Node, 3 keys / 2 getters, create + 1 read ns/object | read ns | B/object: literal getters 166–198 | 18–19 | 496; slot (private) 90–100 | 3.5–4 | 168; enumerable symbol slot 90 | 3.5 | 168; non-enumerable symbol (`defineProperty`) 172; class per call site (own keys lost, reference only) 5 | 1.8 | 56.
- Private vs enumerable symbol slot: same speed. Symbol: visible to `Reflect.ownKeys`, copied by `{...props}` / `Object.assign`, breaks `toEqual` / symbol-aware deep equality; works with unbound descriptor copies. Private: exact own keys; an unbound descriptor copy (`Object.defineProperties(x, Object.getOwnPropertyDescriptors(props))`, Solid 1.x `splitProps` style) throws on read. Chosen private (own-key semantics = §2 requirement); combine through `splitProps` / `mergeProps` (`desc.get.call(props)` works).
- Runtime (`props.ts`): helpers return slot objects; forwarding getters are shared per key and read live — `splitProps` / `_restProps` `source[key]` (a source getter runs with `this` = its object, as `bind` did), `_spreadProps` last source having the key, `mergeProps` last non-undefined (settled plain values stay data). No `.bind`, no per-key chain arrays / `Object.create(null)` records, no Set per `splitProps` list (`includes`). Edge: a non-enumerable own source key is now seen at read time (`Object.hasOwn`).
- Compiler ABI `_p(env)` + `_pg(o, key, i)`; emission (patch `props-layout`, DOM v2 + server-resume `live_props`): a props literal with a getter → hoisted per-layout factory `const __rivetPropsN = (e, a0) => { const o = _p(e); o["k"] = a0; _pg(o, "x", 0); return o; };`, call `__rivetPropsN(($rivetKey) => $rivetKey === 0 ? (g0) : (g1), a0)` (1 getter: `() => g0`); literal data values inlined into the factory, others are arguments (source-order evaluation kept); duplicate keys / no getter → literal as before. Env = arrow: lexical `this` (getters never read `this` / `arguments`: `getter_safe`).
- Props suite (`apps/dom-bench/props`, 1000 rows × 6 components, Chromium 153, 30 interleaved samples, medians; `docs/benchmarks/2026-10-08-props-suite.md`): HEAD → runtime helpers → + compiler emission: mount 7.86 → 7.65 → 7.33 ms, relabel 1.06 → 0.93 → 0.87, select 1.24 → 1.21 → 1.15, heap 2971 → 2498 → 1887 KB; Solid stable 9.47 / 4.53 / 3.65 / 5366 KB.

## 3. Lowering per target

- **DOM v2 (P1, `live-props-1`):** `live_props()` in `dom_v2.rs`; flags per attr in `lower` order; `r:slot` skipped; conditional slot names reading state → getter; non-lazy dynamic children → getter `get children() { return expr; }`.
- **Structural (`For` / `Show` / `Switch` / `Match`):** same object; runtime reads `props.each` / `props.when` inside its effect (already) → live with no extra wrapper. `For` keeps `by` / `children` read once (identity props).
- **i18n DOM:** messages that read state (plural over a signal) → getter; static messages folded as today.
- **`_compileSymbolModule`** (resume chunks): same DOM lowering → same getters.
- **Server / server-resume twins:** unchanged in P1; server-resume recipes P3 (§5).
- **Dev:** `dev/dom.ts` `_c` wrapper unchanged; `_cp` wrapper removed P6. Devtools prop display reads getters lazily (no tracking: inspector reads under `untrack`).

## 4. Spreads, defaults, forwarding

- Runtime `@rivetjs/runtime/props` (new subpath, target-free, tree-shaken until imported):
  - `mergeProps(...sources)` — Solid parity: later source wins; `undefined` falls through (defaults); getters forwarded without reading; `null`/`undefined`/`false` sources skipped; `__proto__`/`constructor` never copied. Function source or proxied source → Proxy result whose keys follow it.
  - `splitProps(props, ...lists)` → `[picked…, rest]`; getters bound to source (author `this` kept); key in two lists → first list; Proxy parts over proxied props.
  - `_restProps(props, used)` — compiler ABI for `...rest` destructuring.
  - Types `MergeProps<T>` / `SplitProps<T, K>`.
- Component spreads `<C {...a} b={x()} {...c()} />` → `_c(C, _spreadProps(a, { get b() {…} }, () => c()))` (landed: `_spreadProps` = object-spread semantics, not `mergeProps` defaults — server parity):
  - Identifier / static member chain spread arg → passed as object (getters inside stay live).
  - Other dynamic spread arg (call, conditional) → thunk source → Proxy path (keys follow it).
  - Lone member-chain spread with nothing else → object passed through (`p || {}`), no merge.
- Native element spreads: live — a member / call spread is a thunk (`_spread(el, () => ({ ...x }))`); an identifier spread was copied once (`{ ...rest }`: snapshot) until hardening `live-props-p4` (2026-10-08): a lone identifier → `_spread(el, rest, 2)` (uncopied, read inside the spread effect, which reactivity releases when the run read nothing; no `props.ts` brand check — it would join the resume runtime's chunk graph), with other parts → thunk. Chromium, 5000 spreads, median: plain object copy 3.60 / flag-2 3.90 / thunk 4.10 ms; live getters flag-2 3.20 / thunk 3.50 ms (copy 2.80 = the snapshot bug). An explicit `ref` after the last spread masks the spread's `ref` key (server: `"ref": void 0` appended; DOM since IMPL-SPREAD ABI 5: `ref` in the spread's `exclude` list; React: later prop, one ref).
- Author-level: `{...props}` = explicit snapshot (documented); use `mergeProps` / `splitProps` to forward.

### 4.1 Destructured params — compiler rewrite (recommend: yes, Vue 3.5 style, P4)

- Applies to: PascalCase component function (outermost fn containing JSX) whose first param is an ObjectPattern; plus top-level `const {…} = P` in that body where `P` = the props param or a props-derived const (init = call with a props-derived identifier as direct arg: `mergeProps(d, props)`, `splitProps(props, …)[i]`, cdk `contextProps(props, …)`).
- Rewrite: param → `__props`; every read of `x` (semantic reference, shadowing-safe) → `__props.x` (renamed key: `{ a: b }` → `b` reads `__props.a`).
- Defaults `{ size = "md" }`: read = `__props.size !== undefined ? __props.size : <default>`; default expr evaluated lazily at most once per instance (sentinel local) → object/array defaults keep identity.
- `...rest` → `const rest = _restProps(__props, ["a", "b"])`.
- Nested patterns `{ a: { b } }` → `__props.a.b` (live chain); default inside nested pattern → diagnostic (new code, error: "default in nested props pattern — use mergeProps").
- Computed non-literal key `{ [k]: v }` → diagnostic (error). Literal computed keys ok.
- Assignment / update to a destructured prop (`size = …`, `x++`) → diagnostic (error: "props are read-only; copy into a signal").
- Closures capturing `x` read `__props.x` at call time (live) — documented semantic change.
- Resume: rewritten reads become member captures of the props object (§5) — all site kinds, not only bindings.
- Module: new `rust/src/compile/live_props.rs` (patch `live-props-4`, root lands).

## 5. Resume

- Goal: drop Region sites that exist only because a component has dynamic props.
- **Recipes (P3):** server-resume component call with ≥1 dynamic prop → `Card(_rProps("m#Page$6", { get variant() { return v(); }, title: "s", children: … }, [v, n]))`.
  - `_rProps` registers the object like `_rFn` with a live flag → `special` always encodes `{f: id, a: captures}` (never by-value, skips holdsSignal path).
  - Client symbol `(v, n) => ({ get variant() { return v(); }, … })` compiled via `_compileSymbolModule`.
  - New SiteKind `Props` → symbol numbering shifts → re-record oracle corpus.
  - Component elements with only prop dynamism are no longer Region sites: no `_rBind` region / markers. Child bindings (`_rAttr` reading `props.variant` under `_trackReads`) record `v` directly → client binding subscribes to `v`, component never re-runs.
  - Bonus: recipe props make JSX-valued props serializable (content prop = recipe getter) — retires part of the "JSX content props not serializable" rule.
- **Member captures:** server `_rMember(props, "a")` for a live accessor returns a box encoded custom `{k: "member", a: [propsRef, key]}`; symbol prologue `_rMembers([...])` turns boxes back into getters on the client (dom-resume).
- **`_rFn`:** unchanged; inline arrows inside recipes capture as today.
- **`_regionState`:** keep for P3; P6 audit via dev `resume.region` events across cdk/ui story suites → delete when zero re-creations remain (57 cdk uses become plain state).
- **`_serverBranch`:** keep (Show/ternary root branch identity). Add root structural regions: a `Show` / `Switch` / `For` with reactive props is its own region site anywhere incl. component root → cdk `display: contents` anchor wrappers (23 uses) deleted in P5.

## 6. RV1014 — retire (P2, `live-props-2`)

- Getters make `each={xs()}` / `when={on()}` live → diagnostic obsolete.
- `codes.json`: RV1014 `"retired": true` (codes never reused); `called_accessor_props` deleted.
- Runtime `when` / `each`: value-or-accessor (`typeof v === "function" ? v() : v`) on DOM + server — strict superset; caveat: a function *value* as `when` is called (document).
- Docs: guides / editor.md row retired; control-flow docs show `each={xs()}` as canonical.

## 7. children / slots

- Children: non-lazy dynamic children → getter `children`; lazy children (compiler render-fn children) unchanged.
- Named slots (`r:slot`): slot record stays lazy; conditional slot name reading state → getter.
- `docs/guides/slots.md` "props are snapshots" rewritten (P5).

## 8. cdk / ui (P5)

- Keep `T | Signal<T>` only for controllable two-way values (`value` / `onChange` pairs, `isOpen`).
- State-like `T | (() => T)` props (108) → plain `T` (live via getters), RAC-faithful signatures; `read(` (269) shrinks to controllable reads.
- Getter-preserving helpers (must not read props while combining): `globalDOMProps` (121 uses), cdk RA `mergeProps` (69; class merge = getter `get className()` over both), `contextProps` (84), `{...props}` (110 cdk / 22 ui → `splitProps` / `mergeProps`), `const {…} = props` (193 cdk / 7 ui → P4 rewrite or `splitProps`).
- Retire cdk rule "pass signals not values / reading a prop re-renders" (libs/cdk/CLAUDE.md, resumability guide).
- HeroUI port: compound parts take plain values; remove `card.test.ts` `.fails` after P3.

## 9. Measurements (2026-10-07, M-series, Chromium via Playwright, hand-written lane outputs, median)

| lane (1000 rows × 30) | mount ms | updateAll ms | upd 10% ms | clear ms | heap KB |
| --- | --- | --- | --- | --- | --- |
| snapshot (`_cp`, no updates) | 2.115 | 0.026 | 0.011 | 1.045 | 196 |
| getter literal (chosen) | 2.205 | 0.180 | 0.080 | 1.115 | 967 |
| shared descriptors | 2.505 | 0.174 | 0.078 | 1.110 | 754 |
| accessor per prop | 2.055 | 0.194 | 0.069 | 1.140 | 831 |
| re-create (today's resume path) | 2.245 | 2.189 | 0.240 | 1.225 | 813 |

- 5000 rows mount: snap 8.50, getter 10.79 (heap 4775 KB), shared 9.80 (3712), accessor 9.29 (4103).
- Node ns / props object + 2 reads: literal getters 194, `defineProperty`×2 134, accessor 13, snapshot 8. Getter literals are dictionary-mode in V8.
- `mergeProps(rest, getter)` ~750 ns, `splitProps` (2 lists) ~500, `_restProps` ~200.
- Server `renderToString` 1000 rows: plain 0.218, getters 0.427 ms → server keeps plain values.
- Bench sources: lane scratchpad `live-props/bench/` (harness + lanes + `run.mjs`); port into `apps/dom-bench` as `live-props` suite in P1.

## 10. Perf plan + gates

- P1 gate: dom-bench full + krausest (`06_create1k`, `07_create10k`, `03_update10th` within noise of baseline; components without dynamic props byte-identical), resume-bench unchanged, ssr-bench unchanged (server untouched).
- P3 gate: resume-bench click-to-interactive ≤ baseline (fewer regions / markers → expect bytes ↓), ssr-bench resume lane CPU/page within noise.
- P5 gate: cdk/ui story suites + size-report (cdk shrinks: `read()` / anchors gone).
- P7 follow-ups (measured, only if win): compiler fast path — spread of object literal inlined, no `mergeProps`; list-row props via shared descriptor (`defineProperty`) when ≥ N rows; getter-free props when every dynamic read is already a fn.

## 11. Phases / lanes (Rust = root-only patches)

| Phase | Content | Owner | Gates |
| --- | --- | --- | --- |
| P1 | `./props` export + `live-props-1` (DOM getters, spreads) + compiler test updates | root (patch) + lane (tests) | compiler, parity re-record, zero-cost `--update`, dom-bench, krausest |
| P2 | `live-props-2` RV1014 retired, `when`/`each` value-or-accessor | root (patch; touches OPT-D `dom-v2.ts`) | runtime + compiler tests, zero-cost, size |
| P3 | server-resume `_rProps` recipes, `Props` SiteKind, member boxes, root structural regions (`live-props-3`) | root + resume lane (server-resume.ts, dom-resume.ts, resume-format) | resume suites, oracle re-record, resume-bench, ssr-bench |
| P4 | destructure rewrite `live_props.rs` + diagnostics (`live-props-4`) | root | compiler tests, typescript-plugin build, language-core quick fixes |
| P5 | cdk / ui / docs / templates migration (§8), slots guide | cdk + ui lanes | full test run, cdk-docs build, docs check-content |
| P6 | delete `_cp` (dom-v2.ts, dom.ts re-export, dev/dom.ts), `_regionState` audit → delete | root + runtime lane | zero-cost, size, resume suites |

- Runtime hooks in other lanes' files (additive): `dom-v2.ts` `_show`/`_switch` `when()` (P2), `_cp` delete (P6); `dom.ts` types (P2); `dev/dom.ts` `_cp` wrapper (P6); `server-structural.ts` value-or-accessor (P2); `server-resume.ts` `_rProps` + live flag in `fns` + `special` `{f}` + `_rMember` (P3); `dom-resume.ts` custom kind `member` + `_rMembers` (P3); `package.json` `./props` (P1).

## 12. Open questions (user-level)

- Destructure rewrite (P4) default-on, or opt-in per file? Recommendation: default-on (Vue 3.5 precedent; otherwise destructuring silently snapshots).
- Accept +4% mount / ~5× heap per dynamic-prop component instance for live semantics (vs snapshot), with P7 fast paths as follow-up?
