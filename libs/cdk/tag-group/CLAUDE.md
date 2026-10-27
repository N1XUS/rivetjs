# libs/cdk/tag-group
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC TagGroup / TagList / Tag + RA useTagGroup / useTag on the `grid-list/behaviour` port. Subpaths: `tag-group` (index.tsx), `tag-group/behaviour`.

## Files
| File | What |
| --- | --- |
| `index.tsx` | TagGroup (TagGroupContext), TagGroupInternalContext (state, labelledBy / describedBy, onRemove), TagList (TagListContext), Tag (leaf ItemNode; ButtonContext slot `remove`). |
| `behaviour.ts` | `tagGroupOptions`, `tagGroupKeyboardDelegate` (horizontal), `tagGroupProps`, `tagProps`, `tagKeyDown` (Delete / Backspace), `tagRemove`, `tagFocus` / `tagBlur` (remove description). |
| `intl.ts` | RA intl/tag strings. |

## Invariants / gotchas
- Remove-button slot props: plain values / inline arrows, no accessor (`isDisabled: () => …`) in the ButtonContext slot; use an `untrack(...)` snapshot (rule from the serialized model, where the accessor made the provider unserializable; kept until a derived test covers accessor slot props).
- TagList calls `gridListItemsChanged` in a clientEffect + microtask: focus moves to the next tag (or the grid) after removal.
- `tagProps` roving `tabIndex` reads focus keyed (`../selection/keyed.ts` `isFocusedKey` + `hasFocusedKey`): a focus move re-runs the two tags involved, not every tag. Remaining focus-move cost is the handlers' DOM collection scan (`listStateView` → `domCollection`, O(tags) per event).
- `render` prop (RAC DOMRenderProps; `(attrs, renderProps)` → spread attrs; early return before the compiled element; `tests/render-collections.browser.test.tsx`) on TagGroup / TagList / Tag
- Pending: tooltips (C1b).
- Live props (P5): TagGroup root class via `liveClass` in the spread bag (no explicit `class` attribute on the div); TagList / Tag `class` / `style` / `children` render props read live (`renderProps(…, props)`, untracked); Tag `isDisabled` still read once (gap)
- `aria-label` + a visible Label: the TagList is labelled by both (RA useField / useLabel: `aria-labelledby` = label id); the server sees the Label through `markSlotRendered` (the Label renders before the TagList), so resumed and client renders match (CDK-PINS 2026-10-12).
- Gap (CDK-PINS follow-up, 2026-10-12): the server TagList `aria-describedby` names `<id>-description` / `<id>-error` even when those Description / FieldError parts do not render (IDREFs to nothing); unchecked against the client render, not pinned. Follow-up.

## Tests
`tests/tag-group.browser.test.tsx`, story `tests-components/tag-group.test.ts` (route `app/src/routes/tag-group.tsx`).

- ID-RESUME (2026-10-27): Generated label and remove-button ids use the shared `resumedId()` keyed-signal helper. The resume record retains the server id when parts adopt independently. Existing explicit-id fallback and ARIA behaviour are unchanged.
