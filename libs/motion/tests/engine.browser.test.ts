// T4: mini engine glue in Chromium — WAAPI animations, committed final styles, interrupts without jumps, springs as
// Motion's value (D4b), the string "spring" and hybrid-only values as dev errors, reduced motion.
import { afterEach, expect, test } from "vitest";
import { spring } from "motion";
import { animateTo, motionState, setNow } from "../engine.ts";

const els: HTMLElement[] = [];
const box = () => {
  const el = document.createElement("div");
  el.style.cssText = "width:40px;height:40px;background:red";
  document.body.append(el);
  els.push(el);
  return el;
};
const realMatchMedia = window.matchMedia;
afterEach(() => {
  els.splice(0).forEach((el) => el.remove());
  window.matchMedia = realMatchMedia;
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

test("animates on WAAPI and commits the final values inline", async () => {
  const el = box();
  const run = animateTo(el, { opacity: 0.5, x: 20 }, { duration: 0.05 }, { from: { opacity: 1 } });
  expect(el.getAnimations().length).toBeGreaterThan(0);
  await run.finished;
  expect(el.style.opacity).toBe("0.5");
  expect(el.style.translate).toBe("20px");
  expect(motionState(el)).toEqual({ opacity: 0.5, x: 20 });
});

test("a partial target keeps the other translate axis", async () => {
  const el = box();
  setNow(el, { x: 0, y: 8 });
  expect(el.style.translate).toBe("0px 8px");
  await animateTo(el, { x: 30 }, { duration: 0.03 }).finished;
  expect(el.style.translate).toBe("30px 8px");
});

test("an interrupt starts from the current value (no jump)", async () => {
  const el = box();
  animateTo(el, { x: 200 }, { duration: 0.4, ease: "linear" }, { from: { x: 0 } });
  for (let i = 0; i < 6; i++) await frame();
  const mid = new DOMMatrix(getComputedStyle(el).transform).m41 || parseFloat(getComputedStyle(el).translate);
  expect(mid).toBeGreaterThan(5);
  const second = animateTo(el, { x: 0 }, { duration: 0.4, ease: "linear" });
  await frame();
  const after = parseFloat(getComputedStyle(el).translate);
  expect(Math.abs(after - mid)).toBeLessThan(40);
  second.stop();
});

test("springs run as Motion's spring value; the string is a dev error naming the import", async () => {
  const el = box();
  await animateTo(el, { scale: 1.2 }, { type: spring as never, visualDuration: 0.05, bounce: 0 }).finished;
  expect(el.style.scale).toBe("1.2");
  expect(() => animateTo(el, { scale: 1 }, { type: "spring" as never })).toThrow(/import \{ spring \} from "@rivetjs\/motion"/);
  expect(() => animateTo(el, { pathLength: 1 }, undefined)).toThrow(/@rivetjs\/motion\/animate/);
});

test("reduced motion (user): transforms jump, opacity still animates; always: the same without the preference", async () => {
  const realMatch = window.matchMedia;
  window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as never;
  const el = box();
  animateTo(el, { x: 50, opacity: 0.2 }, { duration: 0.2 }, { from: { x: 0, opacity: 1 } });
  expect(el.style.translate).toBe("50px");
  const animated = (e: HTMLElement) => e.getAnimations().map((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k)));
  expect(animated(el)).toEqual([expect.arrayContaining(["opacity"])]);
  window.matchMedia = realMatch;
  const other = box();
  animateTo(other, { x: 10, opacity: 0 }, { duration: 0.2 }, { reduced: "always", from: { x: 0, opacity: 1 } });
  expect(other.style.translate).toBe("10px");
  expect(animated(other)).toEqual([expect.arrayContaining(["opacity"])]);
});

test("without a known state, values start from the element's inline / computed style", async () => {
  const el = box();
  el.style.translate = "5px 7px";
  el.style.opacity = "0.4";
  const run = animateTo(el, { x: 25, opacity: 1 }, { duration: 0.2, ease: "linear" });
  const frames = Object.fromEntries(
    el.getAnimations().flatMap((a) =>
      (a.effect as KeyframeEffect)
        .getKeyframes()
        .slice(0, 1)
        .flatMap((k) => Object.entries(k).filter(([n]) => n === "translate" || n === "opacity")),
    ),
  );
  expect(frames).toEqual({ translate: "5px 7px", opacity: "0.4" });
  run.stop();
  const fresh = box();
  await animateTo(fresh, { scale: 2 }, { duration: 0.02 }).finished;
  expect(fresh.style.scale).toBe("2");
});
