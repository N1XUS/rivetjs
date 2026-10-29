# @rivetjs/cdk/dnd
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Drag and drop for collections: react-aria dnd hooks + react-stately dnd states + RAC `useDragAndDrop` / `DropIndicator`. Consumer today: `Tree` (`../tree/dnd.tsx`; RAC also ListBox / GridList / Table — not wired yet).

## Entry points
- `@rivetjs/cdk/dnd` -> `index.tsx`: `useDragAndDrop(options)` → `{ dragAndDropHooks }`, `DropIndicator`, `DragAndDropContext`, `DropIndicatorContext`, `useRenderDropIndicator`, `useDndPersistedKeys`, `dropIndicatorRenderProps`, `dropIndicatorRow`, `dragPreviewOf`, `isVirtualDragging`; hooks `useDrag`, `useDrop`, `useDraggableCollection`, `useDraggableItem`, `useDroppableCollection`, `useDroppableItem`, `useDropIndicator`, `ListDropTargetDelegate`, `DragPreview` / `createDragPreviewRenderer`; states `useDraggableCollectionState`, `useDroppableCollectionState` (`../state/draggable-collection.ts`, `../state/droppable-collection.ts`); constants + `isTextDropItem` / `isFileDropItem` / `isDirectoryDropItem`, `DIRECTORY_DRAG_TYPE`; all types (`types.ts`).

## Layout
- `types.ts`, `constants.ts`, `utils.ts` (global dnd state: dragging keys / collection refs, `readFromDataTransfer`, `writeToDataTransfer`), `intl.ts` (generated `// @rivet-locale-table`, every upstream locale)
- `drag-manager.ts` — keyboard / screen reader drag session (Tab / Shift+Tab between drop targets, Enter drops, Escape cancels, `ariaHideOutside` with `inert`); `useDragSession()` / `useDragModality()` are signal accessors
- `use-drag.ts`, `use-drop.tsx`, `use-virtual-drop.ts`, `use-auto-scroll.ts`, `drag-preview.tsx`
- `use-draggable-collection.tsx`, `use-draggable-item.ts`, `use-droppable-collection.tsx`, `use-droppable-item.tsx`, `use-drop-indicator.ts`, `drop-target-keyboard-navigation.ts`, `list-drop-target-delegate.ts`
- `index.tsx` — RAC `useDragAndDrop.tsx` + `DragAndDrop.tsx`
- tests: `../tests/tree.browser.test.tsx` "drag and drop" (RAC `test/Tree.test.tsx`), story `../tests-components/tree-dnd.test.ts` (cold keyboard + mouse drags)

## Upstream
- react-spectrum 06891de: `packages/react-aria/src/dnd/*`, `packages/react-aria/intl/dnd/*.json`, `packages/react-stately/src/dnd/*`, `packages/react-aria-components/src/{useDragAndDrop,DragAndDrop,Tree}.tsx`, `test/Tree.test.tsx` (Apache-2.0, `../NOTICE`)

## Rules / invariants
- Hooks are factories run once in a component body; results are accessors (`isDragging()`, `isDropTarget()`, `aria-*` props that change during a drag are accessors) and DOM event handlers. React re-render dependencies → signals (`draggingKeys`, drop `target`, drag session).
- `useDragAndDrop` merges `options` over the collection's props keeping accessor properties (`withOptions`; a spread would snapshot the Tree's `keyboardDelegate` getter on an empty first collection).
- Element refs are `{ current }` getters over Rivet `ref` signals (`ElementRef`); drop targets / items register in `clientEffect(…, { when: "interaction" })`: nothing runs at load on a resumed page.
- Drop indicators render only while a keyboard drag session runs or while they are the pointer target (`useRenderDropIndicator`, `isHidden`): no indicator markup on the server / first render.
- Drop-indicator row code lives here (`dropIndicatorRow`), handed to collections as `renderRow` (`../collections/components.tsx`): untouched collections carry none.
- `.tsx` for every module importing `@rivetjs/runtime/dom` (server rewrite: `.ts` modules are not rewritten); the drag preview uses `mount` (server form links, throws if called).
- A dropped item receives DOM focus after the collection update (`updateFocusAfterDrop` + microtask `focusSafely`; react-aria: the item's `useSelectableItem` effect).
- A droppable item focuses itself one microtask after it becomes the session target (react-aria: passive effect after the DragManager focused the collection).

## Gotchas / deviations
- `DropZone` keeps its own drop half (`../drop-zone/dnd.ts`, earlier port); not merged into `use-drop.tsx` yet.
- Drag descriptions (`aria-describedby` nodes) are created per hook call, not ref-counted / shared (react-aria `useDescription`).
- Drag preview renders into a body-level container: it inherits the body's text styles (react-aria: where `<DragPreview>` sits).
- Virtualized collections: no `persistedKeys` for the drop target / dragged keys, and the virtualizer renderer ignores `renderRow` (no drop indicators in a virtualized Tree).
- Chromium: a constructed `DataTransfer` ignores `effectAllowed` / `dropEffect` writes outside a real drag — tests shadow them (`writableEffects`), real drags are unaffected.
- Dev a11y `click-events` warns on drop indicator buttons (`role="button"`, `tabIndex=-1`, `onClick`, no key handler: the DragManager's document key handlers operate them; same markup as RAC).
