// Lite resume runtime (ZERO R4 / R5, `dom-lite.ts`): a page whose boundaries' chunks export residuals (`<Name>$a`) boots
// `@rivetjs/runtime/dom-lite` from `data-rt` (the loader contract of `dom-derived`), adopts only the boundary an event
// lands in (no template, no probe, the full runtime never fetched), shares one delegated listener per type with the page
// (constant in the number of boundaries), and falls back one-way to the full runtime + the ordinary component (`$c`)
// when a residual cannot adopt. The full runtime runs residuals too (R5). Server side = the real derived server target;
// the residuals are hand-written (FE-COMPILE C1 emits them later, same ABI).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Counter() {
  const count = signal(0);
  return <div class="c"><button type="button" class="inc" onClick={() => count.update((n) => n + 1)}>Add</button><p class="n">Count: {count()}</p></div>;
}
export function Page(props: { n: number }) {
  return <main>{Array.from({ length: props.n }, () => <Counter />)}</main>;
}`;
const RESUME = { module: "src/c.tsx", boundaries: ["Counter"], independent: ["Counter"] };
// The hand-written residual of `Counter` (what lite emission produces): the keyed signal from the record, the button's
// handler, the count text after its content opener. `walk` = the path to that opener from the button.
// `read` (ZERO X9): the count's initial value read from the page (`_lr` codec 1: the text as a number), not the record.
const residual = (walk = "nfn", key?: string, read = false) => `import { _ls, _le, _lr, _lt, _lw } from "@rivetjs/runtime/dom-lite";
export function Counter$a(n, r) {
  const b = n.firstChild, at = _lw(b, ${JSON.stringify(walk)}),
    count = ${read ? `_lr(r, ${JSON.stringify(key ?? "KEY")}, at, 1)` : `_ls(r, ${JSON.stringify(key ?? "KEY")}, 0)`};
  _le(r, b, "click", () => count.update((x) => x + 1));
  _lt(at, () => count());
}
export const Counter$c = () => import("/c-full.js");`;

const compiled = hasDerivedModel() ? test : test.skip;
async function files(n: number, options: { runtime?: "lite" | "full"; walk?: string; wake?: boolean; read?: string } = {}): Promise<Record<string, string>> {
  const server = compile(SOURCE, { target: "server", filename: "c.tsx", resume: RESUME } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "c.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const key = /__rivetR_sig\("([^"]+)"/.exec(dom.code)![1]!;
  const { Page } = await importServer<{ Page: (props: { n: number }) => ServerValue }>(server.code);
  const runtime = options.runtime === "full" ? "/rt.js" : "/lite.js";
  let html = (await derivedToString(() => Page({ n }), { manifest: { runtime, symbols: { "src/c.tsx#Counter": "/c.js" } } })) as string;
  // A wake list naming the first counter's key (another boundary reads it): not lite.
  // (Tail v2, ZERO S2: inserted before the names table `n`.)
  if (options.wake) html = html.replace('"n":[', '"w":{"1.' + key + '":[2]},"n":[');
  // X9: the page shows another count than the init (the server elides a DOMREAD key while unwritten).
  if (options.read !== undefined) html = html.replaceAll("Count: <!--[-->0<!--]-->", "Count: <!--[-->" + options.read + "<!--]-->");
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/lite.js": 'export { default } from "/dom-lite.ts";',
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    // X9: the residual reads a key the record does not have (what DOMREAD elision leaves).
    "/c.js": rewrite(residual(options.walk, options.read !== undefined ? "elided" : key, options.read !== undefined)),
    "/c-full.js": rewrite(dom.code),
  };
}
const counts = (page: Page): Promise<string[]> => page.evaluate(() => [...document.querySelectorAll(".n")].map((p) => p.textContent!));
const handled = (page: Page): Promise<boolean[]> =>
  page.evaluate(() => [...document.querySelectorAll(".inc")].map((b) => (b as unknown as Record<string, unknown>).$$click !== undefined));
// Count the listeners added to the document (delegation: one per type, whatever the number of boundaries).
const COUNT_DOC_LISTENERS = () => {
  const add = EventTarget.prototype.addEventListener;
  (window as unknown as { docListeners: number }).docListeners = 0;
  EventTarget.prototype.addEventListener = function (this: EventTarget, ...args: Parameters<typeof add>) {
    if (this === document) (window as unknown as { docListeners: number }).docListeners++;
    return add.apply(this, args);
  };
};

compiled("lite page: a cold click adopts only its boundary through the residual; the full runtime is never fetched", async () => {
  await withPage(await files(3), async (page, requests) => {
    await page.goto("http://rivet.test/");
    assert.deepEqual(requests, ["/"], "nothing before input but the page (fetch-ahead comes after load)");
    await page.evaluate(() => document.querySelectorAll(".n").forEach((p, i) => ((p as unknown as { __t: number }).__t = i)));
    await page.click(".c:nth-child(2) .inc");
    await page.waitForFunction(() => document.querySelectorAll(".n")[1]!.textContent === "Count: 1");
    assert.deepEqual(await counts(page), ["Count: 0", "Count: 1", "Count: 0"]);
    assert.deepEqual(await handled(page), [false, true, false], "only the clicked boundary adopted");
    assert.ok(
      await page.evaluate(() => [...document.querySelectorAll(".n")].every((p, i) => (p as unknown as { __t: number }).__t === i)),
      "server nodes kept",
    );
    // Live from now on: the native dispatch runs the handler synchronously.
    await page.click(".c:nth-child(2) .inc");
    assert.deepEqual(await counts(page), ["Count: 0", "Count: 2", "Count: 0"]);
    await page.click(".c:nth-child(3) .inc");
    await page.waitForFunction(() => document.querySelectorAll(".n")[2]!.textContent === "Count: 1");
    assert.ok(!requests.includes("/dom-derived.ts") && !requests.includes("/c-full.js"), requests.join(" "));
    assert.ok(requests.includes("/dom-lite.ts") && requests.includes("/c.js"));
  });
});

compiled("lite page: document listeners and adopt work are constant in the number of boundaries", async () => {
  const measure = async (n: number) =>
    withPage(await files(n), async (page) => {
      await page.addInitScript(COUNT_DOC_LISTENERS);
      await page.goto("http://rivet.test/");
      const before = await page.evaluate(() => (window as unknown as { docListeners: number }).docListeners);
      for (const i of new Set([1, Math.ceil(n / 2), n])) {
        await page.click(`.c:nth-child(${i}) .inc`);
        await page.waitForFunction((i) => document.querySelectorAll(".n")[i - 1]!.textContent === "Count: 1", i);
      }
      const t0 = await page.evaluate(() => performance.now());
      await page.click(`.c:nth-child(${n}) .inc`);
      const live = (await page.evaluate(() => performance.now())) - t0;
      return {
        added: (await page.evaluate(() => (window as unknown as { docListeners: number }).docListeners)) - before,
        adopted: (await handled(page)).filter(Boolean).length,
        live,
      };
    });
  const one = await measure(1),
    many = await measure(1000);
  assert.equal(one.adopted, 1);
  assert.equal(many.adopted, 3, "three clicked boundaries of 1000 adopted");
  assert.equal(many.added, one.added, `document listeners: ${one.added} (N=1) vs ${many.added} (N=1000)`);
  console.log(`dom-lite N=1 / N=1000: document listeners ${one.added} / ${many.added}, live click ${one.live.toFixed(1)} / ${many.live.toFixed(1)} ms`);
});

compiled("a residual that cannot adopt falls back one-way to the full runtime and the ordinary component", async () => {
  await withPage(await files(2, { walk: "nnnnn" }), async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.click(".c:nth-child(1) .inc");
    await page.waitForFunction(() => document.querySelectorAll(".n")[0]!.textContent === "Count: 1");
    assert.ok(requests.includes("/dom-derived.ts") && requests.includes("/c-full.js"), requests.join(" "));
    await page.click(".c:nth-child(1) .inc");
    await page.click(".c:nth-child(2) .inc");
    await page.waitForFunction(() => document.querySelectorAll(".n")[1]!.textContent === "Count: 1");
    assert.deepEqual(await counts(page), ["Count: 2", "Count: 1"]);
  });
});

compiled("a key another boundary reads (wake list) is not lite: the boundary adopts through the full runtime", async () => {
  await withPage(await files(2, { wake: true }), async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.click(".c:nth-child(1) .inc");
    await page.waitForFunction(() => document.querySelectorAll(".n")[0]!.textContent === "Count: 1");
    assert.ok(requests.includes("/c-full.js"), requests.join(" "));
  });
});

compiled("full runtime (R5): a chunk exporting `<Name>$a` adopts through the residual, no ordinary module", async () => {
  await withPage(await files(2, { runtime: "full" }), async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.click(".c:nth-child(2) .inc");
    await page.waitForFunction(() => document.querySelectorAll(".n")[1]!.textContent === "Count: 1");
    await page.click(".c:nth-child(2) .inc");
    assert.deepEqual(await counts(page), ["Count: 0", "Count: 2"]);
    assert.deepEqual(await handled(page), [false, true]);
    assert.ok(requests.includes("/dom-derived.ts") && !requests.includes("/c-full.js"), requests.join(" "));
  });
});

compiled("full runtime (R5): a residual that throws adopts through `$c` (one-way)", async () => {
  await withPage(await files(1, { runtime: "full", walk: "nnnnn" }), async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.click(".inc");
    await page.waitForFunction(() => document.querySelector(".n")!.textContent === "Count: 1");
    await page.click(".inc");
    assert.deepEqual(await counts(page), ["Count: 2"]);
    assert.ok(requests.includes("/c-full.js"), requests.join(" "));
  });
});

compiled("X9: a residual reads a keyed signal's initial value from the page (`_lr`); an unreadable one falls back", async () => {
  await withPage(await files(2, { read: "7" }), async (page, requests) => {
    await page.goto("http://rivet.test/");
    assert.deepEqual(await counts(page), ["Count: 7", "Count: 7"]);
    await page.click(".c:nth-child(1) .inc");
    await page.waitForFunction(() => document.querySelectorAll(".n")[0]!.textContent === "Count: 8");
    assert.ok(!requests.includes("/c-full.js"), requests.join(" "));
  });
  // Not a number on the page: `LiteMiss` → the ordinary component (its init: the record has no such key either).
  await withPage(await files(1, { read: "x" }), async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.click(".c:nth-child(1) .inc");
    await page.waitForFunction(() => /^Count: \d+$/.test(document.querySelectorAll(".n")[0]!.textContent!));
    assert.ok(requests.includes("/c-full.js"), requests.join(" "));
  });
});
