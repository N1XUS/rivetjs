import { test } from "vitest";
import assert from "node:assert/strict";
import { check, compile } from "../index.ts";

const UNSAFE_URL =
  "Unsafe URL attribute: javascript: / vbscript: URLs and data: URLs (except image / video / audio data on media elements) are rejected; use an http(s), relative or mailto: URL, or an event handler";

const squash = (code: string) => code.replace(/\s+/g, " ");
const both = (source: string, options: Record<string, unknown> = {}) => {
  const dom = compile(source, { target: "dom", filename: "a.tsx", ...options });
  const server = compile(source, { target: "server", filename: "a.tsx", ...options });
  assert.deepEqual(dom.diagnostics, []);
  assert.deepEqual(server.diagnostics, []);
  return { dom: squash(dom.code), server: squash(server.code) };
};

test("component spread: one props object in source order, both targets", () => {
  const { dom, server } = both(
    `function C(p: any) { return <i>{p.a}</i>; }\nexport const f = (rest: object, x: () => number) => <C a={1} {...rest} b={x()}>hi</C>;`,
  );
  // DOM: live props — spreads merge through `_spreadProps` (object-spread semantics, source order), dynamic props stay getters.
  assert.match(
    dom,
    /__rivetPropsGetter\(o, "b", 0\); o\["children"\] = "hi";[\s\S]*__rivet_c\(C, __rivetSpreadProps\(\{ "a": 1 \}, rest, __rivetProps\d+\(\(\) => x\(\)\)\)\)/,
  );
  assert.match(dom, /import \{ _p as __rivetPropsObject, _pg as __rivetPropsGetter, _spreadProps as __rivetSpreadProps \} from "@rivetjs\/runtime\/props";/);
  assert.match(server, /C\(\{ "a": 1, \.\.\.rest, "b": x\(\), children: "hi" \}\)/);
  assert.doesNotMatch(dom + server, /spreadAttributes/);
});

test("component spread keeps r:slot lowering", () => {
  const { dom } = both(`function C(p: any) { return <i>{p.header?.()}</i>; }\nexport const f = (rest: object) => <C {...rest}><b r:slot="header">h</b></C>;`);
  assert.match(dom, /__rivetSpreadProps\(rest, \{ "header": \(\) => /);
});

test("element spread: plain attributes merge into one object; events, refs and models keep their bindings", () => {
  const { dom, server } = both(
    `export const f = (attrs: object, id: () => string, go: () => void) => { let el; return <a class="a" {...attrs} href={id()} disabled onClick={go} ref={(e) => (el = e)}>x</a>; };`,
  );
  // IMPL-SPREAD F1 (DOM only): attributes after the last spread are template text / one `_attrs` binding, excluded from the spread.
  assert.match(dom, /__rivet_tplNs\("<a disabled>x<\/a>"\)/);
  assert.match(dom, /__rivet_on\(_el\$1, "click", go\); __rivet_ref\(_el\$1, \(e\) => el = e\);/);
  assert.match(
    dom,
    /__rivet_spread\(_el\$1, \(\) => \(\{ "class": "a", \.\.\.attrs \}\), 0, null, "href disabled ref"\); __rivet_attrs\(_el\$1, \(\) => \[id\(\)\], "href"\);/,
  );
  assert.match(dom, /import \{[^}]*_spread as __rivet_spread[^}]*\} from "@rivetjs\/runtime\/dom"/);
  assert.match(server, /__rivetSpreadAttributes\(\{ "class": "a", \.\.\.attrs, "href": id\(\), "disabled": true, "ref": void 0 \}, "a"\)/);
  assert.match(server, /import \{[^}]*spreadAttributes as __rivetSpreadAttributes[^}]*\} from "@rivetjs\/runtime\/server"/);
  // SVG namespace is passed; HTML needs none (media sources are decided per tag at runtime).
  assert.match(both(`export const f = (p: object) => <svg><circle {...p} /></svg>;`).server, /\.\.\.p \}, "circle", "svg"\)/);
});

test("element spread: static attributes keep compile-time checks; spread children stay unsupported", () => {
  const messages = (source: string) => compile(source, { target: "server", filename: "a.tsx" }).diagnostics.map((d) => d.message);
  assert.deepEqual(messages(`export const f = (p: object) => <a href="javascript:x" {...p}>x</a>;`), [UNSAFE_URL]);
  assert.deepEqual(messages(`export const f = (p: object) => <div innerHTML="x" {...p} />;`), ["Unsafe or unsupported native attribute: innerHTML"]);
  assert.deepEqual(messages(`export const f = (p: any[]) => <div {...p}>{...p}</div>;`), [
    "Spread children are not supported: render the array as one child ({items}) or map it ({items.map((x) => <li>{x}</li>)} / <For each={items} by={…}>)",
  ]);
});

test("zero cost: no spread, no helper import and unchanged output", () => {
  const source = `export const f = (t: () => string) => <div class="a" title={t()}>x</div>;`;
  for (const target of ["dom", "server"] as const) {
    const code = compile(source, { target, filename: "a.tsx" }).code;
    assert.doesNotMatch(code, /spread/i, target);
  }
  const resumed = compile(`import { signal } from "@rivetjs/reactivity";\nexport function P() { const s = signal(1); return <p title={s()}>x</p>; }`, {
    target: "server",
    filename: "a.tsx",
    resume: { module: "m" },
  }).code;
  assert.doesNotMatch(resumed, /spread/i);
});

test("resume: a spread element is one spread site; its symbol rebuilds the merged object and binds the element", () => {
  const source = `import { signal } from "@rivetjs/reactivity";\nexport function P(props: { attrs: object }) { const on = signal(true); return <div class="a" {...props.attrs} title={on() ? "y" : "n"} onClick={() => on.set(!on())}>x</div>; }`;
  const server = compile(source, { target: "server", filename: "a.tsx", resume: { module: "m" } }) as unknown as {
    code: string;
    symbols: { id: string; kind: string; source: string; imports: unknown[]; captures: string[] }[];
  };
  assert.deepEqual(server.symbols.map((s) => s.kind).sort(), ["event", "spread"]);
  const spread = server.symbols.find((s) => s.kind === "spread")!;
  assert.deepEqual(spread.captures, ["props$attrs", "on"]);
  assert.equal(
    spread.source,
    'export const P$t9z = (props$attrs, on) => { const props = __rivetMembers({ attrs: props$attrs }); return (__rivetEl, __rivetNames) => __rivetResumeSpread(__rivetEl, () => ({ "class": "a", ...(props.attrs), "title": (on() ? "y" : "n") }), 0, __rivetNames); };\n',
  );
  assert.deepEqual(spread.imports, [
    { local: "__rivetResumeSpread", imported: "_spread", from: "@rivetjs/runtime/dom" },
    { local: "__rivetMembers", imported: "_members", from: "@rivetjs/runtime/props" },
  ]);
  assert.match(
    squash(server.code),
    /__rivetR_spread\("m#P\$\w+", \(\) => \(\{ "class": "a", \.\.\.props\.attrs, "title": on\(\) \? "y" : "n" \}\), \[__rivetR_member\(props, "attrs"\), on\], "div"\), __rivetR_id\(\)/,
  );
  const sites = check(source, { filename: "a.tsx", resume: { module: "m" } }).sites;
  assert.equal(sites.find((s) => s.kind === "spread")?.runsOn, "both");
});

test("spread children: a native element without JSX children renders the merged object's children (both targets)", () => {
  const { dom, server } = both(`export const f = (p: object, t: () => string) => <div class="a" {...p} title={t()} />;`);
  assert.match(server, /\[ "<div", ">", "<\/div>" \]/);
  assert.match(server, /__rivetSpreadAttributes\(\{ "class": "a", \.\.\.p, "title": t\(\) \}, "div"\), __rivetSpreadChildren\(\)\]/);
  assert.match(server, /import \{[^}]*spreadChildren as __rivetSpreadChildren[^}]*\} from "@rivetjs\/runtime\/server"/);
  // DOM: one tracked object; content flag `1` renders its `children` as the element's content.
  assert.match(dom, /__rivet_tpl\("<div>"\)/);
  assert.match(
    dom,
    /__rivet_spread\(_el\$1, \(\) => \(\{ "class": "a", \.\.\.p \}\), 1, null, "title"\); __rivet_attrs\(_el\$1, \(\) => \[t\(\)\], "title"\);/,
  );
  assert.doesNotMatch(dom, /spreadChildren/);
  // Whitespace-only text and empty expressions are no children; `children` as a plain attribute merges too.
  for (const body of ["<p {...p}>\n  </p>", "<p {...p}>{/* none */}</p>", '<p {...p} children="x"></p>'])
    assert.match(both(`export const f = (p: object) => ${body};`).server, /__rivetSpreadChildren\(\)/, body);
});

test("spread children: explicit JSX children win; void elements and title take no spread content (textarea: spread-style-textarea.test.ts)", () => {
  for (const body of [
    "<p {...p}>x</p>",
    "<p {...p}> </p>",
    "<p {...p}>{undefined}</p>",
    "<p {...p}><b /></p>",
    "<img {...p} />",
    "<input {...p} />",
    "<title {...p} />",
  ]) {
    const { dom, server } = both(`export const f = (p: object) => ${body};`);
    assert.doesNotMatch(server, /spreadChildren/, body);
    // A lone identifier spread passes the object uncopied (flag 2: live-props getters stay live).
    assert.match(dom, /__rivet_spread\(_el\$1, p, 2\);/, body);
  }
});

test("spread children: components get children through the props object unless JSX children are present", () => {
  const source = (body: string) => `function C(p: any) { return <i>{p.children}</i>; }\nexport const f = (p: object) => ${body};`;
  const passthrough = both(source("<C {...p} />"));
  assert.match(passthrough.server, /C\(\{ \.\.\.p \}\)/);
  // A lone member-chain spread passes the props object through (live: no copy); `undefined` / `null` → `{}`.
  assert.match(passthrough.dom, /__rivet_c\(C, p \|\| \{\}\)/);
  const explicit = both(source("<C {...p}>x</C>"));
  assert.match(explicit.server, /C\(\{ \.\.\.p, children: "x" \}\)/);
  assert.match(explicit.dom, /__rivet_c\(C, __rivetSpreadProps\(p, \{ children: "x" \}\)\)/);
});

test("spread children: zero cost for elements without spreads and elements with explicit children", () => {
  for (const source of [`export const f = (t: () => string) => <div title={t()} />;`, `export const f = (p: object) => <div {...p}>x</div>;`])
    for (const target of ["dom", "server"] as const)
      assert.doesNotMatch(compile(source, { target, filename: "a.tsx" }).code, /spreadChildren|\}\)?, 1\)/, target);
});

test("spread children, resume: the spread site's symbol renders the content; the server slot follows the element id", () => {
  const source = `import { signal } from "@rivetjs/reactivity";\nexport function P() { const n = signal(1); return <div {...{ children: n() }} />; }`;
  const server = compile(source, { target: "server", filename: "a.tsx", resume: { module: "m" } }) as unknown as {
    code: string;
    symbols: { kind: string; source: string }[];
  };
  assert.match(
    squash(server.code),
    /__rivetR_spread\("m#P\$\w+", \(\) => \(\{ \.\.\.\{ children: n\(\) \} \}\), \[n\], "div"\), __rivetR_id\(\), __rivetSpreadChildren\(\) \]/,
  );
  assert.equal(
    server.symbols.find((s) => s.kind === "spread")!.source,
    "export const P$4n1 = (n) => (__rivetEl, __rivetNames) => __rivetResumeSpread(__rivetEl, () => ({ ...({ children: n() }) }), 1, __rivetNames);\n",
  );
  const explicit = compile(source.replace("/>;", ">x</div>;"), { target: "server", filename: "a.tsx", resume: { module: "m" } }) as unknown as {
    code: string;
    symbols: { kind: string; source: string }[];
  };
  assert.doesNotMatch(explicit.code, /spreadChildren/);
  assert.match(explicit.symbols.find((s) => s.kind === "spread")!.source, /__rivetNames\);\n$/);
});

test("live props: values reading `this` / `arguments` stay data properties (a getter would rebind them)", () => {
  const { dom } = both(
    `function C(p: any) { return <i>{p.a}</i>; }\nexport class T { x = 1; v(...a: unknown[]) { return <C a={this.x} n={arguments[0]} m={a[0]} />; } }`,
  );
  // Data entries are factory arguments evaluated at the call site; only `m` is a slot getter.
  assert.match(dom, /o\["a"\] = a0; o\["n"\] = a1; __rivetPropsGetter\(o, "m", 0\);/);
  assert.match(dom, /__rivet_c\(C, __rivetProps\d+\(\(\) => a\[0\], this\.x, arguments\[0\]\)\)/);
});
