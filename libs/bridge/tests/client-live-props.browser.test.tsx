// T4 live props: one `update` per Rivet batch after hydration (first run = the hydration snapshot), changes while the
// chunk loads applied once after hydrate, hydrate-on-change for a static island (no policy): nothing fetched until
// the first change, hydrate with the old values (no mismatch), then update.
import { afterEach, expect, test } from "vitest";
import { batch, createRoot, signal } from "@rivetjs/reactivity";
import { hydrateIsland } from "../client.ts";
import { chunk, Counter, counterHtml, log } from "./fake-client.ts";

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
afterEach(() => {
  log.length = 0;
  document.body.innerHTML = "";
});

test("three signal writes in one batch → one update with the latest snapshot; writes outside a batch → one each", async () => {
  const root = page(counterHtml("i0", 1));
  const a = signal(1),
    b = signal("x");
  const props = {
    get count() {
      return a();
    },
    get label() {
      return b();
    },
  };
  createRoot(() => hydrateIsland(chunk(Counter), root, props, { id: "i0", on: "load" }));
  await until(() => log.length > 0);
  expect(log.map((e) => e.call)).toEqual(["hydrate"]);
  batch(() => {
    a.set(2);
    a.set(3);
    b.set("y");
  });
  expect(log.filter((e) => e.call === "update").map((e) => e.props)).toEqual([{ count: 3, label: "y" }]);
  expect(root.querySelector("span")!.textContent).toBe("3");
  a.set(4);
  b.set("z");
  expect(log.filter((e) => e.call === "update").length).toBe(3);
});

test("changes while the chunk loads: hydrate with the server values, then one update with the latest", async () => {
  const root = page(counterHtml("i0", 1));
  const n = signal(1);
  const load = chunk(Counter, { held: true });
  createRoot(() =>
    hydrateIsland(
      load,
      root,
      {
        get count() {
          return n();
        },
      },
      { id: "i0", on: "load" },
    ),
  );
  n.set(2);
  n.set(5);
  load.release();
  await until(() => log.length > 1);
  expect(log.map((e) => [e.call, e.props?.count])).toEqual([
    ["hydrate", 1],
    ["update", 5],
  ]);
});

test("no change, no update; an unchanged write does not update", async () => {
  const root = page(counterHtml("i0", 1));
  const n = signal(1);
  createRoot(() =>
    hydrateIsland(
      chunk(Counter),
      root,
      {
        get count() {
          return n();
        },
      },
      { id: "i0", on: "load" },
    ),
  );
  await until(() => log.length > 0);
  n.set(1);
  await tick();
  expect(log.map((e) => e.call)).toEqual(["hydrate"]);
});

test("hydrate-on-change: no chunk request before the first change; then hydrate with the old values, then update", async () => {
  const root = page(counterHtml("i0", 1));
  const n = signal(1);
  const fetched = () => performance.getEntriesByType("resource").some((entry) => entry.name.includes("late-island"));
  createRoot(() =>
    hydrateIsland(
      () => import("./fixtures/late-island.ts") as never,
      root,
      {
        get count() {
          return n();
        },
      },
      { id: "i0" },
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(fetched()).toBe(false);
  expect(log).toEqual([]);
  n.set(2);
  await until(() => log.length > 1);
  expect(fetched()).toBe(true);
  // The fake framework throws on a mismatch (server text vs hydrate props): hydrate saw 1, the DOM's value.
  expect(log.map((e) => [e.call, e.props?.count])).toEqual([
    ["hydrate", 1],
    ["update", 2],
  ]);
  expect(root.querySelector("span")!.textContent).toBe("2");
  n.set(3);
  expect(log.at(-1)).toMatchObject({ call: "update", props: { count: 3 } });
});

test("a disposed island stops updating", async () => {
  const root = page(counterHtml("i0", 1));
  const n = signal(1);
  const { dispose } = createRoot(() =>
    hydrateIsland(
      chunk(Counter),
      root,
      {
        get count() {
          return n();
        },
      },
      { id: "i0", on: "load" },
    ),
  );
  await until(() => log.length > 0);
  dispose();
  n.set(9);
  expect(log.map((e) => e.call)).toEqual(["hydrate", "unmount"]);
});
