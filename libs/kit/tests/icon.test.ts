// `@rivetjs/kit/icon`: lucide icon data → inline SVG. Server markup (lucide defaults, size / strokeWidth /
// absoluteStrokeWidth / color, aria), client mounts and resume in Chromium, tree-shaking.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Check, CircleAlert, Search } from "lucide";
import { compile } from "@rivetjs/compiler";
import { renderToString, type ServerValue } from "@rivetjs/runtime/server";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileSymbolModule, importServer } from "../../runtime/tests/resume/compile.ts";
import type { ResumeSymbol } from "../../runtime/tests/resume/compile.ts";
import { withPage, rewrite } from "../../runtime/tests/resume/harness.ts";
import type { Served } from "../../runtime/tests/resume/harness.ts";
import type { Page } from "playwright";
import type { IconProps } from "../icon.tsx";

const source = await readFile(new URL("../icon.tsx", import.meta.url), "utf8");
type Compiled = { code: string; diagnostics: { message: string }[]; symbols?: ResumeSymbol[] };
const run = (src: string, options: object): Compiled => {
  const result = (compile as unknown as (s: string, o: object) => Compiled)(src, options);
  assert.deepEqual(result.diagnostics, []);
  return result;
};
const plain = await importServer<{ Icon(props: IconProps): ServerValue }>(run(source, { target: "server", filename: "icon.tsx" }).code);
const html = (props: IconProps) => renderToString(() => plain.Icon(props));

test("server: lucide defaults, decorative by default, shapes from the icon data", async () => {
  assert.equal(
    await html({ icon: Check }),
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>',
  );
  const alert = await html({ icon: CircleAlert });
  assert.match(
    alert,
    /<circle cx="12" cy="12" r="10"><\/circle><line x1="12" x2="12" y1="8" y2="12"><\/line><line x1="12" x2="12.01" y1="16" y2="16"><\/line><\/svg>$/,
  );
});

test("server: size, strokeWidth, absoluteStrokeWidth, color, svg attributes, accessible name", async () => {
  const out = await html({
    icon: Search,
    size: 16,
    strokeWidth: 1.5,
    color: "red",
    class: "i",
    style: { verticalAlign: "middle" },
    "data-x": "1",
  } as IconProps);
  assert.match(out, /^<svg xmlns="[^"]+" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="1.5" /);
  assert.match(out, / aria-hidden="true" class="i" style="vertical-align:middle" data-x="1">/);
  assert.match(await html({ icon: Check, size: 12, absoluteStrokeWidth: true }), / stroke-width="4" /);
  assert.match(await html({ icon: Check, size: 48, strokeWidth: 1, absoluteStrokeWidth: true }), / stroke-width="0.5" /);
  const labelled = await html({ icon: Check, "aria-label": "Done" });
  assert.match(labelled, / role="img" aria-label="Done">/);
  assert.doesNotMatch(labelled, /aria-hidden/);
  assert.match(await html({ icon: Check, title: "Done" }), / role="img"><title>Done<\/title><path /);
});

test("tree-shaking: one lucide icon import bundles that icon's data only", async () => {
  const bundle = await build({
    stdin: { contents: 'import { Check } from "lucide"; console.log(Check);', resolveDir: new URL(".", import.meta.url).pathname },
    bundle: true,
    minify: true,
    write: false,
    format: "esm",
    logLevel: "error",
  });
  const code = bundle.outputFiles[0]!.text;
  assert.ok(code.length < 400, `${code.length} B`);
  assert.match(code, /M20 6 9 17l-5-5/);
  assert.doesNotMatch(code, /createElement|m21 21-4.34-4.34/);
});

// Browser: the icon module compiled per target like the Vite plugin does (resume mode on the server and in
// resume chunks); icon data passed from the page.
const PAGE = `import { signal } from "@rivetjs/reactivity";
import { Icon } from "./icon.tsx";
const CHECK = ${JSON.stringify(Check)};
const ALERT = ${JSON.stringify(CircleAlert)};
export function Page() {
  const on = signal(false);
  return (
    <main>
      <Icon icon={CHECK} class="static" />
      {on() ? <Icon icon={ALERT} class="on" size={32} title="Alert" /> : <Icon icon={CHECK} class="off" size={16} />}
      <button id="t" onClick={() => on.set(!on())}>t</button>
    </main>
  );
}`;
// Every root mode (`icon.tsx` `mode`): FIXED (constant props), STATIC (`icon` a getter), LIVE (a root getter or
// `title`), SPREAD (other svg attributes); one click changes every live prop.
const LIVE = `import { signal } from "@rivetjs/reactivity";
import { Icon } from "./icon.tsx";
const CHECK = ${JSON.stringify(Check)};
const ALERT = ${JSON.stringify(CircleAlert)};
export function Page() {
  const icon = signal(CHECK), size = signal(16), title = signal(undefined);
  return (
    <main>
      <Icon icon={CHECK} size={20} class="fixed" />
      <Icon icon={icon()} size={20} class="static" />
      <Icon icon={CHECK} size={size()} class="live" />
      <Icon icon={icon()} title={title()} class="titled" />
      <Icon icon={icon()} data-size={size()} class="spread" />
      <button id="t" onClick={() => (icon.set(ALERT), size.set(32), title.set("Alert"))}>t</button>
    </main>
  );
}`;
const resume = (src: string, target: string, module: string) => run(src, { target, filename: module, resume: { module } });
const iconServer = resume(source, "server", "@rivetjs/kit/icon.tsx").code;
const iconDom = resume(source, "dom", "@rivetjs/kit/icon.tsx");
const iconUrl =
  "data:text/javascript;base64," +
  Buffer.from(
    iconServer
      .replaceAll('"@rivetjs/runtime/server-resume"', JSON.stringify(import.meta.resolve("@rivetjs/runtime/server-resume")))
      .replaceAll('"@rivetjs/runtime/server"', JSON.stringify(import.meta.resolve("@rivetjs/runtime/server"))),
  ).toString("base64");
const at = (code: string, url: string) => rewrite(code).replaceAll('"./icon.tsx"', JSON.stringify(url));
const csr = (module: string) => `<!doctype html><html><body><div id="app"></div><script type="module">
    import { mount } from "/dom.ts"; import { Page } from "${module}";
    mount(() => Page(), document.getElementById("app"));
  </script></body></html>`;
const files: Record<string, Served> = {
  "/icon-csr.mjs": rewrite(run(source, { target: "dom", filename: "icon.tsx" }).code),
  "/icon-resume.mjs": rewrite(iconDom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
/** Serve `src` at `path` (resumed: server render + symbol chunks) and `path + "csr"` (client render). */
async function site(src: string, path: string, module: string): Promise<string> {
  const pageDom = resume(src, "dom", module);
  const symbols = [...(iconDom.symbols ?? []), ...(pageDom.symbols ?? [])];
  const server = await importServer<{ Page(): never }>(resume(src, "server", module).code.replaceAll('"./icon.tsx"', JSON.stringify(iconUrl)));
  const chunk = (component: string) => path + "c/" + component + ".js";
  const manifest: ResumeManifest = { hash: "icon", runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((s) => [s.id, chunk(s.component)])) };
  const ssr = await resumableToString(() => server.Page(), { manifest });
  files[path + "page-resume.mjs"] = at(pageDom.code, "/icon-resume.mjs");
  files[path + "csr.mjs"] = at(run(src, { target: "dom", filename: "page.tsx" }).code, "/icon-csr.mjs");
  files[path + "csr"] = csr(path + "csr.mjs");
  files[path] = "<!doctype html><html><head></head><body>" + ssr + "</body></html>";
  const byComponent: Record<string, ResumeSymbol[]> = {};
  for (const symbol of symbols) (byComponent[chunk(symbol.component)] ??= []).push(symbol);
  for (const [file, list] of Object.entries(byComponent))
    files[file] = at(compileSymbolModule(list, list[0]!.id.startsWith("@rivetjs/kit") ? "/icon-resume.mjs" : path + "page-resume.mjs"), "/icon-resume.mjs");
  return ssr;
}
const ssr = await site(PAGE, "/", "src/page.tsx");
await site(LIVE, "/live/", "src/live.tsx");

const state = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main > svg")].map((svg) =>
      [
        svg.getAttribute("class"),
        svg.getAttribute("width"),
        svg.getAttribute("role") ?? "hidden",
        [svg, ...svg.querySelectorAll("*")].map((el) => el.localName + (el.namespaceURI === "http://www.w3.org/2000/svg" ? "" : "@html")).join(","),
      ].join(" "),
    ),
  );
const before = ["static 24 hidden svg,path", "off 16 hidden svg,path"];
const after = ["static 24 hidden svg,path", "on 32 img svg,title,circle,line,line"];

for (const path of ["/csr"]) {
  test(`client ${path}: icons in the SVG namespace (incl. the conditional <title>), re-created on change`, async () => {
    await withPage(files, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test" + path);
      await page.waitForFunction(() => document.querySelectorAll("main > svg").length === 2);
      assert.deepEqual(await state(page), before);
      await page.click("#t");
      await page.waitForFunction(() => document.querySelector("svg.on"));
      assert.deepEqual(await state(page), after);
      assert.deepEqual(errors, []);
    });
  });
}

test("resume: static icons cost no state; the branch icon re-creates client-side", async () => {
  assert.doesNotMatch(ssr.split('<script type="rivet/state"')[1]!.split("</script>")[0]!, /M20 6/);
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    assert.deepEqual(await state(page), before);
    await page.click("#t");
    await page.waitForFunction(() => document.querySelector("svg.on"));
    assert.deepEqual(await state(page), after);
    assert.deepEqual(errors, []);
  });
});

// Canonical markup per root svg (attributes sorted: client writes them in another order than the server).
const canonical = (page: Page) =>
  page.evaluate(() => {
    const walk = (el: Element): string =>
      "<" +
      el.localName +
      (el.namespaceURI === "http://www.w3.org/2000/svg" ? "" : "@html") +
      [...el.attributes]
        .filter((a) => !a.name.startsWith("data-r"))
        .map((a) => ` ${a.name}="${a.value}"`)
        .sort()
        .join("") +
      ">" +
      [...el.children].map(walk).join("") +
      (el.textContent && !el.children.length ? el.textContent : "") +
      "</>";
    return [...document.querySelectorAll("main > svg")].map(walk);
  });

for (const path of ["/live/csr", "/live/"]) {
  test(`${path === "/live/" ? "resume" : "client"} ${path}: every root mode renders the server markup and follows live props`, async () => {
    await withPage(files, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/live/");
      await page.waitForFunction(() => document.querySelectorAll("main > svg").length === 5);
      const server = await canonical(page);
      await page.goto("http://rivet.test" + path);
      await page.waitForFunction(() => document.querySelectorAll("main > svg").length === 5);
      assert.deepEqual(await canonical(page), server);
      const shapes = () =>
        page.evaluate(() =>
          [...document.querySelectorAll("main > svg")].map((svg) =>
            [
              svg.getAttribute("class"),
              svg.getAttribute("width"),
              svg.getAttribute("role"),
              svg.getAttribute("data-size"),
              [...svg.children].map((c) => c.localName).join(","),
            ].join(" "),
          ),
        );
      assert.deepEqual(await shapes(), ["fixed 20   path", "static 20   path", "live 16   path", "titled 24   path", "spread 24  16 path"]);
      await page.click("#t");
      await page.waitForFunction(() => document.querySelector("svg.live")?.getAttribute("width") === "32");
      assert.deepEqual(await shapes(), [
        "fixed 20   path",
        "static 20   circle,line,line",
        "live 32   path",
        "titled 24 img  title,circle,line,line",
        "spread 24  32 circle,line,line",
      ]);
      assert.equal(await page.evaluate(() => document.querySelector("svg.titled")!.hasAttribute("aria-hidden")), false);
      assert.deepEqual(errors, []);
    });
  });
}

// The pre-template implementation (one spread per shape), the byte reference for the server output.
const REFERENCE = `const OWN = new Set(["icon", "size", "color", "strokeWidth", "absoluteStrokeWidth", "title", "children"]);
function root(props) {
  const size = props.size ?? 24, stroke = props.strokeWidth ?? 2, labelled = props.title || props["aria-label"] || props["aria-labelledby"];
  const out = { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: props.color ?? "currentColor",
    "stroke-width": props.absoluteStrokeWidth ? (Number(stroke) * 24) / Number(size) : stroke, "stroke-linecap": "round", "stroke-linejoin": "round",
    "aria-hidden": labelled ? undefined : "true", role: labelled ? "img" : undefined };
  for (const key in props) if (!OWN.has(key)) out[key] = props[key];
  return out;
}
export function Icon(props) {
  return (
    <svg {...root(props)}>
      {props.title ? <title>{props.title}</title> : null}
      {props.icon.map(([tag, attrs]) => tag === "path" ? <path {...attrs} /> : tag === "circle" ? <circle {...attrs} /> : tag === "rect" ? <rect {...attrs} />
        : tag === "line" ? <line {...attrs} /> : tag === "polyline" ? <polyline {...attrs} /> : tag === "polygon" ? <polygon {...attrs} /> : <ellipse {...attrs} />)}
    </svg>
  );
}`;

test("server: byte-identical to the per-shape spread rendering for every lucide icon and root mode", async () => {
  const lucide = await import("lucide");
  const reference = await importServer<{ Icon(props: IconProps): ServerValue }>(run(REFERENCE, { target: "server", filename: "reference.tsx" }).code);
  const icons = Object.entries(lucide).filter(([name, value]) => /^[A-Z]/.test(name) && Array.isArray(value)) as [string, IconProps["icon"]][];
  assert.ok(icons.length > 1000, String(icons.length));
  const live = (props: Record<string, unknown>) => Object.defineProperty({ ...props }, "size", { get: () => 18, enumerable: true });
  const sets: Record<string, unknown>[] = [
    {},
    { size: 16, class: "size-4" },
    { size: 12, strokeWidth: 1, absoluteStrokeWidth: true, color: "red" },
    { title: 'A <"b"> & c' },
    { class: "" },
    { "aria-label": "x", class: "a", style: { color: "red" } },
    { "data-slot": "icon", "aria-hidden": "false", role: "presentation", class: "b" },
  ];
  for (const [name, icon] of icons)
    for (const props of [...sets, live({ class: "l" })]) {
      const p = { icon, ...props } as IconProps;
      assert.equal(await html(p), await renderToString(() => reference.Icon(p)), name + " " + JSON.stringify(props));
    }
  // One shared chunk per icon data array: a second render reuses it.
  assert.equal(await html({ icon: Check, size: 16 }), await html({ icon: Check, size: 16 }));
});
