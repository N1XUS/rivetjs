import { test } from "vitest";
import assert from "node:assert/strict";
import { parseImageId, resolveOptions, validateConfig, DEFAULT_QUALITY } from "../images/options.ts";

test("parseImageId: keyword, directives, vite keys ignored, non-images skipped", () => {
  assert.equal(parseImageId("/a/x.jpg"), null);
  assert.equal(parseImageId("/a/x.tsx?image"), null);
  assert.equal(parseImageId("/a/x.jpg?url"), null);
  assert.deepEqual(parseImageId("/a/x.jpg?image"), { file: "/a/x.jpg", kind: "image", directives: {} });
  assert.deepEqual(parseImageId("/a/x.PNG?layout=fixed&width=320&formats=avif;webp&densities=1;1.5&image&import&t=123"), {
    file: "/a/x.PNG",
    kind: "image",
    directives: { layout: "fixed", width: 320, formats: ["avif", "webp"], densities: [1, 1.5] },
  });
  assert.deepEqual(parseImageId("/a/l.svg?width=24&jsx"), { file: "/a/l.svg", kind: "jsx", directives: { width: 24 } });
  assert.throws(() => parseImageId("/a/x.jpg?image&jsx"), /use one of \?image, \?jsx or \?svg, not \?image \+ \?jsx/);
});

test("invalid directives name the file and key", () => {
  assert.throws(() => parseImageId("/a/x.jpg?bogus=1&image"), /\/a\/x\.jpg: unknown image directive "bogus"/);
  assert.throws(() => parseImageId("/a/x.jpg?width=0&image"), /width must be a positive integer/);
  assert.throws(() => parseImageId("/a/x.jpg?formats=gif&image"), /unknown image format "gif"/);
  assert.throws(() => parseImageId("/a/x.jpg?layout=tiled&image"), /layout must be one of fixed, constrained, full-width/);
  assert.throws(() => parseImageId("/a/x.jpg?quality=101&image"), /quality must be 1-100/);
  assert.throws(() => parseImageId("/a/x.jpg?position=middle&image"), /position must be one of/);
});

test("merge precedence: import > preset > config > defaults", () => {
  const config = { formats: ["webp" as const], placeholder: "none" as const, presets: { hero: { layout: "full-width" as const, quality: 40 } } };
  const base = resolveOptions(config, {}, "/x.jpg");
  assert.deepEqual(base, {
    layout: "constrained", width: undefined, height: undefined, formats: ["webp"], quality: DEFAULT_QUALITY,
    densities: [1, 2], breakpoints: [640, 768, 1024, 1280, 1536, 1920, 2560], placeholder: "none", fit: "cover", position: "center",
  });
  const preset = resolveOptions(config, { preset: "hero" }, "/x.jpg");
  assert.equal(preset.layout, "full-width");
  assert.deepEqual(preset.quality, { avif: 40, webp: 40, jpeg: 40, png: 40 });
  const own = resolveOptions(config, { preset: "hero", layout: "fixed", width: 10 }, "/x.jpg");
  assert.equal(own.layout, "fixed");
  assert.equal(own.width, 10);
  assert.throws(() => resolveOptions(config, { preset: "nope" }, "/x.jpg"), /\/x\.jpg: unknown image preset "nope"/);
  assert.deepEqual(resolveOptions({ quality: { avif: 30 } }, {}, "/x.jpg").quality, { ...DEFAULT_QUALITY, avif: 30 });
});

test("validateConfig rejects bad presets and formats early", () => {
  assert.throws(() => validateConfig({ formats: ["bmp" as never] }), /images config: unknown image format "bmp"/);
  assert.throws(() => validateConfig({ presets: { a: { width: -1 } } }), /images preset "a": width must be a positive integer/);
  assert.throws(() => validateConfig({ breakpoints: [0] }), /images config: breakpoints must be positive integers/);
  validateConfig({ presets: { a: { layout: "fixed", width: 100 } } });
});
