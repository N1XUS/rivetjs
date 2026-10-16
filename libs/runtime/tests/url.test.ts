// URL attribute sanitization (gap X-4): unsafe dynamic URLs render as about:invalid#rivet on the
// server and in the DOM (no throw; `#dev` warns once); static unsafe literals are compile errors;
// data: images/video/audio are allowed on media sources only.
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { chromium } from "playwright";
import { compile } from "@rivetjs/compiler";

const UNSAFE_URL = "Unsafe URL attribute: javascript: / vbscript: URLs and data: URLs (except image / video / audio data on media elements) are rejected; use an http(s), relative or mailto: URL, or an event handler";
import { renderToString, renderToWriter, template, attribute, Dynamic } from "../server.ts";
import { resumableToString, type ResumeManifest } from "../server-resume.ts";
import { unsafeUrl, INVALID_URL } from "../url.ts";
import { compileResume, importServer } from "./resume/compile.ts";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const SVG = "data:image/svg+xml,<svg onload=alert(1)>";

test("unsafeUrl: schemes, control characters, lists and media data: types", () => {
  const unsafe = (name: string, value: string, media = false) => unsafeUrl(name, value, media);
  for (const value of ["javascript:x", " JAVASCRIPT:x", "java\nscript:x", "\u0000\tjavascript:x", "vbscript:x", "data:text/html,x", "\u007fdata:x"])
    assert.ok(unsafe("href", value), value);
  for (const value of ["/ok", "https://x/javascript:", "javascript", "#data:x", "mailto:a@b", "about:blank"]) assert.equal(unsafe("href", value), undefined, value);
  assert.equal(unsafe("href", " Javascript:x"), "Javascript");
  assert.equal(unsafe("title", "javascript:x"), undefined);
  // data: media types only in a media context, never svg.
  for (const value of [PNG, "data:image/jpeg,x", "data:image/webp;base64,AA", "data:video/mp4;base64,AA", "data:audio/ogg,x", "data:image/png"])
    assert.equal(unsafe("src", value, true), undefined, value);
  for (const value of [SVG, "data:image/SVG+xml;base64,AA", "data:text/html,x", "data:,x", "data:image/,x", "data:application/pdf,x", "data:image/png<x"])
    assert.equal(unsafe("src", value, true), "data", value);
  assert.equal(unsafe("src", PNG), "data");
  // Lists: every entry is checked.
  assert.equal(unsafe("srcset", "a.png 1x, b.png 2x"), undefined);
  assert.equal(unsafe("srcset", `${PNG} 1x, b.png 2x`, true), undefined);
  assert.equal(unsafe("srcset", "a.png 1x,javascript:alert(1) 2x"), "javascript");
  assert.equal(unsafe("srcset", `a.png 1x, ${SVG} 2x`, true), "data");
  assert.equal(unsafe("imagesrcset", "a.png 1x, data:image/png,x 2x"), "data");
  assert.equal(unsafe("ping", "https://a/p javascript:x"), "javascript");
  assert.equal(unsafe("ping", "https://a/p https://b/p"), undefined);
  assert.equal(unsafe("values", "#a;javascript:alert(1)"), "javascript");
  assert.equal(unsafe("values", "0;10;20"), undefined);
  for (const name of ["to", "from", "by", "data", "formaction", "xlink:href", "poster", "action"]) assert.equal(unsafe(name, "javascript:x"), "javascript", name);
});

test("server: unsafe dynamic URLs render as about:invalid#rivet (no rejection)", async () => {
  assert.equal(
    await renderToString(template(["<a", ">x</a>"], [attribute("href", " java\tscript:alert(1)")])),
    `<a href="${INVALID_URL}">x</a>`,
  );
  assert.equal(await renderToString(template(["<img", ">"], [attribute("src", PNG, "media")])), `<img src="${PNG}">`);
  assert.equal(await renderToString(template(["<img", ">"], [attribute("src", SVG, "media")])), `<img src="${INVALID_URL}">`);
  assert.equal(await renderToString(template(["<iframe", ">"], [attribute("src", PNG)])), `<iframe src="${INVALID_URL}">`);
  assert.equal(await renderToString(Dynamic({ component: "img", src: PNG, alt: "" })), `<img src="${PNG}" alt="">`);
  assert.equal(await renderToString(Dynamic({ component: "a", href: () => PNG, children: "x" })), `<a href="${INVALID_URL}">x</a>`);
  const chunks: string[] = [];
  await renderToWriter(template(["<object", "></object>"], [attribute("data", "javascript:x")]), { write: (s: string) => void chunks.push(s) });
  assert.equal(chunks.join(""), `<object data="${INVALID_URL}"></object>`);
});

const vectors = `
  export const Page = ({ u, items }) => <main>
    <a id="a" href={u} ping={"https://p/ " + u}>a</a>
    <form id="f" action={u}><button id="b" formAction={u}>b</button></form>
    <img id="img" src={u} srcset={"x.png 1x, " + u + " 2x"} />
    <picture><source id="source" src={u} srcset={u} /></picture>
    <video id="video" src={u} poster={u}></video>
    <audio id="audio" src={u}></audio>
    <track id="track" src={u} />
    <iframe id="iframe" src={u}></iframe>
    <embed id="embed" src={u} />
    <object id="object" data={u}></object>
    <link id="link" rel="preload" as="image" href={u} imagesrcset={u + " 1x"} />
    <svg><a id="svga" href={u}><text>t</text></a><use id="use" xlink:href={u} />
      <animate id="animate" attributeName="href" values={"#a;" + u} to={u} />
      <set id="set" attributeName="href" to={u} />
      <animate id="dyn" attributeName={u.length ? "href" : "x"} from={u} by={u} />
    </svg>
    <ul>{items.map((item) => <li><img class="row" src={item} /><a class="row" href={item}>r</a></li>)}</ul>
  </main>;`;
/** id → [attribute, expected for an unsafe value, expected for a PNG data: URL]. */
const expected: [string, string, string][] = [
  ["a", "href", INVALID_URL],
  ["a", "ping", INVALID_URL],
  ["f", "action", INVALID_URL],
  ["b", "formaction", INVALID_URL],
  ["img", "src", PNG],
  ["img", "srcset", `x.png 1x, ${PNG} 2x`],
  ["source", "src", PNG],
  ["source", "srcset", PNG],
  ["video", "src", PNG],
  ["video", "poster", PNG],
  ["audio", "src", PNG],
  ["track", "src", INVALID_URL],
  ["iframe", "src", INVALID_URL],
  ["embed", "src", INVALID_URL],
  ["object", "data", INVALID_URL],
  ["link", "href", INVALID_URL],
  ["link", "imagesrcset", INVALID_URL],
  ["svga", "href", INVALID_URL],
  ["use", "xlink:href", INVALID_URL],
  ["animate", "values", INVALID_URL],
  ["animate", "to", INVALID_URL],
  ["set", "to", INVALID_URL],
  ["dyn", "from", INVALID_URL],
  ["dyn", "by", INVALID_URL],
];
const attributeOf = (html: string, id: string, name: string): string | undefined => {
  const tag = new RegExp(`<[\\w]+ [^>]*id="${id}"[^>]*>`).exec(html)?.[0] ?? "";
  return new RegExp(` ${name.replace(":", "\\:")}="([^"]*)"`, "i").exec(tag)?.[1]?.replaceAll("&amp;", "&").replaceAll("&lt;", "<");
};
const serverRuntime = new URL("../server.ts", import.meta.url).href;
async function loadServer(lists: boolean) {
  const { code, diagnostics } = compile(vectors, { target: "server", filename: "vectors.tsx", serverListMounts: lists } as never);
  assert.deepEqual(diagnostics, []);
  return (await import("data:text/javascript," + encodeURIComponent(code.replaceAll("@rivetjs/runtime/server", serverRuntime) + `\n//${lists}`))) as {
    Page: (props: { u: string; items: string[] }) => never;
  };
}

test("server (compiled, list mounts on and off): every URL vector is neutralized; media sources keep data: images", async () => {
  for (const lists of [false, true]) {
    const { Page } = await loadServer(lists);
    for (const u of ["javascript:alert(1)", " vbscript:x", "data:text/html,<script>alert(1)</script>", SVG]) {
      const html = await renderToString(Page({ u, items: [u] }));
      for (const [id, name] of expected) assert.equal(attributeOf(html, id, name), INVALID_URL, `${lists} ${u} ${id}[${name}]`);
      assert.equal((html.match(/class="row" (?:src|href)="about:invalid#rivet"/g) ?? []).length, 2, `${lists} rows`);
    }
    const html = await renderToString(Page({ u: PNG, items: [PNG] }));
    for (const [id, name, value] of expected) assert.equal(attributeOf(html, id, name), value, `${lists} png ${id}[${name}]`);
    assert.match(html, new RegExp(`<img class="row" src="${PNG.replace(/[+/]/g, "\\$&")}"><a class="row" href="${INVALID_URL}">`));
  }
});

test("server-resume: resumed attribute bindings are neutralized with the media rule", async () => {
  const source = `
    import { signal } from "@rivetjs/reactivity";
    export function Pic({ start }) {
      const u = signal(start);
      return <p><img src={u()} onClick={() => u.set("/x.png")} /><a href={u()}>a</a></p>;
    }`;
  const manifest: ResumeManifest = {
    hash: "h",
    runtime: "/rt.js",
    symbols: Object.fromEntries(compileResume(source, "dom").symbols.map((s) => [s.id, "/c.js"])),
  };
  const mod = await importServer<{ Pic: (props: { start: string }) => never }>(compileResume(source, "server").code);
  const unsafe = await resumableToString(() => mod.Pic({ start: "javascript:x" }), { manifest });
  assert.match(unsafe, /<img src="about:invalid#rivet" data-r="0"><a href="about:invalid#rivet"/);
  const png = await resumableToString(() => mod.Pic({ start: PNG }), { manifest });
  assert.match(png, /<img src="data:image\/png;base64,iVBORw0KGgo=" data-r="0"><a href="about:invalid#rivet"/);
});

const diagnostics = (source: string, target: "server" | "dom") =>
  compile(source, { target, filename: "static.tsx" }).diagnostics.map((d) => d.message);
test("static: unsafe literals are compile errors (both targets); media data: literals compile", () => {
  const rejected = [
    `<a href="javascript:alert(1)">x</a>`,
    `<a href=" java&#x09;script:alert(1)">x</a>`,
    `<a href="data:image/png;base64,AA">x</a>`,
    `<img src="${SVG.replace("<", "&lt;").replace(">", "&gt;")}" />`,
    `<iframe src="data:image/png;base64,AA"></iframe>`,
    `<track src="data:image/png;base64,AA" />`,
    `<img srcset="a.png 1x,javascript:x 2x" />`,
    `<a ping="https://p javascript:x">x</a>`,
    `<object data="javascript:x"></object>`,
    `<embed src="vbscript:x" />`,
    `<button formAction="javascript:x">b</button>`,
    `<svg><animate attributeName="href" values="#a;javascript:alert(1)" /></svg>`,
    `<svg><set attributeName="xlink:href" to="javascript:alert(1)" /></svg>`,
    `<svg><use xlink:href="javascript:x" /></svg>`,
    `<link rel="preload" as="image" imagesrcset="data:image/png,x 1x" />`,
  ];
  for (const jsx of rejected)
    for (const target of ["server", "dom"] as const)
      assert.deepEqual(diagnostics(`export const v = ${jsx};`, target), [UNSAFE_URL], `${target} ${jsx}`);
  const accepted = [
    `<img src="${PNG}" />`,
    `<img srcset="${PNG} 1x, b.png 2x" />`,
    `<picture><source srcset="data:image/webp;base64,AA" /></picture>`,
    `<video src="data:video/mp4;base64,AA" poster="data:image/jpeg;base64,AA"></video>`,
    `<audio src="data:audio/ogg;base64,AA"></audio>`,
    `<svg><animate attributeName="width" values="0;10" /></svg>`,
  ];
  for (const jsx of accepted)
    for (const target of ["server", "dom"] as const) assert.deepEqual(diagnostics(`export const v = ${jsx};`, target), [], `${target} ${jsx}`);
  assert.ok(compile(`export const v = <img src="${PNG}" />;`, { target: "server", filename: "static.tsx" }).code.includes(PNG));
});

// DOM: compiled attribute writers in Chromium, production and development resolution.
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
async function run(code: string): Promise<{ result: Record<string, unknown>; warnings: string[] }> {
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
      const result = await ((await import("/app.mjs" as string)) as { run(): Record<string, unknown> }).run();
      return { result, warnings };
    });
  } finally {
    await browser.close();
  }
}
const dom = `
  import { signal } from "@rivetjs/reactivity";
  import { mount } from "@rivetjs/runtime/dom";
  ${vectors.replace("export const Page = ({ u, items }) =>", "const Page = ({ u, items }) =>").replaceAll("{u}", "{u()}").replaceAll("+ u", "+ u()").replaceAll("u +", "u() +").replace("u.length", "u().length").replace("items.map((item) =>", "[0].map(() =>").replaceAll("{item}", "{u()}")}
  const read = (el, name) => name === "xlink:href" ? el.getAttributeNS("http://www.w3.org/1999/xlink", "href") : el.getAttribute(name);
  export function run() {
    const u = signal("/start");
    const out = {};
    const snapshot = (key) => {
      out[key] = {};
      for (const el of document.querySelectorAll("[id]")) for (const attr of el.getAttributeNames()) if (attr !== "id" && attr !== "attributename" && attr !== "attributeName" && attr !== "rel" && attr !== "as") out[key][el.id + " " + attr] = read(el, attr);
      out[key].rows = [...document.querySelectorAll(".row")].map((el) => el.getAttribute(el.localName === "img" ? "src" : "href"));
    };
    mount(() => <Page u={u} items={[]} />, document.querySelector("#host"));
    for (const [key, value] of [["js", "javascript:alert(1)"], ["png", "${PNG}"], ["svg", ${JSON.stringify(SVG)}], ["js2", "\\u0001java\\u000bscript:x"]]) {
      try { u.set(value); snapshot(key); } catch (error) { out[key] = "threw " + error.message; }
    }
    try {
      mount(() => <Page u={() => "vbscript:x"} items={[]} />, document.querySelector("#host"));
      out.initial = "ok";
    } catch (error) { out.initial = "threw " + error.message; }
    return out;
  }`;

function checkDom(result: Record<string, unknown>) {
  assert.equal(result.initial, "ok");
  for (const key of ["js", "svg", "js2"]) {
    const values = result[key] as Record<string, unknown>;
    assert.equal(typeof values, "object", `${key}: ${String(values)}`);
    for (const [id, name] of expected) assert.equal(values[`${id} ${name}`], INVALID_URL, `${key} ${id}[${name}]`);
    assert.deepEqual(values.rows, [INVALID_URL, INVALID_URL]);
  }
  const png = result.png as Record<string, unknown>;
  for (const [id, name, value] of expected) assert.equal(png[`${id} ${name}`], value, `png ${id}[${name}]`);
  assert.deepEqual(png.rows, [PNG, INVALID_URL]);
}

test(`DOM (production): unsafe URLs are neutralized without throwing, silently`, async () => {
    const { result, warnings } = await run(await bundle(dom, []));
    checkDom(result);
    assert.deepEqual(warnings, []);
  });


test(`DOM (development): same neutralization; one warning per attribute and scheme naming the component`, async () => {
    const { result, warnings: all } = await run(await bundle(dom, ["development"]));
    checkDom(result);
    // URL warnings only (the dev a11y audit also reports on this fixture's markup).
    const warnings = all.filter((w) => !w.startsWith("Rivet a11y"));
    const href = warnings.filter((w) => /unsafe javascript: URL in href in <Page>/.test(w));
    assert.equal(href.length, 1, warnings.join("\n"));
    assert.ok(warnings.some((w) => /unsafe vbscript: URL in href in <Page>/.test(w)));
    assert.ok(warnings.some((w) => /unsafe data: URL in src in <Page>/.test(w)));
    assert.equal(new Set(warnings).size, warnings.length);
  });


// Spread attributes (`{...x}`): the same neutralization, and the same `#dev` warning (once per
// attribute and scheme); production stays silent.
const spreadSource = `
  export const Spread = ({ attrs }) => <a {...attrs()}>x</a>;
  export const Img = ({ attrs }) => <img {...attrs()} />;
  export const Box = ({ attrs }) => <a {...attrs()} />;`;
// Server: a fresh process per resolution, so earlier warnings in this file (warn once) do not hide these.
const serverSpread = (conditions: string[]): { html: string[]; warnings: string[] } =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        ...conditions,
        "--input-type=module",
        "-e",
        `import { compile } from ${JSON.stringify(import.meta.resolve("@rivetjs/compiler"))};
         import { importServer } from ${JSON.stringify(new URL("./resume/compile.ts", import.meta.url).href)};
         import { renderToString } from ${JSON.stringify(new URL("../server.ts", import.meta.url).href)};
         const mod = await importServer(compile(${JSON.stringify(spreadSource)}, { target: "server", filename: "spread.tsx" }).code);
         const warnings = [];
         console.warn = (...args) => warnings.push(args.join(" "));
         const html = [];
         for (const [name, attrs] of [
           ["Spread", { href: "javascript:alert(1)" }],
           ["Spread", { href: () => " JavaScript:x", ping: "https://p/ vbscript:x" }],
           ["Img", { src: ${JSON.stringify(PNG)} }],
           ["Img", { src: ${JSON.stringify(SVG)} }],
         ]) html.push(await renderToString(() => mod[name]({ attrs: () => attrs })));
         process.stdout.write(JSON.stringify({ html, warnings }));`,
      ],
      { encoding: "utf8" },
    ),
  );
const serverSpreadHTML = [
  `<a href="${INVALID_URL}">x</a>`,
  `<a href="${INVALID_URL}" ping="${INVALID_URL}">x</a>`,
  `<img src="${PNG}">`,
  `<img src="${INVALID_URL}">`,
];

test("server spread (production): unsafe URLs are neutralized, silently", () => {
  assert.deepEqual(serverSpread([]), { html: serverSpreadHTML, warnings: [] });
});

test("server spread (development): same neutralization; one warning per attribute and scheme", () => {
  const { html, warnings } = serverSpread(["--conditions=development"]);
  assert.deepEqual(html, serverSpreadHTML);
  assert.equal(warnings.length, 3, warnings.join("\n"));
  assert.match(warnings[0]!, /unsafe javascript: URL in href rendered as about:invalid#rivet/);
  assert.match(warnings[1]!, /unsafe vbscript: URL in ping/);
  assert.match(warnings[2]!, /unsafe data: URL in src/);
});

const domSpread = `
  import { signal } from "@rivetjs/reactivity";
  import { mount } from "@rivetjs/runtime/dom";
  ${spreadSource.replaceAll("export const", "const")}
  export function run() {
    const host = document.querySelector("#host");
    const attrs = signal({ href: "/ok" }), img = signal({ src: "${PNG}" });
    mount(() => <><Spread attrs={attrs} /><Img attrs={img} /></>, host);
    const a = host.querySelector("a"), out = [];
    for (const next of [{ href: "javascript:alert(1)" }, { href: " JAVASCRIPT:x" }, { href: () => "data:text/html,x" }, { href: "/fine", ping: "https://p/ vbscript:x" }]) {
      attrs.set(next);
      out.push(a.getAttribute("href") + " " + a.getAttribute("ping"));
    }
    img.set({ src: ${JSON.stringify(SVG)} });
    out.push(host.querySelector("img").getAttribute("src"));
    img.set({ src: "${PNG}" });
    out.push(host.querySelector("img").getAttribute("src"));
    // No JSX children: the spread's \`children\` is the content (passed through the dev façade).
    const box = document.createElement("div");
    mount(() => <Box attrs={() => ({ href: "/b", children: "boxed" })} />, box);
    out.push(box.innerHTML.replace(/<!--[^>]*-->/g, ""));
    return { out };
  }`;
const domSpreadExpected = [
  `${INVALID_URL} null`,
  `${INVALID_URL} null`,
  `${INVALID_URL} null`,
  `/fine ${INVALID_URL}`,
  INVALID_URL,
  PNG,
  '<a href="/b">boxed</a>',
];

test(`DOM spread (production): unsafe URLs are neutralized, silently`, async () => {
    const { result, warnings } = await run(await bundle(domSpread, []));
    assert.deepEqual(result.out, domSpreadExpected);
    assert.deepEqual(warnings, []);
  });


test(`DOM spread (development): same neutralization; one warning per attribute and scheme naming the component`, async () => {
    const { result, warnings } = await run(await bundle(domSpread, ["development"]));
    assert.deepEqual(result.out, domSpreadExpected);
    assert.deepEqual(
      // The dev a11y checks also warn here (the test <img> has no alt); only URL warnings count.
      warnings.filter((w) => !w.startsWith("Rivet a11y")).map((w) => /unsafe (\w+): URL in (\S+ in <\w+>)/.exec(w)?.slice(1).join(" ")),
      ["javascript href in <Spread>", "data href in <Spread>", "vbscript ping in <Spread>", "data src in <Img>"],
    );
  });

