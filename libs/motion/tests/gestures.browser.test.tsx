// T6: whileHover / whilePress / whileFocus in Chromium — layer priority, return to the next active layer, touch hover
// ignored, press success / cancel, keyboard press, focus-visible only, user handlers still run.
import { afterEach, expect, test } from "vitest";
import { userEvent } from "@testing-library/user-event";
import { userEvent as real } from "vitest/browser";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Motion, MotionConfig } from "@rivetjs/motion";

afterEach(cleanup);
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const settle = async (el: Element) => {
  for (let i = 0; i < 200 && el.getAnimations().length; i++) await frame();
};
const fast = { duration: 0.02 };
const pointer = (el: Element, type: string, init: PointerEventInit = {}) =>
  el.dispatchEvent(
    new PointerEvent(type, { bubbles: type !== "pointerenter" && type !== "pointerleave", isPrimary: true, pointerType: "mouse", button: 0, ...init }),
  );

test("hover animates to whileHover and back to animate on leave; touch hover is ignored", async () => {
  const log: string[] = [];
  render(() => (
    <Motion.div
      id="h"
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.5 }}
      transition={fast}
      onHoverStart={() => log.push("start")}
      onHoverEnd={() => log.push("end")}
    />
  ));
  const el = document.getElementById("h")!;
  pointer(el, "pointerenter", { pointerType: "touch" });
  expect(el.getAnimations().length).toBe(0);
  pointer(el, "pointerenter");
  await settle(el);
  expect(el.style.scale).toBe("1.5");
  pointer(el, "pointerleave");
  await settle(el);
  expect(el.style.scale).toBe("1");
  expect(log).toEqual(["start", "end"]);
});

test("a key only the gesture sets returns to its pre-gesture value", async () => {
  render(() => <Motion.div id="r" style={{ opacity: 0.4 }} whileHover={{ opacity: 1 }} transition={fast} />);
  const el = document.getElementById("r")!;
  pointer(el, "pointerenter");
  await settle(el);
  expect(el.style.opacity).toBe("1");
  pointer(el, "pointerleave");
  await settle(el);
  expect(el.style.opacity).toBe("0.4");
});

test("press: whilePress over whileHover; release inside = onPress + success, outside = no onPress", async () => {
  const log: string[] = [];
  let downs = 0;
  render(() => (
    <Motion.button
      id="p"
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.2 }}
      whilePress={{ scale: 0.8 }}
      transition={fast}
      onPointerDown={() => downs++}
      onPressStart={() => log.push("start")}
      onPressEnd={(_e, info) => log.push("end:" + info.success)}
      onPress={() => log.push("press")}
    >
      go
    </Motion.button>
  ));
  const el = document.getElementById("p")!;
  pointer(el, "pointerenter");
  pointer(el, "pointerdown");
  await settle(el);
  expect(el.style.scale).toBe("0.8");
  pointer(el, "pointerup");
  await settle(el);
  expect(el.style.scale).toBe("1.2");
  pointer(el, "pointerdown");
  pointer(document.body, "pointerup");
  await settle(el);
  expect(log).toEqual(["start", "end:true", "press", "start", "end:false"]);
  expect(downs).toBe(2);
  pointer(el, "pointerdown");
  pointer(el, "pointercancel");
  expect(log.at(-1)).toBe("end:false");
});

test("keyboard: Enter / Space press and release; blur during a held key ends unsuccessfully", async () => {
  const user = userEvent.setup();
  const log: string[] = [];
  render(() => (
    <Motion.button
      id="k"
      whilePress={{ scale: 0.9 }}
      transition={fast}
      onPressEnd={(_e, info) => log.push("end:" + info.success)}
      onPress={() => log.push("press")}
    >
      k
    </Motion.button>
  ));
  const el = document.getElementById("k")!;
  el.focus();
  await user.keyboard("{Enter}");
  await user.keyboard("[Space]");
  expect(log).toEqual(["end:true", "press", "end:true", "press"]);
  await user.keyboard("{Enter>}");
  await settle(el);
  expect(el.style.scale).toBe("0.9");
  el.blur();
  expect(log.at(-1)).toBe("end:false");
});

test("whileFocus only while :focus-visible (real mouse click vs Tab)", async () => {
  render(() => (
    <>
      <button id="before">before</button>
      <Motion.button id="f" animate={{ opacity: 1 }} whileFocus={{ opacity: 0.5 }} transition={fast}>
        f
      </Motion.button>
    </>
  ));
  const el = document.getElementById("f")!;
  await real.click(el);
  await settle(el);
  expect(document.activeElement).toBe(el);
  expect(el.matches(":focus-visible")).toBe(false);
  expect(el.style.opacity).toBe("1");
  await real.click(document.getElementById("before")!);
  await real.tab();
  expect(document.activeElement).toBe(el);
  expect(el.matches(":focus-visible")).toBe(true);
  await settle(el);
  expect(el.style.opacity).toBe("0.5");
  await real.tab();
  await settle(el);
  expect(el.style.opacity).toBe("1");
});

test("a live animate change while hovered keeps the hover value for its keys", async () => {
  const color = signal("rgb(255, 0, 0)");
  render(() => <Motion.div id="c" animate={{ backgroundColor: color(), scale: 1 }} whileHover={{ scale: 2 }} transition={fast} />);
  const el = document.getElementById("c")!;
  pointer(el, "pointerenter");
  await settle(el);
  color.set("rgb(0, 0, 255)");
  await Promise.resolve();
  await settle(el);
  expect(el.style.scale).toBe("2");
  expect(el.style.backgroundColor).toBe("rgb(0, 0, 255)");
});

test("no gesture props: user handlers pass straight through", async () => {
  let enters = 0;
  render(() => <Motion.div id="n" onPointerEnter={() => enters++} animate={{ opacity: 1 }} />);
  pointer(document.getElementById("n")!, "pointerenter");
  expect(enters).toBe(1);
});

test("MotionConfig applies to gestures: its transition under the element's own, reducedMotion=always jumps transforms", async () => {
  render(() => (
    <MotionConfig transition={{ duration: 0.4, ease: "linear" }}>
      <>
        <Motion.div id="c" animate={{ scale: 1 }} whileHover={{ scale: 1.5 }} />
        <Motion.div id="o" animate={{ scale: 1 }} whileHover={{ scale: 1.5 }} transition={{ duration: 0.1 }} />
      </>
    </MotionConfig>
  ));
  const c = document.getElementById("c")!;
  pointer(c, "pointerenter");
  expect(c.getAnimations().map((a) => a.effect!.getTiming().duration)).toEqual([400]);
  const o = document.getElementById("o")!;
  pointer(o, "pointerenter");
  expect(o.getAnimations().map((a) => a.effect!.getTiming().duration)).toEqual([100]);
  cleanup();
  render(() => (
    <MotionConfig reducedMotion="always">
      <Motion.div id="r" animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.5, opacity: 0.5 }} transition={{ duration: 0.2 }} />
    </MotionConfig>
  ));
  const r = document.getElementById("r")!;
  pointer(r, "pointerenter");
  // The transform jumps (no scale animation); opacity still animates (Motion's reduced-motion semantics).
  expect(r.style.scale).toBe("1.5");
  expect(r.getAnimations().every((a) => !(a.effect as KeyframeEffect).getKeyframes().some((k) => "scale" in k))).toBe(true);
  expect(r.getAnimations().length).toBeGreaterThan(0);
});

test("a variant child that inherits its labels returns to the parent's animate target after a gesture", async () => {
  const variants = { off: { scale: 1 }, on: { scale: 2 } };
  render(() => (
    <Motion.div initial="off" animate="on" variants={variants} transition={fast}>
      <Motion.div id="v" variants={variants} whileHover={{ scale: 3 }} transition={fast} />
    </Motion.div>
  ));
  const v = document.getElementById("v")!;
  await settle(v);
  pointer(v, "pointerenter");
  await settle(v);
  expect(v.style.scale).toBe("3");
  pointer(v, "pointerleave");
  await settle(v);
  expect(v.style.scale).toBe("2");
});
