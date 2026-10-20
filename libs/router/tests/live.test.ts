// Live pages (`export const live = true`): route scan flag, generated App wiring, and the in-place
// refresh of `_serveLive` (client/live.ts) with browser globals stubbed.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../build/codegen.ts";
import { routeTable, scanRoutes } from "../build/routes.ts";

const g = globalThis as Record<string, unknown>;
type Listener = () => void;
const listeners: Listener[] = [];
g.location = { href: "http://x.test/", pathname: "/", search: "", origin: "http://x.test", hash: "" };
g.document = {
  title: "",
  dispatchEvent: () => (listeners.forEach((fn) => fn()), true),
  querySelector: () => ({}),
};
const { _live, _livePage, _serveLive } = await import("../client/live.ts");
const { invalidate } = await import("../client/navigate.ts");

test("scan: `export const live = true` marks the page live (not a server export); other values do not", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rivet-live-"));
  try {
    await mkdir(join(dir, "a"));
    await writeFile(join(dir, "index.tsx"), "export const live = true;\nexport default () => null;\n");
    await writeFile(
      join(dir, "load.tsx"),
      'import { load } from "@rivetjs/router";\nexport const live = true;\nexport const loader = load(() => ({}));\nexport default () => null;\n',
    );
    await writeFile(join(dir, "off.tsx"), "export const live = false;\nexport default () => null;\n");
    await writeFile(join(dir, "a", "_layout.tsx"), "export const live = true;\nexport default () => null;\n");
    await writeFile(join(dir, "a", "b.tsx"), "export default () => null;\n");
    const table = await scanRoutes(dir);
    const byId = Object.fromEntries(table.routes.map((route) => [route.id, route]));
    assert.equal(byId["index"]!.live, true);
    assert.equal(byId["index"]!.inline, undefined, "live alone is no server export");
    assert.equal(byId["load"]!.live, true);
    assert.equal(byId["load"]!.inline, true);
    assert.equal(byId["off"]!.live, undefined);
    assert.equal(byId["a/b"]!.live, undefined);
    assert.equal(byId["a/b"]!.layouts[0]!.inline, undefined, "a layout's live flag is ignored (layouts are live already)");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("codegen: live wiring only with a live page and navigate()/forms in use; other apps byte-identical", () => {
  const files = ["_layout.tsx", "index.tsx", "other.tsx"];
  const plain = routeTable(files, new Map([["_layout.tsx", ["load"]]]));
  const live = routeTable(
    files,
    new Map([
      ["_layout.tsx", ["load"]],
      ["index.tsx", ["live"]],
    ]),
  );
  const app = (table: ReturnType<typeof routeTable>, navigate: boolean) => generate(table, { routesDir: "src/routes", navigate }).files["app.tsx"]!;
  // Not navigating in place: the flag changes nothing.
  assert.equal(app(live, false), app(plain, false));
  const out = app(live, true);
  assert.doesNotMatch(app(plain, true), /_live|LIVE/);
  assert.match(out, /_serveLive, _live, _livePage, /);
  // Form intent warms the data readers' chunks (focusin through the intent handler, pointerdown).
  assert.match(out, /    _liveIntent\(event, live, nest\);/);
  assert.match(
    out,
    /clientEvent\(document, "pointerdown", \(event: PointerEvent\) => _liveIntent\(event, live, nest\), \{ passive: true, preload: "intent", match: "form" \}\);/,
  );
  assert.match(out, /clientEvent\(document, "focusin", intent, \{ preload: "intent", match: "a,form" \}\);/);
  assert.match(out, /clientEvent\(document, "pointerover", intent, \{ passive: true, preload: "intent", match: "a,form" \}\);/);
  assert.doesNotMatch(out, /\b_serve\b/);
  assert.match(out, /const LIVE: readonly number\[\] = \[\d\];/);
  // Single-level app: the top Router keys on the slot; the navigation entry points start its location sync.
  assert.match(out, /const live = _live\("server", router\);/);
  assert.match(out, /clientEvent\(document, "rivet:go", \(\) => \(_armLive\(router, live, nest, NEST\), _serveLive\(router, live, nest, NEST\)\)/);
  assert.match(out, /clientEvent\(document, "click", \(event: MouseEvent\) => \(_armLive\(router, live, nest, NEST\), interceptClick\(/);
  assert.match(out, /<Router router=\{_liveRouter\(router, live\)\}/);
  // The slot is declared before the listeners that capture it.
  assert.ok(out.indexOf("const live = ") < out.indexOf('clientEvent(document, "click"'));
  assert.match(out, /const data = LIVE\.includes\(row\[2\]\) \? _livePage\(live, result\.data\[depth\], match\.url, depth\) : result\.data\[depth\];/);
  // A static prop (hoisted): a getter would create a signal per read.
  assert.match(out, /<Page data=\{data\} params=\{match\.params\} url=\{match\.url\} \/>/);
  // Without layouts: no layout state.
  const bare = generate(routeTable(["index.tsx", "x.tsx"], new Map([["index.tsx", ["live"]]])), { routesDir: "src/routes", navigate: true }).files["app.tsx"]!;
  assert.match(bare, /_armLive\(router, live\), _serveLive\(router, live\)/);
  // Nested layout levels: the top Router is a level navigator.
  const nested = generate(
    routeTable(
      ["_layout.tsx", "shop/_layout.tsx", "shop/index.tsx"],
      new Map([
        ["shop/_layout.tsx", ["load"]],
        ["shop/index.tsx", ["live"]],
      ]),
    ),
    { routesDir: "src/routes", navigate: true },
  ).files["app.tsx"]!;
  assert.match(nested, /const live = _live\("server"\);/);
  assert.doesNotMatch(nested, /_armLive|_liveRouter/);
  // Its level sync asks the live hook first (search-only changes of the shown live page move no level key).
  assert.match(nested, /_sync\(router, nest, NEST, \(from, url\) => _liveLevels\(router, live, nest, NEST, from, url\)\)/);
  // Static mode reads `_data.json`.
  assert.match(generate(live, { routesDir: "src/routes", navigate: true, mode: "static" }).files["app.tsx"]!, /_live\("static", router\)/);
});

test("_serveLive: a same-URL revalidation with fresh data updates the page's data signal in place (no navigation)", async () => {
  const slot = _live("server");
  const data = _livePage(slot, { n: 1 }, new URL("http://x.test/"), 1);
  assert.deepEqual(data(), { n: 1 });
  const navigations: unknown[] = [];
  const router = { location: () => new URL("http://x.test/"), navigate: (url: URL, options: unknown) => void navigations.push([url.href, options]) };
  listeners.push(() => _serveLive(router, slot));
  await invalidate({ data: [{ layout: 2 }, { n: 2 }], head: { title: "Fresh" } });
  assert.deepEqual(data(), { n: 2 });
  assert.equal((g.document as { title: string }).title, "Fresh");
  assert.deepEqual(navigations, [], "the page is not re-rendered");
  // Another page shown (the slot's URL differs): the regular path re-runs the route.
  _livePage(slot, { n: 3 }, new URL("http://x.test/other"), 1);
  void invalidate();
  await new Promise((done) => setTimeout(done, 0));
  assert.deepEqual(navigations, [["http://x.test/", { revalidate: true }]]);
  listeners.length = 0;
});

test("_serveLive: concurrent refreshes — only the newest applies", async () => {
  const slot = _live("server");
  const data = _livePage(slot, { n: 0 }, new URL("http://x.test/"), 0);
  const answers: ((value: Response) => void)[] = [];
  g.fetch = () => new Promise<Response>((resolve) => answers.push(resolve));
  const router = { location: () => new URL("http://x.test/"), navigate: () => assert.fail("no navigation") };
  listeners.push(() => _serveLive(router, slot));
  const body = (n: number) =>
    new Response(JSON.stringify({ t: [{ o: ["data", 1] }, [2], { o: ["n", 3] }, n], r: 0 }), { headers: { "content-type": "application/json" } });
  const first = invalidate();
  const second = invalidate();
  await new Promise((done) => setTimeout(done, 0));
  assert.equal(answers.length, 2);
  answers[1]!(body(2));
  await second;
  assert.deepEqual(data(), { n: 2 });
  answers[0]!(body(1));
  await first;
  assert.deepEqual(data(), { n: 2 }, "the older answer is dropped");
  listeners.length = 0;
  delete g.fetch;
});

test("forms follow(): a redirect back to the shown live page with the answer's data refreshes in place, no data request", async () => {
  const { follow } = await import("../../forms/transport.ts");
  const slot = _live("server");
  const data = _livePage(slot, { n: 0 }, new URL("http://x.test/"), 1);
  g.fetch = () => assert.fail("no data request");
  const router = { location: () => new URL("http://x.test/"), navigate: () => assert.fail("no navigation") };
  // The generated App of a forms app installs the router brand first (forms reach the router through it).
  const { _brand, _go } = await import("../client/index.ts");
  listeners.push(() => (_brand(_go), _serveLive(router, slot)));
  await follow("/", { redirect: "/", status: 303, data: [{ layout: 1 }, { n: 5 }] });
  assert.deepEqual(data(), { n: 5 });
  listeners.length = 0;
  delete g.fetch;
});
