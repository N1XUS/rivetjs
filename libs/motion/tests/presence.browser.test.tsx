// T10: `Presence` / `PresenceFor` on kit transitions: exits hold the unmount, reopen reverses, `initial={false}`,
// keyed exits keep their index, re-adding a leaving key restores it; Motion `exit` inside a plain kit `Transition`.
import { afterEach, expect, test } from "vitest";
import { signal, _setRegionStateHook } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Transition } from "@rivetjs/kit/transition";
import { Motion } from "@rivetjs/motion";
import { Presence, PresenceFor } from "@rivetjs/motion/presence";
import { Modal } from "@rivetjs/cdk/modal";

afterEach(cleanup);
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const until = async (check: () => boolean, ms = 3000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await frame();
  }
};
const byId = (id: string) => document.getElementById(id);
const opacity = (id: string) => Number(getComputedStyle(byId(id)!).opacity);

test("Presence: closing plays exit and unmounts after it; onExitComplete once", async () => {
  const open = signal(true);
  let completed = 0;
  render(() => (
    <Presence show={open} onExitComplete={() => completed++}>
      {() => <Motion.div id="p" animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "linear" }} />}
    </Presence>
  ));
  expect(byId("p")).not.toBeNull();
  const started = performance.now();
  open.set(false);
  await until(() => byId("p")?.hasAttribute("data-exiting") === true);
  await frame();
  await frame();
  expect(byId("p")).not.toBeNull();
  expect(opacity("p")).toBeLessThan(1);
  await until(() => byId("p") === null);
  expect(performance.now() - started).toBeGreaterThanOrEqual(180);
  expect(completed).toBe(1);
});

test("Presence: reopening during the exit reverses it (same element, no unmount)", async () => {
  const open = signal(true);
  render(() => (
    <Presence show={open}>{() => <Motion.div id="p" animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: "linear" }} />}</Presence>
  ));
  const el = byId("p");
  open.set(false);
  await until(() => opacity("p") < 0.8);
  open.set(true);
  await until(() => opacity("p") === 1);
  expect(byId("p")).toBe(el);
  expect(el!.hasAttribute("data-exiting")).toBe(false);
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(byId("p")).toBe(el);
});

test("Presence initial={false}: the first render skips entrances; a later open plays them", async () => {
  const open = signal(true);
  render(() => (
    <Presence show={open} initial={false}>
      {() => <Motion.div id="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.05 }} />}
    </Presence>
  ));
  expect(byId("p")!.hasAttribute("data-mve")).toBe(false);
  open.set(false);
  await until(() => byId("p") === null);
  open.set(true);
  await until(() => byId("p") !== null);
  expect(byId("p")!.hasAttribute("data-mve")).toBe(true);
});

test("Motion exit inside a plain kit Transition (no Presence) holds its unmount", async () => {
  const open = signal(true);
  render(() => (
    <Transition show={open} id="t">
      {() => <Motion.span id="p" animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />}
    </Transition>
  ));
  const started = performance.now();
  open.set(false);
  await until(() => byId("t") === null);
  expect(performance.now() - started).toBeGreaterThanOrEqual(180);
});

test("cdk Modal (no Presence): a Motion exit in its content plays on close and holds the unmount", async () => {
  const open = signal(true);
  render(() => (
    <Modal isOpen={open} onOpenChange={(value) => open.set(value)}>
      <Motion.div id="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "linear" }} />
    </Modal>
  ));
  await until(() => byId("p") !== null && byId("p")!.hasAttribute("data-mve"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const started = performance.now();
  open.set(false);
  await until(() => byId("p")?.hasAttribute("data-exiting") === true);
  await frame();
  await frame();
  expect(opacity("p")).toBeLessThan(1);
  await until(() => byId("p") === null);
  expect(performance.now() - started).toBeGreaterThanOrEqual(180);
});

// A server-open Modal dismissed as a resumed page's first interaction: the region re-created on the close renders the
// modal closed, with the server's "was open" (`_regionState`): it exits, and its Motion content (created while leaving)
// starts from the final state, not from `initial`.
test("cdk Modal re-created closed after a server-open render: Motion content exits from its final state", async () => {
  const open = signal(false);
  // The resume adoption's hook, as for the server render's values: the exit state's "was open at creation" is true.
  const previous = _setRegionStateHook(<T,>(create: () => T): T => {
    const value = create();
    return (value === false ? true : value) as T;
  });
  try {
    render(() => (
      <Modal isOpen={open} onOpenChange={(value) => open.set(value)}>
        <Motion.div id="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "linear" }} />
      </Modal>
    ));
  } finally {
    _setRegionStateHook(previous);
  }
  expect(byId("p")).not.toBeNull();
  expect(byId("p")!.hasAttribute("data-mve")).toBe(false);
  await until(() => byId("p")?.hasAttribute("data-exiting") === true);
  await frame();
  const mid = opacity("p");
  expect(mid).toBeGreaterThan(0.2);
  expect(mid).toBeLessThan(1);
  await until(() => byId("p") === null);
});

test("PresenceFor: a removed row stays at its index with data-exiting until its exit ends; re-adding restores it", async () => {
  const items = signal(["a", "b", "c"]);
  const exited: string[] = [];
  render(() => (
    <ul id="list">
      <PresenceFor each={items} by={(x) => x} onExitComplete={(key) => exited.push(key)}>
        {(x) => (
          <Motion.li id={x()} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {x()}
          </Motion.li>
        )}
      </PresenceFor>
    </ul>
  ));
  const ids = () => [...byId("list")!.children].map((li) => li.id + (li.hasAttribute("data-exiting") ? "*" : ""));
  expect(ids()).toEqual(["a", "b", "c"]);
  items.set(["a", "c"]);
  await until(() => ids().join() === "a,b*,c");
  // Back while leaving: the same row, no duplicate.
  const b = byId("b");
  items.set(["a", "b", "c"]);
  await until(() => ids().join() === "a,b,c");
  expect(byId("b")).toBe(b);
  items.set(["c"]);
  await until(() => ids().join() === "a*,b*,c");
  await until(() => ids().join() === "c");
  expect(exited.sort()).toEqual(["a", "b"]);
});

test("PresenceFor: 100 removals at once leave together and drop out", async () => {
  const items = signal(Array.from({ length: 100 }, (_, i) => i));
  render(() => (
    <div id="list">
      <PresenceFor each={items} by={(x) => x}>
        {(x) => (
          <Motion.div animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
            {String(x())}
          </Motion.div>
        )}
      </PresenceFor>
    </div>
  ));
  items.set([]);
  await until(() => byId("list")!.querySelectorAll("[data-exiting]").length === 100);
  await until(() => byId("list")!.children.length === 0);
});

test("Presence: a quick close → reopen → close still exits and unmounts", async () => {
  const open = signal(true);
  render(() => <Presence show={open}>{() => <Motion.div id="p" animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />}</Presence>);
  open.set(false);
  await until(() => byId("p")!.hasAttribute("data-exiting"));
  open.set(true);
  await until(() => !byId("p")!.hasAttribute("data-exiting"));
  open.set(false);
  await until(() => byId("p") === null);
});
