// T4 nesting: an island inside another island's slot hydrates first, even when the outer chunk arrives first; an
// outer update keeps the inner island's root element and framework handle.
import { afterEach, expect, test } from "vitest";
import { createRoot, signal } from "@rivetjs/reactivity";
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
afterEach(() => {
  log.length = 0;
  document.body.innerHTML = "";
});

test("inner hydrates before outer; an outer update keeps the inner root + handle", async () => {
  document.body.innerHTML = counterHtml("i0", 1, counterHtml("i1", 10));
  const [outer, inner] = [...document.querySelectorAll("rivet-island")] as [Element, Element];
  const n = signal(1);
  const outerLoad = chunk(Counter);
  const innerLoad = chunk(Counter, { held: true });
  createRoot(() => {
    hydrateIsland(
      outerLoad,
      outer,
      {
        get count() {
          return n();
        },
      },
      { id: "i0", on: "load" },
    );
    hydrateIsland(innerLoad, inner, { count: 10 }, { id: "i1", on: "load" });
  });
  await tick();
  await tick();
  expect(log).toEqual([]);
  innerLoad.release();
  await until(() => log.length === 2);
  expect(log.map((e) => e.id)).toEqual(["i1", "i0"]);
  const innerButton = inner.querySelector("button")!;
  n.set(2);
  const update = log.at(-1)!;
  expect(update).toMatchObject({ call: "update", props: { count: 2 } });
  expect(outer.querySelector(":scope > div > span")!.textContent).toBe("2");
  expect(outer.querySelector("rivet-island")).toBe(inner);
  expect(inner.querySelector("span")!.textContent).toBe("10");
  expect(inner.querySelector("button")).toBe(innerButton);
  expect(log.filter((e) => e.call === "unmount" || e.call === "mount")).toEqual([]);
});
