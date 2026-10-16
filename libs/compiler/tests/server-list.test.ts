import { test } from "vitest";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { compile } from "../index.ts";
import { NodeStreamWriter } from "../../runtime/node.ts";

// Differential harness: every scenario renders with list mounts on and off and must agree on
// output, write boundaries (string writers), author-visible evaluation order and errors.
let serial = 0;
/** Namespace of a compiled fixture module (dynamic `data:` import). */
type Module = Record<string, any>;
type Settled = { value?: any; error?: string };
type Row = {
  id: number | string;
  a?: unknown;
  label?: unknown;
  cls?: unknown;
  href?: unknown;
  hidden?: unknown;
  title?: unknown;
  b?: unknown;
  r?: unknown;
  child?: unknown;
  fail?: boolean;
};
const runtime = new URL("../../runtime/server.ts", import.meta.url).href;
async function load(source: string, lists: boolean) {
  const result = compile(source, { target: "server", filename: "lists.tsx", serverListMounts: lists });
  assert.deepEqual(result.diagnostics, []);
  const code = result.code
    .replaceAll("@rivetjs/runtime/server", runtime)
    .replaceAll("@rivetjs/runtime/slot", runtime.replace("server.ts", "slot.ts"))
    .replaceAll("@rivetjs/runtime/style", runtime.replace("server.ts", "style.ts"));
  return { code: result.code, module: await import("data:text/javascript," + encodeURIComponent(code + `\n// ${serial++}`)) };
}
async function both(source: string) {
  const [plain, lists] = [await load(source, false), await load(source, true)];
  assert.doesNotMatch(plain.code, /__rivetList\(/);
  return { plain, lists };
}
const settle = async (run: () => unknown): Promise<Settled> => {
  try {
    return { value: await run() };
  } catch (error) {
    return { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
};
// String writer that suspends on every write, recording each chunk.
const slowStrings = (chunks: string[]) => ({
  write(chunk: string) {
    chunks.push(chunk);
    return new Promise((r) => setImmediate(r));
  },
});
// Byte writer into a sink that applies backpressure on every write.
function bytes(maxBuffered: number) {
  let html = "";
  const sink = new Writable({
    highWaterMark: 1,
    write(chunk, _encoding, done) {
      html += chunk.toString();
      setImmediate(done);
    },
  });
  return { writer: new NodeStreamWriter(sink, { threshold: 64, maxBuffered }), html: () => html, ended: () => new Promise((r) => sink.end(r)) };
}
async function lanes(module: Module, make: () => unknown) {
  const out: Record<string, any> = {};
  module.log.length = 0;
  out.string = await settle(() => module.renderToString(make()));
  out.stringLog = [...module.log];
  module.log.length = 0;
  const chunks: string[] = [];
  out.writer = await settle(() => module.renderToWriter(make(), slowStrings(chunks)));
  out.chunks = chunks;
  for (const maxBuffered of [0, 1 << 20]) {
    module.log.length = 0;
    const b = bytes(maxBuffered);
    const result = await settle(async () => {
      await module.renderToWriter(make(), b.writer);
      await b.writer.finish();
      await b.ended();
    });
    out["bytes" + maxBuffered] = { ...result, html: result.error ? undefined : b.html(), log: [...module.log] };
  }
  return out;
}

const source = `import { renderToString, renderToWriter } from '@rivetjs/runtime/server';
export { renderToString, renderToWriter };
export const log = [];
const t = (tag, value) => (log.push(tag), value);
export const em = (x) => <em>{x}</em>;
function Item({ item, index = -1, label: text }) {
  log.push('item:' + item.id);
  if (item.fail) throw new Error('fail ' + item.id);
  return <li data-id={item.id} className={item.cls} href={item.href} hidden={item.hidden}>{t('a' + item.id, item.a)}{item.child}<b>{text}</b>{index}</li>;
}
export const component = (items) => <ul>{items.map((item, i) => <Item label={t('label' + item.id, item.label)} item={item} index={i} />)}</ul>;
export const inline = (items) => <ul>{items.map((item, i) => <li data-n={i} title={t('title', item.title)}>{item.a}<i>{item.b}</i></li>)}</ul>;
export const svg = (items) => <svg>{items.map((item) => <circle r={item.r} />)}</svg>;
export const nested = (groups) => <section>{groups.map((group) => <ol data-g={group.id}>{group.items.map((item) => <Item item={item} label="n" />)}</ol>)}</section>;
`;

const hostile = "<&>\"'😀\ud800";
const rows = (): Row[] => [
  { id: 1, a: 1, label: hostile, cls: "c", href: "/x?a=1&b=2", hidden: false, title: hostile, b: null, r: 2 },
  { id: "2<", a: -0, label: 0, cls: undefined, href: null, hidden: true, title: 1e21, b: true, r: -1.5 },
  { id: 3, a: NaN, label: "", cls: { toString: () => "coerced" }, href: undefined, hidden: "", title: undefined, b: false, r: 2 ** 53 },
  { id: 4, a: hostile, child: null, label: undefined, cls: 7, hidden: 0, title: "", b: Infinity, r: undefined },
];

test("list mounts match per-row records across writers and value kinds", async () => {
  const { plain, lists } = await both(source);
  assert.match(lists.code, /function Item__rivetTape\(/);
  for (const name of ["component", "inline", "svg"])
    assert.deepEqual(await lanes(lists.module, () => lists.module[name](rows())), await lanes(plain.module, () => plain.module[name](rows())), name);
  // Nested JSX children, async children and thenable attributes take the generic slot path.
  const rich = (module: Module) => () => {
    const items = rows();
    items[0].child = module.em(hostile);
    items[1].child = Promise.resolve("async<");
    items[2].cls = Promise.resolve("later");
    items[3].child = [module.em(1), "x"];
    return module.component(items);
  };
  assert.deepEqual(await lanes(lists.module, rich(lists.module)), await lanes(plain.module, rich(plain.module)));
  const nested = (module: Module) => () =>
    module.nested([
      { id: 1, items: rows() },
      { id: 2, items: [] },
      { id: 3, items: rows().slice(1) },
    ]);
  const expected = await lanes(plain.module, nested(plain.module));
  assert.deepEqual(await lanes(lists.module, nested(lists.module)), expected);
  assert.match(expected.string.value, /<ol data-g="3"><li data-id="2&lt;"/);
});

test("list mounts keep eager evaluation: every row runs before output, in author order", async () => {
  const { plain, lists } = await both(source);
  for (const { module } of [plain, lists]) {
    const items = rows();
    items[2].fail = true;
    module.log.length = 0;
    assert.throws(() => module.component(items), /fail 3/);
    // Rows after the failing one never ran; every earlier row ran fully.
    assert.deepEqual(
      module.log.filter((entry: string) => entry.startsWith("item:")),
      ["item:1", "item:2<", "item:3"],
    );
  }
  const order = async (module: Module) => {
    module.log.length = 0;
    module.component(rows());
    return [...module.log];
  };
  const expected = await order(plain.module);
  assert.deepEqual(expected.slice(0, 3), ["label1", "item:1", "a1"]);
  assert.deepEqual(await order(lists.module), expected);
});

test("list mounts mirror intrinsic map observations, holes, mutation and fallbacks", async () => {
  const { plain, lists } = await both(source);
  const traced = (log: string[]) => (items: Row[]) =>
    new Proxy(items, {
      get(target, key, receiver) {
        log.push("get:" + String(key));
        return Reflect.get(target, key, receiver);
      },
      has(target, key) {
        log.push("has:" + String(key));
        return Reflect.has(target, key);
      },
    });
  class Rows extends Array {}
  const cases: Record<string, (module: Module) => unknown> = {
    proxy: (module) => traced(module.log)(rows()),
    holes: () => {
      const items = rows();
      delete items[1];
      items.length = 6;
      return items;
    },
    growing: () => {
      const items = rows();
      Object.defineProperty(items[0], "a", {
        get() {
          items.push({ id: 9, a: 9 });
          return 1;
        },
      });
      return items;
    },
    shrinking: () => {
      const items = rows();
      Object.defineProperty(items[0], "a", {
        get() {
          items.length = 2;
          return 1;
        },
      });
      return items;
    },
    subclass: () => Rows.from(rows()),
    species: () => {
      const items = rows();
      (items as { constructor: unknown }).constructor = { [Symbol.species]: Rows };
      return items;
    },
    nullSpecies: () => {
      const items = rows();
      (items as { constructor: unknown }).constructor = { [Symbol.species]: null };
      return items;
    },
    badSpecies: () => {
      const items = rows();
      (items as { constructor: unknown }).constructor = 1;
      return items;
    },
    custom: (module) => ({
      map(callback: (row: Row, index: number) => unknown) {
        module.log.push("custom map");
        return [callback({ id: "c", a: "custom" }, 0)];
      },
    }),
    noMap: () => ({}),
    lengthGetter: (module) => {
      const items = rows();
      return new Proxy(items, {
        get(target, key) {
          if (key === "length") {
            module.log.push("length");
            return { valueOf: () => (module.log.push("valueOf"), 2) };
          }
          return target[key as keyof typeof target];
        },
      });
    },
    empty: () => [],
  };
  for (const [name, make] of Object.entries(cases)) {
    const run = async ({ module }: { module: Module }) => {
      module.log.length = 0;
      const result = await settle(() => module.renderToString(module.component(make(module))));
      return { ...result, log: [...module.log] };
    };
    const [actual, expected] = [await run(lists), await run(plain)];
    // Engine error messages name the original call expression; the error type must match.
    if (name === "badSpecies" || name === "noMap") {
      assert.match(actual.error!, /^TypeError: /);
      assert.match(expected.error!, /^TypeError: /);
      actual.error = expected.error;
    }
    assert.deepEqual(actual, expected, name);
  }
});

test("list mounts neutralize unsafe URLs and abort at the same position", async () => {
  const { plain, lists } = await both(source);
  const seen = new Map();
  for (const { module } of [plain, lists]) {
    const items = rows();
    items[2].href = " javascript:alert(1)";
    const chunks: string[] = [];
    await module.renderToWriter(module.component(items), slowStrings(chunks));
    assert.match(chunks.join(""), /href="about:invalid#rivet"/);
    seen.set(module, { chunks });
  }
  assert.deepEqual(seen.get(lists.module).chunks, seen.get(plain.module).chunks);
  for (const { module } of [plain, lists]) {
    const controller = new AbortController();
    let writes = 0;
    const writer = {
      write() {
        if (++writes === 3) controller.abort(new Error("stop"));
        return Promise.resolve();
      },
    };
    await assert.rejects(module.renderToWriter(module.inline(rows()), writer, { signal: controller.signal }), /stop/);
    seen.get(module).writes = writes;
  }
  assert.equal(seen.get(lists.module).writes, seen.get(plain.module).writes);
});

test("list mounts admit async siblings before earlier output fails", async () => {
  const { plain, lists } = await both(source);
  for (const { module } of [plain, lists]) {
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", listener);
    const items = rows();
    items[0].href = {
      toString() {
        throw new TypeError("bad href");
      },
    };
    items[3].child = Promise.reject(new Error("late"));
    await assert.rejects(module.renderToString(module.component(items)), /bad href/);
    await new Promise((r) => setImmediate(r));
    process.off("unhandledRejection", listener);
    assert.deepEqual(unhandled, []);
  }
});

test("only eligible list sites and components are lowered", () => {
  const lowered = (body: string, extra = "") => compile(`${extra}\nexport const f = (xs) => ${body};`, { filename: "x.tsx" }).code;
  const C = (fn: string) => `function C(${fn}`;
  const eligible = [
    [`<ul>{xs.map(x => <li>{x}</li>)}</ul>`],
    [`<ul>{(xs.map((x, i) => (<li>{i}</li>)))}</ul>`],
    [`<ul>{xs.map(x => <C a={x} />)}</ul>`, `${C("{ a }) { return <li>{a}</li>; }")}`],
    [`<ul>{xs.map(x => <C a={x} />)}</ul>`, `${C("props) { const g = () => { return props.a; }; return <li>{g()}</li>; }")}`],
    [`<ul>{xs.map(x => <C a={x} />)}</ul>`, `${C("{ a }) { function inner() { return this; } return <li>{a}</li>; }")}`],
  ];
  for (const [body, extra] of eligible) assert.match(lowered(body, extra), /__rivetList\(/, body + extra);
  const ineligible = [
    [`<ul>{xs?.map(x => <li>{x}</li>)}</ul>`],
    [`<ul>{xs.map?.(x => <li>{x}</li>)}</ul>`],
    [`<ul>{xs.map(function (x) { return <li>{x}</li>; })}</ul>`],
    [`<ul>{xs.map(x => { return <li>{x}</li>; })}</ul>`],
    [`<ul>{xs.map((x, i, all) => <li>{x}</li>)}</ul>`],
    [`<ul>{xs.map(({ a }) => <li>{a}</li>)}</ul>`],
    [`<ul>{xs.map(x => <li>{x}</li>, self)}</ul>`],
    [`<ul>{xs.map(async x => <li>{x}</li>)}</ul>`],
    [`<ul>{xs.map(x => <>{x}</>)}</ul>`],
    [`<>{xs.map(x => <li>{x}</li>)}</>`],
    [`<ul>{xs.map(x => <input model:value={x.v} />)}</ul>`],
    [`<ul>{xs.map(x => <C {...x} />)}</ul>`, C("{ a }) { return <li>{a}</li>; }")],
    [`<ul>{xs.map(x => <C a={x} />)}</ul>`, C("{ a }) { if (a) return null; return <li>{a}</li>; }")],
    [`<ul>{xs.map(x => <C a={x} />)}</ul>`, C("{ a }) { return <D />; }") + " function D() { return <i />; }"],
    [`<ul>{xs.map(x => <C a={x} />)}</ul>`, C("{ a }) { return <li>{this}</li>; }")],
    [`<ul>{xs.map(x => <C a={x} />)}</ul>`, C("{ a }) { const f = () => arguments; return <li>{a}</li>; }")],
    [`<ul>{xs.map(x => <C a={x} />)}</ul>`, `async ${C("{ a }) { return <li>{a}</li>; }")}`],
    [`<ul>{xs.map(x => <C a={x} />)}</ul>`, `${C("{ a }) { return <li>{a}</li>; }")} C = () => null;`],
    [`<ul>{xs.map(x => <C a={x} />)}</ul>`, `const C = ({ a }) => <li>{a}</li>;`],
  ];
  for (const [body, extra = ""] of ineligible) assert.doesNotMatch(lowered(body, extra), /__rivetList\(/, body + extra);
});

test("positional props evaluate every authored prop in source order", async () => {
  const src = `import { renderToString } from '@rivetjs/runtime/server';
  export { renderToString };
  export const log = [];
  const t = (tag, value) => (log.push(tag), value);
  function C({ b, a: renamed = 'dflt', missing = 'm' }) { log.push('body'); return <p data-a={renamed}>{b}{missing}</p>; }
  function Kids({ children, x }) { return <div>{x}{children}</div>; }
  export const f = (xs) => <main>{xs.map((x) => <C a={t('a', x.a)} extra={t('extra', 1)} b={t('b', x.b)} />)}</main>;
  export const g = (xs) => <main>{xs.map((x) => <Kids x={x.b}><i>{t('kid', x.a)}</i>text</Kids>)}</main>;`;
  const { plain, lists } = await both(src);
  assert.match(lists.code, /function C__rivetTape\(__rivetTape, __rivetBase, b, renamed = ["']dflt["'], missing = ["']m["']\)/);
  for (const name of ["f", "g"]) {
    const run = ({ module }: { module: Module }) => {
      module.log.length = 0;
      const html = module.renderToString(module[name]([{ a: 1, b: "<" }, { b: 2 }, { a: undefined, b: null }]));
      return { html, log: [...module.log] };
    };
    assert.deepEqual(run(lists), run(plain), name);
  }
  assert.deepEqual(run0(plain), ["a", "extra", "b", "body"]);
  function run0({ module }: { module: Module }) {
    module.log.length = 0;
    module.f([{ a: 1, b: 2 }]);
    return [...module.log];
  }
});

const nestedSource = `import { renderToString, renderToWriter } from '@rivetjs/runtime/server';
export { renderToString, renderToWriter };
export const log = [];
const t = (tag, value) => (log.push(tag), value);
function Badge({ n, tone = 'plain' }) { log.push('badge:' + n); return <span data-tone={tone}>{t('n' + n, n)}</span>; }
function Pair({ a, b }) { log.push('pair'); return <em><Badge n={a} tone={t('tone', 'hot')} />{t('mid', '|')}<Badge n={b} /></em>; }
function Early({ x }) { if (x == null) return null; return <q>{x}</q>; }
function Tree({ depth }) { log.push('tree:' + depth); return <div>{depth}{depth > 0 ? Tree({ depth: depth - 1 }) : null}<Tree2 depth={depth} /></div>; }
function Tree2({ depth }) { return <s>{depth}{depth > 1 ? <Tree depth={depth - 2} /> : null}<Leaf /></s>; }
function Leaf() { return <i>leaf</i>; }
function Self({ n }) { return <b>{n > 0 ? <Self n={n - 1} /> : 'end'}</b>; }
function Wrap({ children, label }) { return <section aria-label={label}><Badge n={label} />{children}</section>; }
function Row({ row }) { log.push('row:' + row.id); return <li data-id={row.id}><Pair b={t('b', row.b)} a={t('a', row.a)} /><Early x={row.x} /><Wrap label={row.id}><Badge n={row.b} /></Wrap><Leaf />{row.tail}</li>; }
export const rows = (items) => <ul>{items.map((row) => <Row row={row} />)}</ul>;
export const inline = (items) => <ol>{items.map((row) => <li><Badge n={row.a} /><Pair a={row.a} b={row.b} /></li>)}</ol>;
export const trees = (items) => <main>{items.map((d) => <Tree depth={d} />)}{items.map((d) => <Self n={d} />)}</main>;
`;

test("nested components flatten into row plans with identical output, order and chunks", async () => {
  const { plain, lists } = await both(nestedSource);
  // Row's children are spliced into its plan; Badge/Pair/Leaf twins are called in place.
  assert.match(lists.code, /function Row__rivetTape\([^)]*\) \{[^]*?Pair__rivetTape\(/);
  assert.doesNotMatch(lists.code.slice(lists.code.indexOf("function Row__rivetTape")), /^\s*return/m);
  const data = () => [
    { id: 1, a: 1, b: "<b>", x: "q&", tail: "t" },
    { id: '2"', a: -0, b: null, x: null, tail: Promise.resolve("async") },
    { id: 3, a: hostile, b: 3, x: 0, tail: undefined },
  ];
  for (const name of ["rows", "inline"])
    assert.deepEqual(await lanes(lists.module, () => lists.module[name](data())), await lanes(plain.module, () => plain.module[name](data())), name);
  assert.deepEqual(await lanes(lists.module, () => lists.module.trees([0, 1, 3, 4])), await lanes(plain.module, () => plain.module.trees([0, 1, 3, 4])));
});

// U1: walk_server writes no `omitted()` slot for arrow / function literal handlers and refs (S6);
// the list plan width must agree (was RV9001 "list plan width mismatch").
const handlerSource = `import { renderToString, renderToWriter } from '@rivetjs/runtime/server';
export { renderToString, renderToWriter };
export const log = [];
const onKey = () => log.push('key');
function Btn({ id }) { return <button type="button" onClick={() => log.push(id)} ref={(el) => el} onKeyDown={onKey}>{id}</button>; }
export const arrows = (xs) => <ul>{xs.map((x) => <li onClick={() => log.push(x.id)} ref={(el) => el} data-id={x.id} onMouseEnter={function () { log.push('fn'); }}>{x.label}</li>)}</ul>;
export const mixed = (xs) => <ul>{xs.map((x) => <li onClick={onKey} onKeyDown={() => 0} title={x.label}><Btn id={x.id} /></li>)}</ul>;
export const globals = (xs) => <ol>{xs.map((x) => <li window:onResize={() => 0} document:onKeyDown={onKey}>{x.id}</li>)}</ol>;
`;

test("list mounts accept arrow / function literal handlers and refs on rows and twins", async () => {
  const { plain, lists } = await both(handlerSource);
  assert.match(lists.code, /__rivetList\(/);
  const data = () => [
    { id: 1, label: hostile },
    { id: "2<", label: 0 },
  ];
  for (const name of ["arrows", "mixed", "globals"])
    assert.deepEqual(await lanes(lists.module, () => lists.module[name](data())), await lanes(plain.module, () => plain.module[name](data())), name);
});

test("list mount rows with class / style groups lower and match per-row records", async () => {
  // Regression: `style={…}` in a list row failed the build (RV9001 list plan width mismatch): the width scan
  // skipped `style` while the row wrote a `_styleAttr` slot, and class/style groups count one slot each.
  const src = `import { renderToString } from '@rivetjs/runtime/server';
  export { renderToString };
  export const A = ({ rows }) => <ul>{rows.map((r) => <li style={{ color: r.c }}>{r.n}</li>)}</ul>;
  export const B = ({ rows, s }) => <ul>{rows.map((r) => <li style={s} data-n={r.n}>{r.n}</li>)}</ul>;
  export const C = ({ rows }) => <ul>{rows.map((r) => <li class="row" class:on={r.on} style={{ color: r.c, margin: 0 }} style:width={r.w}>{r.n}</li>)}</ul>;
  export const D = ({ rows }) => <ul>{rows.map((r) => <li class={r.k} class:on={r.on} title={r.n}>{r.n}</li>)}</ul>;
  export const E = ({ rows }) => <ul>{rows.map((r) => <li style={{ color: "red" }}>{r.n}</li>)}</ul>;`;
  const { plain, lists } = await both(src);
  assert.equal((lists.code.match(/__rivetList\(/g) ?? []).length, 5);
  const rows = [
    { n: "a", c: "red", on: true, w: "1px", k: "x" },
    { n: "<b>", c: undefined, on: false, w: null, k: undefined },
    { n: 3, c: "url(x)", on: 1, w: 0, k: ["p", { q: true }] },
  ];
  for (const name of ["A", "B", "C", "D", "E"]) {
    const expected = plain.module.renderToString(plain.module[name]({ rows, s: { color: "blue", "--x": 1 } }));
    assert.equal(lists.module.renderToString(lists.module[name]({ rows, s: { color: "blue", "--x": 1 } })), expected, name);
  }
});
