# libs/cdk/motion
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

`@rivetjs/cdk/motion`: embla-carousel 8.6.0's motion core (MIT, © David Jerleke), DOM-agnostic and reusable. User decision 2026-10-08 ("embla's motion feels natural, reuse it"): no CSS transitions / other easing in components that adopt it. Consumers: `../carousel` (engine), `../sidebar/sheet-motion.ts` (mobile sheet swipe-to-dismiss), `../slider/state.ts` (`Motion1D`: stepped snap-on-release), `../sheet-motion` (edge-sheet drag / snap points; `@rivetjs/ui/sheet`), `../wheel-picker` (`Motion1D` drum spin / flick / settle in item units; `../time-wheels`). Also `../compare` (`Motion1D` settle of the divider for keys / frame presses; drags stay 1:1). Planned: Sidebar sheet on `../sheet-motion`.

## Files (header `// Ported from embla-carousel (<path>, v8.6.0), MIT, © David Jerleke.` + `Rivet:`)
| File | Export | Upstream |
| --- | --- | --- |
| `Animations.ts` | `AnimationLoop(update, render, scheduler?)` → `{ start, stop, reset, update, render }`; types `AnimationLoopType`, `FrameSchedulerType` | `Animations.ts` loop (fixed step 1000/60, two updates on the first frame, `render(alpha)` leftover fraction); scheduler injectable (default `globalThis` rAF); `visibilitychange` stays in `carousel/engine/Animations.ts` |
| `ScrollBody.ts` | `ScrollBody(location, offsetLocation, previousLocation, target, baseDuration, baseFriction)` | verbatim |
| `Vector1d.ts` | `Vector1D(n)` → `{ get, set, add, subtract }` | verbatim |
| `Limit.ts` | `Limit(min, max)` | verbatim |
| `DragTracker.ts` | `VelocityTracker()` → `{ pointerDown(point, time), pointerMove(point, time) → diff, pointerUp(time) → px/ms force }` | `DragTracker.ts` math (170 ms log interval, |force| > 0.1), numbers instead of events |
| `DragRelease.ts` | `DragRelease(dragFree, baseFriction)` → `{ forceBoost(isMouse), settle(rawForce, force) → { duration, friction } }`; `snapForceBoost` {300, 400}, `freeForceBoost` {500, 600} | `DragHandler.ts` release physics (baseSpeed 25 / 43) |
| `Motion1D.ts` | `Motion1D({ value, duration = 25, friction = 0.68, render, onSettle?, scheduler? })` → `{ to(v, jump?), drag(delta), hold(held), settled(), get(), stop(), location, previousLocation, offsetLocation, target, scrollBody, animation }` | composition of `Engine.ts` update (`scrollBody.seek()`) / render (interpolate, stop + settle when settled and not held) |
| `utils.ts` | `isNumber`, `mathAbs`, `mathSign`, `deltaAbs`, `factorAbs` | `utils.ts` subset |
| `index.ts` | barrel of the above | — |

## Rules / invariants
- Numbers in, numbers out: no DOM, no `window` / `document` reads; caller applies transforms. Only `AnimationLoop` defaults to `globalThis.requestAnimationFrame` (pass `scheduler` elsewhere).
- Math stays verbatim embla: the carousel engine imports these files, and its ported upstream suite (`tests/carousel-*.test.ts`, 509 tests) pins the behaviour. Change math only with an upstream diff.
- Own subpath (`package.json` `"./motion"`), no imports outside this folder → 0 B unless imported.
- No reduced-motion handling built in (embla has none): callers pass `duration: 0` / `to(v, true)`.

## Tests
- `../tests/motion.test.ts`: AnimationLoop (fake scheduler: first-frame double update, steps per elapsed time, alpha, idempotent start, stop in render), ScrollBody (settle within 0.001, monotonic ease-out, instant jump, base resets), VelocityTracker (diffs, force, expiry, window restart), DragRelease (boosts, settle formula), Limit, Motion1D (to + onSettle once, jump, hold + drag).
- Indirect: every carousel engine test.

## Docs
- `apps/cdk-docs/content/foundations/motion.md` (API tables, release recipe), example `motion-basic`.
