// Dev search (`tools/dev-search.ts`): a real Vite dev server with `docsDevSearch()` and a fixture app
// (routes module + pages) serves `/pagefind/*` from memory; Pagefind in Chromium finds pages by title
// with the build's URLs and section filters, skips ignored regions, and sees edits after a lazy rebuild
// (a change only marks the index stale; the next request starts one rebuild and gets the stale index).
// Run: `npx vitest run --project docs-kit` (needs Playwright Chromium).
import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser } from "playwright";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { docsSite } from "../vite.ts";
import { changedRoutes } from "../tools/dev-search.ts";

const page = (title: string, section: string, body: string) =>
  `<!doctype html><html lang="en"><head><title>${title} | Site</title></head><body>` +
  `<header data-pagefind-ignore=""><nav>Zebracorn navigation</nav></header>` +
  `<article data-pagefind-body="" data-pagefind-filter="section:${section}"><h1>${title}</h1><p>${body}</p>` +
  `<figure data-pagefind-ignore="">Quokkaframe example frame</figure></article>` +
  `<footer data-pagefind-ignore="">Zebracorn footer</footer></body></html>`;

/** Rendered pages by path (what the fixture app's handler answers). */
const pages = new Map<string, string>([
  ["/", page("Home", "Home", "Welcome to the site.")],
  ["/learn/signals", page("Signals in depth", "Learn", "Fine-grained reactive values.")],
  ["/api/runtime/mount", page("mount", "API", "Mounts a component into a host element.")],
]);

/** Page renders per path (the index fetches every page once per build). */
const renders = new Map<string, number>();

/** Fixture app: the generated routes module the dev index enumerates (a static route, an entries() route, a skipped dynamic one) + its pages. */
function fixtureApp(): Plugin {
  const ENTRY = "\0fixture-entry";
  return {
    name: "fixture-app",
    resolveId: (id) => (id === "/.rivet/entry.server.tsx" ? ENTRY : null),
    load: (id) =>
      id === ENTRY
        ? `export const routes = [
            { id: "index", pattern: "/", page: true },
            { id: "learn/signals", pattern: "/learn/signals", page: true },
            { id: "api/[...symbol]", pattern: "/api/*symbol", page: true, server: async () => ({ entries: () => [{ symbol: "runtime/mount" }] }) },
            { id: "drafts/[id]", pattern: "/drafts/:id", page: true },
            { id: "feed.xml", pattern: "/feed.xml", page: false },
          ];`
        : null,
    configureServer(server) {
      // Ahead of Vite's own middlewares (no SPA fallback rewriting the page URLs); /pagefind/ is mounted before it.
      server.middlewares.use((req, res) => {
        const path = (req.url ?? "/").split("?")[0]!;
        const html = pages.get(path);
        if (html && req.headers.accept === "text/html") renders.set(path, (renders.get(path) ?? 0) + 1);
        res.writeHead(html ? 200 : 404, { "content-type": "text/html; charset=utf-8" });
        res.end(html ?? "not found");
      });
    },
  };
}

let root: string;
let server: ViteDevServer;
let origin: string;
let browser: Browser;
beforeAll(async () => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "docs-dev-search-")));
  mkdirSync(join(root, "src/routes/learn"), { recursive: true });
  mkdirSync(join(root, "src/components"), { recursive: true });
  server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
    // Only the dev search plugin of the kit (the others need a docs app).
    plugins: [docsSite().find((plugin) => plugin.name === "rivet-docs-dev-search")!, fixtureApp()],
  });
  await server.listen();
  const address = server.httpServer!.address() as { port: number };
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
}, 60_000);
afterAll(async () => {
  await browser?.close();
  await server?.close();
  rmSync(root, { recursive: true, force: true });
});

interface Found {
  url: string;
  title: string | undefined;
  section: string[] | undefined;
  excerpt: string;
}
/** Query the dev index the way the search dialog does (`/pagefind/pagefind.js`, same origin). */
async function search(query: string): Promise<Found[]> {
  const tab = await browser.newPage();
  try {
    await tab.goto(origin + "/");
    return await tab.evaluate(async (query) => {
      const pagefind = await import(/* @vite-ignore */ new URL("/pagefind/pagefind.js", location.href).href);
      const { results } = await pagefind.search(query);
      const data = await Promise.all(results.map((result: { data(): Promise<unknown> }) => result.data()));
      return data.map((entry: { url: string; meta: { title?: string }; filters: Record<string, string[]>; excerpt: string }) => ({
        url: entry.url,
        title: entry.meta.title,
        section: entry.filters.section,
        excerpt: entry.excerpt,
      }));
    }, query);
  } finally {
    await tab.close();
  }
}

test("dev server serves pagefind.js and an in-memory index of the rendered pages", async () => {
  const script = await fetch(origin + "/pagefind/pagefind.js");
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type") ?? "", /javascript/);
  const entry = await fetch(origin + "/pagefind/pagefind-entry.json");
  assert.equal(entry.status, 200);
  const found = await search("Signals in depth");
  assert.equal(found[0]?.url, "/learn/signals/");
  assert.equal(found[0]?.title, "Signals in depth");
  assert.deepEqual(found[0]?.section, ["Learn"]);
  // entries() routes are indexed under the build's trailing-slash URL.
  assert.deepEqual(
    (await search("mount")).map((hit) => [hit.url, hit.section?.[0]]),
    [["/api/runtime/mount/", "API"]],
  );
  // Ignored regions (nav, footer, example frames) stay out, as in the build's index.
  assert.equal((await search("Zebracorn")).length, 0);
  assert.equal((await search("Quokkaframe")).length, 0);
  assert.equal((await fetch(origin + "/pagefind/nope.js")).status, 404);
  // Nothing written to disk.
  assert.equal(existsSync(join(root, "pagefind")), false);
}, 60_000);

test("a source change marks the index stale; the next request rebuilds once, served the stale index meanwhile", async () => {
  const entryJSON = async () => (await fetch(origin + "/pagefind/pagefind-entry.json")).text();
  const before = await entryJSON();
  const rendered = renders.get("/learn/signals") ?? 0;
  const home = renders.get("/") ?? 0;
  pages.set("/learn/signals", page("Signals in depth", "Learn", "Now mentions xylophones."));
  writeFileSync(join(root, "src/routes/learn/signals.tsx"), "export default () => null;\n");
  // No eager rebuild: nothing renders the pages until search is used again.
  await new Promise((done) => setTimeout(done, 1500));
  assert.equal(renders.get("/learn/signals") ?? 0, rendered, "no rebuild without a request");
  // Concurrent requests: answered at once from the stale index, one rebuild between them.
  const answers = await Promise.all([entryJSON(), entryJSON(), entryJSON()]);
  assert.deepEqual(answers, [before, before, before]);
  let after = before;
  for (let tries = 0; tries < 150 && after === before; tries++) {
    await new Promise((done) => setTimeout(done, 100));
    after = await entryJSON();
  }
  assert.notEqual(after, before, "index rebuilt after the next request");
  assert.equal(renders.get("/learn/signals"), rendered + 1, "one rebuild for all requests");
  // Only the changed route module's page was rendered again; the others came from the previous run.
  assert.equal(renders.get("/"), home);
  assert.deepEqual(
    (await search("xylophones")).map((hit) => hit.url),
    ["/learn/signals/"],
  );
  // Fresh again: more requests start no rebuild.
  await entryJSON();
  await new Promise((done) => setTimeout(done, 300));
  assert.equal(renders.get("/learn/signals"), rendered + 1);
}, 60_000);

test("a change outside route modules renders every page again", async () => {
  const entryJSON = async () => (await fetch(origin + "/pagefind/pagefind-entry.json")).text();
  const before = await entryJSON();
  const counts = [...pages.keys()].map((path) => renders.get(path) ?? 0);
  pages.set("/", page("Home", "Home", "Welcome, now with pangolins."));
  writeFileSync(join(root, "src/components/Shared.tsx"), "export const x = 1;\n");
  await new Promise((done) => setTimeout(done, 500));
  let after = await entryJSON();
  for (let tries = 0; tries < 150 && after === before; tries++) {
    await new Promise((done) => setTimeout(done, 100));
    after = await entryJSON();
  }
  assert.notEqual(after, before, "index rebuilt");
  assert.deepEqual(
    [...pages.keys()].map((path) => renders.get(path) ?? 0),
    counts.map((n) => n + 1),
  );
  assert.deepEqual(
    (await search("pangolins")).map((hit) => hit.url),
    ["/"],
  );
}, 60_000);

test("changedRoutes: route modules narrow the re-render, page Markdown is skipped, anything else is all", () => {
  const ids = new Set(["index", "(docs)/learn/signals", "api/[...symbol]"]);
  const at = (...files: string[]) => new Set(files.map((file) => join("/app", file)));
  assert.equal(changedRoutes("all", "/app", ids), "all");
  assert.deepEqual(
    changedRoutes(at("src/routes/(docs)/learn/signals.tsx", "content/learn/signals.md", "src/routes/api/[...symbol].tsx"), "/app", ids),
    new Set(["(docs)/learn/signals", "api/[...symbol]"]),
  );
  assert.deepEqual(changedRoutes(at("content/learn/signals.md"), "/app", ids), new Set());
  // Shared inputs: generated data, layouts, components, nav, fragments, unknown route files.
  for (const file of [
    "src/generated/pages.ts",
    "src/routes/_layout.tsx",
    "src/components/Nav.tsx",
    "content/_nav.ts",
    "content/_hero.md",
    "src/routes/gone.tsx",
    "../libs/x.ts",
  ])
    assert.equal(changedRoutes(at(file), "/app", ids), "all", file);
});
