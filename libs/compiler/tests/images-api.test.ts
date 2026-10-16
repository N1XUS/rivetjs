import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { getImage } from "../images/index.ts";

test("getImage writes variants under outDir and returns a matching descriptor", async () => {
  await mkdir(".artifacts", { recursive: true });
  const dir = await mkdtemp(resolve(".artifacts/images-api-"));
  try {
    await sharp({ create: { width: 900, height: 300, channels: 3, background: "#345" } }).jpeg().toFile(resolve(dir, "cms.jpg"));
    const image = await getImage(resolve(dir, "cms.jpg"), {
      outDir: resolve(dir, "out"),
      base: "/static/",
      config: { formats: ["webp"], cacheDir: resolve(dir, "cache") },
      directives: { layout: "fixed", width: 300 },
    });
    assert.equal(image.width, 300);
    assert.equal(image.height, 100);
    const files = (await readdir(resolve(dir, "out/assets"))).sort();
    assert.equal(files.length, 4); // webp + jpeg × 1x/2x
    for (const url of image.sources.flatMap((s) => s.srcset.split(", ").map((p) => p.split(" ")[0]!)))
      assert.ok(files.includes(url.replace("/static/assets/", "")), url);
    await assert.rejects(getImage(resolve(dir, "cms.jpg"), { outDir: dir, directives: { width: -1 } }), /width must be a positive integer/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
