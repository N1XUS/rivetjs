// T7b inline lean boot (`boot.min.ts`, run as the server writes it: a classic script right after the island records):
// policies as the resume runtime applies them (load / idle at idle, visible over the root's boxes + idle prefetch, interaction, media,
// only over the fallback), hydration through the chunk's adapter with the JSON props, mismatch → mount, chunk failure
// → one console.error, the hydrated island handles its own events.
import { afterEach, expect, test, vi } from "vitest";
import { BOOT } from "../boot.min.ts";
import { clicks, counterHtml, log } from "./fake-client.ts";

const ISLAND = new URL("./fixtures/lean-island.ts", import.meta.url).href;
const MISMATCH = new URL("./fixtures/lean-mismatch.ts", import.meta.url).href;
const BROKEN = new URL("./fixtures/broken-island.ts", import.meta.url).href;
const FAKE_CLIENT = new URL("./fake-client.ts", import.meta.url).href;
/** The boot's modulepreload links (Vitest's own runner preloads excluded). */
const ours = () => [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].filter((link) => link.href.includes("/libs/bridge/"));
const preloads = () => ours().map((link) => link.href);
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const until = async (check: () => boolean, ms = 3000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await tick();
  }
};
/** Server HTML + `<script type="rivet/islands">` + the boot script (executed on insertion, `currentScript` set). */
const serve = (html: string, records: unknown[], nonce?: string) => {
  document.body.innerHTML = html;
  const data = document.createElement("script");
  data.type = "rivet/islands";
  data.textContent = JSON.stringify(records);
  const boot = document.createElement("script");
  boot.textContent = BOOT;
  if (nonce) boot.nonce = nonce;
  document.body.append(data, boot);
};
afterEach(() => {
  for (const link of ours()) link.remove();
  log.length = 0;
  clicks.n = clicks.pointerdowns = 0;
  document.body.innerHTML = "";
});

test("load / idle: hydrate(root, component, JSON props, {}, { id }); the island then handles its clicks", async () => {
  serve(counterHtml("i0", 1) + counterHtml("i1", 2), [
    ["i0", ISLAND, { count: 1, label: "x" }, "load"],
    ["i1", ISLAND, { count: 2 }, "idle", [ISLAND, FAKE_CLIENT]],
  ]);
  await until(() => log.length === 2);
  // The `idle` record's closure is modulepreloaded once at idle (after the first paint entry); the `load` record here has none.
  expect(preloads()).toEqual([ISLAND, FAKE_CLIENT]);
  // Two concurrent cold imports of one chunk settle in either order: no hydration order across islands.
  expect(log.map((entry) => [entry.call, entry.id, entry.props]).sort((a, b) => String(a[1]).localeCompare(String(b[1])))).toEqual([
    ["hydrate", "i0", { count: 1, label: "x" }],
    ["hydrate", "i1", { count: 2 }],
  ]);
  expect(log[0]!.slots).toEqual({});
  (document.querySelector('[data-ri="i0"] button') as HTMLButtonElement).click();
  expect(clicks.n).toBe(1);
});

test("CSP: the idle modulepreload links carry the boot script's nonce (T7b N1)", async () => {
  serve(counterHtml("i1", 2), [["i1", ISLAND, { count: 2 }, "idle", [ISLAND, FAKE_CLIENT]]], "n0nce-1");
  await until(() => log.length === 1);
  expect(preloads()).toEqual([ISLAND, FAKE_CLIENT]);
  expect(ours().map((link) => link.nonce)).toEqual(["n0nce-1", "n0nce-1"]);
});

test("interaction: nothing until the first pointerdown / keydown in the document", async () => {
  serve(counterHtml("i0", 1), [["i0", ISLAND, { count: 1 }, "interaction"]]);
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(log).toEqual([]);
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await until(() => log.length === 1);
  expect(log[0]!.call).toBe("hydrate");
});

test("visible: hydrates once a box of the display:contents root nears the viewport", async () => {
  serve('<div style="height:500vh"></div>' + counterHtml("i0", 1), [["i0", ISLAND, { count: 1 }, "visible", [ISLAND, FAKE_CLIENT]]]);
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(log).toEqual([]);
  // The record's closure is modulepreloaded at idle (the full planner's `P`), not hydrated.
  expect(preloads()).toEqual([ISLAND, FAKE_CLIENT]);
  document.querySelector('[data-ri="i0"] div')!.scrollIntoView();
  await until(() => log.length === 1);
  expect(log[0]!.call).toBe("hydrate");
});

test("media: hydrates when the query matches", async () => {
  serve(counterHtml("i0", 1) + counterHtml("i1", 2), [
    ["i0", ISLAND, { count: 1 }, "media:(min-width: 1px)"],
    ["i1", ISLAND, { count: 2 }, "media:(max-width: 1px)"],
  ]);
  await until(() => log.length === 1);
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(log.map((entry) => entry.id)).toEqual(["i0"]);
});

test("only: mounts over the server fallback (root back to display: contents)", async () => {
  serve('<rivet-island data-ri="i0" style="display:contents"><i>wait</i></rivet-island>', [["i0", ISLAND, { count: 3 }, "only"]]);
  await until(() => log.length === 1);
  const root = document.querySelector('[data-ri="i0"]') as HTMLElement;
  expect(log[0]!.call).toBe("mount");
  expect(root.querySelector("i")).toBeNull();
  expect(root.querySelector("span")!.textContent).toBe("3");
  expect(root.style.display).toBe("contents");
});

test("hydration throw → mount fresh over the server HTML; chunk failure → static + one console.error", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    serve(counterHtml("i0", 1) + counterHtml("i1", 2), [
      ["i0", MISMATCH, { count: 1 }, "load"],
      ["i1", BROKEN, { count: 2 }, "load"],
    ]);
    await until(() => log.some((entry) => entry.call === "mount") && error.mock.calls.length > 0);
    expect(log.map((entry) => entry.call)).toEqual(["hydrate", "mount"]);
    expect(error.mock.calls.length).toBe(1);
    expect(String(error.mock.calls[0]![0])).toBe("[rivet:bridge] island chunk failed to load:");
    expect(document.querySelector('[data-ri="i1"] span')!.textContent).toBe("2");
  } finally {
    error.mockRestore();
  }
});

// The paint gate (LCP fix 2026-10-13): no preload / import before the first `paint` entry; fallbacks so an island
// always mounts (no entry type, no observer, a page that never paints contentfully, a first interaction).
const observers: (() => void)[] = [];
const stubObserver = (types: readonly string[] | null | "no-list") => {
  const real = self.PerformanceObserver;
  const Stub = class {
    static supportedEntryTypes = types == "no-list" ? undefined : (types ?? []);
    constructor(callback: () => void) {
      observers.push(callback);
    }
    observe() {}
  };
  Object.defineProperty(self, "PerformanceObserver", { value: types ? Stub : undefined, configurable: true, writable: true });
  return () => Object.defineProperty(self, "PerformanceObserver", { value: real, configurable: true, writable: true });
};
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("paint gate: nothing modulepreloaded or hydrated before the paint entry; the entry opens it", async () => {
  const restore = stubObserver(["paint"]);
  observers.length = 0;
  try {
    serve(counterHtml("i0", 1), [["i0", ISLAND, { count: 1 }, "load", [ISLAND, FAKE_CLIENT]]]);
    await settle(150);
    expect(log).toEqual([]);
    expect(preloads()).toEqual([]);
    expect(observers.length).toBe(1);
    observers[0]!();
    await until(() => log.length === 1);
    expect(preloads()).toEqual([ISLAND, FAKE_CLIENT]);
  } finally {
    restore();
  }
});

test("paint gate cap, boot after `load` (readyState complete): no paint entry ever → the island mounts 1 s after boot", async () => {
  const restore = stubObserver(["paint"]);
  try {
    expect(document.readyState).toBe("complete");
    serve(counterHtml("i0", 1), [["i0", ISLAND, { count: 1 }, "load"]]);
    await settle(500);
    expect(log).toEqual([]);
    await until(() => log.length === 1, 3000);
    expect(log[0]!.call).toBe("hydrate");
  } finally {
    restore();
  }
});

test("paint gate cap, boot before `load`: no paint entry ever (never-contentful page) → the island mounts 1 s after load", async () => {
  const restore = stubObserver(["paint"]);
  Object.defineProperty(document, "readyState", { value: "interactive", configurable: true });
  try {
    serve(counterHtml("i0", 1), [["i0", ISLAND, { count: 1 }, "load"]]);
    delete (document as { readyState?: unknown }).readyState;
    await settle(1300);
    // Not before `load`: the cap is anchored on it.
    expect(log).toEqual([]);
    dispatchEvent(new Event("load"));
    await settle(500);
    expect(log).toEqual([]);
    await until(() => log.length === 1, 3000);
    expect(log[0]!.call).toBe("hydrate");
  } finally {
    restore();
  }
});

test("paint gate: a first pointerdown opens it at once (interaction islands, and the rest with them)", async () => {
  const restore = stubObserver(["paint"]);
  try {
    serve(counterHtml("i0", 1), [["i0", ISLAND, { count: 1 }, "interaction"]]);
    await settle(50);
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await until(() => log.length === 1, 500);
    expect(log[0]!.call).toBe("hydrate");
  } finally {
    restore();
  }
});

test("paint gate fallback: no `paint` entry type, no `supportedEntryTypes`, or no PerformanceObserver → the idle slice alone", async () => {
  for (const types of [[], null, "no-list"] as const) {
    const restore = stubObserver(types);
    try {
      serve(counterHtml("i0", 1), [["i0", ISLAND, { count: 1 }, "load"]]);
      await until(() => log.length === 1, 500);
    } finally {
      restore();
      log.length = 0;
      document.body.innerHTML = "";
    }
  }
});
