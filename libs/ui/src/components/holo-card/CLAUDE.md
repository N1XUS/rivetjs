# HoloCard

Rivet-authored visual effect. Public props and CSS remain in `holo-card.tsx` and `styles/components/holo-card.css`.

- The root's explicit pointer JSX handlers keep the card resumable on its first input. Do not use a client effect that wakes it before input.
- `holo-card-input.ts` is part of the resumed card chunk: request iOS permission synchronously inside the first eligible pointerup handler, before importing anything. Cache the permission result once per page, including denial/failure.
- `holo-card-gyro.ts` is a dynamic import only from that touch/pen/no-hover tap path. Never statically import its runtime exports into the root or barrel.
- First valid beta/gamma reading is neutral. Relative movement saturates at 25 degrees; screen rotations remap axes and recalibrate. Frame filtering uses alpha 0.2 and rounds to 0.1 percentage points. Reuse the root's CSS-variable writer.
- One shared orientation listener and IntersectionObserver serve all activated cards. Hidden pages, offscreen cards and reduced motion suspend tracking. Owner disposal removes the card; the final card removes shared listeners/observer. Missing readings time out after 1000 ms without retries; pointer dragging remains available.
- No new public gyro prop. Existing `isInteractive={false}` / `isDisabled` prevent startup; reduced motion prevents permission requests. Sensor samples stay in memory on the page.
- Tests: `libs/ui/tests/holo-card*.test.{ts,tsx}` in project `ui`; cold browser coverage in `libs/ui/tests-components/holo-card.test.ts`, project `ui-components`.
