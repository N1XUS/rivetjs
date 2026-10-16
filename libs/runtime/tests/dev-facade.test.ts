// The development DOM façade (`development` condition → dev/dom.ts): the ownership ABI suite passes
// through it with a recording hook, and it reports components, mounts and binding updates.
import { test } from "vitest";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
import { compile } from "@rivetjs/compiler";

const here = new URL(".", import.meta.url).pathname;
/** Bundle `source` (resolved from tests/) for the browser with the given export conditions. */
async function bundle(source: string, conditions: string[]): Promise<string> {
  const result = await build({
    stdin: { contents: source, resolveDir: here, loader: "ts" },
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    conditions,
    logLevel: "silent",
  });
  return result.outputFiles[0]!.text;
}
/** A recording hook installed before any module runs: `window.events` keeps [type, data] pairs. */
const recorder = (level: number) => `globalThis[Symbol.for("rivet.devtools")] = { v: 1, level: ${level}, stacks: false, emit(type, data) { (globalThis.events ??= []).push([type, data]); } };`;

async function run(browser: Browser, code: string, init?: string): Promise<{ result: string; types: Record<string, number> }> {
  const page = await browser.newPage();
  try {
    if (init) await page.addInitScript(init);
    await page.route("http://rivet.test/**", (route) =>
      route.fulfill(
        new URL(route.request().url()).pathname === "/app.mjs"
          ? { body: code, contentType: "text/javascript" }
          : { body: '<div id="host"><i>unrelated</i></div>', contentType: "text/html" },
      ),
    );
    await page.goto("http://rivet.test/");
    return await page.evaluate(async () => {
      const result = await ((await import("/app.mjs" as string)) as { run(): string | Promise<string> }).run();
      const types: Record<string, number> = {};
      for (const [type] of (globalThis as { events?: [string][] }).events ?? []) types[type] = (types[type] ?? 0) + 1;
      return { result, types };
    });
  } finally {
    await page.close();
  }
}

test("façade exports every export of dom.ts", async () => {
  const [base, facade] = await Promise.all([import("../dom.ts"), import("../dev/dom.ts")]);
  assert.deepEqual(Object.keys(facade).sort(), Object.keys(base).sort());
});

test("lazy and client-only components report the loaded component; their wrappers are hidden", async () => {
    const source = `
    import { mount, lazyComponent, clientOnly, For, ChunkGroup, Provider, Show, Switch, Match, Suspense, _for, _show, _switch, _match } from "@rivetjs/runtime/dom";
    function Child(props) { return <em>{props.label}</em>; }
    const Lazy = lazyComponent(() => Promise.resolve({ default: Child }));
    const Only = clientOnly(() => Promise.resolve({ named: Child }), (m) => m.named);
    export async function run() {
      const stop = mount(() => <p><Lazy label="a" /><Only label="b" /></p>, document.querySelector("#host"));
      for (let i = 0; i < 20 && document.querySelectorAll("em").length < 2; i++) await new Promise((r) => setTimeout(r, 10));
      // Structural built-ins (\`ChunkGroup\`, \`Provider\`, \`Suspense\` and its dev wrapper, \`_for\` / \`_show\` / \`_switch\` / \`_match\`
      // = \`For\` / \`Show\` / \`Switch\` / \`Match\`) are hidden once, when the façade loads.
      const hidden = events.filter(([type]) => type === "comp.hide").map(([, d]) => d.fn);
      const structural = hidden.filter((fn) => [For, ChunkGroup, Provider, Show, Switch, Match, _for, _show, _switch, _match].includes(fn) || fn === Suspense || fn.name === "Suspense").length;
      const mounts = events.filter(([type]) => type === "comp.mount").map(([, d]) => d);
      const loaded = mounts.filter((d) => d.fn === Child);
      const out = JSON.stringify({
        structural,
        hidden: hidden.length - structural,
        wrappers: mounts.filter((d) => hidden.includes(d.fn)).length,
        loaded: loaded.map((d) => d.props.label),
        // The span is the output's own nodes.
        spans: loaded.map((d) => d.spanOf()).map(({ start }) => start.nodeName),
        text: document.querySelector("p").textContent,
      });
      stop();
      return out;
    }`;
    const compiled = compile(source, { target: "dom", filename: "lazy.tsx" });
    assert.deepEqual(compiled.diagnostics, []);
    const browser = await chromium.launch({ headless: true });
    try {
      const { result } = await run(browser, await bundle(compiled.code, ["development"]), recorder(1));
      assert.deepEqual(JSON.parse(result), { structural: 8, hidden: 2, wrappers: 2, loaded: ["a", "b"], spans: ["EM", "EM"], text: "ab" });
    } finally {
      await browser.close();
    }
  });

test("components, mounts and binding updates are reported with owners and spans", async () => {
    const source = `
    import { signal } from "@rivetjs/reactivity";
    import { mount } from "@rivetjs/runtime/dom";
    function Counter() {
      const count = signal(0);
      return <button title={"n" + count()} onClick={() => count.update((n) => n + 1)}>{count()}</button>;
    }
    export function run() {
      const stop = mount(() => <section><Counter /></section>, document.querySelector("#host"));
      const created = events.map(([type]) => type).join();
      document.querySelector("button").click();
      const mount0 = events.find(([type]) => type === "comp.mount")[1];
      const root = events.find(([type]) => type === "root.mount")[1];
      const updates = events.filter(([type]) => type === "dom.update").map(([, d]) => d.kind + ":" + (d.name ?? "") + ":" + (d.node.nodeType ?? "range"));
      // \`spanOf()\`: the output's first and last node.
      const span = mount0.spanOf();
      const owner = mount0.owner;
      const write = events.find(([type]) => type === "sig.write")[1];
      stop();
      const unmounted = events.some(([type, d]) => type === "comp.unmount" && d.owner === owner);
      const rootGone = events.some(([type, d]) => type === "root.unmount" && d.owner === root.owner);
      return JSON.stringify({
        created: created.includes("dom.update"),
        name: mount0.fn.name,
        span: [span.start.data ?? span.start.nodeName, span.end.data ?? span.end.nodeName],
        container: root.container.id,
        owned: events.find(([type]) => type === "sig.create")[1].owner === owner,
        write: [write.prev, write.next],
        updates,
        unmounted,
        rootGone,
      });
    }`;
    const compiled = compile(source, { target: "dom", filename: "counter.tsx" });
    assert.deepEqual(compiled.diagnostics, []);
    const code = await bundle(compiled.code, ["development"]);
    const browser = await chromium.launch({ headless: true });
    try {
      const { result } = await run(browser, code, recorder(2));
      assert.deepEqual(JSON.parse(result), {
        created: false,
        name: "Counter",
        span: ["BUTTON", "BUTTON"],
        container: "host",
        owned: true,
        write: [0, 1],
        // The button's sole text child is written by \`_t\`.
        updates: ["attr:title:1", "child::1"],
        unmounted: true,
        rootGone: true,
      });
    } finally {
      await browser.close();
    }
  });
