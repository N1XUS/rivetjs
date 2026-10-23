// Seeded `locals` (`context.locals` of the app handler): the caller of the handler hands a page its data (e.g. a view
// model another server computed). `event.locals` is the caller's object itself (no copy: writes come back); guards, loaders, actions, request handlers,
// `headers`, error pages and the i18n locale see it; it reaches the browser only through what loaders return; the
// route rules' page cache is bypassed; the node adapter forwards it from a custom `serve({ handler })`.
// Run: `npx vitest run --project router libs/router/tests/seeded-locals.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { _variants, _variantTemplate, _variantValue } from "@rivetjs/runtime/server";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { _rB, _rBEnd, _rBOut, _rSig } from "@rivetjs/runtime/server-derived";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import { createHandler, type AppRoute, type RequestEvent, type ServerModule } from "../server/handler.ts";
import { createApp, type GeneratedEntry } from "../server/app.ts";
import { serve } from "../adapters/node.ts";
import { notFound } from "../shared/errors.ts";

const mod = (module: ServerModule) => () => Promise.resolve(module);
const decode = async (response: Response): Promise<unknown> => {
  const { t, r } = JSON.parse(await response.text()) as { t: unknown[]; r: number };
  return createDecoder(t).get(r);
};

test("seeded locals reach request handlers, guards, loaders, actions, headers, head (through loader data) and error pages", async () => {
  const seen: Record<string, unknown> = {};
  const note = (name: string) => (event: RequestEvent) => void (seen[name] = event.locals.viewModel);
  const handler = createHandler({
    routes: [
      {
        id: "splash/survey",
        pattern: "/splash/survey",
        page: true,
        layouts: [mod({ onRequest: note("onRequest"), guard: note("layout guard"), load: (e) => (note("layout load")(e), "layout") })],
        server: mod({
          onGet: note("onGet"),
          onPost: note("onPost"),
          guard: note("guard"),
          headers: (e) => (note("headers")(e), { "x-survey": String((e.locals.viewModel as { id: number }).id) }),
          load: (e) => (note("load")(e), e.locals.viewModel),
          actions: { save: (e) => (note("action")(e), { saved: (e.locals.viewModel as { id: number }).id }) },
        }),
      },
      {
        id: "broken",
        pattern: "/broken",
        page: true,
        layouts: [],
        server: mod({
          load: () => {
            throw notFound();
          },
        }),
      },
    ],
    render: (input) =>
      new Response(JSON.stringify({ data: input.data, action: input.action, title: input.head?.title, locals: input.locals }), { headers: input.headers }),
    head: (_route, data) => ({ title: (data[1] as { title: string }).title }),
    renderError: ({ status, locals }) => new Response(`error ${status} ${JSON.stringify(locals)}`, { status }),
  });
  const viewModel = { id: 7, title: "Survey" };
  const page = await handler(new Request("http://x/splash/survey"), { locals: { viewModel } });
  assert.equal(page.headers.get("x-survey"), "7");
  assert.deepEqual(JSON.parse(await page.text()), { data: ["layout", viewModel], title: "Survey", locals: { viewModel } });
  for (const name of ["onRequest", "onGet", "layout guard", "guard", "headers", "layout load", "load"]) assert.deepEqual(seen[name], viewModel, name);

  const posted = await handler(new Request("http://x/splash/survey?/save", { method: "POST", headers: { origin: "http://x" } }), {
    locals: { viewModel },
  });
  assert.deepEqual(JSON.parse(await posted.text()).action, { name: "save", result: { saved: 7 } });
  assert.deepEqual(seen.onPost, viewModel);
  assert.deepEqual(seen.action, viewModel);

  // Error pages (a loader's 404, an unmatched URL) render with the seeded locals.
  const broken = await handler(new Request("http://x/broken"), { locals: { viewModel } });
  assert.equal(await broken.text(), `error 404 ${JSON.stringify({ viewModel })}`);
  const missing = await handler(new Request("http://x/nowhere"), { locals: { viewModel } });
  assert.equal(await missing.text(), `error 404 ${JSON.stringify({ viewModel })}`);
  // Without a seed: as before (an empty object).
  assert.equal(await (await handler(new Request("http://x/nowhere"))).text(), "error 404 {}");
});

test("event.locals is the caller's object: guard / loader writes come back; an unseeded request gets its own {}", async () => {
  const handler = createHandler({
    routes: [
      {
        id: "p",
        pattern: "/p",
        page: true,
        layouts: [],
        server: mod({
          guard: (e) => {
            e.locals.user = "ada";
            e.locals.count = ((e.locals.count as number) ?? 0) + 1;
          },
          load: (e) => {
            const seen = { ...e.locals };
            e.locals.status = "rendered";
            return seen;
          },
        }),
      },
    ],
    render: (input) => new Response(JSON.stringify(input.data[0])),
  });
  const seed: Record<string, unknown> = { count: 1 };
  const first = await handler(new Request("http://x/p"), { locals: seed });
  assert.deepEqual(JSON.parse(await first.text()), { count: 2, user: "ada" });
  assert.deepEqual(seed, { count: 2, user: "ada", status: "rendered" });
  // A fresh seed per request: nothing carries over.
  const second = await handler(new Request("http://x/p"), { locals: { count: 1 } });
  assert.deepEqual(JSON.parse(await second.text()), { count: 2, user: "ada" });
  assert.deepEqual(JSON.parse(await (await handler(new Request("http://x/p"))).text()), { count: 1, user: "ada" });
});

test("concurrent requests with different seeds render their own data", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((done) => (release = done));
  let waiting = 0;
  const handler = createHandler({
    routes: [
      {
        id: "p",
        pattern: "/p",
        page: true,
        layouts: [],
        server: mod({
          load: async (e) => {
            if (++waiting === 2) release();
            await gate; // both requests are inside their loader at once
            return e.locals.viewModel;
          },
        }),
      },
    ],
    render: (input) => new Response(JSON.stringify(input.data[0])),
  });
  const [a, b] = await Promise.all([
    handler(new Request("http://x/p"), { locals: { viewModel: "a" } }),
    handler(new Request("http://x/p"), { locals: { viewModel: "b" } }),
  ]);
  assert.equal(await a.text(), '"a"');
  assert.equal(await b.text(), '"b"');
});

// createApp with a resumable page (resume manifest + a recorded binding of the loader's title).
const SECRET = "seed-secret-4f1c";
const manifest = (locale: string): ResumeManifest => ({ runtime: `/${locale}/assets/resume-entry.js`, symbols: { Page: `/${locale}/assets/page.js` } });
const fragments = _variants([
  ["<p>Hello ", "</p>"],
  ["<p>Hallo ", "</p>"],
]);
function surveyEntry(): GeneratedEntry {
  return {
    routes: [
      {
        id: "splash/survey",
        pattern: "/splash/survey",
        page: true,
        layouts: [],
        server: mod({ load: ({ locals }) => ({ title: (locals.viewModel as { title: string }).title }) }),
      },
    ],
    universal: {},
    page: (input) => () => {
      const { title } = (input.data[0] ?? { title: "?" }) as { title: string };
      const B = _rB("Page", 0);
      try {
        const n = _rSig("n", 1);
        const t = _rSig("t", title);
        return _rBOut(B, _variantTemplate(fragments, [() => _variantValue([t() + " en" + n(), () => t() + " de" + n()])]));
      } finally {
        _rBEnd(B);
      }
    },
    document: (input) => ({ start: `<!doctype html><html lang="${input.locale ?? "-"}"><head></head><body>`, end: "</body></html>" }),
  };
}

test("seeded values reach the browser only through what loaders return (HTML, resume state, data answers, dev pages)", async () => {
  const locals = { viewModel: { title: "Survey" }, secret: SECRET };
  const app = createApp({ entry: surveyEntry(), manifest: manifest("en") });
  const html = await (await app(new Request("http://x/splash/survey"), { nonce: "n", locals })).text();
  assert.match(html, /<p>Hello Survey en1<\/p>/);
  const state = /<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/.exec(html)?.[1];
  assert.ok(state && state.includes("Survey"), html);
  assert.ok(!html.includes(SECRET), html);
  const answer = await app(new Request("http://x/splash/survey?_rivet=data"), { locals });
  const body = await answer.clone().text();
  assert.deepEqual(((await decode(answer)) as { data: unknown[] }).data, [{ title: "Survey" }]);
  assert.ok(!body.includes(SECRET), body);
  // Dev pages embed the route data for the client mount: still only the loader's.
  const dev = createApp({ entry: surveyEntry(), dev: true, devScripts: ["/entry.dev.tsx"] });
  const devHTML = await (await dev(new Request("http://x/splash/survey"), { nonce: "n", locals })).text();
  assert.match(devHTML, /Survey/);
  assert.ok(!devHTML.includes(SECRET), devHTML);
});

test("seeded locals.locale selects the locale variant and manifest (pages and error pages); a guard may override it", async () => {
  const i18n = { locales: ["en", "de"], manifests: { en: manifest("en"), de: manifest("de") } };
  const app = createApp({ entry: surveyEntry(), manifest: manifest("en"), i18n });
  const locals = { viewModel: { title: "Umfrage" }, locale: "de" };
  const html = await (await app(new Request("http://x/splash/survey"), { nonce: "n", locals })).text();
  assert.match(html, /^<!doctype html><html lang="de">/);
  assert.match(html, /<p>Hallo Umfrage de1<\/p>/);
  assert.match(html, /\/de\/assets\/page\.js/);
  assert.doesNotMatch(html, /\/en\/assets\//);
  // Unmatched URL: the error page takes the seeded locale (no i18n.resolve, no locale prefix).
  const missing = await (await app(new Request("http://x/nowhere"), { nonce: "n", locals })).text();
  assert.match(missing, /^<!doctype html><html lang="de">/);
  // A guard still decides last.
  const entry = surveyEntry();
  const guarded: AppRoute = {
    ...entry.routes[0]!,
    server: mod({ guard: (e) => void (e.locals.locale = "en"), load: ({ locals }) => ({ title: (locals.viewModel as { title: string }).title }) }),
  };
  const overridden = createApp({ entry: { ...entry, routes: [guarded] }, manifest: manifest("en"), i18n });
  assert.match(await (await overridden(new Request("http://x/splash/survey"), { nonce: "n", locals })).text(), /^<!doctype html><html lang="en">.*Umfrage en1/);
});

test("route rules: requests with seeded locals bypass the page cache (never read, never stored); others still use it", async () => {
  let renders = 0;
  const entry: GeneratedEntry = {
    routes: [{ id: "p", pattern: "/*rest", page: true, layouts: [], server: mod({ load: ({ locals }) => locals.viewModel ?? "anonymous" }) }],
    universal: {},
    page: (input) => () => `render ${++renders} ${String(input.data[0])}`,
    document: () => ({ start: "<!doctype html><html><head></head><body>", end: "</body></html>" }),
  };
  const app = createApp({ entry, routeRules: { "/a": { swr: 60, headers: { "x-a": "1" } } }, routeCache: { origin: "http://x" } });
  const seeded = async (viewModel: string) => {
    const response = await app(new Request("http://x/a"), { nonce: "Q7zX9", locals: { viewModel } });
    assert.equal(response.headers.get("x-rivet-cache"), null);
    assert.equal(response.headers.get("x-a"), "1"); // rule headers still apply
    return response.text();
  };
  // Not written: a seeded render stores nothing, so the next anonymous request misses.
  assert.match(await seeded("one"), /render 1 one/);
  const miss = await app(new Request("http://x/a"), { nonce: "Q7zX9" });
  assert.equal(miss.headers.get("x-rivet-cache"), "MISS");
  assert.match(await miss.text(), /render 2 anonymous/);
  const hit = await app(new Request("http://x/a"), { nonce: "Q7zX9" });
  assert.equal(hit.headers.get("x-rivet-cache"), "HIT");
  assert.match(await hit.text(), /render 2 anonymous/);
  // Not read: with a stored page, seeded requests still render their own data.
  assert.match(await seeded("two"), /render 3 two/);
  assert.match(await seeded("three"), /render 4 three/);
});

test("node adapter: serve({ handler }) forwarding { ...context, locals } renders a resumable page end to end", async () => {
  const app = createApp({ entry: surveyEntry(), manifest: manifest("en") });
  const contexts: unknown[] = [];
  const serving = await serve({
    port: 0,
    handler: async (request, context) => {
      contexts.push(context);
      const { template, viewModel } = (await request.json()) as { template: string; viewModel: unknown };
      const page = new Request(new URL(`/splash/${template}`, request.url), { headers: request.headers });
      return app(page, { ...context, locals: { viewModel } });
    },
  });
  try {
    const response = await fetch(serving.url + "/render", {
      method: "POST",
      headers: { "content-type": "application/json", "x-locals": '{"viewModel":{"title":"Forged"}}' },
      body: JSON.stringify({ template: "survey", viewModel: { title: "From ASP.NET" } }),
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<p>Hello From ASP\.NET en1<\/p>/);
    assert.match(html, /<script type="rivet\/boundaries"[^>]*>.*From ASP\.NET.*<\/script>/);
    assert.match(html, /\/en\/assets\/resume-entry\.js/);
    assert.match(response.headers.get("content-security-policy") ?? "", /'nonce-/);
    // The adapter's context carries nonce + address only: nothing from the request (headers, query, body) seeds locals.
    assert.deepEqual(Object.keys(contexts[0] as object).sort(), ["address", "nonce", "platform"]);
  } finally {
    await serving.close();
  }
});
