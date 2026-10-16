// T7: variant propagation (labels), inherit={false}, DOM-order stagger on a parent label change (also after a reorder),
// MotionConfig transition + reducedMotion, and the 1000-children re-target cost.
import { afterEach, expect, test } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Motion, MotionConfig, stagger } from "@rivetjs/motion";

afterEach(cleanup);
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const settle = async (els: Element[]) => {
  for (let i = 0; i < 300 && els.some((el) => el.getAnimations().length); i++) await frame();
};
const delayOf = (el: Element) => Number(el.getAnimations()[0]?.effect?.getTiming().delay ?? NaN);
const list = { open: { opacity: 1, transition: { delayChildren: stagger(0.05) } }, closed: { opacity: 0.5 } };
const item = { open: { x: 0 }, closed: { x: -20 } };

test("children follow a parent label change, staggered in DOM order; inherit={false} opts out", async () => {
  const open = signal(false);
  render(() => (
    <Motion.ul id="ul" variants={list} animate={open() ? "open" : "closed"} transition={{ duration: 0.05 }}>
      <Motion.li id="a" variants={item} transition={{ duration: 0.05 }} />
      <Motion.li id="b" variants={item} transition={{ duration: 0.05 }} />
      <Motion.li id="c" variants={item} transition={{ duration: 0.05 }} inherit={false} />
    </Motion.ul>
  ));
  const [a, b, c] = ["a", "b", "c"].map((id) => document.getElementById(id)!);
  expect(a!.style.translate).toBe("-20px");
  expect(c!.style.translate).toBe("");
  open.set(true);
  await Promise.resolve();
  await Promise.resolve();
  expect(delayOf(a!)).toBe(0);
  expect(delayOf(b!)).toBe(50);
  expect(c!.getAnimations().length).toBe(0);
  await settle([a!, b!]);
  expect(a!.style.translate).toBe("0px");
  expect(b!.style.translate).toBe("0px");
});

test("stagger follows DOM order after a reorder", async () => {
  const open = signal(false);
  const ids = signal(["x", "y", "z"]);
  render(() => (
    <Motion.div variants={list} animate={open() ? "open" : "closed"}>
      <For each={ids()} by={(id) => id}>
        {(id) => <Motion.span id={id()} variants={item} transition={{ duration: 0.05 }} />}
      </For>
    </Motion.div>
  ));
  ids.set(["z", "x", "y"]);
  await Promise.resolve();
  open.set(true);
  await Promise.resolve();
  await Promise.resolve();
  expect(["z", "x", "y"].map((id) => delayOf(document.getElementById(id)!))).toEqual([0, 50, 100]);
});

test("MotionConfig: transition default and reducedMotion='always' (transforms jump)", async () => {
  const x = signal(0);
  render(() => (
    <MotionConfig transition={{ duration: 0.4, ease: "linear" }} reducedMotion="always">
      <Motion.div id="m" animate={{ x: x(), opacity: x() ? 0.5 : 1 }} />
    </MotionConfig>
  ));
  const el = document.getElementById("m")!;
  x.set(30);
  await Promise.resolve();
  expect(el.style.translate).toBe("30px");
  const animations = el.getAnimations();
  expect(animations.length).toBe(1);
  expect(animations[0]!.effect!.getTiming().duration).toBe(400);
});

test("1000 variant children re-targeted by one label change: start cost", async () => {
  const open = signal(false);
  const rows = Array.from({ length: 1000 }, (_, i) => i);
  render(() => (
    <Motion.div variants={{ open: { opacity: 1, transition: { staggerChildren: 0.001 } }, closed: { opacity: 1 } }} animate={open() ? "open" : "closed"}>
      <For each={rows} by={(i) => i}>
        {() => <Motion.i variants={item} transition={{ duration: 0.05 }} />}
      </For>
    </Motion.div>
  ));
  await frame();
  const start = performance.now();
  open.set(true);
  await Promise.resolve();
  await Promise.resolve();
  const ms = performance.now() - start;
  const els = [...document.querySelectorAll("i")];
  expect(els.every((el) => el.getAnimations().length === 1)).toBe(true);
  console.log(`[motion] 1000-child stagger start: ${ms.toFixed(2)} ms`);
  await settle(els);
});
