// <Transition>: enter / leave phases with real CSS transitions in Chromium — class props, data
// attributes, unmount after the transition, `unmount={false}`, interruption, nested children.
import { afterEach, expect, test } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Transition, TransitionChild, useTransitionScope, type TransitionScope } from "@rivetjs/kit/transition";

const style = document.createElement("style");
style.textContent = `.fade { transition: opacity 80ms linear; } .from { opacity: 0; } .to { opacity: 1; }`;
document.head.append(style);

afterEach(cleanup);

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const until = async (check: () => boolean, ms = 2000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await frame();
  }
};
const panel = () => document.getElementById("panel");

test("enter: from classes and data-closed first, then to classes; settles without transition classes", async () => {
  const show = signal(false);
  render(() => (
    <Transition show={show} id="panel" class="box" enter="fade" enterFrom="from" enterTo="to" entered="done" leave="fade" leaveFrom="to" leaveTo="from">
      Hello
    </Transition>
  ));
  expect(panel()).toBeNull();
  show.set(true);
  await Promise.resolve();
  expect(panel()!.className).toBe("box fade from");
  expect(panel()!.hasAttribute("data-closed")).toBe(true);
  expect(panel()!.hasAttribute("data-enter")).toBe(true);
  expect(panel()!.hasAttribute("data-transition")).toBe(true);
  await until(() => panel()!.className === "box fade to");
  expect(panel()!.hasAttribute("data-closed")).toBe(false);
  await until(() => panel()!.className === "box done");
  expect(panel()!.hasAttribute("data-enter")).toBe(false);
  expect(panel()!.hasAttribute("data-transition")).toBe(false);
});

test("leave: stays mounted through the transition, then unmounts", async () => {
  const show = signal(true);
  render(() => (
    <Transition show={show} id="panel" leave="fade" leaveFrom="to" leaveTo="from">
      Bye
    </Transition>
  ));
  expect(panel()!.className).toBe("");
  show.set(false);
  await Promise.resolve();
  expect(panel()!.className).toBe("fade to");
  expect(panel()!.hasAttribute("data-leave")).toBe(true);
  await until(() => panel()!.className === "fade from");
  expect(panel()!.hasAttribute("data-closed")).toBe(true);
  const started = performance.now();
  await until(() => panel() === null);
  expect(performance.now() - started).toBeGreaterThan(40);
});

test("unmount={false}: hidden instead of removed", async () => {
  const show = signal(true);
  render(() => (
    <Transition show={show} id="panel" unmount={false}>
      Kept
    </Transition>
  ));
  show.set(false);
  await until(() => panel()!.hidden === true);
  expect(panel()!.hasAttribute("data-closed")).toBe(true);
  show.set(true);
  await until(() => !panel()!.hidden && !panel()!.hasAttribute("data-transition"));
});

test("interrupting a leave re-enters without unmounting", async () => {
  const show = signal(true);
  render(() => (
    <Transition show={show} id="panel" enter="fade" enterFrom="from" enterTo="to" leave="fade" leaveFrom="to" leaveTo="from">
      Flip
    </Transition>
  ));
  const element = panel();
  show.set(false);
  await frame();
  show.set(true);
  await until(() => !panel()!.hasAttribute("data-transition"));
  expect(panel()).toBe(element);
});

test("nested TransitionChild: the parent unmounts after the slower child has left", async () => {
  const show = signal(true);
  render(() => (
    <Transition show={show} id="panel">
      {() => (
        <TransitionChild id="child" leave="slow" leaveFrom="to" leaveTo="from">
          Inner
        </TransitionChild>
      )}
    </Transition>
  ));
  const slow = document.createElement("style");
  slow.textContent = `.slow { transition: opacity 150ms linear; }`;
  document.head.append(slow);
  show.set(false);
  await until(() => document.getElementById("child")!.className === "slow from");
  await frame();
  expect(panel()).not.toBeNull(); // child still leaving
  await until(() => panel() === null);
  slow.remove();
});

test("data attributes for react-aria-components styles", async () => {
  const show = signal(false);
  render(() => (
    <Transition show={show} id="panel" ariaComponents enter="fade" enterFrom="from" enterTo="to">
      RAC
    </Transition>
  ));
  show.set(true);
  await Promise.resolve();
  expect(panel()!.hasAttribute("data-entering")).toBe(true);
  await until(() => !panel()!.hasAttribute("data-entering"));
});

test("hold: the leave settles after held promises (also ones added mid-run); holds outside a run are ignored", async () => {
  const show = signal(true);
  let scope: TransitionScope | null = null;
  const Child = () => {
    scope = useTransitionScope();
    return <span>held</span>;
  };
  render(() => (
    <Transition show={show} id="panel" leave="fade" leaveFrom="to" leaveTo="from">
      {() => <Child />}
    </Transition>
  ));
  expect(scope).not.toBeNull();
  // Settled open: ignored (would otherwise keep the next leave waiting forever).
  scope!.hold(new Promise(() => {}));
  const started = performance.now();
  show.set(false);
  await Promise.resolve();
  scope!.hold(new Promise((resolve) => setTimeout(resolve, 120)));
  await until(() => panel()!.className === "fade from");
  // Added while the first hold runs: waited for too.
  scope!.hold(new Promise((resolve) => setTimeout(resolve, 200)));
  await until(() => panel() === null, 3000);
  expect(performance.now() - started).toBeGreaterThanOrEqual(190);
});

test("hold: an interrupted leave drops its holds", async () => {
  const show = signal(true);
  let scope: TransitionScope | null = null;
  const Child = () => {
    scope = useTransitionScope();
    return <span>held</span>;
  };
  render(() => (
    <Transition show={show} id="panel" enter="fade" enterFrom="from" enterTo="to" entered="done" leave="fade" leaveFrom="to" leaveTo="from">
      {() => <Child />}
    </Transition>
  ));
  show.set(false);
  await Promise.resolve();
  scope!.hold(new Promise(() => {}));
  await frame();
  show.set(true);
  await until(() => panel()!.className === "done");
  show.set(false);
  await until(() => panel() === null);
});

test("useTransitionScope: null outside a transition", () => {
  let scope: TransitionScope | null | undefined;
  const Probe = () => {
    scope = useTransitionScope();
    return null;
  };
  render(() => <Probe />);
  expect(scope).toBeNull();
});

test("a quick leave → enter → leave still unmounts (only the latest run steps the phase)", async () => {
  const show = signal(true);
  render(() => (
    <Transition show={show} id="panel" enter="fade" enterFrom="from" enterTo="to" leave="fade" leaveFrom="to" leaveTo="from">
      Quick
    </Transition>
  ));
  show.set(false);
  await Promise.resolve();
  await frame();
  show.set(true);
  await Promise.resolve();
  show.set(false);
  await until(() => panel() === null);
});
