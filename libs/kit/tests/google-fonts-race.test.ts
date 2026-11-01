// Vite resolves several `google-font:` imports of one family in parallel: concurrent cold-cache writers of one file must
// not share a temporary name (the second `rename` failed ENOENT and the build errored intermittently).
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseGoogleFontId, resolveGoogleFont } from "../google-fonts.ts";

const CSS = `/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/inter/v1/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

test("google-font: concurrent cold resolves of one family all succeed", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "rivet-google-font-race-"));
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://fonts.googleapis.com/css2?")) return new Response(CSS);
    if (url === "https://fonts.gstatic.com/s/inter/v1/latin.woff2") return new Response(new Uint8Array(64 * 1024));
    return new Response("missing", { status: 404 });
  }) as typeof fetch;
  try {
    const request = parseGoogleFontId("google-font:Inter?weight=400&font")!;
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => resolveGoogleFont(request, cacheDir)));
    assert.deepEqual(
      results.map((r) => r.status),
      ["fulfilled", "fulfilled", "fulfilled", "fulfilled"],
    );
    assert.equal(new Set(results.map((r) => (r as PromiseFulfilledResult<{ id: string }>).value.id)).size, 1);
    assert.deepEqual(
      (await readdir(cacheDir)).filter((f) => f.endsWith(".tmp")),
      [],
    );
  } finally {
    globalThis.fetch = original;
    await rm(cacheDir, { recursive: true, force: true });
  }
});
