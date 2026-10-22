import { test } from "vitest";
import assert from "node:assert/strict";
import * as compiler from "@rivetjs/compiler";
import { renderToString } from "@rivetjs/runtime/server";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { createRenderCache, withRenderCache, cached, shell, _cached } from "@rivetjs/runtime/server-cache";
import type { RenderCacheScope } from "@rivetjs/runtime/server-cache";
import { compileResume, importServer } from "./resume/compile.ts";

type Render = Parameters<typeof renderToString>[0];
type Component = (props: Record<string, unknown>) => Render;
const html = (value: unknown, variant = 0) => renderToString(value as Render, { variant }) as string;

// Plain server compile (no resume) of a module; returns its exports.
async function serverModule(source: string): Promise<Record<string, Component & Record<string, unknown>>> {
  const result = compiler.compile(source, { target: "server", filename: "cache-fixture.tsx" });
  if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  return importServer(result.code);
}

const source = `
export let calls = 0;
export let mutable = 0;
export const bump = () => mutable++;
const NAV = [{ href: "/a", label: "A & B" }, { href: "/b", label: "<B>" }];
export function Header(props) {
  calls++;
  return <header class="top"><h1>{props.title}</h1><nav>{NAV.map((l) => <a href={l.href}>{l.label}</a>)}</nav><p>{props.items.join(",")}</p></header>;
}
export function Impure(props) { return <p>{props.x}:{mutable}</p>; }
export function Layout(props) {
  calls++;
  return <div class="layout"><Header title={props.title} items={[]} /><main>{props.children}</main><aside>{props.aside}</aside><footer>(c)</footer></div>;
}
export function Twice(props) { return <div>{props.children}{props.children}</div>; }
export function Page(props) {
  return <section><p>{props.body}</p></section>;
}
`;

const scopeOf = (extra: Partial<RenderCacheScope> = {}): RenderCacheScope => ({ cache: createRenderCache({ admit: "first", verify: false }), ...extra });

test("no scope: the wrapper renders normally every time", async () => {
  const m = await serverModule(source);
  const Header = cached(m.Header);
  const counted = () => (m as unknown as { calls: number }).calls;
  const start = counted();
  const a = html(Header({ title: "x", items: [1] }));
  const b = html(Header({ title: "x", items: [1] }));
  assert.equal(a, b);
  assert.equal(a, html(m.Header({ title: "x", items: [1] })));
  assert.equal(counted() - start, 3);
});

test("hits return the same frozen record; output byte-identical to an uncached render", async () => {
  const m = await serverModule(source);
  const Header = cached(m.Header, { id: "Header" });
  const scope = scopeOf();
  const reference = html(m.Header({ title: "Docs & co", items: ["a", "b"] }));
  const counted = () => (m as unknown as { calls: number }).calls;
  const start = counted();
  const outputs: string[] = [];
  const records: unknown[] = [];
  for (let i = 0; i < 4; i++)
    withRenderCache(scope, () => {
      const record = Header({ title: "Docs & co", items: ["a", "b"] });
      records.push(record);
      outputs.push(html(record));
    });
  assert.ok(outputs.every((out) => out === reference));
  assert.equal(counted() - start, 1, "one render for four requests");
  assert.equal(records[1], records[3], "hits share one record");
  assert.deepEqual({ hits: scope.cache.stats.hits, misses: scope.cache.stats.misses, entries: scope.cache.stats.entries }, { hits: 3, misses: 1, entries: 1 });
});

test("keys are injective: different props never share an entry", async () => {
  const m = await serverModule(source);
  const Header = cached(m.Header);
  const scope = scopeOf();
  const pairs: Record<string, unknown>[] = [
    { title: "1", items: ["2"] },
    { title: "12", items: [] },
    { title: "1", items: [2] },
    { title: "1", items: ["2", ""] },
    { title: 1, items: ["2"] },
  ];
  for (let round = 0; round < 2; round++) for (const props of pairs) withRenderCache(scope, () => assert.equal(html(Header(props)), html(m.Header(props))));
  assert.equal(scope.cache.stats.entries, pairs.length);
});

test("unkeyable props (functions, class instances, slots) bypass the cache", async () => {
  const m = await serverModule(source);
  const Header = cached(m.Header);
  const scope = scopeOf();
  withRenderCache(scope, () => {
    Header({ title: "x", items: [() => 1] });
    Header({ title: new (class Box {})(), items: [] });
  });
  assert.equal(scope.cache.stats.bypass, 2);
  assert.equal(scope.cache.stats.entries, 0);
});

test("variant and partition are part of the key", async () => {
  const m = await serverModule(source);
  const Header = cached(m.Header);
  const cache = createRenderCache({ admit: "first", verify: false });
  for (const scope of [{ cache }, { cache, variant: 1 }, { cache, partition: "tenant-b" }, { cache }])
    withRenderCache(scope, () => html(Header({ title: "t", items: [] })));
  assert.equal(cache.stats.entries, 3);
  assert.equal(cache.stats.hits, 1);
});

test("admission: a key is stored the second time it is seen", async () => {
  const m = await serverModule(source);
  const Header = cached(m.Header);
  const scope = { cache: createRenderCache({ verify: false }) };
  for (let i = 0; i < 3; i++) withRenderCache(scope, () => html(Header({ title: "t", items: [] })));
  assert.deepEqual([scope.cache.stats.misses, scope.cache.stats.stores, scope.cache.stats.hits], [2, 1, 1]);
  for (let i = 0; i < 50; i++) withRenderCache(scope, () => html(Header({ title: "unique " + i, items: [] })));
  assert.equal(scope.cache.stats.stores, 1, "one-off keys never displace entries");
});

test("bounded: entry and byte limits evict least recently used entries", async () => {
  const m = await serverModule(source);
  const Header = cached(m.Header);
  const scope = { cache: createRenderCache({ admit: "first", verify: false, maxEntries: 3 }) };
  for (const t of ["a", "b", "c"]) withRenderCache(scope, () => Header({ title: t, items: [] }));
  withRenderCache(scope, () => Header({ title: "a", items: [] })); // a used
  withRenderCache(scope, () => Header({ title: "d", items: [] })); // evicts b (oldest unused)
  assert.equal(scope.cache.stats.entries, 3);
  assert.equal(scope.cache.stats.evictions, 1);
  const hits = scope.cache.stats.hits;
  withRenderCache(scope, () => Header({ title: "a", items: [] }));
  withRenderCache(scope, () => Header({ title: "b", items: [] }));
  assert.equal(scope.cache.stats.hits - hits, 1, "a kept, b evicted");
  const small = { cache: createRenderCache({ admit: "first", verify: false, maxBytes: 2000 }) };
  for (let i = 0; i < 20; i++) withRenderCache(small, () => Header({ title: "t" + i, items: [] }));
  assert.ok(small.cache.stats.bytes <= 2000 && small.cache.stats.entries < 20);
});

test("ttl: an expired entry renders again", async () => {
  const m = await serverModule(source);
  const Header = cached(m.Header, { ttl: 1 });
  const scope = scopeOf();
  withRenderCache(scope, () => Header({ title: "t", items: [] }));
  const until = Date.now() + 3;
  while (Date.now() < until);
  withRenderCache(scope, () => Header({ title: "t", items: [] }));
  assert.equal(scope.cache.stats.misses, 2);
});

test("the CSP nonce is never stored; signals and async renders are never stored", async () => {
  const { signal } = await import("@rivetjs/reactivity");
  const { _trackReads } = await import("@rivetjs/reactivity/track");
  const nonce = "n0nceAbc123+/=";
  const scope = scopeOf({ nonce });
  const Leaky = cached(() => ["<p data-nonce=", nonce, ">"] as never);
  const s = signal(1);
  const Signal = cached(() => String(s()) as never, { id: "Signal" });
  const Async = cached(() => Promise.resolve("later") as never);
  withRenderCache(scope, () => {
    assert.match(html(Leaky({})), /n0nce/);
    const { signals } = _trackReads(() => html(Signal({})));
    assert.equal(signals.length, 1, "the enclosing tracker still sees the read");
  });
  const out = await withRenderCache(scope, () => renderToString(Async({}) as Render));
  assert.equal(out, "later");
  for (let i = 0; i < 2; i++) withRenderCache(scope, () => (html(Leaky({})), html(Signal({}))));
  assert.equal(scope.cache.stats.entries, 0);
});

test("dev verification: output depending on module state turns the wrapper off with a warning", async () => {
  const m = await serverModule(source);
  const Impure = cached(m.Impure, { id: "Impure" });
  const scope = { cache: createRenderCache({ admit: "first", verify: true }) };
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    withRenderCache(scope, () => html(Impure({ x: 1 })));
    (m.bump as unknown as () => void)();
    const out = withRenderCache(scope, () => html(Impure({ x: 1 })));
    assert.equal(out, html(m.Impure({ x: 1 })), "fresh output served");
    withRenderCache(scope, () => html(Impure({ x: 1 })));
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /Impure rendered different HTML/);
  assert.equal(scope.cache.stats.entries, 0);
});

test("shell: the layout renders once, each request splices its own children", async () => {
  const m = await serverModule(source);
  const Layout = shell(m.Layout, { holes: ["children", "aside"] });
  const scope = scopeOf();
  const { _slot } = await import("@rivetjs/runtime/slot");
  const counted = () => (m as unknown as { calls: number }).calls;
  const bodies = ["one <&>", "two", "three"];
  const propsOf = (body: string) => ({ title: "Docs", children: _slot(() => m.Page({ body })), aside: () => "side " + body });
  const expected = bodies.map((body) => html(m.Layout(propsOf(body))));
  const start = counted();
  bodies.forEach((body, i) =>
    assert.equal(
      withRenderCache(scope, () => html(Layout(propsOf(body)))),
      expected[i],
    ),
  );
  // Layout + its Header: two calls, once.
  assert.equal(counted() - start, 2);
  assert.equal(scope.cache.stats.hits, 2);
});

test("shell: a hole placed twice or inside the layout's own provider is not a shell", async () => {
  const m = await serverModule(source);
  const scope = { cache: createRenderCache({ admit: "first", verify: true }) };
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (message: string) => warnings.push(message);
  try {
    const Twice = shell(m.Twice);
    const out = withRenderCache(scope, () => html(Twice({ children: () => "x" })));
    assert.equal(out, "<div>xx</div>");
    const { createContext, useContext } = await import("@rivetjs/reactivity");
    const Theme = createContext("light");
    const { Provider } = await import("@rivetjs/runtime/server");
    const Provides = shell(
      (props: { children: () => unknown }) => ["<", Provider({ token: Theme, value: "dark", children: props.children as never })] as never,
    );
    const read = withRenderCache(scope, () => html(Provides({ children: () => useContext(Theme) })));
    assert.equal(read, "&lt;dark");
  } finally {
    console.warn = warn;
  }
  assert.equal(scope.cache.stats.entries, 0);
  assert.equal(warnings.length, 2);
});

const resumeSource = `
import { signal } from "@rivetjs/reactivity";
export function Static(props) { return <nav><a href={props.href}>{props.label}</a></nav>; }
export function Clicky(props) { return <button onClick={() => console.log(props.label)}>{props.label}</button>; }
export function App(props) {
  const n = signal(0);
  return <main>{props.top}<p>{n()}</p><button onClick={() => n.set(n() + 1)}>+</button>{props.bottom}</main>;
}
`;

test("resumable renders: inert fragments cache, ids stay unique, resume-active fragments never store", async () => {
  const m = await importServer<Record<string, Component>>(compileResume(resumeSource, "server").code);
  const manifest = { runtime: "/rt.js", symbols: new Proxy({}, { get: () => "/c.js" }) as Record<string, string> };
  const cache = createRenderCache({ admit: "first", verify: false });
  const Static = _cached(m.Static!, "fixture#Static");
  const Clicky = cached(m.Clicky!, { id: "Clicky", inert: true }); // wrongly asserted inert: markers caught
  const NotInert = cached(m.Static!);
  const page = () =>
    withRenderCache({ cache, resumable: true }, () =>
      resumableToString(
        () => m.App!({ top: Static({ href: "/x", label: "X" }), bottom: [Clicky({ label: "c" }), NotInert({ href: "/y", label: "Y" })] }) as never,
        {
          manifest,
        },
      ),
    ) as string;
  const reference = resumableToString(
    () => m.App!({ top: m.Static!({ href: "/x", label: "X" }), bottom: [m.Clicky!({ label: "c" }), m.Static!({ href: "/y", label: "Y" })] }) as never,
    { manifest },
  ) as string;
  const pages = [page(), page(), page()];
  for (const out of pages) assert.equal(out, reference);
  const ids = [...pages[2]!.matchAll(/data-r="(\d+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "unique ids");
  assert.equal(cache.stats.entries, 1, "only the inert Static entry");
  assert.ok(cache.stats.hits >= 2);
});

test("a re-created wrapper (HMR, redeploy in process) never sees an old wrapper's entries", async () => {
  const m = await serverModule(source);
  const scope = scopeOf();
  withRenderCache(scope, () => cached(m.Header)({ title: "t", items: [] }));
  withRenderCache(scope, () => cached(m.Header)({ title: "t", items: [] }));
  assert.equal(scope.cache.stats.hits, 0);
});

test("byte writers: hits and shells write the same bytes as an uncached render (encoded once per entry)", async () => {
  const { Writable } = await import("node:stream");
  const { NodeStreamWriter } = await import("@rivetjs/runtime/node");
  const { renderToWriter } = await import("@rivetjs/runtime/server");
  const { _slot } = await import("@rivetjs/runtime/slot");
  const m = await serverModule(source);
  const Layout = shell(m.Layout);
  const Header = cached(m.Header);
  const bytes = async (value: () => unknown) => {
    const parts: Buffer[] = [];
    const sink = new Writable({ write: (chunk: Buffer, _encoding, done) => (parts.push(Buffer.from(chunk)), done()) });
    const writer = new NodeStreamWriter(sink, { threshold: 64, early: false });
    await renderToWriter(value() as Render, writer);
    await writer.finish();
    return Buffer.concat(parts).toString("utf8");
  };
  const scope = scopeOf();
  const page = (body: string) => [Header({ title: "é€漢字 𝄞 <x>", items: ["a"] }), Layout({ title: "T", children: _slot(() => m.Page({ body })) })];
  const reference = await bytes(() => [
    m.Header({ title: "é€漢字 𝄞 <x>", items: ["a"] }),
    m.Layout({ title: "T", children: _slot(() => m.Page({ body: "b" })) }),
  ]);
  for (let i = 0; i < 3; i++) assert.equal(await withRenderCache(scope, () => bytes(() => page("b"))), reference);
  assert.equal(scope.cache.stats.hits, 4);
});

test("ids: a cached fragment's ids never collide with the request's or with a second use in the same page", async () => {
  const { template } = await import("@rivetjs/runtime/server");
  const { createId, withIdScope } = await import("@rivetjs/runtime/id");
  const { Async } = await import("@rivetjs/runtime/server");
  // A field (label + input related by id), as cdk components create them.
  const Field = (props: { label: string }) => {
    const id = createId();
    return template(['<label for="', '">', '</label><input id="', '">'], [id, props.label, id]);
  };
  const Plain = () => {
    const id = createId();
    return template(['<p id="', '"></p>'], [id]);
  };
  // Nested: a cached form holding cached fields.
  const CachedField = cached(Field, { id: "Field" });
  const Form = cached((props: { name: string }) => template(["<form>", "", "</form>"], [CachedField({ label: props.name }), Plain()]), { id: "Form" });
  const cache = createRenderCache({ admit: "first", verify: false });
  const page = () =>
    withIdScope("rv", () =>
      withRenderCache({ cache }, () =>
        renderToString(
          () => [Plain(), CachedField({ label: "a" }), Plain(), CachedField({ label: "a" }), Form({ name: "a" }), Form({ name: "b" }), Plain()] as never,
        ),
      ),
    ) as string;
  const idsOf = (out: string) => [...out.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]!);
  const pages = [page(), page(), page()];
  assert.equal(pages[1], pages[0], "same page, same HTML (hits replay the miss bytes)");
  assert.equal(pages[2], pages[0]);
  for (const out of pages) {
    const ids = idsOf(out);
    assert.equal(new Set(ids).size, ids.length, `unique ids: ${ids.join(" ")}`);
  }
  // Uncached id users count from rv0 in every request; fragments use their own `rv-<hash>-` namespace.
  const ids = idsOf(pages[2]!);
  assert.deepEqual(ids.filter((id) => /^rv\d+$/.test(id)).slice(0, 2), ["rv0", "rv1"]);
  assert.ok(ids.some((id) => /^rv-[0-9a-z]+-0$/.test(id)));
  assert.ok(cache.stats.hits >= 4, "fields and forms hit");
  assert.ok(cache.stats.bypass >= 2, "second use in the same page renders normally");
  // An entry's bytes do not depend on the page that populated the cache (nested wrappers render inside it).
  const formAlone = (c: ReturnType<typeof createRenderCache>, first: boolean) =>
    withIdScope("rv", () =>
      withRenderCache({ cache: c }, () => renderToString(() => (first ? [CachedField({ label: "a" }), Form({ name: "a" })] : [Form({ name: "a" })]) as never)),
    ) as string;
  const c1 = createRenderCache({ admit: "first", verify: false }),
    c2 = createRenderCache({ admit: "first", verify: false });
  formAlone(c1, true);
  formAlone(c2, false);
  assert.equal(formAlone(c1, false), formAlone(c2, false));
  // Concurrent requests with async content: each page's ids stay unique and match the sync reference.
  const asyncPage = () =>
    withIdScope("rv", () =>
      withRenderCache({ cache }, () =>
        renderToString(
          () =>
            [
              Plain(),
              Async({
                load: () => new Promise<number>((resolve) => setTimeout(() => resolve(1), 1)),
                children: () => [CachedField({ label: "a" }), Plain(), CachedField({ label: "a" })],
              } as never),
              CachedField({ label: "a" }),
              Plain(),
            ] as never,
        ),
      ),
    ) as Promise<string>;
  const outs = await Promise.all([asyncPage(), asyncPage(), asyncPage()]);
  for (const out of outs) {
    assert.equal(out, outs[0]);
    const all = idsOf(out);
    assert.equal(new Set(all).size, all.length, `unique ids: ${all.join(" ")}`);
  }
});

test("ids: dev verification caches id users (deterministic per entry) and shells keep the layout's ids apart", async () => {
  const { template } = await import("@rivetjs/runtime/server");
  const { createId, withIdScope } = await import("@rivetjs/runtime/id");
  const { _slot } = await import("@rivetjs/runtime/slot");
  const warnings: unknown[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args);
  try {
    const Field = cached((props: { label: string }) => {
      const id = createId();
      return template(['<input id="', '" aria-label="', '">'], [id, props.label]);
    });
    const Layout = shell((props: { children: unknown }) => {
      const id = createId();
      return template(['<nav aria-labelledby="', '"><h2 id="', '">Menu</h2></nav><main>', "</main>"], [id, id, props.children as never]);
    });
    const Plain = () => template(['<p id="', '"></p>'], [createId()]);
    const cache = createRenderCache({ admit: "first", verify: true });
    const page = () =>
      withIdScope("rv", () =>
        withRenderCache({ cache }, () => renderToString(() => Layout({ children: _slot(() => [Plain(), Field({ label: "x" }), Plain()]) }) as never)),
      ) as string;
    const [a, b] = [page(), page()];
    assert.equal(a, b);
    const ids = [...a.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]!);
    assert.equal(new Set(ids).size, ids.length, ids.join(" "));
    assert.deepEqual(warnings, [], "no wrapper turned off");
    assert.ok(cache.stats.entries >= 2);
  } finally {
    console.warn = warn;
  }
});
