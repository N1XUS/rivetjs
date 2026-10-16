import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { sharpProcessor, type ImageProcessor } from "../images/processor.ts";
import { createPipeline, MIME_BY_EXT } from "../images/pipeline.ts";
import { pool } from "../images/cache.ts";

async function fixtures() {
  await mkdir(".artifacts", { recursive: true });
  const dir = await mkdtemp(resolve(".artifacts/images-pipeline-"));
  await sharp({ create: { width: 1200, height: 600, channels: 3, background: { r: 200, g: 80, b: 40 } } }).jpeg().toFile(resolve(dir, "photo.jpg"));
  await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 0.5 } } }).png().toFile(resolve(dir, "logo.png"));
  await writeFile(resolve(dir, "icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12" viewBox="0 0 24 12"/>');
  // Portrait pixels stored landscape with EXIF orientation 6 (rotate 90°).
  await sharp({ create: { width: 300, height: 100, channels: 3, background: "#888" } }).jpeg().withMetadata({ orientation: 6 }).toFile(resolve(dir, "rotated.jpg"));
  return dir;
}
function counting(inner: ImageProcessor) {
  const calls = { encode: 0 };
  return { calls, processor: { ...inner, id: inner.id, encode: (i: Buffer, o: Parameters<ImageProcessor["encode"]>[1]) => (calls.encode++, inner.encode(i, o)) } };
}

test("sharp metadata: dims, alpha, EXIF rotation, svg", async () => {
  const dir = await fixtures();
  try {
    const p = sharpProcessor();
    assert.match(p.id, /^sharp@\d+\.\d+\.\d+$/);
    const { readFile } = await import("node:fs/promises");
    assert.deepEqual(await p.metadata(await readFile(resolve(dir, "photo.jpg"))), { width: 1200, height: 600, format: "jpeg", hasAlpha: false, animated: false });
    assert.equal((await p.metadata(await readFile(resolve(dir, "logo.png")))).hasAlpha, true);
    const rotated = await p.metadata(await readFile(resolve(dir, "rotated.jpg")));
    assert.deepEqual([rotated.width, rotated.height], [100, 300]);
    const svg = await p.metadata(await readFile(resolve(dir, "icon.svg")));
    assert.deepEqual([svg.width, svg.height, svg.format, svg.animated], [24, 12, "svg", false]);
    const blur = await p.placeholder(await readFile(resolve(dir, "photo.jpg")), "blur");
    assert.equal(blur.kind, "blur");
    assert.ok(blur.kind === "blur" && blur.src.startsWith("data:image/webp;base64,") && blur.src.length < 600);
    // sharp bins the histogram, so derive the expected hex from its own stats.
    const { r, g, b } = (await sharp(resolve(dir, "photo.jpg")).stats()).dominant;
    const hex = "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
    assert.deepEqual(await p.placeholder(await readFile(resolve(dir, "photo.jpg")), "dominant-color"), { kind: "color", value: hex });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pipeline plans variants, alpha → png fallback, deterministic file names and URLs", async () => {
  const dir = await fixtures();
  try {
    const pipeline = createPipeline({ config: {}, processor: sharpProcessor(), base: "/", assetsDir: "assets", dev: false, cacheDir: resolve(dir, "cache") });
    const photo = await pipeline.describe(resolve(dir, "photo.jpg"), { width: 600 });
    assert.equal(photo.descriptor.width, 600);
    assert.equal(photo.descriptor.height, 300);
    assert.deepEqual(photo.descriptor.sources.map((s) => s.type), ["image/avif", "image/webp", "image/jpeg"]);
    assert.equal(photo.assets.length, 3 * 5); // 600, 640, 768, 1024, 1200
    assert.ok(photo.assets.every((a) => /^assets\/photo-\d+-[0-9a-f]{8}\.(avif|webp|jpg)$/.test(a.fileName) && a.url === "/" + a.fileName));
    assert.equal(photo.descriptor.placeholder?.kind, "blur");
    const again = await pipeline.describe(resolve(dir, "photo.jpg"), { width: 600 });
    assert.deepEqual(again.assets.map((a) => a.fileName), photo.assets.map((a) => a.fileName));
    const logo = await pipeline.describe(resolve(dir, "logo.png"), { layout: "fixed", width: 100, placeholder: "none" });
    assert.deepEqual(logo.descriptor.sources.at(-1), { type: "image/png", srcset: logo.assets.filter((a) => a.ext === "png").map((a, k) => `${a.url} ${k + 1}x`).join(", ") });
    assert.equal(logo.descriptor.placeholder, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("svg passthrough, upscale warning, dev URLs", async () => {
  const dir = await fixtures();
  try {
    const pipeline = createPipeline({ config: {}, processor: sharpProcessor(), base: "/app/", assetsDir: "static", dev: true, cacheDir: resolve(dir, "cache") });
    const icon = await pipeline.describe(resolve(dir, "icon.svg"), { width: 48 });
    assert.equal(icon.assets.length, 1);
    assert.equal(icon.assets[0]!.encode, undefined);
    assert.deepEqual({ ...icon.descriptor, src: "" }, { src: "", width: 48, height: 24, layout: "constrained", sources: [{ type: "image/svg+xml", srcset: icon.descriptor.src }] });
    assert.match(icon.descriptor.src, /^\/app\/@rivet\/image\/[0-9a-f]{64}\.svg$/);
    const big = await pipeline.describe(resolve(dir, "photo.jpg"), { width: 5000 });
    assert.deepEqual(big.warnings, [`${resolve(dir, "photo.jpg")}: requested width 5000px exceeds intrinsic 1200px; clamped`]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("encode uses disk cache across pipelines; output format matches", async () => {
  const dir = await fixtures();
  try {
    const cacheDir = resolve(dir, "cache");
    const first = counting(sharpProcessor());
    const a = createPipeline({ config: { formats: ["webp"] }, processor: first.processor, base: "/", assetsDir: "assets", dev: false, cacheDir });
    const described = await a.describe(resolve(dir, "photo.jpg"), { layout: "fixed", width: 300, placeholder: "none" });
    const outputs = await Promise.all(described.assets.map((asset) => a.encode(asset)));
    assert.equal(first.calls.encode, described.assets.length);
    assert.equal((await sharp(outputs[0]!).metadata()).format, "webp");
    assert.equal((await sharp(outputs[0]!).metadata()).width, 300);
    const second = counting(sharpProcessor());
    const b = createPipeline({ config: { formats: ["webp"] }, processor: second.processor, base: "/", assetsDir: "assets", dev: false, cacheDir });
    for (const asset of (await b.describe(resolve(dir, "photo.jpg"), { layout: "fixed", width: 300, placeholder: "none" })).assets) await b.encode(asset);
    assert.equal(second.calls.encode, 0);
    assert.ok((await readdir(cacheDir)).every((n) => !n.endsWith(".tmp")));
    assert.equal(MIME_BY_EXT.avif, "image/avif");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("pool bounds concurrency", async () => {
  const run = pool(2);
  let active = 0, peak = 0;
  await Promise.all(Array.from({ length: 6 }, () => run(async () => {
    peak = Math.max(peak, ++active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
  })));
  assert.equal(peak, 2);
});
