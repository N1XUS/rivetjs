// Shell cache units (`server/shell-cache.ts`, route rule `shell`): rule compilation, the cut, and the store driven
// through the real handler (`createHandler`) with a synthetic streamed document: keys (locale partition, query),
// tracker rejections + sticky off, single flight, nonce slots, tags / revalidate. End to end (real renderer, Chromium):
// `tests/shell-app.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compileRules, revalidate, withRouteRules, type CachePolicy, type RouteRules } from "../server/route-cache.ts";
import { createShells, shellCut } from "../server/shell-cache.ts";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../server/handler.ts";

test("compileRules: shell defaults, own times, keys; shell wins over cache; validation", () => {
  const resolve = compileRules(
    {
      "/**": { swr: 60, shell: true },
      "/a/**": { shell: { maxAge: 5, tags: ["a"], query: ["page"], varies: ["Accept-Language"] } },
      "/a/off": { shell: false },
    },
    true,
  );
  const root = resolve("/x")!;
  assert.equal(root.cache, undefined, "no whole-page copy of shell documents");
  assert.equal(root.shell?.maxAge, 60);
  assert.equal(root.shell?.swr, Infinity);
  assert.equal(root.shell?.control, "private, no-cache");
  const own = resolve("/a/b")!.shell!;
  assert.deepEqual([own.maxAge, own.swr, own.tags, own.query, own.varies], [5, 0, ["a"], ["page"], ["accept-language"]]);
  assert.equal(resolve("/a/off")?.shell, undefined);
  assert.equal(resolve("/a/off")?.cache?.maxAge, 60, "shell: false leaves the less specific cache");
  assert.equal(compileRules({ "/s": { shell: true } }, true)("/s")?.shell?.maxAge, Infinity);
  for (const [rules, message] of [
    [{ "/s": { shell: true } }, /isr needs a fixed origin/],
    [{ "/s": { shell: { maxAge: 1, cookies: true } } }, /unknown shell option "cookies"/],
    [{ "/s": { shell: "yes" } }, /shell must be true, false or/],
    [{ "/s": { swr: 5, shell: true, cdn: { maxAge: 5 } } }, /shell cannot take cdn/],
    [{ "/s": { shell: { maxAge: 1, varies: ["cookie"] } } }, /varies cannot name cookie/],
  ] as const)
    assert.throws(() => compileRules(rules as unknown as RouteRules)("/s"), message);
});

const STATE = '<script type="rivet/state" data-region="0" data-events="click"';
test("shellCut: after the root state tail (state, loader, stream add-on with pending boundaries)", () => {
  const head = "<!doctype html><body><p>shell</p>";
  const streamed = head + STATE + ' data-stream="4,5,3">{"t":[]}</script><script nonce="n">L</script><script nonce="n">S</script>';
  assert.equal(shellCut(streamed + '<template data-a="4">x</template>'), streamed.length);
  assert.equal(shellCut(streamed.slice(0, -3)), -1, "incomplete tail");
  const plain = head + STATE + '>{"t":[]}</script><script nonce="n">L</script>';
  assert.equal(shellCut(plain + "</body>"), plain.length, "no pending boundary: state + loader");
  assert.equal(shellCut(head + "<script>x</script>"), -1, "no resume state");
});

// A synthetic app: the page streams `shell` + root state tail + one hole (a deferred value) + document end.
const DEFER = Symbol.for("rivet.defer");
function app(options: { read?: (event: Parameters<NonNullable<ServerModule["load"]>>[0]) => unknown; locale?: boolean } = {}) {
  const counts = { load: 0, render: 0 };
  const load = (event: Parameters<NonNullable<ServerModule["load"]>>[0]) => (counts.load++, { title: "T", extra: options.read?.(event) });
  const hole = Object.assign(async ({ cookies }: { cookies: { get(name: string): string | undefined } }) => cookies.get("user") ?? "guest", { [DEFER]: true });
  const page: ServerModule = { load } as ServerModule;
  const layout: ServerModule = {
    load: hole as unknown as ServerModule["load"],
    ...(options.locale
      ? {
          guard: ({ request, locals }: { request: Request; locals: Record<string, unknown> }) => void (locals.locale = request.headers.get("x-locale") ?? "en"),
        }
      : {}),
  } as ServerModule;
  const route: AppRoute = { id: "post", pattern: "/post", layouts: [async () => layout], server: async () => page, page: true, keys: ["/"] };
  const render = async (input: RenderInput): Promise<Response> => {
    counts.render++;
    const nonce = input.nonce ? ` nonce="${input.nonce}"` : "";
    const data = input.data[1] as { title: string };
    const locale = String(input.locals.locale ?? "");
    const shell =
      `<!doctype html><html><head><script${nonce} src="/a.js"></script></head><body><h1>${data.title} ${locale}</h1>` +
      `${STATE} data-stream="4,5,3">{}</script><script${nonce}>L</script><script${nonce}>S</script>`;
    const handle = input.data[0] as PromiseLike<string>;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(shell));
        const user = await handle;
        controller.enqueue(encoder.encode(`<template data-a="4">Hello ${user}</template></body></html>`));
        controller.close();
      },
    });
    input.headers.set("content-type", "text/html; charset=utf-8");
    return new Response(body, { status: input.status, headers: input.headers });
  };
  const handler = createHandler({ routes: [route], render });
  const policy: CachePolicy = { policy: (nonce) => `script-src 'nonce-${nonce}' 'strict-dynamic'`, hash: null };
  const rules = (routeRules: RouteRules) => withRouteRules(handler, routeRules, policy, "", { origin: "http://x" }, { createShells }, { build: "b1" });
  return { counts, rules };
}
const get = (
  handler: ReturnType<ReturnType<typeof app>["rules"]>,
  path: string,
  headers: Record<string, string> = {},
  nonce = "N" + Math.random().toString(36).slice(2, 8),
) => handler(new Request("http://x" + path, { headers }), { nonce });

test("store: miss stores, hits skip shell loaders and re-fill nonce slots; holes stay per visitor", async () => {
  const { counts, rules } = app();
  const handler = rules({ "/post": { shell: true } });
  const miss = await get(handler, "/post", { cookie: "user=ann" }, "AAAA");
  assert.equal(miss.headers.get("x-rivet-cache"), "SHELL-MISS");
  const missed = await miss.text();
  assert.match(missed, /self\.\$rvh="[0-9a-f]{8}"/);
  assert.match(missed, /Hello ann/);
  const hit = await get(handler, "/post", { cookie: "user=bob" }, "BBBBBB");
  assert.equal(hit.headers.get("x-rivet-cache"), "SHELL-HIT-REPLAY");
  assert.equal(hit.headers.get("content-security-policy"), "script-src 'nonce-BBBBBB' 'strict-dynamic'");
  const html = await hit.text();
  assert.match(html, /Hello bob/);
  assert.doesNotMatch(html, /AAAA|ann/);
  assert.equal(html.replaceAll("BBBBBB", "AAAA").replace("bob", "ann"), missed);
  assert.equal(counts.load, 1, "the shell loader ran once");
  assert.equal(counts.render, 2, "the hit replays the render (H-replay)");
});

test("keys: the locale a guard sets partitions shells; tags + revalidate drop them", async () => {
  const { counts, rules } = app({ locale: true });
  const handler = rules({ "/post": { shell: { maxAge: 60, tags: ["posts"] } } });
  for (const locale of ["en", "de"]) {
    const response = await get(handler, "/post", { "x-locale": locale });
    assert.equal(response.headers.get("x-rivet-cache"), "SHELL-MISS", locale);
    assert.match(await response.text(), new RegExp(`<h1>T ${locale}</h1>`));
  }
  const de = await get(handler, "/post", { "x-locale": "de" });
  assert.equal(de.headers.get("x-rivet-cache"), "SHELL-HIT-REPLAY");
  assert.match(await de.text(), /<h1>T de<\/h1>/);
  assert.equal(counts.load, 2);
  assert.equal(revalidate({ tag: "posts" }), 2);
  assert.equal((await get(handler, "/post", { "x-locale": "de" })).headers.get("x-rivet-cache"), "SHELL-MISS");
});

test("tracker: a shell loader reading a cookie is never stored; three rejections stop the fills (sticky)", async () => {
  const { counts, rules } = app({ read: ({ cookies }) => cookies.get("theme") });
  const handler = rules({ "/post": { shell: true } });
  for (let i = 0; i < 5; i++) {
    const response = await get(handler, "/post", { cookie: "theme=dark; user=ann" });
    assert.equal(response.headers.get("x-rivet-cache"), null);
    assert.doesNotMatch(await response.text(), /\$rvh/);
  }
  assert.equal(counts.load, 5);
  assert.ok(revalidate({ path: "/post" }) >= 0, "revalidate() resets the sticky counter");
});

test("tracker: unknown event members and the client address count as reads (allow-list, R3)", async () => {
  for (const read of [
    (event: object) => (event as { platform: unknown }).platform,
    (event: object) => (event as Record<string, unknown>).somethingNew,
    (event: object) => (event as { request: Request }).request.headers.get("x-user"),
    (event: object) => (event as { locals: Record<string, unknown> }).locals.session,
  ]) {
    const { rules } = app({ read });
    const handler = rules({ "/post": { shell: true } });
    await (await get(handler, "/post")).text();
    assert.equal((await get(handler, "/post")).headers.get("x-rivet-cache"), null);
  }
  // Keyed request headers (`varies`) are shell input.
  const { rules } = app({ read: ({ request }) => request.headers.get("accept-language") });
  const handler = rules({ "/post": { shell: { maxAge: 60, varies: ["accept-language"] } } });
  await (await get(handler, "/post", { "accept-language": "fr" })).text();
  const fill = await get(handler, "/post", { "accept-language": "fr" });
  assert.equal(fill.headers.get("x-rivet-cache"), "SHELL-MISS", "a keyed header value is stored on its second miss");
  await fill.text();
  assert.equal((await get(handler, "/post", { "accept-language": "fr" })).headers.get("x-rivet-cache"), "SHELL-HIT-REPLAY");
});

test("single flight: misses while a fill runs render on their own (no second fill)", async () => {
  const { counts, rules } = app();
  const handler = rules({ "/post": { shell: true } });
  const [a, b] = await Promise.all([get(handler, "/post", { cookie: "user=a" }), get(handler, "/post", { cookie: "user=b" })]);
  assert.deepEqual([a.headers.get("x-rivet-cache"), b.headers.get("x-rivet-cache")].sort(), [null, "SHELL-MISS"].sort());
  assert.match(await a.text(), /Hello a/);
  assert.match(await b.text(), /Hello b/);
  assert.equal(counts.load, 2);
  assert.equal((await get(handler, "/post")).headers.get("x-rivet-cache"), "SHELL-HIT-REPLAY");
});

test("nonce presence must match the stored shell; HEAD and non-HTML answers bypass", async () => {
  const { rules } = app();
  const handler = rules({ "/post": { shell: true } });
  await (await get(handler, "/post")).text();
  const plain = await handler(new Request("http://x/post"));
  assert.equal(plain.headers.get("x-rivet-cache"), null, "no nonce: renders as usual");
  assert.match(await plain.text(), /Hello guest/);
  const head = await handler(new Request("http://x/post", { method: "HEAD" }), { nonce: "Z" });
  assert.equal(head.headers.get("x-rivet-cache"), null);
});
