// Derived model, listening records (D5, ZERO R2): the tail says per boundary NAME which event types its unit listens to
// (v2 names table `n[i][2]`, ruling R-30: the union over the name's instances); an event adopts — and the loader holds / warms for — only the records around its target that listen to its type
// (and what those need). A click on static text or a native control nothing listens to acts natively (no runtime, no
// chunk); a click in an independent boundary inside a non-listening root loads that boundary's chunk, not the root's.
// Compiled with the real derived server + DOM targets (skips on a wasm without the model); `e` is written into the tail
// here (the server half is BE-RENDER W5 / FE-COMPILE facts), so this pins the client half alone.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Root() {
  const title = signal("Docs");
  return (
    <main>
      <h1 id="title">{title()}</h1>
      <p id="text">static text</p>
      <label id="pause"><input id="box" type="checkbox" /> pause</label>
      <Inner start={1} />
      <Outer start={10} />
    </main>
  );
}
export function Inner(props) {
  const n = signal(props.start);
  return <button id="inner" onClick={() => n.set(n() + 1)}>{n()}</button>;
}
export function Outer(props) {
  const n = signal(props.start);
  return <button id="outer" onClick={() => n.set(n() + 1)} onPointerEnter={() => n.set(n() + 100)}>{n()}</button>;
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
// Replace the listened types of the tail's names (v2 `n[i][2]`, whatever the server wrote) with `listening` (undefined:
// none — a server without D5 facts, every record listens).
function withListening(html: string, listening: Record<string, string> | undefined): string {
  return html.replace(/(<script type="rivet\/boundaries"[^>]*>)(.*?)(<\/script>)/s, (_, open: string, json: string, close: string) => {
    const tail = JSON.parse(json) as { n: [string, number, string?][] };
    for (const entry of tail.n) {
      entry.length = 2;
      if (listening?.[entry[0]]) entry.push(listening[entry[0]]);
    }
    return open + JSON.stringify(tail) + close;
  });
}
const typesOf = (html: string): Record<string, string> => {
  const tail = JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as { n: [string, number, string?][] };
  return Object.fromEntries(tail.n.filter((entry) => entry[2]).map((entry) => [entry[0], entry[2]!]));
};
const resume = { module: "src/page.tsx", boundaries: ["Root", "Inner", "Outer"], independent: ["Root", "Inner", "Outer"] };

compiled("listening records: an event adopts the records around a record listening to its type; nothing listening = native, no runtime", async () => {
  const server = compile(SOURCE, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { Root } = await importServer<{ Root: () => ServerValue }>(server.code);
  const symbols = { "src/page.tsx#Root": "/root.js", "src/page.tsx#Inner": "/inner.js", "src/page.tsx#Outer": "/outer.js" };
  // `lean`: no fetch-ahead (`data-fo`), so every request below is a load the event caused.
  const served0 = (await derivedToString(() => Root(), { manifest: { hash: "t", runtime: "/rt.js", symbols }, preload: { lean: true } } as never)) as string;
  const listening = { "src/page.tsx#Inner": "click", "src/page.tsx#Outer": "click pointerenter" };
  const html = withListening(served0, listening);
  const code = rewrite(dom.code);
  const served = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/root.js": code,
    "/inner.js": code,
    "/outer.js": code,
  };
  await withPage(served, async (page, requests) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    const loaded = () => requests.filter((path) => /^\/(rt|root|inner|outer)\.js$/.test(path));
    // Static text inside the root boundary, and a native checkbox no handler listens to: native, nothing loads.
    await page.click("#text");
    await page.click("#box");
    assert.equal(await page.isChecked("#box"), true, "the toggle is native, not held for a replay");
    await page.waitForTimeout(200);
    assert.deepEqual(loaded(), [], "no runtime, no chunk");
    // A click in a listening boundary: the runtime, its chunk and the records around it (outermost first, intake 3: an
    // ancestor unit may provide a context its descendants read).
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#inner")!.textContent === "2");
    assert.deepEqual(loaded().sort(), ["/inner.js", "/root.js", "/rt.js"]);
    // The sibling adopts on its own event (inside the adopted root's unit: no chunk of its own).
    await page.click("#outer");
    await page.waitForFunction(() => +document.querySelector("#outer")!.textContent! > 10);
    assert.deepEqual(loaded().sort(), ["/inner.js", "/root.js", "/rt.js"]);
    await page.click("#box");
    assert.equal(await page.isChecked("#box"), false);
    assert.deepEqual(errors, []);
  });
});

async function served(listening: Record<string, string> | undefined): Promise<Record<string, string>> {
  const server = compile(SOURCE, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "page.tsx", resume } as never);
  const { Root } = await importServer<{ Root: () => ServerValue }>(server.code);
  const symbols = { "src/page.tsx#Root": "/root.js", "src/page.tsx#Inner": "/inner.js", "src/page.tsx#Outer": "/outer.js" };
  const html = (await derivedToString(() => Root(), { manifest: { hash: "t", runtime: "/rt.js", symbols }, preload: { lean: true } } as never)) as string;
  const code = rewrite(dom.code);
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + withListening(html, listening) + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/root.js": code,
    "/inner.js": code,
    "/outer.js": code,
  };
}

compiled("a tail whose names list no types keeps every record listening: a click on static text adopts the root (pre-D5 behaviour)", async () => {
  await withPage(await served(undefined), async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.click("#text");
    await page.waitForFunction(() => (window as unknown as { __rvIM?: string }).__rvIM !== undefined);
    await page.waitForFunction(() => performance.getEntriesByType("resource").some((r) => r.name.endsWith("/root.js")));
    assert.ok(requests.includes("/rt.js") && requests.includes("/root.js"), requests.join(" "));
  });
});

compiled("`e` by name: a name listening to another type only (`*` absent) does not adopt; `*` adopts on any type", async () => {
  await withPage(await served({ "src/page.tsx#Inner": "keydown", "src/page.tsx#Outer": "*" }), async (page, requests) => {
    await page.goto("http://rivet.test/");
    // Inner listens to keydown only: its click is not held and adopts nothing (the press warms its chunk: intent inside
    // a record listening to anything), the count stays.
    await page.click("#inner");
    await page.waitForTimeout(200);
    assert.equal(await page.textContent("#inner"), "1");
    await page.click("#outer");
    await page.waitForFunction(() => +document.querySelector("#outer")!.textContent! > 10);
    // Outer listens: it adopts with the records around it (the root, intake 3).
    assert.ok(requests.includes("/outer.js") && requests.includes("/root.js"), requests.join(" "));
    assert.equal(await page.textContent("#inner"), "1");
  });
});

// Large page (ZERO R2 numbers): 1,000 independent counters inside a root with keyed state that listens to nothing. With
// `e` a first click adopts its counter only; without `e` the root adopts first (its run over the whole page).
const LARGE = `import { signal } from "@rivetjs/reactivity";
export function Big() {
  const title = signal("Docs");
  return <main><h1>{title()}</h1>{Array.from({ length: 1000 }, (_, i) => <section><p>static {i}</p><Inner start={i} /></section>)}</main>;
}
export function Inner(props) {
  const n = signal(props.start);
  return <button class="inner" onClick={() => n.set(n() + 1)}>{n()}</button>;
}
`;
compiled("large page: 1,000 counters in a non-listening root — the first click adopts one counter, not the root", async () => {
  const big = { module: "src/big.tsx", boundaries: ["Big", "Inner"], independent: ["Big", "Inner"] };
  const server = compile(LARGE, { target: "server", filename: "big.tsx", resume: big } as never);
  const dom = compile(LARGE, { target: "dom", filename: "big.tsx", resume: big } as never);
  const { Big } = await importServer<{ Big: () => ServerValue }>(server.code);
  const symbols = { "src/big.tsx#Big": "/big.js", "src/big.tsx#Inner": "/big.js" };
  const html = (await derivedToString(() => Big(), { manifest: { hash: "t", runtime: "/rt.js", symbols } } as never)) as string;
  const measure = (listening: Record<string, string> | undefined) =>
    withPage(
      {
        ...DERIVED_BUILD,
        "/": "<!doctype html><html><body>" + withListening(html, listening) + "</body></html>",
        "/rt.js": 'export { default } from "/dom-derived.ts";',
        "/big.js": rewrite(dom.code),
      },
      async (page) => {
        await page.goto("http://rivet.test/");
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => {
          const button = document.querySelectorAll(".inner")[500]!;
          (window as unknown as { done: Promise<number> }).done = new Promise((resolve) => {
            let t0 = 0;
            document.addEventListener("pointerdown", () => (t0 = performance.now()), { capture: true, once: true });
            new MutationObserver((_, o) => (o.disconnect(), resolve(performance.now() - t0))).observe(button, {
              subtree: true,
              characterData: true,
              childList: true,
            });
          });
        });
        await page.click(".inner >> nth=500");
        const ms = await page.evaluate(() => (window as unknown as { done: Promise<number> }).done);
        assert.equal(await page.textContent(".inner >> nth=500"), "501");
        const adopted = await page.evaluate(
          () => [...document.querySelectorAll(".inner")].filter((b) => (b as unknown as { $$click?: unknown }).$$click).length,
        );
        return { ms, adopted };
      },
    );
  const without = await measure(undefined),
    withE = await measure({ "src/big.tsx#Inner": "click" });
  console.log(
    `D5 large (1,000 counters): first click ${without.ms.toFixed(1)} → ${withE.ms.toFixed(1)} ms; handlers attached ${without.adopted} → ${withE.adopted}`,
  );
  assert.equal(withE.adopted, 1);
});

// The server's own `e` (compiler `_rB` events + `_rHandler` / spreads): `model:` → input / change, a `ref` → `*` (it may
// attach listeners imperatively at adopt), a plain handler → its type; a root without any → absent (listens to nothing).
const WRITTEN = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const title = signal("Docs");
  return <main><h1 id="t">{title()}</h1><Field init="" /><Wheel start={0} /></main>;
}
export function Field(props) {
  const name = signal(props.init);
  return <label><input id="name" model:value={name} /><b id="hello">Hello {name()}</b></label>;
}
export function Wheel(props) {
  const n = signal(props.start);
  return <p id="wheel" ref={(el) => el.addEventListener("click", () => n.set(n() + 1))}>{n()}</p>;
}
`;
compiled("server-written `e`: model input listens to input / change, a ref listens to anything, a handler-less root to nothing", async () => {
  const opts = { module: "src/w.tsx", boundaries: ["Page", "Field", "Wheel"], independent: ["Page", "Field", "Wheel"] };
  const server = compile(WRITTEN, { target: "server", filename: "w.tsx", resume: opts } as never);
  const dom = compile(WRITTEN, { target: "dom", filename: "w.tsx", resume: opts } as never);
  assert.deepEqual(server.diagnostics, []);
  const { Page } = await importServer<{ Page: () => ServerValue }>(server.code);
  const symbols = { "src/w.tsx#Page": "/page.js", "src/w.tsx#Field": "/field.js", "src/w.tsx#Wheel": "/wheel.js" };
  const html = (await derivedToString(() => Page(), { manifest: { hash: "t", runtime: "/rt.js", symbols }, preload: { lean: true } } as never)) as string;
  assert.deepEqual(typesOf(html), { "src/w.tsx#Field": "change input", "src/w.tsx#Wheel": "*" });
  const code = rewrite(dom.code);
  await withPage(
    {
      ...DERIVED_BUILD,
      "/": "<!doctype html><html><body>" + html + "</body></html>",
      "/rt.js": 'export { default } from "/dom-derived.ts";',
      "/page.js": code,
      "/field.js": code,
      "/wheel.js": code,
    },
    async (page, requests) => {
      await page.goto("http://rivet.test/");
      await page.click("#t");
      await page.waitForTimeout(150);
      assert.ok(!requests.includes("/rt.js"), requests.join(" "));
      await page.fill("#name", "Ada");
      await page.waitForFunction(() => document.querySelector("#hello")!.textContent === "Hello Ada");
      // The ref's own listener (attached at adopt) sees the replayed click.
      await page.click("#wheel");
      await page.waitForFunction(() => document.querySelector("#wheel")!.textContent === "1");
      // Field / Wheel listen: their events adopt the records around them too (the page root, intake 3).
      assert.ok(requests.includes("/page.js"), requests.join(" "));
    },
  );
});

// A handler slot of a non-boundary helper (cdk `Select` / `Group` internals: a lowercase function the component calls) is
// installed by the enclosing boundary's adopt run: that boundary listens to any type (intake 3: `omitted` → `*`).
const HELPER = `import { signal } from "@rivetjs/reactivity";
function panel(props) {
  return <button id="p" onClick={props.on ? props.on : () => props.n.set(props.n() + 1)}>{props.n()}</button>;
}
export function Page() {
  const n = signal(0);
  return <main>{panel({ n })}</main>;
}
`;
compiled("server-written `e`: a non-boundary helper's handler slot makes its boundary listen to anything", async () => {
  const opts = { module: "src/h.tsx", boundaries: ["Page"], independent: ["Page"] };
  const server = compile(HELPER, { target: "server", filename: "h.tsx", resume: opts } as never);
  assert.deepEqual(server.diagnostics, []);
  const { Page } = await importServer<{ Page: () => ServerValue }>(server.code);
  const html = (await derivedToString(() => Page(), {
    manifest: { hash: "t", runtime: "/rt.js", symbols: { "src/h.tsx#Page": "/page.js" } },
    preload: { lean: true },
  } as never)) as string;
  assert.deepEqual(typesOf(html), { "src/h.tsx#Page": "*" });
});

// An in-place handler of such a helper: the compiler writes `_rListens("type")` in its server slot (intake 3).
const HELPER_LITERAL = `import { signal } from "@rivetjs/reactivity";
function surface(props) {
  return <div id="s" onPointerDown={() => props.n.set(props.n() + 1)}>{props.n()}</div>;
}
export function Page() {
  const n = signal(0);
  return <main><button id="b" onClick={() => n.set(0)}>reset</button>{surface({ n })}</main>;
}
`;
compiled("server-written `e`: a non-boundary helper's in-place handler adds its type to the boundary around it", async () => {
  const opts = { module: "src/l.tsx", boundaries: ["Page"], independent: ["Page"] };
  const server = compile(HELPER_LITERAL, { target: "server", filename: "l.tsx", resume: opts } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /_rListens/);
  const { Page } = await importServer<{ Page: () => ServerValue }>(server.code);
  const html = (await derivedToString(() => Page(), {
    manifest: { hash: "t", runtime: "/rt.js", symbols: { "src/l.tsx#Page": "/page.js" } },
    preload: { lean: true },
  } as never)) as string;
  assert.deepEqual(typesOf(html), { "src/l.tsx#Page": "click pointerdown" });
});
