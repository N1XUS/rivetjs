import { afterEach, expect, test, vi } from "vitest";
import { defineComponent, h, nextTick, onUnmounted } from "vue";
import { createRoot, signal } from "@rivetjs/reactivity";
import { hydrateIsland } from "@rivetjs/bridge/client";
import { adapter, createAdapter } from "../client.ts";
import {
  asyncFailure,
  AsyncCard,
  AsyncHeadMeta,
  Card,
  Counter,
  HeadMeta,
  HydrateOnce,
  hydrationAttempt,
  Injected,
  lifecycle,
  nativeRetry,
  RetryHead,
  RejectingAsync,
} from "./fixtures/components.ts";

const disposers: (() => void)[] = [];
const until = async (check: () => boolean) => {
  const end = performance.now() + 3000;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});
const counterHtml = (id: string, count = 1) =>
  `<rivet-island data-ri="${id}" style="display:contents"><article id="${id}-0"><span class="count">${count}</span><span class="label">absent</span><button class="inc">0</button></article></rivet-island>`;

test("driver hydrates existing nodes, applies live props, preserves Vue local state, calls Rivet callback, and disposes", async () => {
  document.body.innerHTML = counterHtml("i0");
  const root = document.querySelector("rivet-island")!;
  const button = root.querySelector("button")!;
  const count = signal(1),
    calls = signal(0);
  const before = lifecycle.unmounted;
  let loads = 0;
  const error = vi.spyOn(console, "error");
  createRoot((dispose) => {
    disposers.push(dispose);
    hydrateIsland(
      async () => {
        loads++;
        return { default: Counter, adapter };
      },
      root,
      {
        get count() {
          return count();
        },
        onIncrement(by: number) {
          calls.set(calls() + by);
        },
      },
      { id: "i0", on: "load" },
    );
  });
  await until(() => loads === 1);
  expect(root.querySelector("button")).toBe(button);
  button.click();
  await nextTick();
  expect(button.textContent).toBe("1");
  expect(calls()).toBe(1);
  count.set(4);
  await until(() => root.querySelector(".count")!.textContent === "4");
  expect(button.textContent).toBe("1");
  expect(error).not.toHaveBeenCalled();
  disposers.pop()!();
  expect(lifecycle.unmounted).toBe(before + 1);
});

test("full prop snapshots delete absent keys while local state survives", async () => {
  const root = document.createElement("rivet-island");
  document.body.append(root);
  const handle = await adapter.mount(root, Counter, { count: 2, label: "present" }, {}, { id: "i1" });
  root.querySelector("button")!.click();
  await nextTick();
  adapter.update(handle, { count: 7 });
  await nextTick();
  expect(root.querySelector(".label")!.textContent).toBe("absent");
  expect(root.querySelector(".count")!.textContent).toBe("7");
  expect(root.querySelector("button")!.textContent).toBe("1");
  expect(root.querySelector("article")!.id).toBe("i1-0");
  adapter.unmount(handle);
});

test("hydrate keeps exact default and kebab-case named slot nodes and handlers through updates", async () => {
  document.body.innerHTML =
    '<rivet-island><article class="warm"><header><rivet-slot name="section-title" style="display:contents"><em>title</em></rivet-slot></header><section><rivet-slot style="display:contents"><button>Rivet</button></rivet-slot></section></article></rivet-island>';
  const root = document.querySelector("rivet-island")!;
  const button = root.querySelector("button")!,
    title = root.querySelector("em")!;
  let hits = 0;
  button.addEventListener("click", () => hits++);
  const errors = vi.spyOn(console, "error");
  const handle = await adapter.hydrate(root, Card, { tone: "warm" }, { default: [button], "section-title": [title] }, { id: "i2" });
  adapter.update(handle, { tone: "cool" });
  await nextTick();
  expect(root.querySelector("button")).toBe(button);
  expect(root.querySelector("em")).toBe(title);
  expect(root.querySelector("article")!.className).toBe("cool");
  button.click();
  expect(hits).toBe(1);
  expect(errors).not.toHaveBeenCalled();
  adapter.unmount(handle);
});

test("client mount adopts existing slot nodes and applies setup(app) symmetrically", async () => {
  const root = document.createElement("rivet-island");
  document.body.append(root);
  const node = document.createElement("button");
  let hits = 0;
  node.onclick = () => hits++;
  const handle = await adapter.mount(root, Card, {}, { default: [node] }, { id: "i3" });
  expect(root.querySelector("button")).toBe(node);
  node.click();
  expect(hits).toBe(1);
  adapter.unmount(handle);
  const configured = createAdapter({
    setup(app) {
      app.provide("value", "configured");
    },
  });
  const injected = await configured.mount(root, Injected, {}, {}, { id: "i4" });
  expect(root.textContent).toBe("configured");
  configured.unmount(injected);
});

test("three islands retain unique server useId values during hydration and updates", async () => {
  document.body.innerHTML = ["i0", "i1", "i2"].map((id) => counterHtml(id)).join("");
  for (const [index, root] of [...document.querySelectorAll("rivet-island")].entries()) {
    const article = root.querySelector("article")!;
    const handle = await adapter.hydrate(root, Counter, { count: 1 }, {}, { id: `i${index}` });
    adapter.update(handle, { count: 2 });
    await nextTick();
    expect(root.querySelector("article")).toBe(article);
    expect(article.id).toBe(`i${index}-0`);
    adapter.unmount(handle);
  }
});

test("nested Vue island inside a Rivet slot survives outer hydration and updates", async () => {
  document.body.innerHTML =
    '<rivet-island data-ri="i0"><article class="warm"><header></header><section><rivet-slot style="display:contents">' +
    counterHtml("i1") +
    "</rivet-slot></section></article></rivet-island>";
  const outer = document.querySelector("rivet-island")!;
  const inner = outer.querySelector("rivet-island")!;
  const button = inner.querySelector("button")!;
  const child = await adapter.hydrate(inner, Counter, { count: 1 }, {}, { id: "i1" });
  const parent = await adapter.hydrate(outer, Card, { tone: "warm" }, { default: [inner] }, { id: "i0" });
  adapter.update(parent, { tone: "cold" });
  await nextTick();
  expect(outer.querySelector("rivet-island")).toBe(inner);
  button.click();
  await nextTick();
  expect(button.textContent).toBe("1");
  adapter.unmount(child);
  adapter.unmount(parent);
});

test("a hydration throw reaches the driver mount-over path and preserves the original Rivet slot node", async () => {
  hydrationAttempt.count = 0;
  document.body.innerHTML = '<rivet-island><div><rivet-slot style="display:contents"><button class="rivet">slot</button></rivet-slot></div></rivet-island>';
  const root = document.querySelector("rivet-island")!,
    button = root.querySelector("button")!;
  let clicks = 0;
  button.addEventListener("click", () => clicks++);
  createRoot((dispose) => {
    disposers.push(dispose);
    hydrateIsland(async () => ({ default: HydrateOnce, adapter }), root, {}, { id: "i9", on: "load" });
  });
  await until(() => root.querySelector(".recovered") !== null);
  expect(hydrationAttempt.count).toBe(2);
  expect(root.querySelector("button")).toBe(button);
  button.click();
  expect(clicks).toBe(1);
});

test("native head ranges hydrate in reverse policy order, async setup completes inside its scope, and resources keep identity", async () => {
  const original = new Set(document.head.childNodes);
  let first: Awaited<ReturnType<typeof adapter.hydrate>> | undefined, second: typeof first;
  try {
    const outside = document.createElement("meta");
    outside.name = "unrelated";
    outside.content = "keep";
    document.head.append(outside);
    const range = (id: string, name: string, content: string) =>
      `<!--rivet-head:vue:${id}--><!--teleport start anchor--><meta name="${name}" content="${content}"><!--teleport anchor--><!--/rivet-head:vue:${id}-->`;
    document.head.insertAdjacentHTML("beforeend", range("i21", "vue-one", "server-one") + range("i22", "vue-two", "server-two"));
    const one = document.head.querySelector('meta[name="vue-one"]')!,
      two = document.head.querySelector('meta[name="vue-two"]')!;
    document.body.innerHTML =
      '<rivet-island data-ri="i21"><section><!--teleport start--><!--teleport end--><p>body</p></section></rivet-island><rivet-island data-ri="i22"><section><!--teleport start--><!--teleport end--><p>body</p></section></rivet-island>';
    const roots = document.querySelectorAll("rivet-island");
    const errors = vi.spyOn(console, "error");
    // The later SSR range starts first and awaits native async setup; the earlier one must wait without touching it.
    const later = adapter.hydrate(roots[1]!, AsyncHeadMeta, { name: "vue-two", content: "server-two" }, {}, { id: "i22" });
    const earlier = adapter.hydrate(roots[0]!, HeadMeta, { name: "vue-one", content: "server-one" }, {}, { id: "i21" });
    [second, first] = await Promise.all([later, earlier]);
    expect(document.head.querySelector('meta[name="vue-one"]')).toBe(one);
    expect(document.head.querySelector('meta[name="vue-two"]')).toBe(two);
    expect(document.head.querySelector('meta[name="unrelated"]')).toBe(outside);
    adapter.update(first, { name: "vue-one", content: "updated" });
    await nextTick();
    expect(one.getAttribute("content")).toBe("updated");
    expect(two.getAttribute("content")).toBe("server-two");
    expect(document.head.querySelectorAll('meta[name^="vue-"]')).toHaveLength(2);
    expect(errors).not.toHaveBeenCalled();
  } finally {
    if (first) adapter.unmount(first);
    if (second) adapter.unmount(second);
    for (const node of [...document.head.childNodes]) if (!original.has(node)) node.remove();
  }
});

test("async setup without native head returns readiness for both hydrate and mount", async () => {
  for (const mode of ["mount", "hydrate"] as const) {
    const root = document.createElement("rivet-island");
    document.body.append(root);
    if (mode === "hydrate") root.innerHTML = "<b>resolved</b>";
    const server = root.firstChild;
    const result = adapter[mode](root, AsyncCard, {}, {}, { id: "i30" });
    expect(result).toBeInstanceOf(Promise);
    const handle = await result;
    expect(root.textContent).toBe("resolved");
    if (mode === "hydrate") expect(root.firstChild).toBe(server);
    adapter.unmount(handle);
  }
});

test("rejected async setup without head unmounts its app before rejecting readiness", async () => {
  const root = document.createElement("rivet-island");
  document.body.append(root);
  let release!: () => void;
  asyncFailure.wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const before = asyncFailure.unmounted;
  const result = adapter.mount(root, RejectingAsync, {}, {}, { id: "i31" });
  if (!(result instanceof Promise)) {
    adapter.unmount(result);
    throw new Error("async setup returned a premature synchronous handle");
  }
  release();
  await expect(result).rejects.toThrow("async readiness rejected");
  expect(asyncFailure.unmounted).toBe(before + 1);
  expect((root as Element & { __vue_app__?: unknown }).__vue_app__).toBeUndefined();
});

test("rejected native head hydration cleans the app, restores its head scope, and retries without duplicate resources", async () => {
  const original = new Set(document.head.childNodes);
  nativeRetry.attempts = 0;
  const before = nativeRetry.unmounted;
  try {
    const outside = document.createElement("meta");
    outside.name = "outside-retry";
    document.head.append(outside);
    document.head.insertAdjacentHTML(
      "beforeend",
      '<!--rivet-head:vue:i41--><!--teleport start anchor--><meta name="vue-retry" content="kept"><!--teleport anchor--><!--/rivet-head:vue:i41-->',
    );
    const serverMeta = document.head.querySelector('meta[name="vue-retry"]');
    document.body.innerHTML = '<rivet-island data-ri="i41"><section><!--teleport start--><!--teleport end--><p>body</p></section></rivet-island>';
    const root = document.querySelector("rivet-island")!;
    createRoot((dispose) => {
      disposers.push(dispose);
      hydrateIsland(async () => ({ default: RetryHead, adapter }), root, { name: "vue-retry", content: "kept" }, { id: "i41", on: "load" });
    });
    await until(() => nativeRetry.attempts === 2 && document.head.querySelector('meta[name="vue-retry"]') !== serverMeta);
    expect(document.head.querySelectorAll('meta[name="vue-retry"]')).toHaveLength(1);
    expect(document.head.querySelector('meta[name="outside-retry"]')).toBe(outside);
    expect(nativeRetry.unmounted).toBe(before + 1);
    disposers.pop()!();
  } finally {
    for (const node of [...document.head.childNodes]) if (!original.has(node)) node.remove();
  }
});

test("a native head cursor post-validation failure unmounts successful sync and async app initialization exactly once", async () => {
  const original = new Set(document.head.childNodes);
  const cursor = Object.getOwnPropertyDescriptor(document.head, "_lpa");
  try {
    for (const async of [false, true]) {
      let disposed = 0;
      const Component = defineComponent({
        setup() {
          onUnmounted(() => disposed++);
          const render = () => h("p", "body");
          return async ? Promise.resolve(render) : render;
        },
      });
      const id = async ? "i52" : "i51";
      document.head.insertAdjacentHTML(
        "beforeend",
        `<!--rivet-head:vue:${id}--><!--teleport start anchor--><meta name="guard-${id}" content="server"><!--teleport anchor--><!--/rivet-head:vue:${id}-->`,
      );
      const root = document.createElement("rivet-island");
      root.innerHTML = "<p>body</p>";
      document.body.append(root);
      let failure: unknown;
      try {
        await adapter.hydrate(root, Component, {}, {}, { id });
      } catch (error) {
        failure = error;
      }
      expect(String(failure)).toContain("cursor");
      expect(disposed).toBe(1);
      expect((root as Element & { __vue_app__?: unknown }).__vue_app__).toBeUndefined();
      expect(Object.getOwnPropertyDescriptor(document.head, "_lpa")).toEqual(cursor);
    }
  } finally {
    for (const node of [...document.head.childNodes]) if (!original.has(node)) node.remove();
  }
});
