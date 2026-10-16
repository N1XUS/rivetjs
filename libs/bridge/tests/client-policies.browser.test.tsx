// T4 driver: hydrate a server-rendered island through the chunk's adapter (snapshot props, resumed slot nodes, id),
// unmount with the owner, chunk failure = static + one console.error, hydrate throw = mount with the same slot nodes,
// `intent` (island-local dwell / focusin / touchstart, cold pointerdown + click replayed once), `only` over the fallback.
import { afterEach, expect, test, vi } from "vitest";
import { createRoot } from "@rivetjs/reactivity";
import { hydrateIsland } from "../client.ts";
import { chunk, clicks, Counter, counterHtml, fakeClient, log, Mismatch, seen, Stopper } from "./fake-client.ts";
import type { ClientAdapter } from "../adapter.ts";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const until = async (check: () => boolean, ms = 2000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await tick();
  }
};
const page = (html: string) => {
  document.body.innerHTML = html;
  return document.querySelector("rivet-island")!;
};
/** The intent listeners load on demand (`intent.ts`): wait until the driver attached them. */
const armed = async () => {
  await import("../intent.ts");
  await tick();
};
afterEach(() => {
  log.length = 0;
  seen.length = 0;
  clicks.n = clicks.pointerdowns = 0;
  document.body.innerHTML = "";
});

test("load: hydrate(root, component, snapshot, resumed slot nodes, { id }); owner disposal unmounts", async () => {
  const root = page(counterHtml("i0", 1, "<b>slot</b>"));
  const slot = root.querySelector("b")!;
  const load = chunk(Counter);
  const { dispose } = createRoot(() => hydrateIsland(load, root, { count: 1, label: "x" }, { id: "i0", on: "load" }));
  await until(() => log.length > 0);
  expect(load.calls).toBe(1);
  expect(log[0]).toMatchObject({ call: "hydrate", id: "i0", props: { count: 1, label: "x" } });
  expect(log[0]!.slots!.default).toEqual([slot]);
  expect(root.querySelector("b")).toBe(slot);
  dispose();
  expect(log.map((e) => e.call)).toEqual(["hydrate", "unmount"]);
});

test("slot nodes exclude the holes of nested islands; named holes by name", async () => {
  const inner = counterHtml("i1", 2, "<i>inner</i>");
  const root = page(
    `<rivet-island data-ri="i0" style="display:contents"><div class="counter"><span>1</span><button>+</button><rivet-slot style="display:contents">${inner}</rivet-slot><rivet-slot name="title" style="display:contents"><u>t</u></rivet-slot></div></rivet-island>`,
  );
  const { slotNodes } = await import("../client.ts");
  const slots = slotNodes(root);
  expect(Object.keys(slots).sort()).toEqual(["default", "title"]);
  expect(slots.default).toEqual([root.querySelector("rivet-island rivet-island")]);
  expect(slots.title).toEqual([root.querySelector("u")]);
});

test("disposed before the chunk arrives: never hydrates", async () => {
  const root = page(counterHtml("i0", 1));
  const load = chunk(Counter, { held: true });
  const { dispose } = createRoot(() => hydrateIsland(load, root, { count: 1 }, { id: "i0", on: "load" }));
  dispose();
  load.release();
  await tick();
  await tick();
  expect(log).toEqual([]);
});

test("chunk load failure: the island stays as rendered, one console.error", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const root = page(counterHtml("i0", 1));
    const html = root.outerHTML;
    createRoot(() => hydrateIsland(() => import("./fixtures/broken-island.ts") as never, root, { count: 1 }, { id: "i0", on: "load" }));
    await until(() => error.mock.calls.length > 0);
    await tick();
    expect(error.mock.calls.length).toBe(1);
    expect(String(error.mock.calls[0]![0])).toMatch(/\[rivet:bridge\] island (i0 )?chunk failed to load/);
    expect(root.outerHTML).toBe(html);
  } finally {
    error.mockRestore();
  }
});

test("hydrate throws (mismatch): mounts fresh, the resumed slot nodes moved into the new hole", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const root = page(counterHtml("i0", 1, "<b>kept</b>"));
    const slot = root.querySelector("b")!;
    createRoot(() => hydrateIsland(chunk(Mismatch), root, { count: 1 }, { id: "i0", on: "load" }));
    await until(() => log.some((e) => e.call === "mount"));
    expect(log.map((e) => e.call)).toEqual(["hydrate", "mount"]);
    expect(root.querySelector("rivet-slot > b")).toBe(slot);
    expect(root.querySelectorAll(".counter").length).toBe(1);
  } finally {
    warn.mockRestore();
  }
});

test("intent: nothing before intent; a 60 ms pointerover dwell hydrates; a shorter hover does not", async () => {
  const root = page(counterHtml("i0", 1));
  const load = chunk(Counter);
  createRoot(() => hydrateIsland(load, root, { count: 1 }, { id: "i0", on: "intent" }));
  await armed();
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(load.calls).toBe(0);
  const div = root.querySelector("div")!;
  div.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  div.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(load.calls).toBe(0);
  div.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  await until(() => log.length > 0);
  expect(load.calls).toBe(1);
});

test("intent: focusin / touchstart start it", async () => {
  for (const event of [new FocusEvent("focusin", { bubbles: true }), new TouchEvent("touchstart", { bubbles: true })]) {
    log.length = 0;
    const root = page(counterHtml("i0", 1));
    const load = chunk(Counter);
    createRoot(() => hydrateIsland(load, root, { count: 1 }, { id: "i0", on: "intent" }));
    await armed();
    root.querySelector("button")!.dispatchEvent(event);
    await until(() => log.length > 0);
    expect(log[0]!.call).toBe("hydrate");
  }
});

test("intent: a cold pointerdown + click are replayed once on their target after hydration; later clicks are not doubled", async () => {
  const root = page(counterHtml("i0", 1));
  const load = chunk(Counter, { held: true });
  createRoot(() => hydrateIsland(load, root, { count: 1 }, { id: "i0", on: "intent" }));
  await armed();
  const button = root.querySelector("button")!;
  button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  button.click();
  button.click();
  expect(load.calls).toBe(1);
  load.release();
  await until(() => clicks.n > 0);
  expect(clicks).toEqual({ n: 1, pointerdowns: 1 });
  button.click();
  expect(clicks).toEqual({ n: 2, pointerdowns: 1 });
});

test("intent: the replayed click does not run the default action twice", async () => {
  const root = page(
    `<rivet-island data-ri="i0" style="display:contents"><div class="counter"><span>1</span><button>+</button><input type="checkbox"></div></rivet-island>`,
  );
  const load = chunk(Counter, { held: true });
  createRoot(() => hydrateIsland(load, root, { count: 1 }, { id: "i0", on: "intent" }));
  await armed();
  const box = root.querySelector("input")!;
  box.click();
  expect(box.checked).toBe(true);
  load.release();
  await until(() => log.length > 0);
  await tick();
  expect(box.checked).toBe(true);
});

test("intent: a replayed click whose handler stops propagation runs no second default action (checkbox + link)", async () => {
  const root = page(
    `<rivet-island data-ri="i0" style="display:contents"><div class="stop"><input type="checkbox"><a href="#moved">go</a></div></rivet-island>`,
  );
  location.hash = "";
  const load = chunk(Stopper, { held: true });
  createRoot(() => hydrateIsland(load, root, {}, { id: "i0", on: "intent" }));
  await armed();
  const box = root.querySelector("input")!;
  box.click();
  expect(box.checked).toBe(true);
  load.release();
  await until(() => seen.length > 0);
  await tick();
  expect(box.checked).toBe(true);
  expect(seen).toMatchObject([{ tag: "INPUT", prevented: true, checked: true }]);

  seen.length = 0;
  log.length = 0;
  const root2 = page(`<rivet-island data-ri="i1" style="display:contents"><div class="stop"><a href="#moved">go</a></div></rivet-island>`);
  const load2 = chunk(Stopper, { held: true });
  createRoot(() => hydrateIsland(load2, root2, {}, { id: "i1", on: "intent" }));
  await armed();
  root2.querySelector("a")!.click();
  await until(() => location.hash === "#moved");
  location.hash = "#other";
  load2.release();
  await until(() => seen.length > 0);
  await tick();
  expect(seen).toMatchObject([{ tag: "A", prevented: true }]);
  expect(location.hash).toBe("#other");
  location.hash = "";
});

test("intent: a replayed click on a form's submit button submits once (the cold click's submit only)", async () => {
  const root = page(
    `<rivet-island data-ri="i0" style="display:contents"><div class="stop"><form><button type="submit">go</button></form></div></rivet-island>`,
  );
  let submits = 0;
  root.querySelector("form")!.addEventListener("submit", (event) => (submits++, event.preventDefault()));
  const load = chunk(Stopper, { held: true });
  createRoot(() => hydrateIsland(load, root, {}, { id: "i0", on: "intent" }));
  await armed();
  root.querySelector("button")!.click();
  expect(submits).toBe(1);
  load.release();
  await until(() => seen.length > 0);
  await tick();
  expect(seen).toMatchObject([{ tag: "BUTTON", prevented: true }]);
  expect(submits).toBe(1);
});

test("intent: a replayed radio click reads the user's choice and keeps it (group state unchanged by the replay)", async () => {
  const root = page(
    `<rivet-island data-ri="i0" style="display:contents"><div class="stop"><input type="radio" name="g" value="a" checked><input type="radio" name="g" value="b"></div></rivet-island>`,
  );
  const [a, b] = [...root.querySelectorAll("input")] as [HTMLInputElement, HTMLInputElement];
  const load = chunk(Stopper, { held: true });
  createRoot(() => hydrateIsland(load, root, {}, { id: "i0", on: "intent" }));
  await armed();
  b.click();
  expect([a.checked, b.checked]).toEqual([false, true]);
  load.release();
  await until(() => seen.length > 0);
  await tick();
  expect(seen).toMatchObject([{ tag: "INPUT", checked: true, prevented: true }]);
  expect([a.checked, b.checked]).toEqual([false, true]);
});

test("intent: the replayed click keeps the modifier keys and button", async () => {
  const root = page(`<rivet-island data-ri="i0" style="display:contents"><div class="stop"><a href="#mod">go</a></div></rivet-island>`);
  const load = chunk(Stopper, { held: true });
  createRoot(() => hydrateIsland(load, root, {}, { id: "i0", on: "intent" }));
  await armed();
  const link = root.querySelector("a")!;
  // Cancelled at the source: the cold click's own default action is not under test here.
  link.addEventListener("click", (event) => event.preventDefault(), { once: true });
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true, shiftKey: true, button: 1 }));
  load.release();
  await until(() => seen.length > 0);
  expect(seen).toMatchObject([{ tag: "A", ctrl: true, shift: true, button: 1 }]);
});

test("disposal during an async adapter.hydrate: unmounted once it resolves, no update", async () => {
  const root = page(counterHtml("i0", 1));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter: ClientAdapter = { ...(fakeClient as ClientAdapter), hydrate: (...args) => gate.then(() => (fakeClient as ClientAdapter).hydrate(...args)) };
  const { dispose } = createRoot(() => hydrateIsland(async () => ({ default: Counter, adapter }), root, { count: 1 }, { id: "i0", on: "load" }));
  await tick();
  dispose();
  release();
  await until(() => log.length > 1);
  await tick();
  expect(log.map((e) => e.call)).toEqual(["hydrate", "unmount"]);
});

test("only: mounts over the server fallback (cleared), no hydrate", async () => {
  const root = page('<rivet-island data-ri="i0" style="display:contents"><i>loading</i></rivet-island>');
  createRoot(() => hydrateIsland(chunk(Counter), root, { count: 7 }, { id: "i0", on: "only" }));
  await until(() => log.length > 0);
  expect(log.map((e) => e.call)).toEqual(["mount"]);
  expect(root.querySelector("i")).toBe(null);
  expect(root.querySelector("span")!.textContent).toBe("7");
});
