// T8 every `client` policy with the real Preact adapter in Chromium. Client-created islands (DOM `_island`): no policy /
// load mount now, idle, visible, interaction, media, only over the fallback. Server-rendered ones (`hydrateIsland`):
// intent, and only (client render over the server fallback). "Network" = chunk loads: `load.calls` counts the dynamic
// imports the driver starts, asserted 0 before the trigger and exactly 1 after.
import { afterEach, expect, test } from "vitest";
import { createRoot } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { _island } from "@rivetjs/bridge/dom";
import { hydrateIsland } from "@rivetjs/bridge/client";
import { Counter as PreactCounter } from "./fixtures/components.ts";
import { chunk, islandHtml } from "./fixtures/page.ts";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const until = async (check: () => boolean, ms = 3000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await tick();
  }
};
const DEF = { id: "tests/counter.preact.tsx#Counter" };
let load = chunk(PreactCounter);
function Counter(props: Record<string, unknown>) {
  return _island(props, DEF, load);
}
const count = () => document.querySelector("rivet-island .count")?.textContent;
const disposers: (() => void)[] = [];
afterEach(() => {
  cleanup();
  for (const dispose of disposers.splice(0)) dispose();
  document.body.innerHTML = "";
});

test("no policy and load: one chunk load, Preact mounts right away", async () => {
  for (const client of [undefined, "load"]) {
    load = chunk(PreactCounter);
    render(() => <Counter count={1} client={client} />);
    await until(() => count() === "1");
    expect(load.calls).toBe(1);
    cleanup();
  }
});

test("idle: loads after idle (not synchronously)", async () => {
  load = chunk(PreactCounter);
  render(() => <Counter count={2} client="idle" fallback={<i class="wait">wait</i>} />);
  expect(load.calls).toBe(0);
  await until(() => count() === "2");
  expect(load.calls).toBe(1);
  expect(document.querySelector("rivet-island i.wait")).toBe(null);
});

test("visible: no load off screen; one load when scrolled into view", async () => {
  load = chunk(PreactCounter);
  render(() => (
    <div>
      <div style={{ height: "5000px" }} />
      <Counter count={3} client={{ on: "visible", rootMargin: "0px" }} fallback={<p style={{ height: "10px" }}>wait</p>} />
    </div>
  ));
  await wait(100);
  expect(load.calls).toBe(0);
  document.querySelector("rivet-island p")!.scrollIntoView();
  await until(() => count() === "3");
  expect(load.calls).toBe(1);
  window.scrollTo(0, 0);
});

test("interaction: no load until a pointerdown; then one", async () => {
  load = chunk(PreactCounter);
  render(() => <Counter count={4} client="interaction" fallback={<i class="wait">wait</i>} />);
  await wait(50);
  expect(load.calls).toBe(0);
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await until(() => count() === "4");
  expect(load.calls).toBe(1);
});

test("media: a matching query loads; a non-matching one never does", async () => {
  load = chunk(PreactCounter);
  render(() => <Counter count={5} client="media:(min-width: 1px)" />);
  await until(() => count() === "5");
  expect(load.calls).toBe(1);
  cleanup();
  load = chunk(PreactCounter);
  render(() => <Counter count={6} client="media:(max-width: 1px)" fallback={<i class="wait">wait</i>} />);
  await wait(100);
  expect(load.calls).toBe(0);
  expect(document.querySelector("rivet-island i.wait")!.textContent).toBe("wait");
});

test("only (client-created): fallback replaced by the Preact mount", async () => {
  load = chunk(PreactCounter);
  render(() => <Counter count={7} client="only" fallback={<i class="wait">wait</i>} />);
  await until(() => count() === "7");
  expect(load.calls).toBe(1);
  expect(document.querySelector("rivet-island i.wait")).toBe(null);
});

test("only (server-rendered): Preact renders over the server fallback", async () => {
  document.body.innerHTML = `<rivet-island data-ri="i0" style="display:contents"><i class="wait">wait</i></rivet-island>`;
  const root = document.querySelector("rivet-island")!;
  const load = chunk(PreactCounter);
  createRoot((dispose) => (disposers.push(dispose), hydrateIsland(load, root, { count: 8 }, { id: "i0", on: "only" })));
  await until(() => count() === "8");
  expect(load.calls).toBe(1);
  expect(root.querySelector("i.wait")).toBe(null);
});

test("intent (server-rendered): no load before intent; a dwell hydrates; the cold click is replayed once", async () => {
  document.body.innerHTML = islandHtml("i0", PreactCounter, { count: 9 });
  const root = document.querySelector("rivet-island")!;
  const load = chunk(PreactCounter);
  createRoot((dispose) => (disposers.push(dispose), hydrateIsland(load, root, { count: 9 }, { id: "i0", on: "intent" })));
  await import("@rivetjs/bridge/intent");
  await wait(100);
  expect(load.calls).toBe(0);
  const button = root.querySelector(".inc") as HTMLButtonElement;
  button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  button.click();
  await until(() => root.querySelector(".local")!.textContent === "1");
  expect(load.calls).toBe(1);
  await wait(50);
  expect(root.querySelector(".local")!.textContent).toBe("1");
});
