# libs/cdk/morph

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`@rivetjs/cdk/morph` — Rivet-authored (no upstream). Pill → panel morph behaviour on `../motion` (house motion: embla ScrollBody integrator, `Motion1D`). Feature set (collapsed / expanded content, footprint = collapsed size, auto-measured sizes, eight directions, controlled open state, animation off switch) inspired by HeroUI Pro's public MorphButton docs; independent web implementation (no Pro source / CSS / demos viewed). Used by `@rivetjs/ui/morph`. `item.tsx` (`@rivetjs/cdk/morph/item`) = item morph on the rect mode (below), used by `@rivetjs/ui/item-morph`.

## DOM contract

- `[data-morph-root]` (`data-open` while open, `data-morphing` while moving, `data-animation="disabled"` = always jump) contains `[data-morph-collapsed]` (with `[data-morph-trigger]`, the focus target on close) and `[data-morph-surface]` (the morphing box) containing `[data-morph-expanded]` (the panel).
- CSS owns both resting states (`@rivetjs/ui/styles` `morph.css`): closed surface = the root box, open surface = the panel box. `--morph-collapsed-radius` / `--morph-expanded-radius` (px, on the root) are read when a morph starts (collapsed clamped to half the box).

## API (`index.tsx`)

- `createMorphState({ isOpen, defaultOpen, onOpenChange, isDisabled }) → MorphState` (`open` = `controllable` ControlledState, `isDisabled`); `isMorphOpen(state)`.
- `openMorph` / `closeMorph` / `toggleMorph(state, el, motion?)` (root found from `el` via `morphRootOf`), `setMorphOpen(state, open, root?, motion?, restoreFocus = true)` (writes the state, then syncs; a read-only controlled value is not synced: the follower effect does it), `syncMorph(state, root, open, motion?, restoreFocus)` (DOM + motion follow `open`; no-op when already there).
- `morphTo(root, open, { duration, friction, jump, onSettle })` low-level motion; `isMorphing(root)`, `morphReducesMotion(root)` (`prefers-reduced-motion` or `data-animation="disabled"`). Defaults `MORPH_DURATION` 10, `MORPH_FRICTION` 0.6 (embla units; under-damped, |λ| = √f ≈ 0.77/frame: a slight overshoot, settled in ~300 ms — close to Pro's documented spring damping 25 / stiffness 300 / mass 0.8).

## Rect mode (`index.tsx`, used by `item.tsx`)

- `morphRectTo(surface, open, { from, to, backdrop?, jump?, onSettle?, duration, friction })`: morphs a fixed-position surface between two viewport rects (`MorphRect { x, y, w, h, r }`, measured once from rest via the `from` / `to` callbacks); each frame writes inline `left` / `top` / `width` / `height` / `border-radius` + `--morph-progress` on the surface and backdrop `opacity`. One controller per surface (WeakMap, separate from root controllers; `isMorphing` checks both); retarget mid-morph keeps progress + velocity. At rest open keeps `left` / `top` (panel position) and clears size / radius; closed clears everything. `morphRectProgress(surface)`.

## Item morph (`item.tsx`, `@rivetjs/cdk/morph/item`)

iOS context-menu style item preview: a list item (ListBox option, GridList row, Menu item, any element) lifts out of the list into a panel on the shared div overlay layer and morphs back on close.

- `createItemMorph({ trigger, threshold, openKey, onOpenChange, isDisabled, duration, friction }) → ItemMorph` (plain data + signals: `open` controllable `Key | null`, `key` (last opened, kept while closing), `phase` 0 idle / 1 primed / 2 open / 3 closing). One per list.
- `itemMorphProps(m)`: bag for every item — `data-rv-morph` (= `m.id`), `onPointerDown`, `onKeyDown`, `onContextMenu`; + `data-rv-long-press` (longPress / contextMenu triggers), `onDblClick` (doubleClick), `onAction` (press). Items are found from events by `closest('[data-rv-morph="<id>"]')`; the key = the item's `data-key` (cdk collections, `data-key-type="number"` honoured) else its `id`.
- Triggers: `"longPress"` (default; `threshold` 500 ms = `ITEM_MORPH_THRESHOLD`, React Aria useLongPress; cancelled by pointerup / pointercancel / scroll / > 10 px move), `"contextMenu"` (right click; touch long press), `"press"` (item action), `"doubleClick"`, `"none"` (controlled / `openItemMorph` only). Keyboard for every trigger but `none`: ContextMenu key, Shift+F10 (other keys `continuePropagation()`: list navigation intact).
- Long press: at the threshold a bubbling synthetic `pointercancel` cancels the item's press, the next `click` is prevented, touch `contextmenu` suppressed; `data-rv-long-press` makes a cdk ListBox select on press up (`listbox/behaviour.tsx` `itemOptions`): a long press never selects or acts. While held: `user-select: none`, `data-morph-holding` + `--morph-hold` 0..1 (ease-out; CSS scales the row; none under reduced motion).
- Priming: 120 ms into a hold the panel renders hidden (`phase` 1) so its resume chunks load before the threshold; a tap renders nothing.
- `ItemMorphPanel { morph, aria-label?, class?, panelClass?, backdropClass?, hideBackdrop?, children: (key) => Content }`: `span[data-rv-item-morph-anchor]` (`display: contents`, own region) > `Show phase > 0` > `Portal` > `[data-rv-item-morph-layer]` with backdrop `[data-morph-backdrop]` + surface `[data-morph-surface]` (`role=dialog`, `aria-modal`, `tabIndex=-1`; inline fixed / z-index / hidden: behaviour styles) > `[data-morph-expanded]` panel. Defaults `rv-ItemMorph`, `rv-ItemMorph-panel`, `rv-ItemMorph-backdrop`.
- Open: row rect + radius measured; panel natural size measured, centred on the row horizontally, top at the row top, clamped to a 16 px viewport margin (RTL-neutral); radius `--morph-expanded-radius` else computed. `data-open` on the surface, `data-morph-open` on the item, `aria-labelledby` = item id unless `aria-label`; `ariaHideOutside` (inert), `preventScroll`, Escape + outside pointerdown (document capture). Settled: `overflow: auto`, `max-height` viewport − 32, focus `[data-morph-autofocus]` / first tabbable / surface.
- Close (`closeItemMorph(m, restoreFocus = true)`, Escape, backdrop press): locks released, focus back to the item, surface morphs back into the (re-measured) row, unmounts at rest. Another item opening while one closes jumps the old close to the end. `syncItemMorph`, `isItemMorphOpen`, `openItemMorph(m, item)`.
- Controlled `openKey`: a `clientEffect` follower exists only when controlled (finds the item by key in the document).
- Gaps: no `aria-haspopup` / `aria-expanded` on options (not allowed on `option`); a list with both `onAction` and touch selection keeps React Aria's own touch long-press-to-select (conflict); no `defaultOpenKey` / server-rendered open panel; `doubleClick` with toggle selection toggles twice; GridList mouse selection on press down not switched to press up yet (ListBox only).

## Invariants

- One controller per root (WeakMap). Sizes measured once from rest (root offset box, panel offset box) when a morph starts; each frame writes only the surface's inline `width` / `height` / `border-radius` + the root's `--morph-progress` (no reads in the loop: no layout thrash); settle clears every inline style and `data-morphing`.
- Interruptible: a new target mid-morph reverses from the current progress (same controller, no re-measure); a target already reached or pending returns.
- Open: `data-open`, panel `inert = false`, collapsed `inert = true`, trigger `aria-expanded="true"`, dismiss listeners installed, focus (next frame) → `[data-morph-autofocus]` / first tabbable / panel. Close: reversed; focus back to the trigger when it was inside the root (or on `body`) and `restoreFocus`.
- Dismiss: document capture `keydown` Escape and `pointerdown` outside → close + restore focus; root `focusout` to an outside element → close without restoring (focus stays where the user tabbed).
- Server renders the initial attributes (ui root, untracked); nothing runs at load.

## Tests

- Item morph: `../tests/item-morph.browser.test.tsx` (Chromium, project `cdk-browser`: long-press threshold + priming + hold feedback + no selection, short press / move cancel, touch, keyboard Shift+F10 / ContextMenu + Escape focus restore + arrows, backdrop close, continuous morph + interruption, reduced motion, scroll container clipping, RTL, triggers contextMenu / doubleClick / press / none + controlled, `aria-label`); ui `libs/ui/tests/item-morph*.test.tsx`, `libs/ui/tests-components/item-morph.test.ts`.
- Behaviour: `libs/ui/tests-components/morph.test.ts` (Chromium: continuous morph, interruption, reduced motion / disabled, focus, dismiss, controlled, directions, 375 px) + `libs/ui/tests/morph*.test.tsx` (happy-dom, jumps). No cdk-local suite yet (gap).

## Gotchas

- happy-dom has no layout: stub `matchMedia` to `reduce` so morphs jump.
- The first trusted click flushes one task later (root CLAUDE.md): wait for `data-open` before measuring.
