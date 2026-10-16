# libs/cdk/compare

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`@rivetjs/cdk/compare` (+ `/behaviour`): Rivet-authored before / after comparison: two stacked layers and a draggable divider. No upstream: React Aria / RAC / Angular CDK have no compare slider. User request 2026-10-09: "new component - Compare, side-by-side comparison with drag handle". `@rivetjs/ui/compare` = the HeroUI-styled version.

## Files

| File | What |
| --- | --- |
| `behaviour.ts` | State + handlers, no JSX. `createCompareState(options)` (`value` value / Signal / accessor via `controllable`, `defaultValue` 50, `onChange`, `onChangeEnd`, `orientation`, `isDisabled` bool / accessor, `step` 1, `pageStep` 10, `dragAnywhere`, `animation` bool / `{ duration, friction }` (defaults `COMPARE_DURATION` 20 / `COMPARE_FRICTION` 0.68; `false` → duration 0), `direction`, `locale`); readers `compareValue`, `comparePosition` (animated `position()` ?? value), `isCompareDisabled`, `compareValueText` (Intl percent); inline styles `compareRootStyle` / `compareAfterStyle` (`clip-path: inset(…)` + `-webkit-`) / `compareHandleStyle`; `compareRootOf`, `compareValueAt(state, rect, x, y, raw?)`, `compareSetValue(state, v, "animate" \| "follow" \| "jump", el?)`, `comparePointerDown(event, state, fromSurface)`, `compareDragEnd`, `compareKeyDown`, `compareDispose`; `COMPARE_KEYS` (`data-rk`). |
| `index.tsx` | Parts: `Compare` (root `div`, provides `CompareContext`, `preload="visible"`, surface `pointerdown`), `CompareBefore`, `CompareAfter`, `CompareHandle` (`role=slider`), `CompareDivider`; `CompareContext` (`resumableContext`, id `rv-compare`), `useComparePosition()`; re-exports the behaviour API. |

## Invariants

- Value = before share in percent from the start edge (left / RTL right / top). After layer on top, clipped to the end side with an inline `clip-path` (behaviour-critical styles inline, never keyed on classes). Handle positioned inline (`left` / `right` / `top` + translate), `touch-action: none`; root `touch-action: pan-y` / `pan-x` only with `dragAnywhere`.
- Pointer: absolute mapping (pointer position → value), not RA `useMove` deltas. Handle press keeps the grab offset (raw value + offset, clamped once in `compareSetValue`), no jump; frame press (`dragAnywhere`) animates to the point, then `"follow"` retargets the running motion (continuous). Window `pointermove` / `pointerup` / `pointercancel` listeners exist only during a drag; ignored: disabled, non-primary button, ctrl-click, a surface press on the handle (the handle's own handler runs). Text selection locked while dragging; the handle is focused on press (`noteModality` first).
- Keys (RA slider rules): horizontal ArrowRight / ArrowUp increase (RTL ArrowLeft / ArrowUp); vertical spatial (ArrowDown / ArrowRight / PageDown increase). Shift = `pageStep`, Home / End = 0 / 100. Keyed values snap to `step` (floor up / ceil down); a key that does not move the divider fires nothing. `onChange` + `onChangeEnd` per moving key.
- Motion: value commits at once; `position` signal animates through a lazily created `Motion1D` (reduced motion / duration 0 / `"jump"` → `position` null). `data-moving` while `position() !== null`.
- Resumable: state = signals + JSON; runtime (motion, drag) in a module `WeakMap` keyed by the state, created by the first interaction. NO client effect / unmount hook (it would put an `fx` entry in the resume state and boot the page at load): a drag whose root left the document ends on its next move (`compareDispose`); a settle on a removed root just finishes. `tests-components/compare.test.ts` (ui) asserts no `"fx"` in the server state.
- Live props: `value` (controlled) and `isDisabled` become accessors (`liveOptions`); the rest read once. A value changed from outside jumps (no follower effect: same no-boot reason).
- ARIA: handle `role=slider`, `aria-valuemin` 0 / `max` 100 / `now` (rounded) / `valuetext` (default percent, string or `(value) => string`), `aria-orientation`, `aria-disabled`; default `aria-label` "Comparison position" unless `aria-labelledby`. Disabled handle: no `tabindex`.
- Data attributes: root `data-rv-compare`, `data-orientation`, `data-dragging`, `data-moving`, `data-disabled`; layers `data-rv-compare-before` / `-after`; handle `data-rv-compare-handle`, `data-rk`, `data-dragging`, `data-disabled`, `data-hovered` (`hoverStateOver`), `data-focus-visible` (`focusStateIn`); divider `data-rv-compare-divider`. Every part forwards global DOM props (`globalDOMProps`); user `onPointerDown` / `onKeyDown` run after the part's own handler.

## Gaps

- No `render` prop on the parts; no animated follow of an outside value change; single pointer only.

## Tests

- `../tests/compare.browser.test.tsx` (cdk-browser, 10), `../tests/compare-ssr.test.ts` (cdk, 3); ui: `libs/ui/tests/compare{,.server}.test.tsx`, `libs/ui/tests-components/compare.test.ts` (resumed page).
- Docs: `apps/cdk-docs/content/components/compare.md` (examples `compare-{basic,vertical-css,controlled}`), `apps/ui-docs/content/components/compare.md`.
