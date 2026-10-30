import { afterEach, beforeEach, expect, test } from "vitest";
import { createRoot, signal } from "@rivetjs/reactivity";
import { hydrateIsland } from "@rivetjs/bridge/client";
import { _delegateBelow, _on } from "../../runtime/dom-events.ts";
import { adapter } from "../client.ts";
import { activity, CleanBoom, Counter, DynamicSlot, Later, Stopper } from "./fixtures/components.solid.tsx";
import snapshot from "./fixtures/ssr.ts";

const disposers: (() => void)[] = [];
const wrap = (id: string, html: string) => `<rivet-island data-ri="${id}" style="display:contents">${html}</rivet-island>`;
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const until = async (check: () => boolean) => {
  const end = performance.now() + 3000;
  while (!check()) {
    if (performance.now() > end) throw Error("timed out");
    await tick();
  }
};
beforeEach(() => {
  (globalThis as any)._$HY = { events: [], completed: new WeakSet(), r: {}, fe() {} };
});
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = "";
});

function hydrated(id = "i0", html = snapshot[id]!, props: Record<string, unknown> = { count: 1, label: "first" }, slots: Record<string, Node[] | null> = {}) {
  document.body.innerHTML = wrap(id, html);
  const root = document.querySelector("rivet-island")!;
  const article = root.querySelector("article");
  const handle = adapter.hydrate(root, Counter, props, slots, { id });
  disposers.push(() => adapter.unmount(handle as never));
  return { root, article, handle: handle as never };
}

test("native hydrate keeps SSR nodes and ids, reconcile updates/deletes props, state/callbacks persist, unmount disposes once", () => {
  let total = 0;
  const before = activity.disposed;
  const { root, article, handle } = hydrated("i0", snapshot.i0, { count: 1, label: "first", onIncrement: (n: number) => (total += n) });
  expect(root.querySelector("article")).toBe(article);
  const id = article!.id;
  (root.querySelector("button") as HTMLButtonElement).click();
  expect(total).toBe(1);
  expect(root.querySelector("button")!.textContent).toBe("1");
  adapter.update(handle, { count: 4 });
  expect(root.querySelector(".count")!.textContent).toBe("4");
  expect(root.querySelector(".label")!.textContent).toBe("gone");
  expect(root.querySelector("button")!.textContent).toBe("1");
  expect(article!.id).toBe(id);
  (root.querySelector("button") as HTMLButtonElement).click();
  expect(total).toBe(1); // deleted callback must not remain in the store
  adapter.unmount(handle);
  adapter.unmount(handle);
  expect(activity.disposed - before).toBe(1);
  expect(root.childNodes).toHaveLength(0);
});

test("hydrated slots keep exact Rivet nodes and listeners across live updates", () => {
  const html = snapshot.slots!.replace(
    '<rivet-slot style="display:contents"></rivet-slot>',
    '<rivet-slot style="display:contents"><button class="rivet">rivet</button></rivet-slot>',
  );
  document.body.innerHTML = wrap("i0", html);
  const root = document.querySelector("rivet-island")!;
  const button = root.querySelector("button.rivet") as HTMLButtonElement;
  let hits = 0;
  button.addEventListener("click", () => hits++);
  button.click();
  const handle = adapter.hydrate(root, Counter, { count: 1, label: "first" }, { default: [button], title: [] }, { id: "i0" }) as never;
  disposers.push(() => adapter.unmount(handle));
  adapter.update(handle, { count: 8 });
  expect(root.querySelector("button.rivet")).toBe(button);
  button.click();
  expect(hits).toBe(2);
});

test("client mount transfers the same nodes, direct Solid events fire once beside real Rivet delegation", () => {
  const root = document.createElement("rivet-island");
  document.body.append(root);
  const child = document.createElement("button");
  child.textContent = "rivet";
  let hits = 0,
    ancestors = 0;
  createRoot((dispose) => {
    disposers.push(dispose);
    _on(root, "click", () => ancestors++);
  });
  const handle = adapter.mount(root, Counter, { count: 1, onIncrement: () => hits++ }, { default: [child] }, { id: "c0" }) as never;
  disposers.push(() => adapter.unmount(handle));
  expect(root.querySelector("rivet-slot")!.firstChild).toBe(child);
  const inc = root.querySelector(".inc") as HTMLButtonElement;
  expect((inc as any).$$click).toBeUndefined();
  inc.click();
  expect(hits).toBe(1);
  expect(ancestors).toBe(1);
});

test("Rivet delegation ignores precompiled Solid delegated handlers", () => {
  const root = document.createElement("div"),
    button = document.createElement("button");
  button.textContent = "delegated";
  root.append(button);
  document.body.append(root);
  let hits = 0;
  (button as any).$$click = () => hits++;
  createRoot((dispose) => {
    disposers.push(dispose);
    _on(root, "click", () => {});
  });
  const event = new MouseEvent("click", { bubbles: true });
  Object.defineProperties(event, { target: { value: button }, composedPath: { value: () => [button, root, document] } });
  // This is the real dispatch path (not a copied delegate). Solid's node has no Rivet owner expando.
  expect(() => _delegateBelow(event, document)).not.toThrow();
  expect(hits).toBe(0);
});

test("throwing mount and hydrate dispose the partial Solid root, and a retry can mount", () => {
  const root = document.createElement("rivet-island");
  document.body.append(root);
  for (const method of ["mount", "hydrate"] as const) {
    const before = activity.disposed;
    expect(() => adapter[method](root, CleanBoom, {}, {}, { id: "err" })).toThrow("solid mount boom");
    expect(activity.disposed - before, method).toBe(1);
  }
  const handle = adapter.mount(root, Counter, {}, {}, { id: "retry" }) as never;
  disposers.push(() => adapter.unmount(handle));
  expect(root.querySelector("article")).not.toBeNull();
});

test("Solid stopPropagation stops native ancestor listeners", () => {
  const root = document.createElement("rivet-island");
  document.body.append(root);
  let hits = 0;
  root.addEventListener("click", () => hits++);
  const handle = adapter.mount(root, Stopper, {}, {}, { id: "stop" }) as never;
  disposers.push(() => adapter.unmount(handle));
  (root.querySelector("button") as HTMLButtonElement).click();
  expect(hits).toBe(0);
});

test("real bridge driver observes live Rivet props, callbacks and disposal", async () => {
  document.body.innerHTML = wrap("i0", snapshot.i0!);
  const root = document.querySelector("rivet-island")!;
  const count = signal(1),
    total = signal(0);
  createRoot((dispose) => {
    disposers.push(dispose);
    hydrateIsland(
      async () => ({ default: Counter, adapter: adapter as never }),
      root,
      {
        get count() {
          return count();
        },
        label: "first",
        onIncrement: (n: number) => total.set(total() + n),
      },
      { id: "i0", on: "load" },
    );
  });
  await until(() => activity.created > 0);
  await tick();
  count.set(6);
  await until(() => root.querySelector(".count")?.textContent === "6");
  (root.querySelector(".inc") as HTMLButtonElement).click();
  expect(total()).toBe(1);
});

test("dynamic slot visibility retains the same Rivet DOM node and listener when shown again", () => {
  const root = document.createElement("rivet-island");
  document.body.append(root);
  const button = document.createElement("button");
  button.textContent = "rivet slot";
  let hits = 0;
  button.addEventListener("click", () => hits++);
  const handle = adapter.mount(root, DynamicSlot, { show: true }, { default: [button] }, { id: "dynamic" }) as never;
  disposers.push(() => adapter.unmount(handle));
  adapter.update(handle, { show: false });
  expect(root.querySelector("button")).toBeNull();
  adapter.update(handle, { show: true });
  expect(root.querySelector("button")).toBe(button);
  button.click();
  expect(hits).toBe(1);
});

test("resolved async SSR hydrates resource output without replacing its server element", async () => {
  document.body.innerHTML = wrap("async", snapshot.later!);
  const root = document.querySelector("rivet-island")!;
  // SSR serialization scripts are generated from native Solid; inserting HTML alone intentionally does not execute them.
  for (const inert of [...root.querySelectorAll("script")]) {
    const script = document.createElement("script");
    script.textContent = inert.textContent;
    inert.replaceWith(script);
  }
  const b = root.querySelector("b");
  expect(b!.textContent).toBe("hydrated-async");
  const handle = adapter.hydrate(root, Later, { value: "hydrated-async" }, {}, { id: "async" }) as never;
  disposers.push(() => adapter.unmount(handle));
  await tick();
  expect(root.querySelector("b")).toBe(b);
});

test("three native Solid roots retain distinct server ids during hydration and updates", () => {
  document.body.innerHTML = ["i0", "i1", "i2"].map((id) => wrap(id, snapshot[id]!)).join("");
  const roots = [...document.querySelectorAll("rivet-island")];
  const ids = roots.map((root) => root.querySelector("article")!.id);
  expect(new Set(ids).size).toBe(3);
  roots.forEach((root, index) => {
    const handle = adapter.hydrate(root, Counter, { count: 1, label: "first" }, {}, { id: `i${index}` }) as never;
    disposers.push(() => adapter.unmount(handle));
    adapter.update(handle, { count: index + 10 });
  });
  expect(roots.map((root) => root.querySelector("article")!.id)).toEqual(ids);
});

test("nested Solid island in a Rivet slot survives outer prop updates and keeps its own local state", () => {
  const html = snapshot.slots!.replace(
    '<rivet-slot style="display:contents"></rivet-slot>',
    `<rivet-slot style="display:contents">${wrap("i1", snapshot.i1!)}</rivet-slot>`,
  );
  document.body.innerHTML = wrap("i0", html);
  const [outer, inner] = [...document.querySelectorAll("rivet-island")] as [Element, Element];
  const outerHandle = adapter.hydrate(outer, Counter, { count: 1, label: "first" }, { default: [inner], title: [] }, { id: "i0" }) as never;
  const innerHandle = adapter.hydrate(inner, Counter, { count: 1, label: "first" }, {}, { id: "i1" }) as never;
  disposers.push(
    () => adapter.unmount(innerHandle),
    () => adapter.unmount(outerHandle),
  );
  (inner.querySelector("button") as HTMLButtonElement).click();
  adapter.update(outerHandle, { count: 4 });
  expect(outer.querySelector("rivet-island")).toBe(inner);
  expect(inner.querySelector("button")!.textContent).toBe("1");
});
