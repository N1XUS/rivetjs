import { test } from "vitest";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { kit } from "../vite.ts";

// A real variable woff2 (latin subset) from the workspace's fontsource install (`@fontsource-variable/geist`, a docs-kit dependency).
const WOFF2 = fileURLToPath(new URL("../../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2", import.meta.url));

/** Run the plugin's `load` hook the way Vite does, collecting warnings. */
async function load(plugin: ReturnType<typeof kit>, id: string): Promise<{ code: string; warnings: string[] }> {
  const warnings: string[] = [];
  const ctx = {
    warn: (message: string) => warnings.push(message),
    error: (message: string) => {
      throw new Error(message);
    },
    addWatchFile() {},
  };
  const hook = plugin.load as unknown as (this: typeof ctx, id: string) => Promise<string | null>;
  const code = await hook.call(ctx, id);
  assert.ok(code !== null, `load(${id}) returned null`);
  return { code, warnings };
}

test("?font fallback: metric-matched @font-face for a local woff2 (capsize unpack v4 fromBuffer)", async () => {
  const plugin = kit();
  const query = "family=Jakarta&weight=200..800&fallback=Arial&font";
  const descriptor = await load(plugin, `${WOFF2}?${query}`);
  assert.deepEqual(descriptor.warnings, []);
  assert.match(descriptor.code, /stack: "\\"Jakarta\\", \\"Jakarta Fallback\\", sans-serif"/);
  const sheet = await load(plugin, `${WOFF2}.rivet-font.css?${query}`);
  assert.deepEqual(sheet.warnings, []);
  const face =
    /@font-face\{font-family:"Jakarta Fallback";src:local\("Arial"\);size-adjust:([\d.]+)%;ascent-override:([\d.]+)%;descent-override:([\d.]+)%;line-gap-override:([\d.]+)%\}/.exec(
      sheet.code,
    );
  assert.ok(face, sheet.code);
  // Geist: xWidthAvg 467 / 1000 upm, ascent 1005, descent -295; Arial: xWidthAvg 913 / 2048 upm.
  const size = 467 / 1000 / (913 / 2048);
  assert.equal(face[1], (size * 100).toFixed(2));
  assert.equal(face[2], ((1005 / (1000 * size)) * 100).toFixed(2));
  assert.equal(face[3], ((295 / (1000 * size)) * 100).toFixed(2));
  assert.equal(face[4], "0.00");
});

test("?font fallback: a variable font of a family the metrics collection knows uses its regular-weight metrics", async () => {
  const plugin = kit();
  const file = fileURLToPath(new URL("../../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2", import.meta.url));
  const face = (code: string) => /size-adjust:([\d.]+)%/.exec(code)?.[1];
  // Variable (weight range): Manrope regular xWidthAvg 920 / 2000 upm (the file's default instance unpacks narrower: 0.4435).
  const variable = await load(plugin, `${file}.rivet-font.css?family=Manrope&weight=200..800&fallback=Arial&font`);
  assert.equal(face(variable.code), ((920 / 2000 / (913 / 2048)) * 100).toFixed(2));
  // One weight: the file's own metrics.
  const single = await load(plugin, `${file}.rivet-font.css?family=Manrope&weight=400&fallback=Arial&font`);
  assert.notEqual(face(single.code), face(variable.code));
});

test("?font fallback: generic families need no metrics", async () => {
  const plugin = kit();
  const { code, warnings } = await load(plugin, `${WOFF2}?fallback=serif&font`);
  assert.deepEqual(warnings, []);
  assert.match(code, /stack: "\\"geist-latin-wght-normal\\", serif"/);
});

test("?font fallback: unknown metrics font warns and keeps the named fallback in the stack", async () => {
  const plugin = kit();
  const { code, warnings } = await load(plugin, `${WOFF2}?family=J&fallback=No Such Font&font`);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /fallback metrics for "No Such Font" skipped/);
  assert.match(code, /stack: "\\"J\\", \\"No Such Font\\", sans-serif"/);
});

// Google Fonts: css2 + gstatic answered by a mocked fetch (no network in tests).
const GOOGLE_CSS = (family: string, style: string) => `/* cyrillic */
@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: 200 800;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/x/v1/cyrillic.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F;
}
/* latin */
@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: 200 800;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/x/v1/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+2000-206F;
}
`;
async function mockGoogle(): Promise<{ urls: string[]; restore(): void; offline(): void }> {
  const { readFile } = await import("node:fs/promises");
  const woff2 = await readFile(WOFF2);
  const urls: string[] = [];
  let online = true;
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    urls.push(url);
    if (!online) throw new TypeError("fetch failed");
    assert.match(String(new Headers(init?.headers).get("user-agent")), /Chrome\//);
    if (url.startsWith("https://fonts.googleapis.com/css2?")) return new Response(GOOGLE_CSS("Plus Jakarta Sans", url.includes("ital") ? "italic" : "normal"));
    if (url === "https://fonts.gstatic.com/s/x/v1/latin.woff2") return new Response(woff2);
    return new Response("missing", { status: 404 });
  }) as typeof fetch;
  return { urls, restore: () => void (globalThis.fetch = original), offline: () => void (online = false) };
}

test("parseGoogleFontId: css2 URL (sorted axes, italic, text), local ?font params", async () => {
  const { parseGoogleFontId } = await import("../google-fonts.ts");
  assert.equal(parseGoogleFontId("./a.woff2?font"), null);
  assert.throws(() => parseGoogleFontId("google-font:Inter?weight=400"), /need "&font"/);
  assert.throws(() => parseGoogleFontId("google-font:Inter?axes=wght:1..2&font"), /invalid axis/);
  assert.throws(() => parseGoogleFontId("google-font:In%22ter?font"), /invalid Google font family/);
  const flex = parseGoogleFontId("google-font:Roboto+Flex?weight=100..1000&style=italic&axes=opsz:8..144,XTRA:323..603,wdth:25..151&fallback=Arial&font")!;
  assert.equal(flex.url, "https://fonts.googleapis.com/css2?family=Roboto+Flex:ital,opsz,wdth,wght,XTRA@1,8..144,25..151,100..1000,323..603&display=swap");
  assert.equal(flex.subset, "latin");
  assert.equal(flex.params.toString(), "family=Roboto+Flex&weight=100..1000&style=italic&fallback=Arial");
  const text = parseGoogleFontId("google-font:Inter?text=Hello%20World&font")!;
  assert.equal(text.url, "https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap&text=Hello%20World");
  assert.equal(text.subset, "text");
});

test("google-font: downloads once into the cache, self-hosts through ?font, works offline from the cache", async () => {
  const { mkdtemp, readdir, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const cacheDir = await mkdtemp(join(tmpdir(), "rivet-google-font-"));
  const google = await mockGoogle();
  try {
    const plugin = kit({ fonts: { cacheDir } });
    const resolveId = plugin.resolveId as unknown as (this: unknown, id: string) => Promise<string>;
    const ctx = {
      error: (message: string) => {
        throw new Error(message);
      },
    };
    const id = await resolveId.call(ctx, "google-font:Plus+Jakarta+Sans?weight=200..800&fallback=Arial&font");
    assert.deepEqual(google.urls, [
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&display=swap",
      "https://fonts.gstatic.com/s/x/v1/latin.woff2",
    ]);
    const [file, query] = id.split("?") as [string, string];
    assert.match(file, /plus-jakarta-sans-latin-[0-9a-f]{16}\.woff2$/);
    assert.equal(
      new URLSearchParams(query).toString(),
      "family=Plus+Jakarta+Sans&weight=200..800&style=normal&fallback=Arial&unicodeRange=U%2B0000-00FF%2C+U%2B0131%2C+U%2B2000-206F&font=",
    );
    assert.ok(query.endsWith("&font"));
    const descriptor = await load(plugin, id);
    assert.deepEqual(descriptor.warnings, []);
    assert.match(descriptor.code, /family: "Plus Jakarta Sans", stack: "\\"Plus Jakarta Sans\\", \\"Plus Jakarta Sans Fallback\\", sans-serif"/);
    const sheet = await load(plugin, file + ".rivet-font.css?" + query);
    assert.match(
      sheet.code,
      /^@font-face\{font-family:"Plus Jakarta Sans";src:url\("\.\/plus-jakarta-sans-latin-[0-9a-f]{16}\.woff2\?no-inline"\) format\("woff2"\);font-weight:200 800;font-style:normal;font-display:swap;unicode-range:U\+0000-00FF, U\+0131, U\+2000-206F\}@font-face\{font-family:"Plus Jakarta Sans Fallback"/,
    );
    // Warm cache: no network at all.
    google.offline();
    google.urls.length = 0;
    assert.equal(await resolveId.call(ctx, "google-font:Plus+Jakarta+Sans?weight=200..800&fallback=Arial&font"), id);
    assert.deepEqual(google.urls, []);
    // Cold cache offline: a clear error naming the cache and the self-host alternative.
    await assert.rejects(
      resolveId.call(ctx, "google-font:Plus+Jakarta+Sans?style=italic&font"),
      /download of https:\/\/fonts\.googleapis\.com\/css2\?family=Plus\+Jakarta\+Sans:ital,wght@1,400&display=swap failed[\s\S]*cacheDir[\s\S]*self-host/,
    );
    assert.deepEqual(
      (await readdir(cacheDir)).filter((f) => f.endsWith(".tmp")),
      [],
    );
  } finally {
    google.restore();
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("google-font: unknown subset lists the available ones", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const cacheDir = await mkdtemp(join(tmpdir(), "rivet-google-font-"));
  const google = await mockGoogle();
  try {
    const resolveId = kit({ fonts: { cacheDir } }).resolveId as unknown as (this: unknown, id: string) => Promise<string>;
    const ctx = {
      error: (message: string) => {
        throw new Error(message);
      },
    };
    await assert.rejects(resolveId.call(ctx, "google-font:Plus+Jakarta+Sans?subset=greek&font"), /no "greek" subset \(available: cyrillic, latin\)/);
  } finally {
    google.restore();
    await rm(cacheDir, { recursive: true, force: true });
  }
});
