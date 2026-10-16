# @rivetjs/motion — design (2026-10-11)

- Status: **implemented (2026-10-12)**: T1–T13 (scaffold dd682950 … primitives 391679c0), T14 bench 212cbf5c, T15 zero-cost / size / package 49edaa05, T16 docs d6e569ad, T17 ui / cdk docs 61e6efb7, T18 AI files. Deviations recorded in the plan's per-task outcomes (D3 namespace not Proxy, D5 `layout` plain prop, bench in `apps/dom-bench/motion`). Open gaps: `libs/motion/CLAUDE.md` "Gaps" (SSR 2.9× vs `motion/react`). Spec accepted 6f7da438; rulings Q1–Q3 recorded (§9, D9 / D10 / D17 rewritten). Later tasks go through brief → implement → review. Plan: [`../plans/2026-10-11-motion.md`](../plans/2026-10-11-motion.md).
- User directive (2026-10-11): "we need to integrate https://motion.dev/".
- Goal: Motion's DX on Rivet signals, plus what React cannot do:
  - server-rendered `initial` styles, no flash;
  - resumed pages animate without hydration;
  - the first hover / press runs with only the small engine loaded;
  - 0 B for apps that never import it.
- Not a goal: depending on React, porting `motion/react`'s source, re-implementing Motion's engine.

## 1. Research (motion.dev docs + npm, read 2026-10-11)

### 1.1 Package facts

| Fact | Value |
| --- | --- |
| npm name / version | `motion` **14.1.0** (published 2026-10-09; 14.0.0 2026-10-02, 13.5.x 2026-10-01/02) |
| License | MIT (also `framer-motion`, `motion-dom`, `motion-utils`) |
| Dependencies | `motion` → `framer-motion@14.1.0` + `tslib`; `framer-motion` → `motion-dom` → `motion-utils` |
| React | `react` / `react-dom` are **optional** peers (`peerDependenciesMeta.optional`) of both `motion` and `framer-motion` → installing `motion` installs no React |
| `sideEffects` | `false` in all four packages |
| Exports (`motion`) | `.` (vanilla hybrid), `./mini`, `./react`, `./react-m`, `./react-mini`, `./react-client`, `./react-animate-view`, `./debug`, `./three`, `./vgpu` |
| Unpacked | motion 757 KB, framer-motion 6.0 MB, motion-dom 3.7 MB (install weight only, not bundle weight) |

### 1.1b Measured bytes (T1 spike, rolldown min + brotli q11, one bundle per import set)

| Import | min B | br B |
| --- | --- | --- |
| `motion/mini` `animate` | 8,443 | 2,958 |
| mini `animate` + `spring` | 12,483 | 4,479 |
| mini `animate` + `spring` + `stagger` | 13,729 | 4,992 |
| `spring` / `stagger` / `inView` / `hover` / `press` | 4,278 / 1,331 / 730 / 1,067 / 2,016 | 1,780 / 676 / 377 / 469 / 859 |
| `scroll` (alone / + mini) | 9,027 / 16,984 | 3,529 / 6,006 |
| hybrid `animate` (+ `stagger` + `spring`) | 54,925 (55,180) | 17,603 (17,707) |
| `animateLayout` (alone / + hybrid) | 94,641 / 100,829 | 27,108 / 29,156 |

- motion.dev's quoted sizes ("2.3kb", "18kb", "5.1kb", "0.5kb") are smaller subsets; this table is what an app ships. Full table: `libs/motion/CLAUDE.md`.
- `animateLayout` = 27 KB br confirms D12 (not Motion's layout engine).
- mini + `spring` = 4.5 KB br crosses the plan's 4 KB re-check line → D4b.

### 1.2 Vanilla API we build on (`motion`, `motion/mini`)

| API | What | Size (motion.dev's own numbers) |
| --- | --- | --- |
| `animate` (`motion/mini`) | WAAPI only: HTML/SVG styles, keyframes, `type: spring` (spring imported from `motion`), registered CSS vars. No independent transforms, no `repeatDelay` | **2.3 KB** |
| `animate` (`motion`, hybrid) | Adds independent transforms (`x`, `y`, `scale`, `rotate`…), colors / strings / numbers / objects, CSS vars everywhere, SVG `pathLength`, sequences (`at`, labels, `defaultTransition`), `onUpdate` | **18 KB** |
| Transition options | `type` tween / spring / inertia, `duration` (0.3 s, 0.8 s multi-keyframe), `ease` (names, bezier array, fn, per-keyframe array), `times`, `delay` (negative = start inside), `repeat`, `repeatType` loop / reverse / mirror, `repeatDelay`; spring `bounce` (0.25), `visualDuration`, `stiffness`, `damping`, `mass`, `velocity`, `restSpeed`, `restDelta`; per-value overrides `{ rotate: {...} }` | — |
| Controls | `duration`, `time`, `speed`, `then` / `await`, `pause`, `play`, `complete`, `cancel` (revert), `stop` (commits WAAPI styles; cannot restart), `finished` | — |
| `stagger(step, { from, ease, startDelay })` | delay distribution over elements | small |
| `scroll(cb \| animation, { container, axis, target, offset, trackContentSize })` | scroll-linked; uses `ScrollTimeline` when the animation is accelerated; returns cancel | **5.1 KB** |
| `inView(el \| selector, (el, entry) => leave?, { root, margin, amount })` | IntersectionObserver; callback may return a leave fn; returns stop | **0.5 KB** |
| `hover(el, start → end?)`, `press(el, start → end(e, { success })?, { passive, once })` | gesture helpers; `press` filters secondary pointers, adds keyboard Enter handling, attaches its own listeners per element | small |
| `animateLayout([scope,] update, transition)` (≥ 14.1.0) | FLIP of `[data-layout]` elements around a DOM-mutating callback; `data-layout-id` shared-element / crossfade; `.shared(id, transition)`; async, returns controls. No vanilla `AnimatePresence`, so no crossfade back | not published |
| Other | `animateView` (View Transitions), `frame`, `mix`, `transform`, `wrap`, `spring`, `motionValue`, `styleEffect` / `attrEffect` / `propEffect` / `svgEffect`, `springValue`, `mapValue` | — |

### 1.3 DX people expect from `motion/react` (port the DX, not the code)

- `<motion.div>` with props `initial`, `animate`, `exit`, `transition`, `variants`, `custom`, `inherit`.
- Gesture props `whileHover`, `whileTap`, `whileFocus`, `whileInView` + `viewport` (`once`, `margin`, `amount`, `root`), `whileDrag` / `drag`.
- Events `onAnimationStart` / `onAnimationComplete` / `onHoverStart` / `onTapStart`…
- `layout` / `layoutId` / `LayoutGroup`; `AnimatePresence` (`initial`, `mode` sync / wait / popLayout, `custom`, `onExitComplete`).
- `MotionConfig` (`transition`, `reducedMotion` user / always / never).
- Hooks: `useAnimate`, `useScroll` (`scrollX/Y`, `scrollX/YProgress`), `useInView(ref, { once, margin, amount })`, `useMotionValue` / `useTransform` / `useSpring`, `useReducedMotion`.
- Variant priority (framer-motion `variantPriorityOrder`): `animate` < `whileInView` < `whileFocus` < `whileHover` < `whileTap` < `whileDrag` < `exit`.
- Variants propagate parent → child labels. `staggerChildren` / `delayChildren: stagger(…)` sit in the parent transition.
- Bundle: `motion` component ≈ 34 KB and cannot be tree-shaken, because features are props. `m` + `LazyMotion` brings it to 4.6 KB + `domAnimation` (+15 KB) / `domMax` (+25 KB).
  - Rivet's answer to this problem: §3.1 *feature-carrying props*.

### 1.4 Rivet constraints that shape the design

- Zero-cost rule: every subpath is independently tree-shakeable, and an untouched feature costs 0 B (`scripts/zero-cost`).
- Resumability (`docs/guides/resumability.md`):
  - handlers are inline arrows, or imported functions used by name (`_rMod`);
  - bindings re-run on resumed pages only when their signals change;
  - `clientEffect(fn, { when })` boots at its trigger;
  - context read inside a resumed binding gives the default, so read it in the component body;
  - closed overlay / provider children must be render functions.
- Preload planner: click / pointerdown / key / focus handlers → `intent`. Non-bubbling events (`pointerenter`…) → `visible` (chunks ≤ 8,192 B), background `P` within the 1 MiB budget. A library's own `import()` is **not** prefetched (loads on use).
- kit `<Transition>` / `createTransition` (`libs/kit/transition.tsx`):
  - resumable at zero JS: the phase machine is driven from bindings that read `show`;
  - it waits on `element.getAnimations()` before unmounting, so a WAAPI exit animation is awaited for free;
  - JS-driven (non-WAAPI) animations are not.
- House motion (memory "Embla motion reuse", `libs/cdk/motion`): embla physics (`Motion1D`, `ScrollBody`, `VelocityTracker`, `DragRelease`) for carousel / slider / sheet / wheel / compare / masonry FLIP. No CSS transitions or other easing in components that adopted it.
- Existing FLIP-like code:
  - `libs/cdk/masonry/flip.ts` (capture → pure geometry last → Motion1D per-frame `translate` + size; in progress, MASONRY lane);
  - `libs/cdk/drag-drop/dom/layout-shift.ts` (WAAPI FLIP timed by the item's own transform transition);
  - `libs/cdk/morph` `morphRectTo` (Motion1D rect morph);
  - lightbox zoom.
- CSP: no `<style>` elements from components (Rivet JSX rejects inline style content). Inline `style` attributes only.
- Icons: lucide via `@rivetjs/kit/icon` in every example.

## 2. Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | New real runtime lib `libs/motion` = `@rivetjs/motion`. Peer dependency `motion: ">=14.1.0 <15"`, devDependency `motion@14.1.0` exact. No dependency on `framer-motion` / `motion-dom` directly, never on React | `motion` is the documented public surface (`motion/mini` exists only there); 14.1.0 is the first with `animateLayout`; the range is pinned to the major we test. React peers are optional upstream, and the plan gate checks `npm ls react` unchanged |
| D2 | Subpaths, one file each, flat like kit: `@rivetjs/motion` (`Motion`, `MotionElement`, `MotionConfig`, `stagger`, `spring`, types), `/animate` (typed hybrid `animate` + sequences + controls), `/presence` (`Presence`, `PresenceFor`), `/layout` (`layout` feature, `LayoutGroup`, `animateLayout`, `layoutDriver`), `/scroll` (`createScroll`, `scrollAnimation`), `/in-view` (`createInView`), `/reduced-motion` (`prefersReducedMotion`). No subpath imports another except through `./engine.ts` (the shared mini engine glue) | Zero-cost: using `/in-view` never pulls `/layout`. Engine glue shared so two entries do not duplicate it |
| D3 | **T8 outcome (2026-10-12): `Motion` = `export * as Motion` namespace of per-tag compiled components (`tags.tsx`, 60 tags, tree-shaken per member); `MotionElement as` = lookup into it. The Proxy over `Dynamic` did not resume: props passed to `Dynamic` are no resume sites, so a resumed page bound no style / live / handler.** Original decision: `Motion` = `Proxy` over one `MotionElement(tag, props)` component (`<Motion.div>`, `<Motion.button>`, `<Motion.svg>`…; cached per tag). `<MotionElement as="div">` is exported too. The Proxy stays only if T3 measures it ≤ +100 B min and SSR / mount within noise of `as`; else `Motion` becomes a frozen object of the ~40 HTML / SVG tags used in practice | The user asked for `<Motion.div>`. Compound `X.Y` components already work (`ListBox.Item`). Lowercase member access is untested in the compiler's resume capture, so T3 also covers resume |
| D4 | Engine = **`motion/mini` animate** for every declarative prop. Independent transforms map to CSS individual transform properties (`x`/`y`/`z` → `translate`, `scale`/`scaleX`/`scaleY` → `scale`, `rotate` → `rotate`; `rotateX/Y`, `skew*`, `transformPerspective` → hybrid only). These are WAAPI-native and composited (Baseline 2022). Values that need hybrid (per-axis transitions on one CSS property, `pathLength`, non-registered CSS vars, colors in gradients, JS objects, sequences) → **dev error** naming the value and the fix: `animate` from `@rivetjs/motion/animate` in a handler / effect. Never a silent 18 KB. **D4b (T1 measurement; approved by the lead 2026-10-11, after 74b3aed9):** the JS path imports `spring` only when the transition carries Motion's `spring` generator *value* (`transition={{ type: spring }}`, `spring` re-exported from `@rivetjs/motion`: mini's own API), so springs cost +1.8 KB br only where used. **Fix round 1 (2026-10-12):** entrances take the same value (its `applyToOptions` gives the CSS `linear()` easing on server and client; the ported spring math is gone), and the string `type: "spring"` throws everywhere, naming the import | Keeps the first-interaction chunk ≈ 3.0 KB br (mini) + glue. Motion React's 34 KB problem is exactly the silent full engine |
| D5 | **Feature-carrying imports** instead of `LazyMotion`. **As built (T12):** `layout` is a plain prop (`true` / `"position"` / `"size"`; objects built at module level do not resume); the engine registers when `@rivetjs/motion/layout` is imported (named or bare `import "@rivetjs/motion/layout"`: the package lists it in `sideEffects`), else `layout` / `layoutId` write attributes only. `exit` needs a Presence scope (Presence or any kit Transition), whose import brings the code. Gestures (`whileHover` / `whilePress` / `whileFocus`) and `whileInView` are in core (≈ 0.6 KB br measured target) | Tree-shaking follows imports. An imported function used by name in JSX resumes by reference (`_rMod`), so resumability is unchanged |
| D6 | Prop names: `initial`, `animate`, `exit`, `transition`, `variants`, `custom`, `inherit`, `whileHover`, `whilePress`, `whileFocus`, `whileInView` + `viewport`, `layout`, `layoutId`, `onAnimationStart` / `onAnimationComplete`, `onHoverStart` / `onHoverEnd`, `onPressStart` / `onPressEnd`. **`whilePress`, not `whileTap`**: RA "press" vocabulary (cdk), no aliases (user rule). Values: objects, variant labels (`string \| string[]`), Signals or accessors (live props: every prop live) | Motion DX + Rivet rules (live props default live, no aliases) |
| D7 | `<Presence>` is built **on kit `createTransition`**. Every kit Transition scope (cdk Modal / Popover / Drawer / Toast / `TransitionChild`) is a Presence scope: a `Motion` element with `exit` inside a cdk overlay plays its exit with no extra wrapper. Kit gains two exports: `useTransitionScope()` and scope `hold(promise)`, which delays the unmount for JS-driven animations (WAAPI ones are already awaited via `getAnimations()`) | One enter/leave machine for the framework. cdk overlays keep working unchanged |
| D8 | `<PresenceFor each by>{(item) => …}</PresenceFor>` (`by(item, index)` = the key; `key` is reserved by JSX): keyed list with exit animations. It keeps a derived array (current ∪ exiting rows, original positions) in a signal over a plain runtime `For`. **No runtime / `For` ABI change**. Exiting rows get `data-exiting`, run `exit`, then drop out | Zero-cost for every `For` user. A `For` removal hook would cost bytes on the hottest list path |
| D9 | **SSR (ruling Q1, 2026-10-11): content is visible and LCP-valid without JS.** The server writes the **final** state (`animate`) as inline style, merged with the user's `style`. Transform keys use the individual properties (§3.3). An entrance (`initial` → `animate` at mount) is **lowered to CSS**: the element gets `data-mve="<hash>"`, and the page gets one rule per distinct entrance, deduped by content hash per page: `[data-mve="h"]{transition:<props> <dur> <easing> <delay>}` + `@starting-style{[data-mve="h"]{<initial>}}`. Springs (Motion's `spring` value) become `linear()` easings through the value's `applyToOptions`; multi-keyframe entrances become a `@keyframes` rule + `animation`. The rule carries `prefers-reduced-motion` in the same CSS: a `@media (prefers-reduced-motion: reduce)` override drops transform / layout properties, keeping opacity / color (`reducedMotion="user"`), all (`"always"`) or none (`"never"`). The rule ships through the kit head sink as `<style>` with the request nonce (CSP: strict nonce, same as kit scripts). In streamed segments it goes inline before the segment's first use. Without a head sink (plain `renderToString`), the fallback is a static stylesheet `@rivetjs/motion/entrance.css` driven by inline custom properties (`--rv-mve-*`); a dev warning shows when that sheet is missing. T5 measures both forms (bytes per page, SSR CPU, first-frame timing) and keeps the cheaper one as the default (both forms approved by the lead 2026-10-11). **LCP rule:** if T5 measures an LCP regression from `@starting-style` opacity-0 starts, entrances default to transform / clip-path terms only, and an LCP candidate never starts at `opacity: 0`. Candidates are the first `<img>` / hero heading in the shell, or an explicit `lcp` prop; the opacity term is dropped with a dev note. Values CSS cannot express at entrance (JS objects, SVG `pathLength`, per-keyframe JS easing functions) → the D4 dev error, with JS `animate` as the fix. Static `animate` (= `initial`) and `initial={false}` emit no rule | No flash, LCP-valid, zero JS for entrances, CSP-safe |
| D10 | Resume. Entrance: **no JS** (CSS, D9). Client-rendered elements (created after load) get the same `data-mve` rule (`@starting-style` applies on insertion), so client render and resume share one path. `whileInView` / `viewport`: `clientEffect(…, { when: "visible" })` in the small `MotionElement` leaf module (pattern: docs-kit `code-watch.tsx`), with the server rendering the `initial` state for in-view elements below the fold only (documented trade-off; `viewport={{ ssr: "final" }}` keeps them visible). JS (`motion/mini`) takes over only for live `animate` changes, `while*` gestures, layout, scroll / inView, and values CSS cannot express. Live `animate` changes: driven **from the binding** that reads the target, like kit Transition (zero JS until the signal changes). Gestures: `onPointerEnter` / `onPointerLeave` (planner → `visible` + background `P`, chunk ≤ 8 KB), `onPointerDown` + Enter / Space `onKeyDown` (planner → `intent`), `onFocusIn` / `onFocusOut` (`intent`). An element-level `preload` prop forwards to the directive | First hover / press finds the chunk evaluated (P at idle). No hydration: nothing runs for elements that never animate |
| D11 | `prefers-reduced-motion`: `MotionConfig reducedMotion="user"` default. `"user"` = Motion React semantics: transform + layout animations jump, opacity / color still animate. `"always"` / `"never"` as in Motion. Read live (`matchMedia` change listener, attached lazily on first animation). Entrances: handled in the D9 CSS. JS animations check the policy at start: live `animate`, gesture layers (hover / press / focus / in-view) and layout (per element, `data-layout-reduced`) all read the nearest `MotionConfig` (fix round 1, 2026-10-12); `MotionConfig transition` merges under every layer's own | Faithful to Motion; a11y default on |
| D12 | Layout = **one FLIP core** `@rivetjs/cdk/flip`, extracted from `masonry/flip.ts`: keyed capture (one read phase), last from caller geometry or one measure, invert, and a play **driver** interface. Default driver = house `Motion1D` (cdk stays motion.dev-free). `@rivetjs/motion/layout` adds `layoutDriver(transition)`, a WAAPI driver over mini `animate` (compositor `transform`), plus `layout` / `layoutId` / `LayoutGroup` / `animateLayout(scope?, update, transition?)` (Motion's vanilla signature; `update` runs in a reactivity batch, then the core measures). Motion's own `animateLayout` is **not** the engine, pending T12's measurement: it re-measures (no pure-geometry last, so masonry's zero-read write phase is lost), assumes a DOM-mutating callback, and its size is unpublished. T12 measures all three drivers on 1000-item masonry relayout; if Motion's wins on every metric, D12 flips and the spec records it | One FLIP engine for masonry / bento / drag-drop lists / morph / Motion `layout`. House feel stays the cdk default (memory rule), and Motion springs are opt-in per call |
| D13 | Embla physics keeps gestures, drag, flick, scroll-snap and wheel (cdk `motion`, carousel, sheet-motion, wheel-picker, slider, compare). `@rivetjs/motion` does declarative / keyframe / spring / scroll / in-view / layout. **No `drag` prop and no `/gesture` subpath in v1.** When `drag` is wanted it lands as a feature prop (`drag={drag}` from `@rivetjs/motion/drag`) on cdk `VelocityTracker` + `DragRelease` + `Motion1D`, not Motion's drag | One gesture physics across the framework (user rule). Avoids two drag feels |
| D14 | Primitives return signals / accessors, Rivet naming (`create*`): `createScroll({ container?, target?, axis?, offset? })` → `{ x, y, xProgress, yProgress }` accessors (server: 0; attach in `clientEffect` `when: "visible"` for element targets, `"idle"` for window); `scrollAnimation(ref, keyframes, scrollOptions)` (mini `animate` + Motion `scroll`, `ScrollTimeline` when available); `createInView(ref, { once, margin, amount, root })` → accessor (server `false`, `when: "visible"`); `prefersReducedMotion()` → accessor | Signals are Rivet's motion values. SSR-safe by construction |
| D15 | `/animate` re-exports hybrid `animate` typed for Rivet: targets accept `Element`, `Ref<Element>` (`ref()`), accessors, and arrays of them. Also sequences, `stagger`, `spring`, controls. A server call throws a dev error ("browser only: call from a handler / clientEffect") | Typed escape hatch. Hybrid weight only where imported |
| D16 | Benchmarks: new `apps/motion-bench` with lanes `rivet` / `motion-react` (React 19 + `motion/react`, isolated toolchain under `apps/bench-stable` conventions) / `vanilla` (`motion` by hand = floor). Reuses dom-bench's Playwright timing helpers. Results → `docs/benchmarks/2026-10-1x-motion.md` | dom-bench is krausest-shaped. Motion needs resume + gesture scenarios and a React baseline |

## 3. API

### 3.1 Components

```tsx
import { Motion, MotionConfig, stagger } from "@rivetjs/motion";
import { Presence, PresenceFor } from "@rivetjs/motion/presence";
import { spring } from "@rivetjs/motion";

<Motion.button
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}                      // object | label | label[] | Signal | accessor
  transition={{ type: spring, visualDuration: 0.3, bounce: 0.2 }}
  whileHover={{ scale: 1.04 }}
  whilePress={{ scale: 0.96 }}
  onPress={() => count.update((n) => n + 1)}           // user handlers compose with gesture handlers
>Save</Motion.button>

<Motion.ul variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delayChildren: stagger(0.04) } } }}
  initial="hidden" animate="show">
  <For each={items()}>{(it) => <Motion.li variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}>{it.name}</Motion.li>}</For>
</Motion.ul>

<Presence show={open()}>{() => <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}</Presence>
<PresenceFor each={toasts()} by={(t) => t.id}>{(t) => <Motion.li layout exit={{ opacity: 0, x: 40 }}>{t.text}</Motion.li>}</PresenceFor>
<MotionConfig reducedMotion="user" transition={{ duration: 0.2 }}>{() => …}</MotionConfig>
```

- `MotionElement` props = the tag's intrinsic props + `MotionProps`.
  - `ref` is forwarded: the user `ref` and the internal one compose.
  - `style` merges: user values win over animated keys at SSR only when not animated.
- Variants:
  - resolve against `custom` (variant functions `(custom) => target`);
  - children without own `animate` inherit the parent's labels;
  - the label signal is read **in the component body**, through `MotionContext`, not in bindings (resumed-binding context limit).
- Stagger on resumed pages: child order comes from the DOM at animation time (`[data-mv]` descendants whose nearest motion ancestor is the parent), not from a creation-time registry, which does not exist on a resumed page.
  - 1000 children with equal keyframes = **one** batched `animate(elements, kf, { delay: stagger(…) })` call.
- Gesture priority: framer-motion order (§1.3). A gesture end returns to the next active layer, not to `animate`.
  - Hover ignores touch (`pointerType === "touch"`).
  - Press: pointer capture + window `pointerup` / `pointercancel` (listeners added inside the handler, removed on end); Enter / Space on focusable elements.
  - `onPress` fires on success only (Motion's `info.success`).
- Events `onAnimationStart` / `onAnimationComplete(definition)` per Motion.

### 3.2 Functions

| Export | Signature (sketch) |
| --- | --- |
| `@rivetjs/motion/animate` `animate` | `animate(target: Target \| Ref<Element> \| (() => Element \| undefined), keyframes, options?) → AnimationPlaybackControls`; sequence form `animate(sequence, options?)` |
| `stagger`, `spring` | re-exports from `motion` (core + `/animate`) |
| `createScroll` | `(options?) → { x(): number; y(): number; xProgress(): number; yProgress(): number }` |
| `scrollAnimation` | `(target: ElementRef, keyframes, options: ScrollOptions & { transition? }) → void` (attaches in a `clientEffect` `when: "visible"`; the owner's disposal cancels it) |
| `createInView` | `(target, { once?, margin?, amount?, root? }) → () => boolean` |
| `prefersReducedMotion` | `() => boolean` (live) |
| `layout` | element prop `true \| "position" \| "size"` (D5 as built) |
| `LayoutGroup` | `{ id?, children }`: scopes `layoutId` matching |
| `animateLayout` | `(scope?: Element \| Ref, update: () => void, transition?) → Promise<Controls>` |
| `layoutDriver` | `(transition) → FlipDriver` for cdk masonry / bento / drag-drop `motion` props |

### 3.3 Value mapping (mini lane)

- `x`, `y`, `z` → `translate: "<x> <y> <z>"`. Composed per element from a small per-element value cache: the last committed values, so animating only `x` keeps `y`.
- `scale`, `scaleX`, `scaleY` → `scale`; `rotate` → `rotate` (deg); `opacity`, `filter`, `clipPath`, `backgroundColor`, `color`, `borderRadius`, `width`, `height`, any WAAPI-animatable CSS property → as-is.
- Numbers get Motion's default units (`px`; `deg` for rotations).
- One transition per CSS property per animation. `x` and `y` with different transitions → dev error (D4).
- The server writes the same mapping (pure `toStyle(target)`, shared by both targets).

## 4. SSR + resumability walkthrough

| Case | Server | Resumed page (no hydration) | Client render |
| --- | --- | --- | --- |
| static (`animate` only, or `initial={false}`) | target styles inline | nothing recorded, 0 JS | styles set at creation |
| entrance (`initial` → `animate`) | **final** styles inline + `data-mve` rule (`@starting-style` / `@keyframes`, reduced-motion media query) in the head (nonce) | **nothing**: CSS plays it, 0 JS | same rule; `@starting-style` applies on insertion |
| `whileInView` | `initial` inline | `clientEffect` `when: "visible"` → `inView` attach | same, attach on mount |
| live `animate={sig}` | current target inline | binding reading `sig` re-runs on change → animate (chunk planned `intent` / `visible`) | binding |
| `whileHover` / `whilePress` / `whileFocus` | nothing extra (`data-mv`) | handlers resume. Planner: pointerenter → `visible`/`P`, pointerdown / key / focus → `intent`; first event runs the gesture synchronously when evaluated, else on chunk arrival (gesture state from the live pointer) | handlers |
| `exit` under Presence / kit Transition | nothing | leave phase (binding-driven) → exit `animate`; WAAPI awaited by `getAnimations()`, else `hold()` | same |
| `layout` / `layoutId` | `data-layout` attribute only | FLIP core captures on `animateLayout` / scope changes | same |

- Measured gate (plan T8): a resumed page with 100 static + 100 gesture `Motion` elements boots **nothing at load** (`data-boot` absent). Before input, the network panel shows only the planned `P` chunk at idle. The first hover animates in ≤ 1 frame after pointerenter once that chunk is evaluated.
- Without JS, entrance content is in its final state (inline) and plays its CSS entrance. Browsers without `@starting-style` (pre-Baseline 2024) show the final state at once. `whileInView` below the fold is the one case where the server renders `initial` (D10).

## 5. Layout / FLIP (D12)

- `@rivetjs/cdk/flip` (Rivet-authored, from `masonry/flip.ts`):
  - `captureBoxes(elements, relativeTo, rtl)`;
  - `playFlip({ items: [{ el, from, to }], viewport?, driver })`, where `to` comes from caller geometry or `measureBoxes` (one read);
  - interruptible (start from the current visual box); items outside the viewport before and after jump;
  - `FlipDriver = { play(frame: (t: number) => void, onDone): Stop } | { waapi(el, from, to, onDone): Stop }`.
- Drivers: `motion1dDriver(options?)` (default, house feel; per-frame writes) and `layoutDriver(transition)` (`@rivetjs/motion/layout`; per-element WAAPI `transform` + size keyframes, compositor).
- Consumers after extraction (plan T11):
  - masonry / bento (`motion` prop accepts `boolean | MotionOptions | FlipDriver`);
  - drag-drop `layout-shift.ts`: keeps its transform-transition timing, but uses the shared capture;
  - morph `morphRectTo`: stays Motion1D rect morph, gains shared capture only if bytes drop, measured.
- T12 measurement (1000-item masonry relayout, Chromium, 4× CPU): drivers Motion1D / WAAPI / Motion's `animateLayout`.
  - Metrics: scripting ms to first frame, forced layouts (spy count), dropped frames over the animation, bytes.
  - Record in `docs/benchmarks/2026-10-1x-motion.md`.

## 6. Perf budget

| Metric | Budget (verified in T1 / T13; numbers become `size-report` entries) |
| --- | --- |
| `@rivetjs/motion` core JS path (Motion + mini + glue + gestures + inView attach; spring / stagger only when imported, D4b) | ~~≤ 12 KB min / ≤ 4.2 KB br~~ **measured (fix round 1, 2026-10-12): client `Motion.div` 28.7 KB min / 9.8 KB br** (runtime + reactivity external; `inView` is a lazy chunk, +0.26 KB br): element core + gestures + `motion/mini` 8.05 KB br, client entrance rules (`entrance.ts` + `css.ts` + memo, D10: client and resume share the CSS path) +1.77 KB br. Resumed hover path (tree-shaken `gesture` graph, no `css.ts`) 18.6 KB min / 6.3 KB br. Reason: mini alone is 3.0 KB br; gesture layers, variants, the value mapping and live bindings are the rest. **Budget = 9.8 KB br (ruled 2026-10-12, speed over size, user rule 2026-10-07): client entrances stay on the CSS path, not moved to the JS engine** |
| Entrance (CSS path) | 0 B JS; ≤ 160 B br of CSS per distinct entrance per page; SSR CPU ≤ +10% vs the same element without entrance |
| `/animate` | motion hybrid (≈ 18 KB) + ≤ 0.3 KB br glue |
| `/presence` | ≤ 1.2 KB br over kit `transition`. Measured: `Presence` 1.52 KB br, `PresenceFor` 1.92 KB br (with kit `transition`) |
| `/layout` (incl. `cdk/flip`) | ~~≤ 2.5 KB br~~ measured 5.19 KB br for `LayoutGroup` + `animateLayout` + `layoutDriver` (mini `animate` + cdk FLIP core + Motion1D default driver) |
| `/scroll` | motion `scroll` (≈ 5.1 KB) + ≤ 0.4 KB br. Measured `createScroll` + `scrollAnimation` 6.23 KB br (incl. mini) |
| `/in-view`, `/reduced-motion` | ≤ 0.8 KB br, ≤ 0.2 KB br. Measured 0.52 KB br, 0.17 KB br |
| App not importing motion | **0 B** (zero-cost hashes of every other package identical) |
| SSR 1000 `<Motion.div initial animate>` | ~~≤ 1.3× 1000 `<div style>`~~ unreachable for any spread component (plain element 0.061 ms). Measured min ms (fix round 1): static 1.21–1.26 (was 2.57), entrance 1.69–1.73 (was 3.3); React 19 `motion/react` 0.88–0.91 / 1.26–1.28. The rest is renderer cost per omitted slot (`admit` 18%, `ref` 10%): runtime patch prototype reaches 0.97 / 1.38 (runtime lane) |
| Resumed page, static + gesture elements | 0 boot JS. State bytes ≤ 12 B br per gesture element (handler entries only). Measured 6.65 B br |
| First hover on resumed page (P chunk evaluated) | animation starts ≤ 16 ms after pointerenter. Cold (no prefetch) ≤ chunk RTT + 1 frame. Measured 31 ms in the resume harness (unbundled: the symbol module imports `element.mjs`, a 10-module waterfall; open, loader lane) |
| Entrance on resume | plays with the first paint (CSS); LCP time equal to the same page without entrance ± noise (T5 measures LCP with opacity-from-0 starting styles) |
| 1000-item stagger (opacity + y) | ≤ 8 ms scripting to start (one batched call), compositor-only frames, heap ≤ 1.5 MB. Compared to motion-react and vanilla lanes |
| Mount 1000 `Motion.li` (client render) | ≤ 1.5× plain `li` with a style binding |

## 7. Docs

- `apps/docs`:
  - new section `content/guides/motion/`: `index.md` (install, `Motion`, values, transitions, gestures, SSR + resume model, reduced motion), `presence.md` (Presence, PresenceFor, kit Transition relationship, cdk overlays), `layout.md` (layout, layoutId, animateLayout, drivers, house motion vs Motion springs), `scroll.md` (createScroll, scrollAnimation, createInView);
  - API reference in `content/reference/motion.md`;
  - `guides/components/lists.md` links to PresenceFor; `content/ui/kit.md` (Transition) gets a "with Motion" note.
- `apps/ui-docs`:
  - `content/start/animation.md` gains a Rivet section (marked non-upstream for the drift test);
  - examples `motion-button-press`, `motion-modal-presence`, `motion-drawer-presence`, `motion-masonry-expand` (masonry `motion={layoutDriver(spring)}`), `motion-toast-stack` (PresenceFor + layout). Icons via `@rivetjs/kit/icon`.
- `apps/cdk-docs`:
  - `foundations/motion.md` names the split: house physics vs `@rivetjs/motion`;
  - masonry page documents the `FlipDriver` value.
- Regenerated (never hand-edited): llms.txt / llms-full.txt / per-page `.md` (`docs-kit llms --check`), MCP data (`libs/mcp/build-data.ts`, adds `@rivetjs/motion` to the component reference), AI sources in `libs/mcp/ai` (agents.md rule line: "animations: `@rivetjs/motion`; gestures / drag physics: cdk motion"), `sync.ts` outputs (starter AGENTS.md / CLAUDE.md / skills `rivet-ui-design` interactions section).
- CLAUDE.md: new `libs/motion/CLAUDE.md`; root repo map row; `libs/kit/CLAUDE.md` (scope exports); `libs/cdk/CLAUDE.md` + `masonry/CLAUDE.md` + new `flip/CLAUDE.md`; `docs/CLAUDE.md` index.

## 8. Testing

- `libs/motion/tests/` (vitest projects `motion` node, `motion-browser` Chromium; happy-dom lacks WAAPI, so every animation test is Chromium):
  - node: `toStyle` mapping, variant resolution + priority, transition merge, dev errors (hybrid-only values, `x`/`y` split transitions), server markup (`initial` / `initial={false}` / merged `style`, no `<style>`);
  - browser: animate to target (WAAPI `getAnimations()` + final committed style), live `animate` signal, gestures (hover with mouse only, press success / cancel, keyboard Enter / Space, focus-visible), variants + stagger order + one batched call, Presence exit holds unmount (kit scope + `hold`), PresenceFor (exit rows keep position, re-add during exit), cdk Modal content exit with no Presence, layout + layoutId (box continuity), scroll / inView primitives, reduced motion via emulated media (`"user"` jumps transforms, keeps opacity; live media change);
  - resume (`libs/runtime/tests/resume/harness.ts`, like kit icon): static elements record nothing; entrance runs at load without re-creating the region; first hover / press animates with no hydration and without loading `/animate`; network log shows no `motion` hybrid chunk.
- `libs/cdk/tests/flip.test.ts` + `flip.browser.test.tsx` (core, drivers, interruption, viewport skip); masonry suites stay green after extraction.
- Zero-cost: add `libs/motion` to `scripts/zero-cost/packages-hashes.mjs` `PACKAGES` (+ baseline lines, intended delta), dev-leaks (`#dev` only), condition parity. Add a lane check: a kit / cdk app not importing motion keeps identical hashes.
- size-report: entries for each subpath (§6).
- motion-bench: scenarios `ssr-1000`, `mount-1000`, `stagger-1000`, `hover-first` (resumed, P and cold), `entrance-resume`, `masonry-relayout-1000` (T12 drivers).

## 9. Rulings (2026-10-11, lead)

- Q1 (SSR entrance invisible without JS): **rejected as designed**. Content must be visible and LCP-valid without JS. The entrance is lowered to CSS: final state inline + a scoped `@starting-style` / keyframe rule, deduped per page, with `prefers-reduced-motion` in the same CSS. JS only for live `animate`, gestures, layout, scroll / inView and values CSS cannot express (D9, D10). Measure both paths in T5 / T12.
- Q2: **no `drag` in v1**; Embla keeps gestures (D13).
- Q3: springs in cdk overlays are **opt-in via a motion token** (`--rv-motion-spring` / theme option); the default stays house `Motion1D` (D17).

| # | Decision | Why |
| --- | --- | --- |
| D17 | cdk overlays (Modal / Drawer / Popover / Toast) read a motion token: CSS custom property `--rv-motion-spring` (spring params, e.g. `0.3 0.2` = visualDuration bounce), or theme option `motion: { overlays: "spring" }` in `@rivetjs/ui`. Set → enter / exit use a Motion spring (CSS `linear()` easing on the kit Transition classes; no JS engine for plain fades). Unset → today's behaviour / house `Motion1D`. Read once per overlay open, no load-time JS | Ruling Q3; zero cost when unset |

## 10. Risks

- Motion 14.x churn: 14.0.0 → 14.1.0 in one week. Mini / hybrid internals and `animateLayout` may shift. Pin `<15`, and the browser suite runs against the exact devDependency.
- Individual transform properties (`translate` / `scale` / `rotate`) compose with a user `transform` in CSS order, not Motion's order. Document it; dev warning when both are animated.
- `@starting-style` entrance + LCP: Chrome reports LCP for an opacity-0 start only when it becomes visible. A long fade could delay LCP, so T5 measures it. On a regression, the D9 LCP rule applies: transform / clip only, never opacity 0 on LCP candidates.
- The nonce'd `<style>` head rule needs the kit head sink. Pages without it use the custom-property sheet; a missing sheet = entrance without animation (still visible).
- Resume edge cases: gesture handler chunk evaluated mid-gesture, Proxy member components in re-created regions, variant context read in bindings. Each has a resume test (T8).
