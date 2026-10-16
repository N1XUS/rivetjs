// T4 client-created islands (DOM `_island`): the fallback stands in, the adapter mounts when the policy fires (no
// policy / load: right away), slot content rendered by Rivet reaches the adapter as Node[] (still Rivet-owned and
// reactive), framework props stay live, a removed branch unmounts the island and disposes its slots.
import { afterEach, expect, test } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { _island } from "../dom.tsx";
import { chunk, Counter as CounterImpl, log } from "./fake-client.ts";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const until = async (check: () => boolean, ms = 2000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await tick();
  }
};
afterEach(() => {
  cleanup();
  log.length = 0;
  document.body.innerHTML = "";
});

const DEF = { id: "tests/Counter.fake#default" };
let load = chunk(CounterImpl);
function Counter(props: Record<string, unknown>) {
  return _island(props, DEF, load);
}

test("a Show branch created in the browser mounts the island (no policy: now), slot nodes appended, props live", async () => {
  load = chunk(CounterImpl);
  const open = signal(false),
    n = signal(1),
    label = signal("a");
  render(() => (
    <main>
      <Show when={open()}>
        <Counter count={n()}>
          <b>{label()}</b>
        </Counter>
      </Show>
    </main>
  ));
  expect(load.calls).toBe(0);
  open.set(true);
  const root = document.querySelector("rivet-island")!;
  expect(root.getAttribute("data-ri")).toMatch(/^c\d+$/);
  await until(() => log.length > 0);
  expect(log[0]).toMatchObject({ call: "mount", props: { count: 1 } });
  const b = root.querySelector("rivet-slot > b")!;
  expect(log[0]!.slots!.default).toContain(b);
  // Rivet keeps owning the slot content: its binding updates in place.
  label.set("b");
  expect(b.textContent).toBe("b");
  n.set(2);
  expect(root.querySelector("span")!.textContent).toBe("2");
  open.set(false);
  expect(log.map((e) => e.call)).toEqual(["mount", "update", "unmount"]);
  label.set("c");
  expect(b.textContent).toBe("b");
});

test("fallback until the policy fires (interaction), then replaced by the mount", async () => {
  load = chunk(CounterImpl);
  render(() => <Counter count={3} client="interaction" fallback={<i>wait</i>} />);
  const root = document.querySelector("rivet-island")!;
  expect(root.querySelector("i")!.textContent).toBe("wait");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(load.calls).toBe(0);
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await until(() => log.length > 0);
  expect(root.querySelector("i")).toBe(null);
  expect(root.querySelector("span")!.textContent).toBe("3");
});

test("visible: observes the fallback's box, mounts when it scrolls into view", async () => {
  load = chunk(CounterImpl);
  render(() => (
    <div>
      <div style={{ height: "5000px" }} />
      <Counter count={4} client={{ on: "visible", rootMargin: "0px" }} fallback={<p style={{ height: "10px" }}>wait</p>} />
    </div>
  ));
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(load.calls).toBe(0);
  document.querySelector("rivet-island p")!.scrollIntoView();
  await until(() => log.length > 0);
  expect(log[0]!.call).toBe("mount");
  window.scrollTo(0, 0);
});

test("no loader: the fallback only", async () => {
  function Bare(props: Record<string, unknown>) {
    return _island(props, DEF);
  }
  render(() => <Bare count={1} fallback={<i>static</i>} />);
  await tick();
  expect(document.querySelector("rivet-island i")!.textContent).toBe("static");
  expect(log).toEqual([]);
});
