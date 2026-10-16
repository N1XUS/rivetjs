// T6 React islands in Chromium, through the real driver (`hydrateIsland`) and the real adapters: hydrate keeps the
// server nodes, live props re-render React once per change, callbacks write Rivet signals, Rivet slot content stays
// interactive before and after hydration, useId stays unique across islands, a hydration mismatch reports through
// onRecoverableError, React › React nesting, and React's stopPropagation vs a handler above the island.
import { afterEach, expect, test, vi } from "vitest";
import { createRoot, signal } from "@rivetjs/reactivity";
import { hydrateIsland } from "@rivetjs/bridge/client";
import { Card, Counter, Mismatch, MismatchCard, Stopper, Suspending, renders } from "./fixtures/components.ts";
import { chunk, islandHtml, islandHtmlAsync } from "./fixtures/page.ts";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const until = async (check: () => boolean, ms = 3000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await tick();
  }
};
/** React hydrated the root (its internal container marker). */
const hydrated = (root: Element) => Object.keys(root).some((key) => key.startsWith("__reactContainer$"));
const disposers: (() => void)[] = [];
const island = (load: ReturnType<typeof chunk>, root: Element, props: Record<string, unknown>, id: string) =>
  createRoot((dispose) => (disposers.push(dispose), hydrateIsland(load, root, props, { id, on: "load" })));
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

test("hydrate: server nodes kept, live prop → one React render per change, callback → Rivet signal, local state works", async () => {
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
  await until(() => (renders.Counter ?? 0) >= 2); // server render + hydration render
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

test("useId: three islands of one component keep distinct ids (island id prefix), hydration without mismatch", async () => {
  document.body.innerHTML = ["i0", "i1", "i2"].map((id) => islandHtml(id, Counter, { count: 0 })).join("");
  const roots = [...document.querySelectorAll("rivet-island")];
  const errors = vi.spyOn(console, "error");
  roots.forEach((root, i) => island(chunk(Counter), root, { count: 0 }, "i" + i));
  await until(() => roots.every(hydrated));
  await tick();
  const ids = roots.map((root) => root.querySelector(".counter")!.id);
  expect(new Set(ids).size).toBe(3);
  expect(errors).not.toHaveBeenCalled();
});

test("a hydration mismatch reports RV2149 through onRecoverableError with the island id (React client-renders it)", async () => {
  document.body.innerHTML = islandHtml("i7", Mismatch, {});
  const root = document.querySelector("rivet-island")!;
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  island(chunk(Mismatch), root, {}, "i7");
  await until(() => root.querySelector(".mismatch")?.textContent === "client");
  await until(() => errors.mock.calls.some((call) => String(call[0]).startsWith("[RV2149] react island i7 recovered from an error:")));
});

test("React › React: an island inside another island's slot hydrates first and keeps its root across outer updates", async () => {
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

test("React stopPropagation stops a click before handlers above the island (React listens at the island root)", async () => {
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

test("a Suspense island (streamed on the server) hydrates without a mismatch and keeps the resolved nodes", async () => {
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

test("recoverable error: React's client re-render keeps the Rivet slot nodes (same node, handler intact)", async () => {
  document.body.innerHTML = islandHtml("i3", MismatchCard, {}, { default: '<button class="rivet">0</button>' });
  const root = document.querySelector("rivet-island")!;
  const button = root.querySelector("button.rivet") as HTMLButtonElement;
  let hits = 0;
  button.addEventListener("click", () => (button.textContent = String(++hits)));
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  island(chunk(MismatchCard), root, {}, "i3");
  await until(() => root.querySelector(".mm p")?.textContent === "client");
  await until(() => errors.mock.calls.some((call) => String(call[0]).startsWith("[RV2149] react island i3")));
  await tick();
  expect(root.querySelector("rivet-slot > button.rivet")).toBe(button);
  button.click();
  expect(button.textContent).toBe("1");
});

test("a live-prop update while hydration is pending lands (React may switch the root to client rendering: RV2149 only)", async () => {
  document.body.innerHTML = islandHtml("i0", Counter, { count: 1 }, { default: "<em>kept</em>" });
  const root = document.querySelector("rivet-island")!;
  const em = root.querySelector("em")!;
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const n = signal(1);
  island(
    chunk(Counter),
    root,
    {
      get count() {
        return n();
      },
    },
    "i0",
  );
  // The chunk resolves in a microtask; hydration runs in a transition: update before React hydrated anything.
  await Promise.resolve();
  n.set(2);
  await until(() => hydrated(root) && root.querySelector(".count")?.textContent === "2");
  n.set(3);
  await until(() => root.querySelector(".count")!.textContent === "3");
  expect(root.querySelector("em")).toBe(em);
  for (const call of errors.mock.calls) expect(String(call[0])).toMatch(/^\[RV2149\] react island i0/);
  (root.querySelector(".inc") as HTMLButtonElement).click();
  await until(() => root.querySelector(".local")!.textContent === "1");
});
