// T8 Preact islands in Chromium, through the real driver (`hydrateIsland`) and the real adapters: hydrate keeps the
// server nodes, live props re-render Preact once per change, callbacks write Rivet signals, Rivet slot content stays
// interactive before and after hydration, useId stays unique across islands (island-id mask), a text mismatch is
// patched in place, Preact › Preact nesting, Preact's stopPropagation vs a handler above the island, a Suspense
// island rendered through renderToStringAsync, `useId` after a live-prop update (one mask per island), a hydration
// throw → Preact root reset + mount-over, React islands inside Preact slots and vice versa.
import { afterEach, expect, test, vi } from "vitest";
import { createRoot, signal } from "@rivetjs/reactivity";
import { hydrateIsland } from "@rivetjs/bridge/client";
import { Card, Counter, HydrateBoom, IdLater, Mismatch, MismatchCard, Stopper, Suspending, hydrateBoom, renders } from "./fixtures/components.ts";
import { chunk, islandHtml, islandHtmlAsync } from "./fixtures/page.ts";
import { Card as ReactCard, Counter as ReactCounter } from "../../bridge-react/tests/fixtures/components.ts";
import { chunk as reactChunk, islandHtml as reactIslandHtml } from "../../bridge-react/tests/fixtures/page.ts";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const until = async (check: () => boolean, ms = 3000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await tick();
  }
};
/** Preact rendered into the root (its mangled `_children` field on the container; test-only). */
const hydrated = (root: Element) => (root as Element & { __k?: unknown }).__k != null;
const disposers: (() => void)[] = [];
const island = (load: ReturnType<typeof chunk>, root: Element, props: Record<string, unknown>, id: string) =>
  createRoot((dispose) => (disposers.push(dispose), hydrateIsland(load, root, props, { id, on: "load" })));
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

test("hydrate: server nodes kept, live prop → one Preact render per change, callback → Rivet signal, local state works", async () => {
  document.body.innerHTML = islandHtml("i0", Counter, { count: 1 });
  const root = document.querySelector("rivet-island")!;
  const span = root.querySelector(".count")!;
  const errors = vi.spyOn(console, "error");
  const n = signal(1),
    total = signal(0);
  const load = chunk(Counter);
  island(
    load,
    root,
    {
      get count() {
        return n();
      },
      onIncrement: (by: number) => total.set(total() + by),
    },
    "i0",
  );
  await until(() => hydrated(root));
  expect(load.calls).toBe(1);
  expect(root.querySelector(".count")).toBe(span);
  const before = renders.Counter!;
  n.set(2);
  await until(() => span.textContent === "2");
  expect(renders.Counter! - before).toBe(1);
  (root.querySelector(".inc") as HTMLButtonElement).click();
  await until(() => root.querySelector(".local")!.textContent === "1");
  expect(total()).toBe(1);
  expect(errors).not.toHaveBeenCalled();
});

test("slots: Rivet content in the holes stays the same nodes and keeps its handlers before and after hydration", async () => {
  document.body.innerHTML = islandHtml("i0", Card, { tone: "warm" }, { default: '<button class="rivet">0</button>', title: "<em>T</em>" });
  const root = document.querySelector("rivet-island")!;
  const button = root.querySelector("button.rivet") as HTMLButtonElement;
  let hits = 0;
  button.addEventListener("click", () => (button.textContent = String(++hits)));
  button.click();
  expect(button.textContent).toBe("1");
  const errors = vi.spyOn(console, "error");
  const tone = signal("warm");
  island(
    chunk(Card),
    root,
    {
      get tone() {
        return tone();
      },
    },
    "i0",
  );
  await until(() => hydrated(root));
  await tick();
  tone.set("cold");
  await until(() => root.querySelector("article")!.className === "card cold");
  expect(root.querySelector("button.rivet")).toBe(button);
  expect(root.querySelector("rivet-slot[name=title] > em")!.textContent).toBe("T");
  button.click();
  expect(button.textContent).toBe("2");
  expect(errors).not.toHaveBeenCalled();
});

test("useId: three islands of one component keep distinct ids (island-id mask), the same on the client", async () => {
  document.body.innerHTML = ["i0", "i1", "i2"].map((id) => islandHtml(id, Counter, { count: 0 })).join("");
  const roots = [...document.querySelectorAll("rivet-island")];
  const server = roots.map((root) => root.querySelector(".counter")!.id);
  expect(server).toEqual(["Pi0-0", "Pi1-0", "Pi2-0"]);
  roots.forEach((root, i) => island(chunk(Counter), root, { count: 0 }, "i" + i));
  await until(() => roots.every(hydrated));
  // A re-render writes the client's useId value: equal to the server's.
  roots.forEach((root) => (root.querySelector(".inc") as HTMLButtonElement).click());
  await until(() => roots.every((root) => root.querySelector(".local")!.textContent === "1"));
  expect(roots.map((root) => root.querySelector(".counter")!.id)).toEqual(server);
});

test("a text mismatch is patched in place by Preact's hydration (no throw, no remount)", async () => {
  document.body.innerHTML = islandHtml("i7", Mismatch, {});
  const root = document.querySelector("rivet-island")!;
  const p = root.querySelector(".mismatch")!;
  island(chunk(Mismatch), root, {}, "i7");
  await until(() => hydrated(root));
  await tick();
  // Same element, client text: Preact patched the text node during hydration.
  expect(root.querySelector(".mismatch")).toBe(p);
  expect(p.textContent).toBe("client");
});

test("Preact › Preact: an island inside another island's slot hydrates and keeps its root across outer updates", async () => {
  const inner = islandHtml("i1", Counter, { count: 5 });
  document.body.innerHTML = islandHtml("i0", Card, { tone: "a" }, { default: inner });
  const [outerRoot, innerRoot] = [...document.querySelectorAll("rivet-island")] as [Element, Element];
  const tone = signal("a");
  const errors = vi.spyOn(console, "error");
  island(
    chunk(Card),
    outerRoot,
    {
      get tone() {
        return tone();
      },
    },
    "i0",
  );
  island(chunk(Counter), innerRoot, { count: 5 }, "i1");
  await until(() => hydrated(outerRoot) && hydrated(innerRoot));
  await tick();
  tone.set("b");
  await until(() => outerRoot.querySelector("article")!.className === "card b");
  expect(outerRoot.querySelector("rivet-island")).toBe(innerRoot);
  (innerRoot.querySelector(".inc") as HTMLButtonElement).click();
  await until(() => innerRoot.querySelector(".local")!.textContent === "1");
  expect(errors).not.toHaveBeenCalled();
});

test("Preact stopPropagation stops a click before handlers above the island (Preact listens on the element)", async () => {
  document.body.innerHTML = `<div class="above">${islandHtml("i0", Stopper, {})}</div>`;
  const root = document.querySelector("rivet-island")!;
  const above: string[] = [];
  document.querySelector(".above")!.addEventListener("click", (event) => above.push((event.target as Element).className));
  const hits: string[] = [];
  island(chunk(Stopper), root, { onHit: (which: string) => hits.push(which) }, "i0");
  await until(() => hydrated(root));
  await tick();
  (root.querySelector(".stop") as HTMLButtonElement).click();
  (root.querySelector(".go") as HTMLButtonElement).click();
  expect(hits).toEqual(["stop", "go"]);
  expect(above).toEqual(["go"]);
});

test("a Suspense island (renderToStringAsync on the server) hydrates and keeps the resolved nodes", async () => {
  const props = { value: "late-b", ms: 1 };
  document.body.innerHTML = await islandHtmlAsync("i0", Suspending, props);
  const root = document.querySelector("rivet-island")!;
  const b = root.querySelector("b.later")!;
  expect(b.textContent).toBe("late-b");
  const errors = vi.spyOn(console, "error");
  island(chunk(Suspending), root, props, "i0");
  await until(() => hydrated(root));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(root.querySelector("b.later")).toBe(b);
  expect(errors).not.toHaveBeenCalled();
});

test("a slot next to mismatching text: the Rivet slot nodes survive (same node, handler intact)", async () => {
  document.body.innerHTML = islandHtml("i3", MismatchCard, {}, { default: '<button class="rivet">0</button>' });
  const root = document.querySelector("rivet-island")!;
  const button = root.querySelector("button.rivet") as HTMLButtonElement;
  let hits = 0;
  button.addEventListener("click", () => (button.textContent = String(++hits)));
  island(chunk(MismatchCard), root, {}, "i3");
  await until(() => hydrated(root));
  await tick();
  expect(root.querySelector("rivet-slot > button.rivet")).toBe(button);
  button.click();
  expect(button.textContent).toBe("1");
});

test("useId after a live-prop update: a child mounted later continues the island's count (one mask per island)", async () => {
  document.body.innerHTML = islandHtml("i4", IdLater, { open: false });
  const root = document.querySelector("rivet-island")!;
  const open = signal(false);
  island(
    chunk(IdLater),
    root,
    {
      get open() {
        return open();
      },
    },
    "i4",
  );
  await until(() => hydrated(root));
  expect(root.querySelector(".ids")!.id).toBe("Pi4-0");
  open.set(true);
  await until(() => root.querySelector(".child") !== null);
  expect(root.querySelector(".child")!.id).toBe("Pi4-1");
  expect(root.querySelector(".ids")!.id).toBe("Pi4-0");
});

test("a throw during hydration: Preact's root is reset, the driver mounts over it, Rivet slot nodes kept", async () => {
  document.body.innerHTML = islandHtml("i5", HydrateBoom, {}, { default: '<button class="rivet">0</button>' });
  const root = document.querySelector("rivet-island")!;
  const button = root.querySelector("button.rivet") as HTMLButtonElement;
  let hits = 0;
  button.addEventListener("click", () => (button.textContent = String(++hits)));
  const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  hydrateBoom.armed = true;
  island(chunk(HydrateBoom), root, {}, "i5");
  await until(() => root.querySelector("article.hb p")?.textContent === "ok" && hydrated(root) && !hydrateBoom.armed);
  await tick();
  expect(root.querySelectorAll("article.hb")).toHaveLength(1);
  expect(root.querySelector("rivet-slot > button.rivet")).toBe(button);
  button.click();
  expect(button.textContent).toBe("1");
  expect(warnings.mock.calls.flat().join(" ") + "").toMatch(/hydrate boom|mount/i);
});

test("mixed nesting: a React island inside a Preact island's slot, and a Preact island inside a React one", async () => {
  const errors = vi.spyOn(console, "error");
  // Preact › React
  document.body.innerHTML = islandHtml("i0", Card, { tone: "a" }, { default: reactIslandHtml("i1", ReactCounter, { count: 2 }) });
  const [outer, inner] = [...document.querySelectorAll("rivet-island")] as [Element, Element];
  const tone = signal("a");
  island(
    chunk(Card),
    outer,
    {
      get tone() {
        return tone();
      },
    },
    "i0",
  );
  createRoot((dispose) => (disposers.push(dispose), hydrateIsland(reactChunk(ReactCounter), inner, { count: 2 }, { id: "i1", on: "load" })));
  await until(() => hydrated(outer) && inner.querySelector(".count")?.textContent === "2");
  tone.set("b");
  await until(() => outer.querySelector("article")!.className === "card b");
  expect(outer.querySelector("rivet-island")).toBe(inner);
  (inner.querySelector(".inc") as HTMLButtonElement).click();
  await until(() => inner.querySelector(".local")!.textContent === "1");
  // React › Preact
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = reactIslandHtml("i2", ReactCard, { tone: "c" }, { default: islandHtml("i3", Counter, { count: 7 }) });
  const [rOuter, pInner] = [...document.querySelectorAll("rivet-island")] as [Element, Element];
  const rTone = signal("c");
  createRoot(
    (dispose) => (
      disposers.push(dispose),
      hydrateIsland(
        reactChunk(ReactCard),
        rOuter,
        {
          get tone() {
            return rTone();
          },
        },
        { id: "i2", on: "load" },
      )
    ),
  );
  island(chunk(Counter), pInner, { count: 7 }, "i3");
  await until(() => hydrated(pInner));
  rTone.set("d");
  await until(() => rOuter.querySelector("article")!.className === "card d");
  expect(rOuter.querySelector("rivet-island")).toBe(pInner);
  (pInner.querySelector(".inc") as HTMLButtonElement).click();
  await until(() => pInner.querySelector(".local")!.textContent === "1");
  expect(errors).not.toHaveBeenCalled();
});
