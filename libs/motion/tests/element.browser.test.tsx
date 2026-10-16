// T5 client: `<Motion.*>` created in the browser plays its entrance through the same generated CSS (constructable
// sheet, no motion JS), live `animate` changes animate from a binding with `motion/mini`, refs / props pass through.
import { afterEach, expect, test } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Motion, MotionElement } from "@rivetjs/motion";

afterEach(cleanup);
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const until = async (check: () => boolean, ms = 2000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await frame();
  }
};

test("client-rendered entrance: final state inline, a CSS animation from the generated rule (constructable sheet)", async () => {
  render(() => (
    <Motion.div id="e" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "linear" }} style={{ color: "red" }}>
      Hi
    </Motion.div>
  ));
  const el = document.getElementById("e")!;
  expect(el.getAttribute("style")).toBe("color: red; opacity: 1; translate: 0px;");
  expect(el.getAttribute("data-mve")).toMatch(/^\w+$/);
  const animations = el.getAnimations();
  expect(animations.length).toBe(1);
  expect(animations[0]).toBeInstanceOf(CSSAnimation);
  expect((animations[0] as CSSAnimation).animationName).toBe(`rv-mve-${el.getAttribute("data-mve")}-1`);
  await frame();
  expect(Number(getComputedStyle(el).opacity)).toBeLessThan(0.6);
  expect(document.adoptedStyleSheets.length).toBe(1);
  // A second element with the same entrance reuses the rule.
  const rules = document.adoptedStyleSheets[0]!.cssRules.length;
  render(() => <Motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "linear" }} />);
  expect(document.adoptedStyleSheets[0]!.cssRules.length).toBe(rules);
  await until(() => el.getAnimations().length === 0);
  expect(getComputedStyle(el).opacity).toBe("1");
});

test("live animate: a signal change animates from the current value (WAAPI), the first run does not", async () => {
  const open = signal(false);
  const starts: unknown[] = [];
  render(() => (
    <Motion.div id="l" animate={{ x: open() ? 100 : 0 }} transition={{ duration: 0.2, ease: "linear" }} onAnimationStart={(d: unknown) => starts.push(d)} />
  ));
  const el = document.getElementById("l")!;
  expect(el.style.translate).toBe("0px");
  expect(el.getAnimations().length).toBe(0);
  expect(el.hasAttribute("data-mv-t")).toBe(false);
  open.set(true);
  await Promise.resolve();
  expect(el.getAnimations().length).toBe(1);
  expect(starts).toEqual([{ x: 100 }]);
  await until(() => el.getAnimations().length === 0);
  expect(el.style.translate).toBe("100px");
});

test("a live change during the CSS entrance takes over from the current value", async () => {
  const big = signal(false);
  render(() => <Motion.div id="t" initial={{ scale: 0 }} animate={{ scale: big() ? 2 : 1 }} transition={{ duration: 0.4, ease: "linear" }} />);
  const el = document.getElementById("t")!;
  for (let i = 0; i < 6; i++) await frame();
  const mid = Number(getComputedStyle(el).scale);
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(1);
  big.set(true);
  await Promise.resolve();
  expect(el.hasAttribute("data-mve")).toBe(false);
  const first = (el.getAnimations()[0]!.effect as KeyframeEffect).getKeyframes()[0]!;
  expect(Math.abs(Number(first.scale) - mid)).toBeLessThan(0.2);
  await until(() => el.getAnimations().length === 0);
  expect(el.style.scale).toBe("2");
});

test("refs compose (Ref object and callback), other props and handlers pass through, MotionElement as", async () => {
  const r = ref<HTMLButtonElement>();
  let called: Element | undefined;
  let clicks = 0;
  render(() => (
    <>
      <Motion.button ref={r} id="b" class="c" type="button" onClick={() => clicks++} animate={{ opacity: 0.5 }}>
        go
      </Motion.button>
      <MotionElement as="section" ref={(el: Element) => (called = el)} aria-label="s" animate={{ rotate: 10 }} />
    </>
  ));
  const button = document.getElementById("b") as HTMLButtonElement;
  expect(r()).toBe(button);
  expect(button.className).toBe("c");
  expect(button.style.opacity).toBe("0.5");
  button.click();
  expect(clicks).toBe(1);
  expect(called?.tagName).toBe("SECTION");
  expect((called as HTMLElement).style.rotate).toBe("10deg");
});

test("dev: a value the WAAPI path cannot run throws with the fix", () => {
  expect(() => render(() => <Motion.path animate={{ pathLength: 1 }} />)).toThrow(/@rivetjs\/motion\/animate/);
});
