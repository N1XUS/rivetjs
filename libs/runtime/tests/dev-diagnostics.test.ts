// Development diagnostics of the DOM façade (`development` condition → dev/dom.ts): live props never warn
// (no snapshots), runtime errors name the component, attribute and value type. Production: unchanged.
import { test } from "vitest";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { compile } from "@rivetjs/compiler";

const here = new URL(".", import.meta.url).pathname;
async function bundle(source: string, conditions: string[]): Promise<string> {
  const compiled = compile(source, { target: "dom", filename: "app.tsx" });
  assert.deepEqual(compiled.diagnostics, []);
  const result = await build({
    stdin: { contents: compiled.code, resolveDir: here, loader: "ts" },
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    conditions,
    logLevel: "silent",
  });
  return result.outputFiles[0]!.text;
}
/** Run the bundle's `run()` in Chromium; console warnings are collected into `warnings`. */
async function run(code: string): Promise<unknown> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("http://rivet.test/**", (route) =>
      route.fulfill(
        new URL(route.request().url()).pathname === "/app.mjs"
          ? { body: code, contentType: "text/javascript" }
          : { body: '<div id="host"></div>', contentType: "text/html" },
      ),
    );
    await page.goto("http://rivet.test/");
    return await page.evaluate(async () => {
      const warnings: string[] = [];
      console.warn = (...args: unknown[]) => warnings.push(args.join(" "));
      const result = await ((await import("/app.mjs" as string)) as { run(): unknown }).run();
      return { result, warnings };
    });
  } finally {
    await browser.close();
  }
}

const snapshots = `
  import { signal, computed } from "@rivetjs/reactivity";
  import { mount } from "@rivetjs/runtime/dom";
  function Child(props) { return <b>{props.n}</b>; }
  function Live(props) { return <b>{props.n()}</b>; }
  function Label(props) { return <i>{props.text}</i>; }
  export function run() {
    const n = signal(1), double = computed(() => n() * 2);
    mount(() => (
      <p>
        <Child n={n()} />
        <Child n={n()} />
        <Live n={n} />
        <Label text={"x" + double()} />
        <Label text="static" />
        <Child n={() => n()} />
      </p>
    ), document.querySelector("#host"));
    n.set(2);
    return document.querySelector("p").textContent;
  }`;

// Live props (2026-10-07, docs/design/specs/2026-10-07-live-props-design.md): the compiler no longer emits
// `_cp` snapshots — a props expression that reads a signal is a getter, so the component's bindings update and
// the former snapshot warnings (dev/dom.ts `snapshot`, removed in P6) never fire.
test(`development: props that read a signal are live — bindings update, no snapshot warning`, async () => {
  const { result, warnings } = (await run(await bundle(snapshots, ["development"]))) as { result: string; warnings: string[] };
  assert.equal(result, "222x4static2");
  assert.deepEqual(
    warnings.filter((w) => /props are values|is a value snapshot/.test(w)),
    [],
  );
});

test(`production bundle: props are live, no snapshot warning, no diagnostics code`, async () => {
  const code = await bundle(snapshots, []);
  assert.doesNotMatch(code, /props are values|pass the accessor|is a snapshot/);
  const { result, warnings } = (await run(code)) as { result: string; warnings: string[] };
  assert.equal(result, "222x4static2");
  assert.deepEqual(warnings, []);
});

const failures = `
  import { signal } from "@rivetjs/reactivity";
  import { mount } from "@rivetjs/runtime/dom";
  function Card(props) { return <div>{props.value()}</div>; }
  function Link(props) { return <a href={props.href()}>go</a>; }
  function Broken() { return {}; }
  const host = () => document.querySelector("#host");
  const attempt = (fn) => { try { fn(); return "ok"; } catch (error) { return error.message; } };
  export function run() {
    const value = signal("text"), href = signal("/ok");
    const out = {};
    out.childInitial = attempt(() => mount(() => <Card value={() => Symbol("s")} />, host()));
    mount(() => <Card value={value} />, host());
    out.childUpdate = attempt(() => value.set(new Map()));
    out.returned = attempt(() => mount(() => <Broken />, host()));
    out.urlInitial = attempt(() => mount(() => <Link href={() => " javascript:alert(1)"} />, host()));
    mount(() => <Link href={href} />, host());
    out.urlUpdate = attempt(() => href.set("data:text/html,x"));
    out.hrefs = [...host().querySelectorAll("a")].map((a) => a.getAttribute("href"));
    out.urlSafe = attempt(() => href.set("/fine"));
    return out;
  }`;

test(`development: runtime errors name the component, attribute and value type; unsafe URLs warn`, async () => {
  const { result, warnings } = (await run(await bundle(failures, ["development"]))) as { result: Record<string, unknown>; warnings: string[] };
  assert.match(result.childInitial as string, /^Unsupported DOM child value \(symbol\) in <Card>/);
  assert.match(result.childUpdate as string, /^Unsupported DOM child value \(Map\) in <Card>/);
  assert.match(result.returned as string, /^Unsupported DOM child value \(Object\) in <Broken>/);
  // Unsafe URLs are neutralized (dom.ts), and warn once per attribute and scheme with the component.
  assert.equal(result.urlInitial, "ok");
  assert.equal(result.urlUpdate, "ok");
  assert.deepEqual(result.hrefs, ["about:invalid#rivet", "about:invalid#rivet"]);
  assert.equal(warnings.filter((w) => /unsafe javascript: URL in href in <Link>/.test(w)).length, 1);
  assert.equal(warnings.filter((w) => /unsafe data: URL in href in <Link>/.test(w)).length, 1);
  assert.equal(result.urlSafe, "ok");
});

test(`production (default resolution): runtime error messages are unchanged`, async () => {
  const { result, warnings } = (await run(await bundle(failures, []))) as { result: Record<string, unknown>; warnings: string[] };
  assert.deepEqual(warnings, []);
  assert.deepEqual(result, {
    childInitial: "Unsupported DOM child value",
    childUpdate: "Unsupported DOM child value",
    returned: "Unsupported DOM child value",
    urlInitial: "ok",
    urlUpdate: "ok",
    hrefs: ["about:invalid#rivet", "about:invalid#rivet"],
    urlSafe: "ok",
  });
});

test("development URL check warns for exactly what dom.ts neutralizes", async () => {
  const probe = `
    import { mount, _attrValue } from "@rivetjs/runtime/dom";
    const values = [" javascript:x", "JAVASCRIPT:x", "java\\nscript:x", "\\tdata:x", "vbscript:x", "data", "/ok", "https://x/javascript:", null, false, 0];
    export function run() {
      const out = [];
      for (const name of ["href", "SRC", "action", "formAction", "poster", "xlink:href", "title"])
        for (const value of values)
          try {
            let el;
            mount(() => { el = document.createElement("a"); _attrValue(el, name, () => value); return el; }, document.querySelector("#host"))();
            out.push(el.getAttribute(name.toLowerCase()) === "about:invalid#rivet" ? "neutralized" : "ok");
          } catch (error) {
            out.push(error.message);
          }
      return out;
    }`;
  const [development, production] = await Promise.all([run(await bundle(probe, ["development"])), run(await bundle(probe, []))]);
  const dev = development as { result: string[]; warnings: string[] },
    prod = production as { result: string[]; warnings: string[] };
  assert.deepEqual(dev.result, prod.result);
  assert.equal(dev.result.filter((r) => r === "neutralized").length, 6 * 5);
  assert.equal(dev.result.filter((r) => r !== "neutralized" && r !== "ok").length, 0);
  // One warning per attribute and scheme (javascript, data, vbscript); production is silent.
  assert.equal(dev.warnings.length, 6 * 3);
  assert.deepEqual(prod.warnings, []);
});

const reactiveReads = `
  import { signal, computed, effect } from "@rivetjs/reactivity";
  import { mount } from "@rivetjs/runtime/dom";
  const log = [];
  function Total(props) {
    const doubled = computed(() => props.total * 2);
    effect(() => log.push("effect " + props.label));
    return <b>{doubled()}</b>;
  }
  function Plain(props) {
    const once = props.label; // component body: not reactive
    return <i title={once}>{props.label}</i>;
  }
  export function run() {
    const n = signal(1);
    mount(() => (
      <p>
        <Total total={n() * 10} label="sum" />
        <Total total={n() * 10} label="again" />
        <Plain label={"x" + (n() + 1)} />
        <Plain label="static" />
      </p>
    ), document.querySelector("#host"));
    return document.querySelector("p").textContent;
  }`;

test(`development: a live prop read inside a computed, effect or binding does not warn`, async () => {
  const { result, warnings } = (await run(await bundle(reactiveReads, ["development"]))) as { result: string; warnings: string[] };
  assert.equal(result, "2020x2static");
  assert.deepEqual(
    warnings.filter((w) => /props are values|is a value snapshot/.test(w)),
    [],
  );
});

test(`production bundle: no reactive-read warning code`, async () => {
  const code = await bundle(reactiveReads, []);
  assert.doesNotMatch(code, /is a value snapshot|new Proxy/);
  const { result, warnings } = (await run(code)) as { result: string; warnings: string[] };
  assert.equal(result, "2020x2static");
  assert.deepEqual(warnings, []);
});
