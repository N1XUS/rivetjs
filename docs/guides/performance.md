# Performance guide

Rules for runtime / cdk / router hot paths. Every change still needs a measured win (ssr-bench, dom-bench, size-report); this page records measured idioms so lanes do not re-measure them.

## Hot path idioms

Measured by lane HOTPATH 2026-10-09 (Chromium CDP profiles of cdk mount lanes, Node 26 in-process SSR). Ratios are mount-time medians on interleaved fresh pages.

- **Memoise pure Intl work per locale string.** `new Intl.Locale(…)`, `Intl.*.supportedLocalesOf`, `resolvedOptions()`, calendar creation are µs-scale; cdk called them per component / per segment. Bounded `Map` keyed by the locale string (or `locale|option`), `WeakMap` keyed by the formatter. cdk `i18n` `isRTL` / `getDefaultLocale`, `state/date-field.ts` `resolveCalendar` / `resolvedOptionsOf`: DatePicker ×300 −19%, Select / ComboBox −14%.
- **Parse once per key string.** Per-element regex / `toLowerCase` / set tests on prop names (`onKeyDownCapture` → type, capture, delegated) belong in a module-wide cache keyed by the name, bounded (512) so arbitrary keys cannot grow it. runtime `_spread` `listenerOf`: Checkbox ×1000 −12%, TextField −8%.
- **Memoise derived arrays by identity.** A list derived from an immutable array (segment keys from `segments(state)`) → `WeakMap<source, derived>`; hand callers a `.slice()` if they may mutate.
- **No `FinalizationRegistry.register` per instance.** Registration costs more than the object it watches. Use a `WeakRef` list pruned at power-of-two lengths plus an amortised sweep when the map doubles (cdk `utils/id.ts`).
- **Keep `JSON.stringify` input on V8's fast path.** Node 26's fast serializer bails for the WHOLE call (~3×) on one sliced or cons string, or one object with integer / digit-leading keys. Flatten strings you slice yourself with an own-key round trip (`Object.keys({ [s]: 0 })[0]`, ~0.1 µs; `.trim()` / `Number()` flatten cons strings, not sliced ones); write integer-keyed maps by hand and stringify the rest in runs (runtime `resume-format.ts` `flat`, `server-resume.ts` `idMap` / `bindingsJSON`: 100-row resume table 26 → 7.8 µs, bindings 4.0 → 1.6 µs). Escape scans: `indexOf` + `replaceAll` with a one-character pattern (memchr) over a regex (10 KB 2.5 → 0.2 µs).
- **Delegate hover / focus; no native listener per element.** React semantics without per-element listeners: delegated `pointerover` whose `relatedTarget` is outside `currentTarget` = pointerenter (`hoverStateOver`); delegated `focusin` with `target === currentTarget` = focus, plus one transient native `blur` listener while focused (`focusStateIn`). Bind the user's `onPointerEnter` / `onPointerLeave` only when given (`onX={user ? (e) => user(e) : undefined}` binds nothing when unset). cdk Table ×1000: listeners 28k → 8k, mount −8%, dispose −20%, heap −7%; DatePicker ×300: listeners 7500 → 300, dispose −19%, heap −6%.
- **Frozen arrays iterate slower, cached encodes do not care.** `Object.freeze`d arrays iterate ~3 ns/element slower on Node 26, but SSR writers iterate cached `encoded()` `Uint8Array[]` (plain arrays); un-freezing the SSR constants measured within noise. Do not freeze per-call literals carrying accessors (see `libs/runtime/CLAUDE.md` server notes); frozen module constants are fine.
- **`style.cssText`, not `setAttribute("style")`.** The attribute write is faster in a micro but CSP `style-src` without `'unsafe-inline'` blocks it; CSSOM writes are allowed.
- **Insert with an `insertBefore` loop.** Faster than building a `DocumentFragment` or `append(...nodes)` for the row / child counts we render.
- **Descriptor scans cost ~21 ns per key.** `Object.getOwnPropertyDescriptor` in a loop and `__lookupGetter__` cost the same on V8; skip the scan (flag at creation) instead of swapping the API.
- **One pass, not `map` + `filter`.** Chained array helpers allocate an intermediate per call; a single loop pushing into one array is the hot-path form.

Measured by lane CODE-SMELL-A 2026-10-11 (Node 26 in-process micro-benchmarks, interleaved, median; numbers in the commit bodies).

- **Bounded caches apply to every per-key / per-header parse.** cdk `globalDOMProps` / `textInputDOMProps` (key → regex match, 512): `pick` over a 12-key part bag −41%; router node adapter `negotiate` (Accept-Encoding string → encoding, 64): 307 → 6 ns. Keys / headers are user / client text: always cap the Map.
- **Constant array literal arguments are free.** `hasLiveProp(props, ["class"])` vs a hoisted constant: same ns and bytes (TurboFan escape analysis drops the literal once the callee inlines). Do not hoist them for speed.
- **Create rarely used per-element side tables on first use.** DOM `_spread` state: 4 of its 5 empty objects (`own` / `direct` / `handlers` / `names`) are needed only for direct listeners or past the name cap; `??=` at the use site: 364 → 190 B per spread element.
- **Compact in place instead of `filter` per step.** `_class` toggles: one array per call (split, trim the empty ends, in-place removal): 1 base + 2 toggles 159 → 115 ns, 1.18 → 0.59 KB.
- **Pass the match you already have.** A memoised matcher still costs a call + result object per lookup: router `_layouts` passing its hit to `keysOf` −7% per SSR request.
- **Getter scans: keep the per-key descriptor loop.** Over an 8-key static bag `Object.getOwnPropertyDescriptors` is 5.4× slower and `__lookupGetter__` +39% (alloc-free, still slower); `for…in` is only −5% and walks inherited keys / proxy traps — not worth the semantic change (CODE-SMELL-B).
- **Allocate result lists on first need.** `mergeRefs` building its cleanup list only once a ref returns one: 16.0 → 10.8 ns, 185 → 1 B per call; `liveOptions` indexing `keys` then `controlled` instead of joining them: −15%, −231 B per part.
- **Short exclusion lists: `includes`, not a `Set`.** A 3-key `liveOmit` with a fresh `Set` is +24% (the Set costs more than the scans it saves).

Measured by lane RESUME-DROP-MARKERS 2026-10-18 (Chromium 141 CPU profiles of the resume-bench `filter` keystroke, 4× CPU; numbers in `apps/resume-bench/CLAUDE.md`).

- **Every `removeChild` costs; a comment's about a third of an element's.** Removing 1,800 marker comments next to 900 `<li>`s was +16 ms on a 46 ms removal pass (4×). A `Range.deleteContents` per contiguous run saves nothing (Blink removes node by node inside it); only a whole-parent wipe (`textContent = ""` / `replaceChildren`) is bulk, and it re-inserts what is kept (focus / media / animation state lost), so it stays limited to the nothing-kept path. Leave inert markers in place instead of removing them one by one (`dom-adopt.ts` `left`).

