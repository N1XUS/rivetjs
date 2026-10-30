import { afterEach, expect, test, vi } from "vitest";
import { createRoot, signal } from "@rivetjs/reactivity";
import { hydrateIsland } from "@rivetjs/bridge/client";
import { adapter } from "../client.ts";
import Counter from "./fixtures/Counter.svelte";
import AsyncBody from "./fixtures/AsyncBody.svelte";
import { counterHtml, slotsHtml, asyncBodyHtml } from "./fixtures/html.ts";
import type { ClientAdapter } from "@rivetjs/bridge/adapter";

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const until = async (check: () => boolean) => {
  const end = performance.now() + 3000;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await pause();
  }
};
const disposers: (() => void)[] = [];
function start(root: Element, props: Record<string, unknown>, adapterOverride: ClientAdapter = adapter as ClientAdapter) {
  return createRoot((dispose) => {
    disposers.push(dispose);
    hydrateIsland(() => Promise.resolve({ default: Counter, adapter: adapterOverride }), root, props, { id: "i0", on: "load" });
    return dispose;
  }).dispose;
}
function html(body = counterHtml) {
  document.body.innerHTML = '<rivet-island data-ri="i0" style="display:contents">' + body + "</rivet-island>";
  return document.querySelector("rivet-island")!;
}
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

test("hydrate keeps SSR nodes and ids, live props preserve local state, callbacks reach Rivet, disposal cleans up", async () => {
  const root = html();
  const countNode = root.querySelector(".count");
  const id = root.querySelector("article")!.id;
  const count = signal(1),
    total = signal(0);
  let ready = 0;
  const unmount = vi.fn(adapter.unmount);
  const errors = vi.spyOn(console, "error");
  const dispose = start(
    root,
    {
      get count() {
        return count();
      },
      onReady: () => ready++,
      onIncrement: (by: number) => total.set(total() + by),
    },
    { ...adapter, unmount } as ClientAdapter,
  );
  await until(() => ready === 1);
  expect(root.querySelector(".count")).toBe(countNode);
  (root.querySelector("button") as HTMLButtonElement).click();
  await until(() => root.querySelector(".local")!.textContent === "1");
  expect(total()).toBe(1);
  count.set(3);
  await until(() => countNode!.textContent === "3");
  expect(root.querySelector(".local")!.textContent).toBe("1");
  expect(root.querySelector("article")!.id).toBe(id);
  expect(errors).not.toHaveBeenCalled();
  dispose();
  await until(() => root.querySelector("article") === null);
  expect(unmount).toHaveBeenCalledTimes(1);
});

test("full snapshots delete removed props while keeping one mounted state proxy", async () => {
  const root = html();
  const handle = await adapter.hydrate(root, Counter, { count: 1 }, {}, { id: "i0" });
  adapter.update(handle as never, { count: 2, label: "changed" });
  await until(() => root.querySelector(".label")!.textContent === "changed");
  adapter.update(handle as never, { count: 4 });
  await until(() => root.querySelector(".label")!.textContent === "fallback");
  expect(root.querySelector(".count")!.textContent).toBe("4");
  adapter.unmount(handle as never);
});

test("raw slot snippets hydrate byte-identical wrappers and keep existing Rivet nodes and handlers", async () => {
  const body = slotsHtml
    .replace('<rivet-slot style="display:contents"></rivet-slot>', '<rivet-slot style="display:contents"><button class="rivet">0</button></rivet-slot>')
    .replace('<rivet-slot name="title" style="display:contents"></rivet-slot>', '<rivet-slot name="title" style="display:contents"><em>T</em></rivet-slot>');
  const root = html(body);
  const original = root.innerHTML;
  const count = signal(1),
    hole = root.querySelector("rivet-slot:not([name])");
  const button = root.querySelector(".rivet") as HTMLButtonElement;
  let hits = 0,
    ready = false;
  button.addEventListener("click", () => (button.textContent = String(++hits)));
  start(root, {
    get count() {
      return count();
    },
    onReady: () => (ready = true),
  });
  await until(() => ready);
  expect(root.innerHTML).toBe(original);
  count.set(2);
  await until(() => root.querySelector(".count")!.textContent === "2");
  expect(root.querySelector("rivet-slot:not([name])")).toBe(hole);
  expect(root.querySelector(".rivet")).toBe(button);
  button.click();
  expect(button.textContent).toBe("1");
});

test("forced mismatch uses one generic bridge mount, preserves slot nodes and reports RV2149", async () => {
  const root = html(
    slotsHtml
      .replace('<rivet-slot style="display:contents"></rivet-slot>', '<rivet-slot style="display:contents"><button class="rivet">0</button></rivet-slot>')
      .replace("<!--]-->", ""),
  );
  const button = root.querySelector(".rivet") as HTMLButtonElement;
  let hits = 0,
    ready = 0;
  button.addEventListener("click", () => (button.textContent = String(++hits)));
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const mount = vi.fn(adapter.mount),
    unmount = vi.fn(adapter.unmount);
  const dispose = start(root, { count: 1, onReady: () => ready++ }, { ...adapter, mount, unmount } as ClientAdapter);
  await until(() => ready === 1);
  expect(mount).toHaveBeenCalledTimes(1);
  expect(root.querySelector(".rivet")).toBe(button);
  button.click();
  expect(button.textContent).toBe("1");
  expect(errors.mock.calls.filter((call) => String(call[0]).includes("RV2149"))).toHaveLength(1);
  dispose();
  await until(() => root.querySelector("article") === null);
  expect(unmount).toHaveBeenCalledTimes(1);
  expect(ready).toBe(1);
});

test("React > Svelte > Rivet slots keep both island roots and the original button interactive", async () => {
  const { Card } = await import("../../bridge-react/tests/fixtures/components.ts");
  const { islandHtml, chunk } = await import("../../bridge-react/tests/fixtures/page.ts");
  const content = slotsHtml.replace(
    '<rivet-slot style="display:contents"></rivet-slot>',
    '<rivet-slot style="display:contents"><button class="rivet">0</button></rivet-slot>',
  );
  const inner = '<rivet-island data-ri="i0" style="display:contents">' + content + "</rivet-island>";
  document.body.innerHTML = islandHtml("i9", Card, { tone: "warm" }, { default: inner });
  const outerRoot = document.querySelector("rivet-island")!;
  const innerRoot = outerRoot.querySelector("rivet-island")!;
  const button = innerRoot.querySelector(".rivet") as HTMLButtonElement;
  let hits = 0,
    ready = false;
  button.addEventListener("click", () => (button.textContent = String(++hits)));
  const tone = signal("warm");
  start(innerRoot, { count: 1, onReady: () => (ready = true) });
  createRoot((dispose) => {
    disposers.push(dispose);
    hydrateIsland(
      chunk(Card),
      outerRoot,
      {
        get tone() {
          return tone();
        },
      },
      { id: "i9", on: "load" },
    );
  });
  await until(() => ready);
  tone.set("cold");
  await until(() => outerRoot.querySelector("article")!.className.includes("cold"));
  expect(outerRoot.querySelector("rivet-island")).toBe(innerRoot);
  expect(innerRoot.querySelector(".rivet")).toBe(button);
  button.click();
  expect(button.textContent).toBe("1");
  (innerRoot.querySelector(".increment") as HTMLButtonElement).click();
  await until(() => innerRoot.querySelector(".local")!.textContent === "1");
});

test("three hydrated islands retain their distinct server id prefixes", async () => {
  document.body.innerHTML = ["i0", "i1", "i2"]
    .map((id) => '<rivet-island data-ri="' + id + '">' + counterHtml.replaceAll("i0-", id + "-") + "</rivet-island>")
    .join("");
  const roots = [...document.querySelectorAll("rivet-island")];
  const ids = roots.map((root) => root.querySelector("article")!.id);
  const handles = await Promise.all(roots.map((root, i) => adapter.hydrate(root, Counter, { count: 1 }, {}, { id: "i" + i })));
  expect(new Set(ids).size).toBe(3);
  roots.forEach((root) => (root.querySelector("button") as HTMLButtonElement).click());
  await until(() => roots.every((root) => root.querySelector(".local")!.textContent === "1"));
  expect(roots.map((root) => root.querySelector("article")!.id)).toEqual(ids);
  handles.forEach((handle) => adapter.unmount(handle as never));
});

test("intent waits for an experimental async body before reporting ready and replaying the first click", async () => {
  const root = html(asyncBodyHtml);
  const button = root.querySelector("button") as HTMLButtonElement;
  let release!: (shown: boolean) => void;
  const waiting = new Promise<boolean>((resolve) => {
    release = resolve;
  });
  let loads = 0,
    clicks = 0,
    ready = false;
  const native = {
    ...adapter,
    async hydrate(...args: Parameters<typeof adapter.hydrate>) {
      const handle = await adapter.hydrate(...args);
      ready = true;
      return handle;
    },
  };
  createRoot((dispose) => {
    disposers.push(dispose);
    hydrateIsland(
      () => {
        loads++;
        return Promise.resolve({ default: AsyncBody, adapter: native as ClientAdapter });
      },
      root,
      { wait: () => waiting, onClick: () => clicks++ },
      { id: "i0", on: "intent" },
    );
  });
  button.click();
  await until(() => loads === 1);
  await pause();
  expect(ready).toBe(false);
  expect(clicks).toBe(0);
  release(true);
  await until(() => ready && clicks === 1);
  expect(root.querySelector("button")).toBe(button);
  button.click();
  expect(clicks).toBe(2);
});
