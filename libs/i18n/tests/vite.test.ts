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

test("?image with per-locale client builds: URLs locale-free, files once beside the locale directories", async () => {
  const sharp = (await import("sharp")).default;
  const { rivet } = await import("@rivetjs/compiler/vite");
  const { i18n } = await import("../vite.ts");
  const { pathToFileURL } = await import("node:url");
  const { existsSync, mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(".artifacts", { recursive: true });
  const app = mkdtempSync(join(process.cwd(), ".artifacts", "i18n-images-"));
  onTestFinished(() => rmSync(app, { recursive: true, force: true }));
  mkdirSync(join(app, "locales"));
  writeFileSync(join(app, "locales/en.json"), JSON.stringify({ hero: "A hero" }));
  writeFileSync(join(app, "locales/de.json"), JSON.stringify({ hero: "Ein Held" }));
  await sharp({ create: { width: 800, height: 400, channels: 3, background: "#123456" } })
    .jpeg()
    .toFile(join(app, "hero.jpg"));
  writeFileSync(
    join(app, "view.tsx"),
    `import { Picture } from "@rivetjs/runtime/image";\nimport { t } from "@rivetjs/i18n";\nimport hero from "./hero.jpg?image";\nexport default () => <main><Picture image={hero} alt={t("hero")} /></main>;\n`,
  );
  writeFileSync(join(app, "client.tsx"), `import { mount } from "@rivetjs/runtime/dom";\nimport View from "./view.tsx";\nmount(View, document.body);\n`);
  writeFileSync(
    join(app, "server.tsx"),
    `import { renderToString } from "@rivetjs/runtime/server";\nimport View from "./view.tsx";\nexport const render = (variant: number) => renderToString(() => View(), { variant });\n`,
  );
  const plugins = () => [
    i18n({ locales: ["en", "de"], defaultLocale: "en", catalogs: "locales/{locale}.json", dts: "i18n.d.ts" }),
    rivet({ images: { cacheDir: ".image-cache" } }),
  ];
  try {
    for (const locale of ["en", "de"]) {
      process.env.RIVET_LOCALE = locale;
      await build({
        root: app,
        configFile: false,
        logLevel: "silent",
        plugins: plugins(),
        build: { outDir: join(app, "dist/client"), rollupOptions: { input: join(app, "client.tsx") } },
      });
    }
  } finally {
    delete process.env.RIVET_LOCALE;
  }
  await build({
    root: app,
    configFile: false,
    logLevel: "silent",
    plugins: plugins(),
    build: { ssr: join(app, "server.tsx"), outDir: join(app, "dist/server") },
  });
  const { render } = await import(pathToFileURL(join(app, "dist/server/server.js")).href);
  for (const [variant, alt] of [
    [0, "A hero"],
    [1, "Ein Held"],
  ] as const) {
    const html: string = await render(variant);
    assert.match(html, new RegExp(`alt="${alt}"`));
    const urls = [...html.matchAll(/(?:src|srcset)="([^"]+)"/g)].flatMap((m) => m[1]!.split(/,\s+/).map((part) => part.split(/\s+/)[0]!));
    assert.ok(urls.length > 1, html);
    for (const url of urls) {
      assert.match(url, /^\/assets\//);
      assert.ok(existsSync(join(app, "dist/client", url)), url + " exists in dist/client");
    }
  }
  // Once: no per-locale copies; each locale's client code names the same locale-free URLs.
  for (const locale of ["en", "de"]) {
    assert.ok(
      !existsSync(join(app, "dist/client", locale, "assets")) || !readdirSync(join(app, "dist/client", locale, "assets")).some((f) => f.startsWith("hero-")),
    );
    const code = read(join(app, "dist/client", locale));
    assert.ok(/[`"]\/assets\/hero-/.test(code), locale + " client code names /assets/hero-…");
    assert.ok(!code.includes(`/${locale}/assets/hero-`), locale + " client code names no per-locale image URL");
  }
});

test("locale(): the request locale on the server, the build's constant in the browser (dev: the page's locale)", async () => {
  const { rivet } = await import("@rivetjs/compiler/vite");
  const { i18n } = await import("../vite.ts");
  const { pathToFileURL } = await import("node:url");
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(".artifacts", { recursive: true });
  const app = mkdtempSync(join(process.cwd(), ".artifacts", "i18n-locale-"));
  onTestFinished(() => rmSync(app, { recursive: true, force: true }));
  mkdirSync(join(app, "locales"));
  writeFileSync(join(app, "locales/en.json"), JSON.stringify({ hi: "Hi" }));
  writeFileSync(join(app, "locales/de.json"), JSON.stringify({ hi: "Hallo" }));
  writeFileSync(
    join(app, "view.tsx"),
    `import { locale, t } from "@rivetjs/i18n";\nexport default () => <p lang={locale()} data-n={new Intl.NumberFormat(locale()).format(1.5)}>{t("hi")}</p>;\n`,
  );
  writeFileSync(join(app, "client.tsx"), `import { mount } from "@rivetjs/runtime/dom";\nimport View from "./view.tsx";\nmount(View, document.body);\n`);
  writeFileSync(
    join(app, "server.tsx"),
    `import { Provider, renderToString } from "@rivetjs/runtime/server";\nimport { ServerData } from "@rivetjs/router/route-context";\nimport View from "./view.tsx";\n` +
      `export const render = (variant: number, locale: string) => renderToString(() => Provider({ token: ServerData, value: { data: [], url: new URL("https://x.test/"), head: undefined, locale }, children: () => View() }), { variant });\n` +
      `export const outside = () => renderToString(() => View());\n`,
  );
  const plugins = () => [i18n({ locales: ["en", "de"], defaultLocale: "en", catalogs: "locales/{locale}.json", dts: "i18n.d.ts" }), rivet()];
  process.env.RIVET_LOCALE = "de";
  try {
    await build({
      root: app,
      configFile: false,
      logLevel: "silent",
      plugins: plugins(),
      build: { outDir: join(app, "dist/client"), rollupOptions: { input: join(app, "client.tsx") } },
    });
  } finally {
    delete process.env.RIVET_LOCALE;
  }
  const code = read(join(app, "dist/client/de"));
  assert.ok(/[`"]de[`"]/.test(code), "the de build inlines its locale");
  assert.ok(!code.includes("has no request locale") && !code.includes("rivet.context"), "nothing of the server locale() ships");
  await build({
    root: app,
    configFile: false,
    logLevel: "silent",
    plugins: plugins(),
    build: { ssr: join(app, "server.tsx"), outDir: join(app, "dist/server") },
  });
  const { render, outside } = await import(pathToFileURL(join(app, "dist/server/server.js")).href);
  assert.equal(await render(1, "de"), '<p lang="de" data-n="1,5">Hallo</p>');
  assert.equal(await render(0, "en"), '<p lang="en" data-n="1.5">Hi</p>');
  await assert.rejects(async () => outside(), /locale\(\) has no request locale/);
  // Dev: the importer's locale query (default locale without one); the server environment keeps the real module.
  const server = await createServer({ root: app, configFile: false, logLevel: "silent", plugins: plugins(), server: { middlewareMode: true, ws: false } });
  try {
    const de = await server.environments.client.pluginContainer.resolveId("@rivetjs/i18n", join(app, "view.tsx") + "?rivet-locale=de");
    assert.equal(de?.id, "\0rivet-i18n-client:de");
    const en = await server.environments.client.pluginContainer.resolveId("@rivetjs/i18n", join(app, "view.tsx"));
    assert.equal(en?.id, "\0rivet-i18n-client:en");
    const loaded = await server.environments.client.pluginContainer.load("\0rivet-i18n-client:de");
    assert.match(String(typeof loaded === "string" ? loaded : loaded?.code), /export const locale = \(\) => "de";/);
    const ssr = await server.environments.ssr.pluginContainer.resolveId("@rivetjs/i18n", join(app, "view.tsx"));
    assert.ok(ssr && !ssr.id.startsWith("\0"), String(ssr?.id));
  } finally {
    await server.close();
  }
});
