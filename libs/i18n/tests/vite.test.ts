import { onTestFinished, test } from "vitest";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer, resolveConfig } from "vite";

const root = fileURLToPath(new URL("./fixture/", import.meta.url));
const read = (dir: string) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".js"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");

test("one client build per locale: strings inlined, no catalog or parser shipped", async () => {
  const out = mkdtempSync(join(tmpdir(), "rivet-i18n-build-"));
  try {
    for (const locale of ["en", "de"]) {
      process.env.RIVET_LOCALE = locale;
      await build({ root, logLevel: "silent", build: { outDir: join(out, "client") } });
    }
  } finally {
    delete process.env.RIVET_LOCALE;
  }
  const de = read(join(out, "client", "de"));
  // The minifier may quote with backticks.
  assert.ok(/Artikel/.test(de) && /[`"]de[`"]/.test(de), "de chunk inlines the German message");
  assert.ok(!/[`"] items|[`"]en[`"]|icu-messageformat|cart\.count/.test(de), "de chunk carries no other locale or catalog");
  assert.ok(/[`"] items/.test(read(join(out, "client", "en"))), "en chunk inlines the English message");
  const manifest = JSON.parse(readFileSync(join(out, "client", "de", ".vite", "rivet-resume.json"), "utf8"));
  assert.ok(Object.values(manifest.symbols as Record<string, string>).every((url) => url.startsWith("/de/assets/")));
});

test("a client build without RIVET_LOCALE fails", async () => {
  await assert.rejects(build({ root, logLevel: "silent", build: { outDir: mkdtempSync(join(tmpdir(), "rivet-i18n-x-")) } }), /RIVET_LOCALE/);
});

test("the server build carries every locale", async () => {
  const out = mkdtempSync(join(tmpdir(), "rivet-i18n-ssr-"));
  await build({ root, logLevel: "silent", build: { ssr: "src/page.tsx", outDir: out } });
  const code = read(out);
  assert.match(code, /Cart/);
  assert.match(code, /Warenkorb/);
  assert.doesNotMatch(code, /cart\.title/);
});

test("dev: client modules compile per locale (?rivet-locale), app imports keep the locale", async () => {
  const server = await createServer({ root, logLevel: "silent", server: { middlewareMode: true, ws: false } });
  try {
    const de = await server.transformRequest("/src/page.tsx?rivet-locale=de");
    assert.match(de!.code, /Warenkorb/);
    assert.doesNotMatch(de!.code, /Cart/);
    const en = await server.transformRequest("/src/page.tsx");
    assert.match(en!.code, /Cart/);
    assert.doesNotMatch(en!.code, /Warenkorb/);
    const importer = join(root, "src/other.tsx") + "?rivet-locale=de";
    const app = await server.environments.client.pluginContainer.resolveId("./page.tsx", importer);
    assert.equal(app?.id, join(root, "src/page.tsx") + "?rivet-locale=de");
    const framework = await server.environments.client.pluginContainer.resolveId("@rivetjs/i18n", importer);
    assert.ok(framework && !framework.id.includes("rivet-locale"), String(framework?.id));
    const ssr = await server.environments.ssr.pluginContainer.resolveId("./page.tsx", importer);
    assert.ok(ssr && !ssr.id.includes("rivet-locale="), String(ssr?.id));
  } finally {
    await server.close();
  }
});

test("dev: translated client modules lower DOM v2 (message text in the _tpl HTML, no v1 template core)", async () => {
  const server = await createServer({ root, logLevel: "silent", server: { middlewareMode: true, ws: false } });
  try {
    const de = (await server.transformRequest("/src/page.tsx?rivet-locale=de"))!.code;
    assert.match(de, /_tpl\("<main><h1>Warenkorb<\/h1><button>"\)/);
    assert.match(de, /_t\(_el\$\d+, __i18nPlural\("de"/);
    assert.doesNotMatch(de, /__rivetSpec\d|bindChild|template as/);
  } finally {
    await server.close();
  }
});

test("declarations are generated", () => {
  const dts = readFileSync(join(root, "src/rivet-i18n.d.ts"), "utf8");
  assert.match(dts, /"cart\.title": \{\}/);
  assert.match(dts, /"cart\.count": \{ n: number \}/);
});

test("router in a locale's client build: assets under <base><locale>/, routes and BASE keep the app base", async () => {
  // A copy: resolving the config regenerates `.rivet/` (here under /shop), which browser.test.ts builds from.
  const fixture = fileURLToPath(new URL("./fixture-app/", import.meta.url));
  const app = mkdtempSync(fileURLToPath(new URL("./.base-app-", import.meta.url))) + "/";
  cpSync(fixture, app, { recursive: true, filter: (src) => !/[/\\](dist|\.rivet)([/\\]|$)/.test(src.slice(fixture.length - 1)) });
  onTestFinished(() => rmSync(app, { recursive: true, force: true }));
  const baseModule = fileURLToPath(import.meta.resolve("@rivetjs/router").replace(/index\.ts$/, "shared/base.ts"));
  const source = readFileSync(baseModule, "utf8");
  const transformed = async (config: Awaited<ReturnType<typeof resolveConfig>>) => {
    const router = config.plugins.find((p) => p.name === "vite-plugin-rivet-router")!;
    const hook = router.transform as (code: string, id: string) => { code: string } | null;
    return hook.call({ error: (message: string) => assert.fail(message) } as never, source, baseModule)?.code;
  };
  process.env.RIVET_LOCALE = "de";
  try {
    const client = await resolveConfig({ root: app, configFile: app + "vite.config.ts", base: "/shop/", logLevel: "silent" }, "build");
    assert.equal(client.base, "/shop/de/");
    assert.match((await transformed(client))!, /normalizeBase\("\/shop\/"\)/);
    // Other locales' URLs are not client-routable in this build: `underBase` also checks the locale prefix.
    assert.match((await transformed(client))!, /new RegExp\("\^\/de\(\?:\/\|\$\)", "i"\)/);
  } finally {
    delete process.env.RIVET_LOCALE;
  }
  const server = await resolveConfig({ root: app, configFile: app + "vite.config.ts", base: "/shop/", logLevel: "silent", build: { ssr: true } }, "build");
  assert.equal(server.base, "/shop/");
  assert.equal(await transformed(server), undefined);
});

test("clientPathPattern: the paths a client build's locale serves", async () => {
  const { clientPathPattern } = await import("../vite.ts");
  const base = { locales: ["en", "de", "pt-BR"], defaultLocale: "en" };
  const own = (locale: string, routing?: { prefix: "always" | "as-needed" | "never" | Record<string, string> }) => {
    const source = clientPathPattern(locale, { ...base, ...(routing ? { routing } : {}) });
    return source === null ? null : (path: string) => new RegExp(source, "i").test(path);
  };
  const en = own("en")!;
  assert.deepEqual(["/", "/cart", "/dev", "/de", "/DE/cart", "/pt-br"].map(en), [true, true, true, false, false, false]);
  const de = own("de")!;
  assert.deepEqual(["/", "/cart", "/de", "/de/cart", "/dev"].map(de), [false, false, true, true, false]);
  assert.deepEqual(["/en", "/"].map(own("en", { prefix: "always" })!), [true, false]);
  assert.deepEqual(["/deutsch/x", "/de"].map(own("de", { prefix: { de: "/deutsch/" } })!), [true, false]);
  assert.equal(own("de", { prefix: "never" }), null);
});
