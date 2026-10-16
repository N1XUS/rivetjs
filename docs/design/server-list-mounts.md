# Server list mounts

Status: implemented, default on for `target: "server"` (`serverListMounts: false` disables; used by differential tests).

## Contract

- Compiled JSX output is opaque: only valid to render or compose. Its internal shape (records, fragments, slots) is not public API. Hand-written `template()` / `compiledTemplate()` are unchanged.
- Requires untampered built-ins (Rivet's trust model: ordinary intrinsics after startup, like React / Solid).

## What is lowered

- `{items.map(item => <native …/>)}` or `{items.map((item, index) => <C …/>)}` as a direct child expression of a native element.
- Callback: plain arrow, expression body, 1–2 identifier params, no defaults/rest/destructuring, single argument to `.map`, no optional chaining.
- Body: native element (no `model:`), or component `C` where `C` is:
  - top-level `function` declaration, not async/generator, never reassigned;
  - ≤1 parameter; single trailing `return <native JSX>`; no other return outside nested functions;
  - no `this` / `arguments` / `super` / `new.target` in its own scope (arrows included).
- No spread props at the call site.
- Everything else compiles as before.

## Output

- `C__rivetTape(tape, base, …)` twin next to `C`: same statements, final JSX stores slot values at `tape[base + n]`.
- Flat destructured param `{ a, b: c, d = 1 }` → positional params; call site evaluates every authored prop in source order (temps when order differs), passes bound ones by position. Other params receive the original props object.
- Hoisted plan: `_listPlan(fragments, attributes)`; attribute entries carry compile-time validated name/namespace.
- Site: `_list(items, original, plan, each)` → one list record `{ [LIST], plan, tape, rows }`.
- Nested components: a twin-eligible `<D …/>` in a native child position of a row (map body or twin JSX) is flattened:
  - parent twin calls `D__rivetTape(tape, base + offset, …)` in place; no record/props per nested call;
  - parent plan entry references `D__rivetPlan`; `_listPlan` splices D's fragments between two break slots at module load (plans emitted children-first);
  - break slots hold no value; string writers flush there, matching the old per-child record writes;
  - edge P→D flattens only if D cannot reach P (recursive components stay records); zero-param components get no props object;
  - compile-time static width (mirrors `walk`) checked against lowered plan → internal diagnostic on mismatch.
- Keyed `<For each by>{(row, index) => <native/> | <Twin …/>}</For>` (structural `For` import, sole concise arrow child, 1–2 identifier params, no spread / `children` / `r:slot` on the For, no `model:`; non-resume): `For({ …, children, $list: [plan, each] })`. Runtime `For` without a row hook → `_list(items, (item, i) => children(() => item, () => i), plan, each)`: rows share the For root as before (no per-row owner either way), same bytes. `each(tape, base, item, at)` rebuilds `row = () => item` / `index = () => at` then stores the slots. With the resume row hook installed, `$list` is ignored.
- Resume mode: `.map` rows lower only when the row (callback / twin) holds no resume site.

## Semantics kept

- Eager: all rows evaluate (and throw) before any output, in author order.
- `_list` with intrinsic `map` on an Array whose constructor is `Array`: Get `map`, Get `length` (ToLength), Get `constructor`, then HasProperty/Get per index — same observable steps as `Array.prototype.map`; holes skipped; live length mutation behaves as map.
- Non-intrinsic `map` → original callback via that `map`. Subclass/species → spec species path with the original callback.
- Admission scans the tape in row/slot order, so async siblings are admitted before earlier output fails.
- Rendering: same bytes; string writers see the same chunk boundaries as per-row records (flush at row end, attributes as separate writes). Object attribute values (thenables, coercible objects) take the generic attribute record path at render time.
- Engine error messages for non-function `map` / non-constructor species differ (type matches).

## Measured (bench adapter, host probe, discard sink)

- Render allocation 273 → 105 B/row (88 B = 11 captured values); presized tape up to 65,536 slots.
- Render CPU: 1k 0.43 → 0.32 ms; 5k 2.70 → 1.84 ms.
- Docker c=1 medians vs Razor (3 repeats): 5k CPU 7.0 vs 11.7 ms, p50 4.9 vs 10.9, p99 9.6 vs 19.4, TTFB 3.0 vs 9.7, peak 77 vs 103 MiB; 1k CPU 1.03 vs 1.53, p99 2.62 vs 2.81.

## Tests

- [server-list.test.ts](../../libs/compiler/tests/server-list.test.ts): differential vs `serverListMounts: false` across string/slow/byte writers, hostile values, nested lists, async children, Proxy trap order, holes, mutation, species, custom `map`, unsafe URL, abort, admission, eligibility, positional props, nested/recursive components. Mutation-verified.
