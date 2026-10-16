// Rivet tests (embla has no unit tests for these internals) for `@rivetjs/cdk/motion`, the DOM-agnostic split of
// embla-carousel's motion core: fixed-timestep loop + interpolation, ScrollBody integrator, VelocityTracker,
// DragRelease, Motion1D. A fake frame scheduler drives the loop deterministically.
import { describe, expect, it } from "vitest";
import {
  AnimationLoop,
  DragRelease,
  Limit,
  Motion1D,
  ScrollBody,
  Vector1D,
  VelocityTracker,
  freeForceBoost,
  snapForceBoost,
  type FrameSchedulerType,
} from "../motion/index.ts";

const STEP = 1000 / 60;

function fakeScheduler() {
  let next = 1;
  const callbacks = new Map<number, (t: number) => void>();
  let now = 0;
  const scheduler: FrameSchedulerType = {
    requestAnimationFrame: (cb) => {
      callbacks.set(next, cb);
      return next++;
    },
    cancelAnimationFrame: (id) => void callbacks.delete(id),
  };
  const frame = (ms = STEP) => {
    now += ms;
    const pending = [...callbacks.entries()];
    callbacks.clear();
    for (const [, cb] of pending) cb(now);
  };
  return { scheduler, frame, pending: () => callbacks.size };
}

describe("AnimationLoop", () => {
  it("runs two updates on the first frame, then one per elapsed fixed step, render with the leftover alpha", () => {
    const { scheduler, frame, pending } = fakeScheduler();
    let updates = 0;
    const alphas: number[] = [];
    const loop = AnimationLoop(
      () => updates++,
      (alpha) => alphas.push(alpha),
      scheduler,
    );
    loop.start();
    expect(pending()).toBe(1);
    frame();
    expect(updates).toBe(2);
    expect(alphas).toEqual([0]);
    frame(STEP * 2.5);
    expect(updates).toBe(4);
    expect(alphas[1]).toBeCloseTo(0.5);
    frame(STEP * 0.25);
    expect(updates).toBe(4);
    expect(alphas[2]).toBeCloseTo(0.75);
    loop.stop();
    expect(pending()).toBe(0);
  });

  it("start is idempotent, stop from render ends the loop, restart re-runs the first-frame updates", () => {
    const { scheduler, frame, pending } = fakeScheduler();
    let updates = 0;
    let renders = 0;
    const loop: ReturnType<typeof AnimationLoop> = AnimationLoop(
      () => updates++,
      () => {
        if (++renders === 2) loop.stop();
      },
      scheduler,
    );
    loop.start();
    loop.start();
    expect(pending()).toBe(1);
    frame();
    frame();
    expect(renders).toBe(2);
    expect(pending()).toBe(0);
    updates = 0;
    loop.start();
    frame();
    expect(updates).toBe(2);
  });
});

describe("ScrollBody", () => {
  it("integrates towards the target with duration / friction and settles within 0.001 of it", () => {
    const location = Vector1D(0);
    const offset = Vector1D(0);
    const previous = Vector1D(0);
    const target = Vector1D(300);
    const body = ScrollBody(location, offset, previous, target, 25, 0.68);
    expect(body.settled()).toBe(false);
    const positions: number[] = [];
    for (let i = 0; i < 200 && !body.settled(); i++) {
      body.seek();
      offset.set(location);
      positions.push(location.get());
    }
    expect(body.settled()).toBe(true);
    expect(Math.abs(location.get() - 300)).toBeLessThan(0.001);
    // Monotonic approach (ease-out), no CSS transition curve.
    for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1] - 1e-9);
    expect(positions[0]).toBeGreaterThan(0);
    expect(positions[0]).toBeLessThan(300);
    expect(body.direction()).toBe(1);
  });

  it("duration 0 jumps to the target in one seek", () => {
    const location = Vector1D(0);
    const offset = Vector1D(0);
    const previous = Vector1D(0);
    const target = Vector1D(-120);
    const body = ScrollBody(location, offset, previous, target, 25, 0.68);
    body.useDuration(0).seek();
    expect(location.get()).toBe(-120);
    expect(previous.get()).toBe(-120);
    expect(body.velocity()).toBe(0);
    expect(body.direction()).toBe(-1);
  });

  it("useBaseDuration / useBaseFriction restore the constructor values", () => {
    const v = () => Vector1D(0);
    const body = ScrollBody(v(), v(), v(), v(), 25, 0.68);
    body.useDuration(3).useFriction(0.1);
    expect(body.duration()).toBe(3);
    body.useBaseDuration().useBaseFriction();
    expect(body.duration()).toBe(25);
  });
});

describe("VelocityTracker", () => {
  it("returns per-move diffs and a px/ms flick force on release", () => {
    const tracker = VelocityTracker();
    expect(tracker.pointerDown(100, 0)).toBe(100);
    expect(tracker.pointerMove(90, 16)).toBe(-10);
    expect(tracker.pointerMove(70, 32)).toBe(-20);
    expect(tracker.pointerUp(40)).toBeCloseTo(-30 / 40);
  });

  it("no flick when the pointer rested longer than the 170 ms log interval before release", () => {
    const tracker = VelocityTracker();
    tracker.pointerDown(0, 0);
    tracker.pointerMove(50, 20);
    expect(tracker.pointerUp(20 + 171)).toBe(0);
  });

  it("restarts the velocity window on long moves; tiny forces count as no flick", () => {
    const tracker = VelocityTracker();
    tracker.pointerDown(0, 0);
    tracker.pointerMove(100, 100);
    tracker.pointerMove(200, 200); // expired: window starts here
    tracker.pointerMove(220, 210);
    expect(tracker.pointerUp(220)).toBeCloseTo(20 / 20);
    const slow = VelocityTracker();
    slow.pointerDown(0, 0);
    slow.pointerMove(1, 100);
    expect(slow.pointerUp(100)).toBe(0);
  });

  it("pointerUp without pointerDown returns 0", () => {
    expect(VelocityTracker().pointerUp(10)).toBe(0);
  });
});

describe("DragRelease", () => {
  it("force boost per pointer type, snap vs free", () => {
    expect(DragRelease(false, 0.68).forceBoost(true)).toBe(snapForceBoost.mouse);
    expect(DragRelease(false, 0.68).forceBoost(false)).toBe(snapForceBoost.touch);
    expect(DragRelease(true, 0.68).forceBoost(true)).toBe(freeForceBoost.mouse);
    expect(DragRelease(true, 0.68).forceBoost(false)).toBe(freeForceBoost.touch);
  });

  it("settle: base speed when the allowed distance covers the throw, faster + stiffer when clamped", () => {
    const snap = DragRelease(false, 0.68);
    expect(snap.settle(200, 200)).toEqual({ duration: 25, friction: 0.68 });
    const clamped = snap.settle(400, 200); // half the throw allowed: forceFactor 0.5
    expect(clamped.duration).toBe(20);
    expect(clamped.friction).toBeCloseTo(0.69);
    expect(snap.settle(0, 0)).toEqual({ duration: 25, friction: 0.68 });
    const free = DragRelease(true, 0.68);
    expect(free.settle(0, 0).duration).toBe(43);
  });
});

describe("Limit", () => {
  it("clamps, reports reach and loops within the range", () => {
    const limit = Limit(-100, 0);
    expect(limit.constrain(20)).toBe(0);
    expect(limit.constrain(-120)).toBe(-100);
    expect(limit.reachedMin(-101)).toBe(true);
    expect(limit.reachedMax(1)).toBe(true);
    expect(limit.length).toBe(100);
  });
});

describe("Motion1D", () => {
  it("to() animates with the fixed-step loop, renders interpolated values and calls onSettle once", () => {
    const { scheduler, frame } = fakeScheduler();
    const rendered: number[] = [];
    let settled = 0;
    const motion = Motion1D({ value: 0, render: (v) => rendered.push(v), onSettle: () => settled++, scheduler });
    motion.to(100);
    for (let i = 0; i < 300 && !settled; i++) frame();
    expect(settled).toBe(1);
    expect(Math.abs(motion.get() - 100)).toBeLessThan(0.001);
    expect(motion.settled()).toBe(true);
    expect(rendered.length).toBeGreaterThan(5);
    expect(rendered.some((v) => v > 0 && v < 100)).toBe(true);
    frame();
    expect(settled).toBe(1);
  });

  it("to(value, true) jumps without starting the loop", () => {
    const { scheduler, pending } = fakeScheduler();
    const rendered: number[] = [];
    const motion = Motion1D({ value: 10, render: (v) => rendered.push(v), scheduler });
    motion.to(-50, true);
    expect(pending()).toBe(0);
    expect(motion.get()).toBe(-50);
    expect(rendered.at(-1)).toBe(-50);
  });

  it("hold + drag follows the pointer and keeps the loop alive until released", () => {
    const { scheduler, frame, pending } = fakeScheduler();
    let settled = 0;
    const motion = Motion1D({ value: 0, render: () => {}, onSettle: () => settled++, scheduler });
    motion.hold(true);
    motion.drag(-40);
    for (let i = 0; i < 60; i++) frame();
    expect(motion.get()).toBeCloseTo(-40, 1);
    expect(pending()).toBe(1);
    expect(settled).toBe(0);
    motion.hold(false);
    motion.to(-100);
    for (let i = 0; i < 300 && !settled; i++) frame();
    expect(Math.abs(motion.get() + 100)).toBeLessThan(0.001);
    expect(settled).toBe(1);
  });
});
