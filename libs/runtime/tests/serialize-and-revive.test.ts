// `serializeAndRevive` (`@rivetjs/runtime/testing/resume`, Function Bridge T30): values built where a component body runs
// (resume-compiled fixtures through the test register's `?rivet-resume=` modules) round-trip through the page encoder and
// the browser decoder in Node; refusals are the encoder's own messages — compared with a resumed page's render.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { serializeAndRevive, serializeValue, importResume } from "@rivetjs/runtime/testing/resume";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";

type Fixture = typeof import("./resume/serialize-fixture.tsx");
const fixture = new URL("./resume/serialize-fixture.tsx", import.meta.url);
const fx = await importResume<Fixture>(fixture);
// The browser half's copy of the module (classes there are the revived values' classes).
const browser = await importResume<Fixture>(fixture, "browser");
const DEV = process.execArgv.includes("--conditions=development");
/** The refusal without the capturing symbol ("Cannot resume <id>: [capture `x` ]"). */
const reason = (message: string): string => message.replace(/^Cannot resume \S+: (capture (`[^`]*`|#\d+) )?/, "");

test("primitives and built-ins: Map / Set / Date / URL / RegExp / bigint / special numbers", async () => {
  const value = {
    s: "x",
    n: 1,
    b: true,
    z: null,
    u: undefined,
    big: 10n,
    nan: NaN,
    neg: -0,
    map: new Map([["a", 1]]),
    set: new Set([1, 2]),
    date: new Date(0),
    url: new URL("https://rivet.test/a?b=1"),
    re: /x+/gi,
  };
  const out = await serializeValue(value);
  assert.notEqual(out, value);
  assert.deepEqual(out, value);
  assert.ok(Object.is(out.neg, -0));
  assert.ok(out.re instanceof RegExp && out.re.flags === "gi");
});

test("functions: a local closure revives through its compiled browser symbol, `let` cells and signals stay live, a module function by reference", async () => {
  const out = await serializeAndRevive(() => fx.Counter());
  assert.equal(typeof out.n.set, "function");
  assert.equal(out.n(), 1);
  assert.equal(out.inc(), 1);
  assert.equal(out.inc(), 2); // the `let calls` cell is shared by every call
  assert.equal(out.n(), 3);
  assert.equal(out.double, browser.double); // `_rMod`: the browser module's own binding
  assert.notEqual(out.double, fx.double);
});

test("a component registering its own client effect inside `make()`: the value's effect is picked by symbol", async () => {
  const out = await serializeAndRevive(() => fx.Effectful());
  assert.equal(out.kind, "value");
  assert.equal(out.seen(), 0);
});

test("classes: data class via `_rClass` (constructor not re-run), `static [revive]`, `registerClass`", async () => {
  const before = browser.constructed.length;
  const out = await serializeAndRevive(() => fx.Classes());
  assert.ok(out.money instanceof browser.Money);
  assert.equal(out.money.euros(), 2.5);
  assert.equal(browser.constructed.length, before);
  assert.ok(out.point instanceof browser.Point);
  assert.equal(out.point.x, 3);
  assert.ok(out.token instanceof browser.Token);
  assert.equal(out.token.id, "t-1");
});

test("store paths: a narrowed store ships the read / written paths only", async () => {
  let shipped = "";
  const out = await serializeAndRevive(() => fx.Store(), { state: (state) => (shipped = JSON.stringify(state)) });
  assert.ok(shipped.includes('"Ada"'), shipped);
  assert.ok(!shipped.includes("long text never read"), shipped);
  assert.equal(out.name(), "Ada");
  out.rename();
  assert.equal(out.name(), "Ada!");
});

test("reconstruct site: the factory runs in the browser half, on first read, from its captures", async () => {
  const out = await serializeAndRevive(() => fx.Rebuilt());
  assert.deepEqual(out.readBox(), { made: 20, browser: false });
});

test("identity, aliases and cycles are kept", async () => {
  const out = await serializeAndRevive(() => fx.Cycle());
  assert.equal(out.self, out);
  assert.equal(out.list[0], out);
  assert.equal(out.list[1], out);
});

test("platform: browser globals exist while the value decodes and are restored after", async () => {
  assert.equal(typeof (globalThis as { window?: unknown }).window, "undefined");
  const out = await serializeAndRevive(() => fx.Platform(), { platform: { window: {} } });
  assert.equal(out.probe.seen, "object");
  assert.equal(typeof (globalThis as { window?: unknown }).window, "undefined");
  assert.equal((await serializeAndRevive(() => fx.Platform())).probe.seen, "undefined");
});

// A page whose handler captures the same value: its render throws the message serializeAndRevive throws.
const page = async (setup: string, prelude = ""): Promise<string> => {
  const source = `${prelude}\nexport function Page() {\n  ${setup}\n  return <button onClick={() => console.log(value)}>x</button>;\n}\n`;
  const server = compileResume(source, "server", "src/page.tsx");
  const mod = await importServer<{ Page: () => never }>(server.code);
  const manifest = {
    runtime: "/rt.js",
    symbols: Object.fromEntries(server.symbols.map((s) => [s.id, "/c.js"])),
    captures: Object.fromEntries(server.symbols.map((s) => [s.id, s.labels ?? s.captures])),
  };
  return (await Promise.resolve()
    .then(() => resumableToString(() => mod.Page(), { manifest }))
    .then(
      () => "",
      (error: Error) => error.message,
    )) as string;
};
const refused = async (make: () => unknown): Promise<string> =>
  serializeAndRevive(make).then(
    () => "",
    (error: Error) => error.message,
  );

const plain = new URL("./resume/serialize-plain.ts", import.meta.url).href;
test("refusals carry the page render's messages: closure without a symbol, unregistered platform-based class, WeakMap, Promise, RV2102", async () => {
  const cases: [string, () => unknown, string, string?][] = [
    ["function not captured", () => fx.Evaluated(), `const value = { fn: new Function("return 1") };`],
    ["platform class not registered", () => fx.Socket(), `const value = { conn: new WebSocketLike() };`, `class WebSocketLike extends EventTarget {}`],
    ["WeakMap", () => fx.Weak(), `const value = { cache: new WeakMap() };`],
    ["Promise", () => fx.Pending(), `const value = { answer: Promise.resolve(1) };`],
    // Runtime RV2102 (`[serialize]` without `static [revive]`): the class comes from a plain module the compiler never checks.
    ["[serialize] without static [revive]", () => fx.Serializer(), `const value = { conn: new Conn() };`, `import { Conn } from ${JSON.stringify(plain)};`],
  ];
  for (const [name, make, setup, prelude] of cases) {
    const ours = await refused(make);
    const theirs = await page(setup, prelude);
    assert.ok(ours.startsWith("Cannot resume serializeAndRevive#value: " + (DEV ? "capture `value` " : "")), `${name}: ${ours}`);
    assert.ok(theirs, `${name}: the page renders`);
    // The page captures `value` itself, the helper an object holding the same field: same refusal of the inner value.
    assert.equal(reason(ours), reason(theirs), name);
  }
  // A closure from a plain `.ts` module (never resume-compiled) is refused too.
  assert.match(await refused(() => fx.NotCaptured()), /function is not serializable/);
});

test("contexts: an unregistered token's provided value needs `contexts` (the browser decoder's `Missing resume context`)", async () => {
  await assert.rejects(
    serializeAndRevive(() => fx.Themed()),
    (error: Error) => {
      assert.equal(error.message.split(" — ")[0], "Missing resume context: fixture.theme");
      return true;
    },
  );
  const client = { name: "client" };
  const out = await serializeAndRevive(() => fx.Themed(), { contexts: [[fx.Theme, client]] });
  assert.equal(out.theme, client);
});

test("importResume keeps a query the URL already carries (adds `rivet-resume`, does not replace it)", async () => {
  const url = new URL("./resume/serialize-query-fixture.tsx?v=1", import.meta.url);
  const server = await importResume<typeof import("./resume/serialize-query-fixture.tsx")>(url);
  const out = await serializeAndRevive(() => server.Tally());
  assert.equal(out.add(), 1);
  assert.equal(out.add(), 2);
  assert.equal(out.n(), 2);
});

test("refusal at compile time: a `#private` class captured by a handler fails the import with the compiler's message", async () => {
  const url = new URL("./resume/serialize-private-fixture.tsx", import.meta.url);
  const error = await importResume(url).then(
    () => undefined,
    (e: Error) => e,
  );
  assert.ok(error, "import rejects");
  assert.match(error.message, /Cannot resume `secret\.#c`: Secret instance has a private field/);
});

test("skew: a browser chunk without the page's symbol throws the browser decoder's skew error", async () => {
  const error = await serializeAndRevive(() => fx.Counter(), { symbols: { "libs/runtime/tests/resume/serialize-fixture.tsx": {} } }).then(
    () => undefined,
    (e: Error & { skew?: string }) => e,
  );
  assert.ok(error);
  assert.match(error.message, DEV ? /^Resume symbol is missing from its chunk \(deploy skew\): \S+#Counter\$/ : /^Resume symbol is not loaded: \S+#Counter\$/);
  assert.match(error.skew!, /#Counter\$/);
});

test("docs example (guides/tooling/testing-resumability.md): the cart resumes; a WeakMap is refused", async () => {
  const revived = await serializeAndRevive(() => fx.Cart());
  assert.ok(revived.total() instanceof browser.Money);
  assert.equal(revived.add(100), 1);
  assert.equal(revived.add(100), 2);
  assert.equal(revived.total().euros(), 4.5);
  await assert.rejects(
    serializeAndRevive(() => ({ cache: new WeakMap() })),
    /WeakMap instance is not serializable/,
  );
});

// The decoder hooks are a copy of dom-resume.ts `start()`'s (the runtime entry pays nothing for the helper): every entry
// kind and error message dom-resume decodes / throws must be in the copy too.
test("drift guard: the helper's decoder handles dom-resume's entry kinds with the same messages", async () => {
  const dom = await readFile(new URL("../dom-resume.ts", import.meta.url), "utf8");
  const ours = await readFile(new URL("../testing-resume.ts", import.meta.url), "utf8");
  const hooks = dom.slice(dom.indexOf("decoder = createDecoder(state.t, {"), dom.indexOf("_warmLazy(idle);"));
  const kinds = [...hooks.matchAll(/kind === "(\w+)"/g)].map((m) => m[1]!);
  assert.deepEqual(kinds, ["const", "bind", "store", "ctx", "m", "props", "href", "router", "reset"]);
  for (const kind of kinds) assert.ok(ours.includes(`kind === "${kind}"`), kind);
  const messages = [
    "Resume symbol is not loaded: ",
    " (the page state lists no chunk for it)",
    " (chunk ",
    " has not loaded)",
    "Resume symbol is missing from its chunk (deploy skew): ",
    'DEV.hint("Missing resume context: " + id, "context")',
    "Unknown resume entry kind ",
  ];
  for (const message of messages) {
    assert.ok(dom.includes(message), "dom-resume.ts: " + message);
    assert.ok(ours.includes(message), "testing-resume.ts: " + message);
  }
  // The hook names (`settle` binds DOM bindings: none here).
  for (const hook of ["signal:", "computed:", "fn:", "custom:", "context:", "ref:"]) assert.ok(hooks.includes(hook) && ours.includes(hook), hook);
});
