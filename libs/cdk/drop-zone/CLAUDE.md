# @rivetjs/cdk/drop-zone
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `DropZone` + react-aria `useDrop` (native drag events) + `useClipboard` (paste): an area objects / files are dragged or pasted into.

## Entry points
- `@rivetjs/cdk/drop-zone` -> `index.tsx`: `DropZone`, `DropZoneContext`, `DropZoneProps`, `DropZoneRenderProps`; re-exports from `dnd.ts`: `DragTypes`, `DIRECTORY_DRAG_TYPE`, `readFromDataTransfer`, `isTextDropItem` / `isFileDropItem` / `isDirectoryDropItem`, types `DropItem` (`TextDropItem` / `FileDropItem` / `DirectoryDropItem`), `DropOperation`, `DragTypesLike`, `Drop{Enter,Move,Exit,Activate}Event`, `DropEvent`, `DropOptions`

## Layout
- `index.tsx` - zone `div` (own JSX drag / pointerover / pointerup handlers) + visually hidden `<button>` (focus target, focus ring → zone `data-focused` / `data-focus-visible`, `on:beforepaste` (custom event: not in the compiler's native list) / `onPaste`, accessible name); `TextContext` `{ id, slot: "label" }` for `<Text slot="label">`
- `dnd.ts` - drop half of react-aria dnd `constants.ts` / `utils.ts` / `useDrop.ts`: `dropDragEnter / dropDragOver / dropDragLeave / dropDrop(opts, e)` with per-element `WeakMap` state (enter counter, last operation, activate timer), `setDropTarget(el, value)` callback
- `intl.ts` - generated `// @rivet-locale-table` `dropzoneLabel` (34 locales, `@react-aria/dnd` intl)
- tests: `../tests/drop-zone.browser.test.tsx` (port of RAC `DropZone.test.js`, real `DataTransfer` in Chromium)
- docs: `apps/cdk-docs` API entry; styled: `libs/ui` `DropZone` (`apps/ui-docs/content/components/drop-zone.md`)

## Upstream
- react-spectrum main 06891def3e: `packages/react-aria/src/dnd/{useDrop,utils,constants,useClipboard}.ts`, `packages/react-aria-components/src/DropZone.tsx`, `test/DropZone.test.js` (Apache-2.0)

## Rules / invariants
- Data attrs on the zone: `data-hovered`, `data-focused`, `data-focus-visible`, `data-drop-target`, `data-disabled`; signals only when `class` / `style` / `children` is a function
- `isDisabled` (value or accessor): drag handlers + paste no-op, hidden button `disabled`
- `getDropOperation(types, allowedOperations)` → `"cancel"` = no drop target, `dropEffect = "none"`; default = first allowed (`effectAllowed` "all" → "move")
- Default class `rv-DropZone`; `render` (DOMRenderProps) receives attrs + `DropZoneRenderProps`

## Gotchas / deviations
- No keyboard / screen-reader virtual drop session (RA `DragManager`) yet — DnD lane; keyboard users pick files via a `FileTrigger` child
- Press on a non-focusable part focuses the hidden button on primary `pointerup` (RAC: `onClick`; a zone click handler trips the dev a11y `click-events` rule)
- Paste handled on the focused hidden button (clipboard events target it), not document listeners while focused
- Label id always in `aria-labelledby` (no client `useSlotId` effect); button `aria-label` keeps the name valid
- Resumed page: the first `dragenter` loads the zone code; a `dragover` with no recorded enter enters in its place (Rivet addition in `dropDragOver`); a drop before the code loaded falls back to the browser default (no preload = no JS before input)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../file-trigger/CLAUDE.md](../file-trigger/CLAUDE.md), [../focus/CLAUDE.md](../focus/CLAUDE.md)

- ID-RESUME (2026-10-27): Generated hidden-button / label IDREF roots use the shared `resumedId()` keyed-signal helper. The resume record retains the server id when parts adopt independently. Existing explicit-id fallback and ARIA behaviour are unchanged.
