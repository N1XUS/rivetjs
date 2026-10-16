# @rivetjs/cdk/flip

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Rivet-authored shared FLIP core (not a port), extracted from `../masonry/flip.ts` (motion plan T11, `docs/design/plans/2026-10-11-motion.md`). Users: `@rivetjs/cdk/masonry` relayouts (key adapter `../masonry/flip.ts`), `@rivetjs/motion/layout` (T12).

- `index.ts` (`@rivetjs/cdk/flip`):
  - `Box` (start-edge `x`, `y`, `width`, `height`, container-relative); `FlipItem { el, from, to, base?, final? }` (`base` = own transform the offset composes with, default the inline `transform` at the start; `final()` = inline `transform` / `width` / `height` at the end).
  - `captureBoxes(els, relativeTo, rtl?)` → `Map<el, Box>` (one rect read per element); `animatingBoxes(container, rtl?)` (visual boxes of a running FLIP's elements); `stopFlip(container)`.
  - `playFlip(container, items, { viewport?, rtl?, driver? })` → `stop`: skips unchanged items (< 0.5 px) and items outside `viewport` before and after; a running FLIP on the same container is stopped first; writes `translate(…)` (+ `base`) and px `width` / `height` per frame, final styles at the end; a disconnected container stops on its next frame (no unmount effect).
  - `FlipDriver { play(run: FlipRun): stop }`, `FlipRun { items: FlipMove[], render(t), done() }` (`FlipMove` = item + `dx` / `dy` (inverted offset, screen px, RTL applied), `base`, `resize`: what a WAAPI driver needs for its keyframes, `@rivetjs/motion/layout` `layoutDriver`) (the driver gets every moved item, drives `render` with progress 0 → 1, calls `done`; `stop` = halt only, the core commits). Plan signature `play(items, done)` became `play({ items, render, done })`: progress drivers need `render`, per-item drivers (WAAPI) get the items.
  - `motion1dDriver({ duration = 25, friction = 0.68 })` = house motion (`../motion` Motion1D, embla units); the default driver.
  - `flipAllowed(motion)`: `false` for `motion === false`, on the server, and under `prefers-reduced-motion: reduce`.
- Docs: `apps/cdk-docs/content/foundations/flip.md` (keep its API table in sync with `index.ts`).
- Browser-only closures, never serialized (resumed handlers create them).
- Tests: `tests/flip.test.ts` (node: permission, driver contract), `tests/flip.browser.test.tsx` (Chromium: LTR / RTL capture, move + settle, resize + stop, interruption, viewport skip, custom driver + `final`, reduced motion); masonry suites cover the adapter.
