import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "vitest";
import { stageUIAssets } from "../docs-cloudflare.ts";

test("the free UI deployment preserves every public file at the same URL across the page and asset Workers", async () => {
  const root = await mkdtemp(join(tmpdir(), "rivet-docs-cloudflare-"));
  const files = {
    "index.html": "<script src='/assets/app.js'></script>",
    "_data.json": '{"route":"/"}',
    "404.html": "Missing",
    "api/button/index.html": "Button reference",
    "assets/app.js": "import './chunk.js'",
    "assets/chunk.js": "export const button = true",
    "assets/font.woff2": "font bytes",
    "pagefind/fragment.pf_fragment": "search bytes",
    _headers: "/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n",
  };
  try {
    for (const [path, content] of Object.entries({ ...files, ".vite/manifest.json": "build metadata" })) {
      const target = join(root, "dist/client", path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    const result = await stageUIAssets(root);
    for (const [path, content] of Object.entries(files)) {
      const worker = /^(assets|pagefind)\//.test(path) ? "assets" : "site";
      assert.equal(await readFile(join(root, "dist/cloudflare", worker, path), "utf8"), content, `${path} keeps its bytes and URL`);
      assert.equal(await readFile(join(root, "dist/client", path), "utf8"), content, `${path} remains in the checked build`);
    }
    assert.equal(await readFile(join(root, "dist/cloudflare/assets/_headers"), "utf8"), files._headers);
    assert.equal((await readdir(join(root, "dist/cloudflare/site"))).includes(".vite"), false);
    assert.ok(result.site < 20_000 && result.assets < 20_000);
    await writeFile(join(root, "dist/cloudflare/site/stale.txt"), "old build");
    await stageUIAssets(root);
    assert.equal((await readdir(join(root, "dist/cloudflare/site"))).includes("stale.txt"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
