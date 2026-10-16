import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import { renderToString, spreadAttributes, spreadChildren } from "@rivetjs/runtime/server";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";

type View = (props: never) => unknown;
interface UnitModule {
  run(): unknown;
}

const source = await readFile(new URL("./spread/fixture.tsx", import.meta.url), "utf8");
const dom = compile(source, { target: "dom", filename: "fixture.tsx" });
const serverCompiled = compile(source, { target: "server", filename: "fixture.tsx" });
const server = await importServer<Record<string, View>>(serverCompiled.code);
const html = (component: string, props: Record<string, unknown>): string =>
  renderToString(() => (server[component] as (props: unknown) => never)(props)) as string;

test("spread fixture compiles cleanly for both targets", () => {
  assert.deepEqual(dom.diagnostics, []);
  assert.deepEqual(serverCompiled.diagnostics, []);
});

test("server: spread attributes merge in source order through the attribute rules", async () => {
  // Wrapper component: caller attributes pass through, the explicit class after the spread wins.
  assert.equal(html("UseButton", { label: () => 'Save "it"' }), '<button class="btn primary" type="submit" aria-label="Save &quot;it&quot;">Save</button>');
  // Static before the spread is overridden; explicit after it wins.
  assert.equal(
    html("Order", { attrs: () => ({ title: "<spread>", id: "s", "data-last": "spread" }) }),
    '<div id="s" title="&lt;spread&gt;" data-last="explicit"></div>',
  );
  assert.equal(html("Order", { attrs: () => ({}) }), '<div id="before" title="static" data-last="explicit"></div>');
  // `style` objects encode like an explicit `style={obj}` (camelCase, custom properties, unsafe values dropped); strings are refused.
  const style = { color: "red", marginTop: 1, "--x": "2", background: "url(x)" };
  assert.equal(html("StyledSpread", { obj: () => style }), '<i id="spread" style="color:red;margin-top:1px;--x:2"></i>');
  assert.equal(html("StyledSpread", { obj: () => style }).replace("spread", "explicit"), html("Styled", { obj: () => style }));
  assert.equal(html("StyledSpread", { obj: () => ({}) }), '<i id="spread"></i>');
  assert.equal(
    html("Order", { attrs: () => ({ style: () => ({ color: "red" }) }) }),
    '<div id="before" title="static" style="color:red" data-last="explicit"></div>',
  );
  await assert.rejects(async () => html("StyledSpread", { obj: () => "color:red" }), /Unsupported style value/);
  // Booleans, null, accessors, listeners (omitted), children / ref (not attributes), className.
  assert.equal(
    html("Live", {
      n: () => 2,
      attrs: () => ({
        hidden: false,
        disabled: true,
        title: null,
        "aria-label": () => "acc",
        onClick: () => {},
        onInput: null,
        children: "x",
        ref: () => {},
        className: "c",
      }),
    }),
    '<p class="c" disabled aria-label="acc" data-n="2">text</p>',
  );
  // URL rule per tag: data: images only on media sources; javascript: neutralized; SVG namespace.
  assert.equal(
    html("Media", {
      img: { src: "data:image/png;base64,AA", srcset: "javascript:x 1x" },
      link: { href: "javascript:alert(1)", ping: "/ok data:text/html,x" },
      shape: { r: 2, hidden: false },
    }),
    '<div><img src="data:image/png;base64,AA" srcset="about:invalid#rivet"><a href="about:invalid#rivet" ping="about:invalid#rivet">a</a><svg><circle r="2" hidden="false"></circle></svg></div>',
  );
  // Unsafe names throw like compiled attributes.
  for (const attrs of [{ onclick: "x" }, { onClick: "alert(1)" }, { innerHTML: "<b>" }, { srcdoc: "x" }, { "a b": 1 }, { 'x"': 1 }])
    await assert.rejects(async () => html("Order", { attrs: () => attrs }), /Unsafe attribute name/, JSON.stringify(attrs));
  // A style string is refused like an explicit one (no CSS parser; objects go through the style helpers).
  await assert.rejects(async () => html("Order", { attrs: () => ({ style: "x" }) }), /Unsupported style value/);
  // Server list mounts flatten a row component whose root spreads.
  assert.match(serverCompiled.code, /__rivetList\(/);
  assert.equal(
    html("List", {
      rows: [
        { name: "a", attrs: { title: "t<" } },
        { name: "b", attrs: { onClick: () => {}, hidden: true, class: "x" } },
      ],
    }),
    '<ul><li class="row" title="t&lt;">a</li><li class="x" hidden>b</li></ul>',
  );
  // Component props: object spread in source order.
  assert.equal(html("Props", { rest: { a: "x", b: 2, c: "no" } }), "<i>x/2/3</i>");
  assert.equal(html("Props", { rest: {} }), "<i>1/undefined/3</i>");
  // The ABI itself: records, media namespace by tag.
  assert.deepEqual(
    spreadAttributes({ src: "a", class: "x" }, "img").map((r) => [r.name, r.value, r.namespace]),
    [
      ["src", "a", "media"],
      ["class", "x", "html"],
    ],
  );
  assert.equal(spreadAttributes(null, "div").length, 0);
});

test("server: a spread `children` is the content without JSX children; explicit children win", () => {
  assert.equal(html("Filled", { attrs: () => ({ title: "t", children: "a<b" }) }), '<section class="f" title="t">a&lt;b</section>');
  assert.equal(html("Filled", { attrs: () => ({ children: ["x", 2, null] }) }), '<section class="f">x2</section>');
  assert.equal(html("Filled", { attrs: () => ({}) }), '<section class="f"></section>');
  assert.equal(html("Explicit", { attrs: () => ({ title: "t", children: "dropped" }) }), '<section title="t">mine</section>');
  // Components: the spread key is the `children` prop; JSX children override it.
  assert.equal(html("Pass", { rest: { children: "via" } }), "<b>via</b>");
  assert.equal(html("PassExplicit", { rest: { children: "via" } }), "<b>mine</b>");
  // Flattened list rows: each spread element gets its own object's children.
  assert.match(serverCompiled.code, /__rivetSpreadChildren\(\)/);
  assert.equal(
    html("Cells", {
      rows: [
        { a: { children: "a1" }, b: { title: "t", children: "b1" } },
        { a: {}, b: { children: "b2" } },
      ],
    }),
    '<ul><li><i>a1</i><u title="t">b1</u></li><li><i></i><u>b2</u></li></ul>',
  );
  // The ABI: the last spreadAttributes call's children, taken once.
  spreadAttributes({ children: "k", id: "x" }, "div");
  assert.equal(spreadChildren(), "k");
  assert.equal(spreadChildren(), undefined);
});

test("DOM: spread keys are diffed, listeners swap, explicit attributes after the spread win", async () => {
  const unit = `
    import { signal } from "/reactivity.mjs";
    import { mount, _c } from "/dom.ts";
    import * as F from "/fixture.mjs";
    const throws = (fn, re) => { try { fn(); } catch (e) { return re.test(e.message) ? true : e.message; } return "no error"; };
    const attrs = (el) => [...el.attributes].map((a) => a.name + "=" + a.value).join(" ");
    export function run() {
      const out = {};
      const host = document.createElement("div");
      document.body.append(host);
      const view = (C, props) => { host.textContent = ""; return mount(() => _c(C, props), host); };
      // Wrapper component (live props: the label change reaches the spread button).
      const label = signal("one");
      let stop = view(F.UseButton, { label });
      const button = host.querySelector("button");
      out.button = [attrs(button), button.textContent];
      label.set("two");
      out.button.push(button.getAttribute("aria-label"));
      stop();
      // Order: spread overrides earlier static, explicit after the spread wins; removed keys fall back.
      const order = signal({ title: "spread", id: "s", "data-last": "spread" });
      stop = view(F.Order, { attrs: order });
      const div = host.querySelector("div");
      out.order = [attrs(div)];
      order.set({});
      out.order.push(attrs(div));
      stop();
      // Live: add / remove keys, booleans, accessors, listener swap and removal.
      const clicks = [];
      const live = signal({ title: "t", disabled: true, onClick: () => clicks.push("a") });
      const n = signal(1);
      stop = view(F.Live, { attrs: live, n });
      const p = host.querySelector("p");
      p.click();
      out.live = [attrs(p)];
      const acc = signal("acc1");
      live.set({ "aria-label": () => acc(), onClick: () => clicks.push("b"), hidden: true, className: "c" });
      p.click();
      out.live.push(attrs(p));
      acc.set("acc2");
      n.set(2);
      out.live.push(attrs(p));
      live.set({ hidden: false });
      p.click();
      out.live.push(attrs(p), clicks.join(""));
      stop();
      // Media / URL rule / SVG namespace.
      stop = view(F.Media, { img: { src: "data:image/png;base64,AA" }, link: { href: " javascript:alert(1)" }, shape: { r: "2" } });
      out.media = [host.querySelector("img").getAttribute("src"), host.querySelector("a").getAttribute("href"), host.querySelector("circle").namespaceURI, host.querySelector("circle").getAttribute("r")];
      stop();
      // Explicit handler and spread handler both listen.
      const order2 = [];
      stop = view(F.Handlers, { attrs: { onClick: () => order2.push("spread") }, mine: () => order2.push("mine") });
      host.querySelector("button").click();
      out.handlers = order2.join(",");
      stop();
      // onXCapture listens in the capture phase (before a child bubble handler); onGotPointerCapture is its own event.
      const phases = [];
      stop = view(F.Order, { attrs: () => ({ onClickCapture: () => phases.push("capture"), onGotPointerCapture: () => phases.push("got") }) });
      const outer = host.querySelector("div");
      const inner = outer.appendChild(document.createElement("i"));
      inner.addEventListener("click", () => phases.push("child"));
      inner.click();
      outer.dispatchEvent(new Event("gotpointercapture"));
      out.capture = phases.join(",");
      stop();
      // First run: unset (null / undefined) keys write nothing (no attribute appears); a later value applies, a later unset removes it.
      const unset = signal({ title: undefined, "aria-label": null, "data-x": undefined, tabIndex: undefined });
      stop = view(F.Order, { attrs: unset });
      const blank = host.querySelector("div");
      out.unset = [attrs(blank)];
      unset.set({ title: "t", "aria-label": null, tabIndex: 0 });
      out.unset.push(attrs(blank));
      unset.set({ title: undefined });
      out.unset.push(attrs(blank));
      stop();
      // Trailing attributes (F1): static ones in the template, the rest one binding; the spread never writes their keys
      // (an unset explicit title keeps the spread's title off; spread class / tabindex aliases are excluded too).
      const spreadAfter = signal({ id: "s", title: "spread", className: "spread", tabindex: 3, "data-k": "spread" });
      const t = signal(undefined), c = signal(undefined);
      stop = view(F.After, { attrs: spreadAfter, t, c });
      const after = host.querySelector("div");
      out.after = [attrs(after)];
      t.set("mine");
      c.set("c");
      out.after.push(attrs(after));
      spreadAfter.set({ title: "spread2", class: "x" });
      out.after.push(attrs(after));
      stop();
      // Unsafe names throw (also with an unset value); a style string is refused like an explicit one.
      out.unsafeUnset = [{ innerHTML: undefined }, { "a b": null }, { onclick: undefined }].map((a) => throws(() => view(F.Order, { attrs: () => a }), /Unsafe attribute name/));
      out.unsafe = [{ onclick: "x" }, { onClick: "alert(1)" }, { style: "x" }, { innerHTML: "<b>" }, { srcdoc: "x" }, { "a b": 1 }]
        .map((a) => throws(() => view(F.Order, { attrs: () => a }), /Unsafe attribute name|Event handler must be a function|Unsupported style value/));
      // style objects: keys diffed per run, accessor values tracked, cleared on removal; same as an explicit style={obj}.
      const style = signal({ color: "red", marginTop: "1px", "--x": 2 });
      const unit = signal("px");
      const css = () => [host.querySelector("#explicit").style.cssText, host.querySelector("#spread").style.cssText];
      stop = view(F.Styled, { obj: style });
      const stop2 = mount(() => _c(F.StyledSpread, { obj: style }), host);
      out.style = [css()];
      style.set(() => ({ color: "blue", "--x": 3 + unit() }));
      out.style.push(css());
      unit.set("em");
      out.style.push(css());
      style.set(undefined);
      out.style.push(css());
      style.set({ color: "green" });
      out.style.push(css());
      stop2();
      stop();
      // style among other spread keys: changing the object rebinds only the style.
      const mixed = signal({ title: "t", style: { color: "red" } });
      stop = view(F.Order, { attrs: mixed });
      const styled = host.querySelector("div");
      out.mixed = [attrs(styled)];
      mixed.set({ title: "u", style: { color: "blue" } });
      out.mixed.push(attrs(styled));
      mixed.set({ title: "u" });
      out.mixed.push(attrs(styled));
      stop();
      // Component props merged in source order.
      stop = view(F.Props, { rest: { a: "x", b: 2, c: "no" } });
      out.props = host.textContent;
      stop();
      // Spread children: reactive content without JSX children; explicit children win.
      const kids = signal({ title: "t", children: "one" });
      stop = view(F.Filled, { attrs: kids });
      const section = host.querySelector("section");
      out.kids = [section.textContent, attrs(section)];
      kids.set({ children: ["a", "b"] });
      out.kids.push(section.textContent, attrs(section));
      const text = signal("acc1");
      kids.set({ children: () => text() });
      text.set("acc2");
      out.kids.push(section.textContent);
      const node = document.createElement("em");
      node.textContent = "node";
      kids.set({ children: node, id: "n" });
      out.kids.push(section.innerHTML.replace(/<!--[^>]*-->/g, ""));
      kids.set({});
      out.kids.push(section.innerHTML.replace(/<!--[^>]*-->/g, ""), section === host.querySelector("section"));
      stop();
      stop = view(F.Explicit, { attrs: () => ({ children: "dropped", title: "t" }) });
      out.explicit = host.querySelector("section").outerHTML;
      stop();
      stop = view(F.Pass, { rest: { children: "via" } });
      out.pass = host.textContent;
      stop();
      stop = view(F.PassExplicit, { rest: { children: "via" } });
      out.pass += "," + host.textContent;
      stop();
      return out;
    }`;
  await withPage({ "/fixture.mjs": rewrite(dom.code), "/unit.mjs": unit, "/": "<!doctype html><body></body>" }, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    const report = await page.evaluate(async () => ((await import("/unit.mjs" as string)) as UnitModule).run());
    assert.deepEqual(report, {
      button: ["type=submit aria-label=one class=btn primary", "Save", "two"],
      order: ["data-last=explicit id=s title=spread", "data-last=explicit id=before title=static"],
      live: [
        "class=live title=t disabled= data-n=1",
        "class=c data-n=1 aria-label=acc1 hidden=",
        "class=c data-n=2 aria-label=acc2 hidden=",
        "class=live data-n=2",
        "ab",
      ],
      media: ["data:image/png;base64,AA", "about:invalid#rivet", "http://www.w3.org/2000/svg", "2"],
      handlers: "mine,spread",
      capture: "capture,child,got",
      unsafe: [true, true, true, true, true, true],
      unset: ["data-last=explicit id=before", "data-last=explicit id=before title=t tabindex=0", "data-last=explicit id=before"],
      after: ["data-k=k id=s tabindex=-1", "data-k=k id=s tabindex=-1 title=mine class=c", "data-k=k tabindex=-1 title=mine class=c"],
      unsafeUnset: [true, true, true],
      style: [
        ["color: red; margin-top: 1px; --x: 2;", "color: red; margin-top: 1px; --x: 2;"],
        ["color: blue; --x: 3px;", "color: blue; --x: 3px;"],
        ["color: blue; --x: 3em;", "color: blue; --x: 3em;"],
        ["", ""],
        ["color: green;", "color: green;"],
      ],
      mixed: [
        "data-last=explicit id=before title=t style=color: red;",
        "data-last=explicit id=before title=u style=color: blue;",
        "data-last=explicit id=before title=u style=",
      ],
      props: "x/2/3",
      kids: ["one", "class=f title=t", "ab", "class=f", "acc2", "<em>node</em>", "", true],
      explicit: '<section title="t">mine</section>',
      pass: "via,mine",
    });
    assert.deepEqual(errors, []);
  });
});

test("strict authoring types accept spread props and attributes", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./spread/fixture.tsx", import.meta.url).pathname], {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    allowImportingTsExtensions: true,
  });
  assert.deepEqual(
    ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [],
  );
});

test("resume: a spread reading signals resumes as an attribute binding and updates", async () => {
  const resumeSource = await readFile(new URL("./spread/resume.tsx", import.meta.url), "utf8");
  const resumeDom = compileResume(resumeSource, "dom");
  const resumeServer = await importServer<{ Page(): never }>(compileResume(resumeSource, "server").code);
  const chunks: Record<string, ResumeSymbol[]> = {};
  for (const symbol of resumeDom.symbols) (chunks["/c/" + symbol.component + ".js"] ??= []).push(symbol);
  const files: Record<string, string> = {
    "/fixture.mjs": rewrite(resumeDom.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
  };
  for (const [path, symbols] of Object.entries(chunks)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
  const manifest = { hash: "test", runtime: "/rt.js", symbols: Object.fromEntries(resumeDom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
  const body = await resumableToString(() => resumeServer.Page(), { manifest });
  // The constant spread renders plainly; the reactive one carries data-r.
  assert.match(body, /<span id="static" data-kind="box">static<\/span>/);
  assert.match(body, /<div id="box" class="base" data-kind="box" title="on" aria-pressed="true" data-n="1" data-r="\d+">/);
  // Spread children: reactive content on the spread binding's element; constant ones render plainly.
  assert.match(body, /<p id="kids" data-r="\d+">on 1<\/p><p id="kept" data-r="\d+">explicit<\/p><p id="fixed">fixed<\/p><b id="shell">via<\/b>/);
  // Function JSX children of a spread: a plain child site (no markers when it read nothing) or a region of its own.
  assert.match(
    body,
    /<p id="fnjsx" title="t1" data-r="\d+"><b id="fnjsxkid">kid<\/b><\/p><p id="fnjsxn" title="t1" data-r="\d+"><!--r\d+\[--><b id="fnjsxnkid" data-n="1" data-r="\d+">on<\/b><!--\]--><\/p>/,
  );
  // Accessor values: called at render on the server (same as v1 DOM), tracked by the resumed binding.
  assert.match(body, /<input id="acc" aria-invalid="true" value="v1" data-r="\d+">/);
  assert.match(body, /<i id="sty" style="color:red;--n:1" data-r="\d+"><\/i>/);
  files["/"] = "<!doctype html><html><head></head><body>" + body + "</body></html>";
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    const box = () =>
      page.evaluate(() =>
        [...document.querySelector("#box")!.attributes]
          .filter((a) => a.name !== "data-r")
          .map((a) => a.name + "=" + a.value)
          .join(" "),
      );
    // Mark the server children of the prop-spreading components before any change.
    await page.evaluate(() => {
      (document.querySelector("#rkid") as unknown as { mark: number }).mark = 1;
      (document.querySelector("#fnjsxkid") as unknown as { mark: number }).mark = 1;
      (document.querySelector("#fnjsxnkid") as unknown as { mark: number }).mark = 1;
    });
    const fnjsx = () =>
      page.evaluate(() => [
        document.querySelector("#fnjsx")!.getAttribute("title") + "|" + ((document.querySelector("#fnjsxkid") as unknown as { mark?: number })?.mark ?? 0),
        document.querySelector("#fnjsxn")!.getAttribute("title") +
          "|" +
          document.querySelector("#fnjsxnkid")!.getAttribute("data-n") +
          "|" +
          document.querySelector("#fnjsxnkid")!.textContent +
          "|" +
          ((document.querySelector("#fnjsxnkid") as unknown as { mark?: number })?.mark ?? 0),
      ]);
    const boxes = () =>
      page.evaluate(() => [
        document.querySelector("#rbox")!.className,
        (document.querySelector("#rkid") as unknown as { mark?: number }).mark ?? 0,
        document.querySelector("#rtext")!.textContent,
        document.querySelector("#fnkid")!.textContent + "|" + document.querySelector("#fnkid")!.getAttribute("title"),
        document.querySelector("#rfn")!.textContent + "|" + document.querySelector("#fnonly")!.textContent,
      ]);
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#box")!.hasAttribute("hidden"));
    assert.equal(await box(), "id=box class=base data-kind=box data-n=1 hidden=");
    const acc = () =>
      page.evaluate(() => [document.querySelector("#acc")!.getAttribute("aria-invalid"), (document.querySelector("#acc") as HTMLInputElement).value]);
    assert.deepEqual(await acc(), [null, "v1"]);
    const sty = () => page.evaluate(() => (document.querySelector("#sty") as HTMLElement).style.cssText);
    assert.equal(await sty(), "color: blue; --n: 1;");
    const kids = () =>
      page.evaluate(() =>
        ["#kids", "#kept", "#fixed", "#shell"].map((s) => document.querySelector(s)!.textContent + (document.querySelector(s)!.getAttribute("title") ?? "")),
      );
    assert.deepEqual(await kids(), ["off1off", "explicit", "fixed", "via"]);
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("#box")!.getAttribute("data-n") === "2");
    assert.deepEqual(await kids(), ["off2off", "explicit", "fixed", "via"]);
    assert.deepEqual(await acc(), [null, "v2"]);
    assert.equal(await sty(), "color: blue; --n: 2;");
    // Attribute-only change: the server child node stays (no re-insert), slot / accessor children keep updating.
    assert.deepEqual(await boxes(), ["c2", 1, "t2", "f2|t2", "g2|h2"]);
    // Function JSX children (` #r` site): the server `<b>` stays while only the attributes change; a site that read `n` was
    // re-created by its own read (the kid is new) and shows the current values.
    assert.deepEqual(await fnjsx(), ["t2|1", "t2|null|off|0"]);
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("#rbox")!.className === "c3");
    assert.deepEqual(await boxes(), ["c3", 1, "t3", "f3|t3", "g3|h3"]);
    assert.deepEqual(await fnjsx(), ["t3|1", "t3|null|off|0"]);
    await page.click("#toggle");
    await page.waitForFunction(() => !document.querySelector("#box")!.hasAttribute("hidden"));
    assert.equal(await box(), "id=box class=base data-kind=box data-n=3 title=on aria-pressed=true");
    assert.equal(await sty(), "color: red; --n: 3;");
    assert.deepEqual(await kids(), ["on 3", "explicit", "fixed", "via"]);
    assert.equal(await page.evaluate(() => (globalThis as { __componentRuns?: number }).__componentRuns ?? 0), 0);
    assert.deepEqual(errors, []);
  });
});

test("resume server: symbol spread handlers are recorded, other functions rejected; constant spreads record nothing", async () => {
  const render = async (body: string): Promise<string> => {
    const code = `import { signal } from "@rivetjs/reactivity";
      export function Page() { const n = signal(1); const attrs = { title: "t" }; return <main>${body}</main>; }`;
    const dom = compileResume(code, "dom");
    const mod = await importServer<{ Page(): never }>(compileResume(code, "server").code);
    const manifest = { runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c.js"])) };
    const out = await resumableToString(() => mod.Page(), { manifest });
    return out.includes("<script") ? out.slice(0, out.indexOf("<script")) : out;
  };
  // An inline function in the spread object is a symbol (R2): recorded like `onClick={…}`.
  assert.equal(await render(`<b {...{ onClick: () => n.set(2) }}>x</b>`), '<main><b data-r="0">x</b></main>');
  await assert.rejects(
    render(`<b {...{ onClick: n.set.bind(n, 2) }}>x</b>`),
    /Cannot resume spread event handler onClick: pass it as an explicit onClick=\{…\} attribute, or create it as an inline function/,
  );
  await assert.rejects(render(`<b onClick={() => n.set(1)} {...{ onClick: () => n.set(2) }}>x</b>`), /Cannot resume two click handlers on one element/);
  assert.equal(await render(`<b {...attrs}>x</b>`), '<main><b title="t">x</b></main>');
});

test("zero cost: the spread helpers tree-shake out of bundles that do not use them", async () => {
  const { rolldown } = await import("rolldown");
  const bundle = async (code: string): Promise<string> => {
    const build = await rolldown({
      input: "entry",
      platform: "node",
      logLevel: "silent",
      external: [/^node:/],
      resolve: { conditionNames: ["import", "production", "default"] },
      plugins: [{ name: "entry", resolveId: (id) => (id === "entry" ? id : null), load: (id) => (id === "entry" ? code : null) }],
    });
    const { output } = await build.generate({ format: "esm" });
    return output.map((chunk) => ("code" in chunk ? chunk.code : "")).join("\n");
  };
  const at = (file: string) => JSON.stringify(new URL("../" + file, import.meta.url).pathname);
  const dom = await bundle(`export { _tpl, _attrValue, _on } from ${at("dom.ts")};`);
  assert.match(dom, /function _attrValue/);
  assert.doesNotMatch(dom, /function _spread\b/);
  const server = await bundle(`export { compiledTemplate, attribute, renderToString } from ${at("server.ts")};`);
  assert.match(server, /function attribute/);
  assert.doesNotMatch(server, /spreadAttributes/);
  const resume = await bundle(`export { createResume } from ${at("dom-resume.ts")};`);
  assert.doesNotMatch(resume, /function _spread\b/);
  assert.match(await bundle(`export { _spread } from ${at("dom.ts")};`), /function _spread\b/);
});
