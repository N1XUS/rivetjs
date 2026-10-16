// T4 callbacks: function props reach the framework as stable batched wrappers; a callback writing a Rivet signal
// updates the Rivet DOM synchronously by the time the call returns; the current function is called after a prop
// change; a throw reaches the owner's catchError, else the framework.
import { afterEach, expect, test, vi } from "vitest";
import { catchError, createRoot, signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { hydrateIsland } from "../client.ts";
import { chunk, clicks, Counter, counterHtml, log } from "./fake-client.ts";

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
  clicks.n = clicks.pointerdowns = 0;
  document.body.innerHTML = "";
});

test("a callback writing Rivet signals: the Rivet DOM is updated when the framework's handler returns (one batch)", async () => {
  const total = signal(0),
    last = signal(0);
  let runs = 0;
  render(() => (
    <p id="out">
      {(runs++, total())}:{last()}
    </p>
  ));
  const host = document.createElement("div");
  host.innerHTML = counterHtml("i0", 0);
  document.body.append(host);
  const root = host.firstElementChild!;
  createRoot(() =>
    hydrateIsland(chunk(Counter), root, { count: 0, onIncrement: (n: number) => (total.set(total() + n), last.set(n), "ret") }, { id: "i0", on: "load" }),
  );
  await until(() => log.length > 0);
  const out = document.getElementById("out")!;
  const before = runs;
  root.querySelector("button")!.click();
  expect(out.textContent).toBe("1:1");
  expect(runs - before).toBe(1);
  // Return values pass through.
  expect((log[0]!.props!.onIncrement as (n: number) => unknown)(5)).toBe("ret");
  expect(out.textContent).toBe("6:5");
});

test("one stable wrapper per key across updates, calling the current function", async () => {
  const root = ((document.body.innerHTML = counterHtml("i0", 0)), document.querySelector("rivet-island")!);
  const seen: string[] = [];
  const which = signal<"a" | "b">("a");
  const props = {
    get count() {
      return which() === "a" ? 0 : 1;
    },
    get onIncrement() {
      const tag = which();
      return () => seen.push(tag);
    },
  };
  createRoot(() => hydrateIsland(chunk(Counter), root, props, { id: "i0", on: "load" }));
  await until(() => log.length > 0);
  const first = log[0]!.props!.onIncrement;
  which.set("b");
  expect(log[1]!.props!.onIncrement).toBe(first);
  root.querySelector("button")!.click();
  expect(seen).toEqual(["b"]);
});

test("a throwing callback reaches the owner's catchError; unhandled, it rethrows to the framework", async () => {
  const caught: unknown[] = [];
  const root = ((document.body.innerHTML = counterHtml("i0", 0)), document.querySelector("rivet-island")!);
  createRoot(() =>
    catchError(
      () =>
        hydrateIsland(
          chunk(Counter),
          root,
          {
            count: 0,
            onIncrement: () => {
              throw new Error("cb");
            },
          },
          { id: "i0", on: "load" },
        ),
      (error) => caught.push(error),
    ),
  );
  await until(() => log.length > 0);
  expect((log[0]!.props!.onIncrement as () => unknown)()).toBe(undefined);
  expect(String(caught[0])).toMatch(/cb/);
  log.length = 0;
  const bare = ((document.body.innerHTML = counterHtml("i1", 0)), document.querySelector("rivet-island")!);
  createRoot(() =>
    hydrateIsland(
      chunk(Counter),
      bare,
      {
        count: 0,
        onIncrement: () => {
          throw new Error("bare");
        },
      },
      { id: "i1", on: "load" },
    ),
  );
  await until(() => log.length > 0);
  expect(() => (log[0]!.props!.onIncrement as () => unknown)()).toThrow(/bare/);
});

test("after unmount every callback wrapper is a no-op (a stale framework timer never reaches the disposed owner)", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const root = ((document.body.innerHTML = counterHtml("i0", 0)), document.querySelector("rivet-island")!);
    const calls: number[] = [];
    const { dispose } = createRoot(() =>
      hydrateIsland(chunk(Counter), root, { count: 0, onIncrement: (n: number) => calls.push(n) }, { id: "i0", on: "load" }),
    );
    await until(() => log.length > 0);
    const wrapper = log[0]!.props!.onIncrement as (n: number) => unknown;
    wrapper(1);
    dispose();
    expect(wrapper(2)).toBe(undefined);
    wrapper(3);
    expect(calls).toEqual([1]);
    // Dev builds warn once per island; production stays silent.
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
  } finally {
    warn.mockRestore();
  }
});
