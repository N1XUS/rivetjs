// Hero glow loop (components/hero-glow.ts): reduced motion = one static frame and no frame loop;
// hidden tab or off screen = no frame scheduled; resume continues without a time jump; ≤ 30 fps.
import { strict as assert } from "node:assert";
import { test } from "vitest";
import { blobAt, createGlowLoop } from "../components/hero-glow.ts";

function fakeClock() {
  let next = 1;
  const pending = new Map<number, (time: number) => void>();
  return {
    requests: 0,
    request(fn: (time: number) => void) {
      this.requests++;
      pending.set(next, fn);
      return next++;
    },
    cancel(id: number) {
      pending.delete(id);
    },
    /** Runs the pending frame callbacks at `time` ms. */
    flush(time: number) {
      const due = [...pending.values()];
      pending.clear();
      for (const fn of due) fn(time);
    },
    get size() {
      return pending.size;
    },
  };
}

test("reduced motion: one static frame, no requestAnimationFrame loop", () => {
  const clock = fakeClock();
  const frames: number[] = [];
  const loop = createGlowLoop((t) => frames.push(t), clock, { reduced: true });
  loop.start();
  loop.setVisible(true);
  loop.setHidden(false);
  assert.deepEqual(frames, [0]);
  assert.equal(clock.requests, 0);
  assert.equal(loop.scheduled, false);
});

test("hidden tab and off screen pause the loop; resuming continues the timeline", () => {
  const clock = fakeClock();
  const frames: number[] = [];
  const loop = createGlowLoop((t) => frames.push(t), clock, { reduced: false });
  loop.start();
  assert.equal(loop.scheduled, true);
  clock.flush(1000);
  clock.flush(1100);
  assert.equal(frames.length, 2);
  loop.setHidden(true);
  assert.equal(loop.scheduled, false);
  assert.equal(clock.size, 0, "the pending frame is cancelled");
  clock.flush(5000);
  assert.equal(frames.length, 2, "no frames while hidden");
  loop.setHidden(false);
  clock.flush(60_000);
  clock.flush(60_100);
  assert.ok(Math.abs(frames.at(-1)! - 0.2) < 1e-9, `time continues from the pause, got ${frames.at(-1)}`);
  loop.setVisible(false);
  assert.equal(loop.scheduled, false);
  loop.setVisible(true);
  assert.equal(loop.scheduled, true);
  loop.dispose();
  assert.equal(loop.scheduled, false);
});

test("at most 30 frames per second", () => {
  const clock = fakeClock();
  let frames = 0;
  const loop = createGlowLoop(() => frames++, clock, { reduced: false });
  loop.start();
  for (let t = 0; t <= 1000; t += 1000 / 120) clock.flush(t);
  assert.ok(frames <= 31 && frames >= 28, `frames in one second at 120 Hz: ${frames}`);
  loop.dispose();
});

test("blobs drift slowly and stay near their centre", () => {
  const base = { x: 0.6, y: 0.4 };
  for (let t = 0; t < 120; t += 0.5) {
    const b = blobAt(1, t, base);
    assert.ok(Math.abs(b.x - base.x) <= 0.07 + 1e-9 && Math.abs(b.y - base.y) <= 0.06 + 1e-9);
    assert.ok(b.r > 0.38 && b.r < 0.5);
  }
  const a = blobAt(0, 0, base);
  const b = blobAt(0, 1 / 30, base);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.001, "one frame moves less than 0.1% of the box");
});
