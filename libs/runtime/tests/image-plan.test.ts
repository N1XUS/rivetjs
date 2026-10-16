import { test } from "vitest";
import assert from "node:assert/strict";
import { planWidths, layoutSizes, fallbackFormat, describe, single, mimeType } from "../image-plan.ts";

const photo = { width: 2000, height: 1000 };
const widths = (plan: { widths: { width: number; descriptor: string }[] }) => plan.widths.map((w) => w.width + ":" + w.descriptor);

test("constrained: breakpoints up to max × max density, plus 1x/2x display widths", () => {
  const plan = planWidths({ intrinsic: photo, layout: "constrained", width: 800 });
  assert.equal(plan.width, 800);
  assert.equal(plan.height, 400);
  assert.equal(plan.clamped, false);
  assert.deepEqual(widths(plan), ["640:640w", "768:768w", "800:800w", "1024:1024w", "1280:1280w", "1536:1536w", "1600:1600w"]);
});

test("constrained without width uses intrinsic and never exceeds it", () => {
  const plan = planWidths({ intrinsic: { width: 1000, height: 500 }, layout: "constrained" });
  assert.deepEqual(widths(plan), ["640:640w", "768:768w", "1000:1000w"]);
});

test("fixed: x descriptors, clamped density collapses and is relabelled", () => {
  assert.deepEqual(widths(planWidths({ intrinsic: photo, layout: "fixed", width: 300 })), ["300:1x", "600:2x"]);
  assert.deepEqual(widths(planWidths({ intrinsic: { width: 450, height: 300 }, layout: "fixed", width: 300 })), ["300:1x", "450:1.5x"]);
  assert.deepEqual(widths(planWidths({ intrinsic: { width: 300, height: 300 }, layout: "fixed", width: 300 })), ["300:1x"]);
});

test("full-width: all breakpoints up to intrinsic plus intrinsic", () => {
  assert.deepEqual(widths(planWidths({ intrinsic: { width: 1700, height: 850 }, layout: "full-width" })), [
    "640:640w", "768:768w", "1024:1024w", "1280:1280w", "1536:1536w", "1700:1700w",
  ]);
});

test("upscale request clamps and flags", () => {
  const plan = planWidths({ intrinsic: { width: 500, height: 250 }, layout: "constrained", width: 900 });
  assert.equal(plan.clamped, true);
  assert.equal(plan.width, 500);
  assert.equal(plan.height, 250);
});

test("explicit height crops aspect", () => {
  const plan = planWidths({ intrinsic: photo, layout: "constrained", width: 600, height: 600 });
  assert.equal(plan.height, 600);
});

test("custom densities and breakpoints", () => {
  const plan = planWidths({ intrinsic: photo, layout: "fixed", width: 200, densities: [1, 3] });
  assert.deepEqual(widths(plan), ["200:1x", "600:3x"]);
  const bp = planWidths({ intrinsic: photo, layout: "full-width", breakpoints: [500, 3000] });
  assert.deepEqual(widths(bp), ["500:500w", "2000:2000w"]);
});

test("layout sizes", () => {
  assert.equal(layoutSizes("fixed", 300), undefined);
  assert.equal(layoutSizes("constrained", 800), "(min-width: 800px) 800px, 100vw");
  assert.equal(layoutSizes("full-width", 800), "100vw");
});

test("fallback format: alpha → png, png stays png, others → jpeg", () => {
  assert.equal(fallbackFormat("png", true), "png");
  assert.equal(fallbackFormat("webp", true), "png");
  assert.equal(fallbackFormat("png", false), "png");
  assert.equal(fallbackFormat("jpeg", false), "jpeg");
  assert.equal(fallbackFormat("tiff", false), "jpeg");
});

test("describe builds ordered sources, fallback src at display width", () => {
  const plan = planWidths({ intrinsic: photo, layout: "fixed", width: 300 });
  const d = describe({
    plan,
    layout: "fixed",
    placeholder: { kind: "color", value: "#aabbcc" },
    sources: [
      { format: "avif", urls: ["/a-300.avif", "/a-600.avif"] },
      { format: "jpeg", urls: ["/a-300.jpg", "/a-600.jpg"] },
    ],
  });
  assert.deepEqual(d, {
    src: "/a-300.jpg",
    width: 300,
    height: 150,
    layout: "fixed",
    placeholder: { kind: "color", value: "#aabbcc" },
    sources: [
      { type: "image/avif", srcset: "/a-300.avif 1x, /a-600.avif 2x" },
      { type: "image/jpeg", srcset: "/a-300.jpg 1x, /a-600.jpg 2x" },
    ],
  });
  const untyped = describe({ plan, layout: "fixed", sources: [{ urls: ["/x?w=300", "/x?w=600"] }] });
  assert.deepEqual(untyped.sources, [{ srcset: "/x?w=300 1x, /x?w=600 2x" }]);
});

test("constrained describe carries sizes; src = largest fallback ≤ display width", () => {
  const plan = planWidths({ intrinsic: { width: 1000, height: 500 }, layout: "constrained", width: 700 });
  const d = describe({ plan, layout: "constrained", sources: [{ format: "jpeg", urls: plan.widths.map((w) => `/p-${w.width}.jpg`) }] });
  assert.equal(d.src, "/p-700.jpg"); // widths 640, 700, 768, 1000
  assert.equal(d.sizes, "(min-width: 700px) 700px, 100vw");
});

test("single passthrough descriptor", () => {
  assert.deepEqual(single("/i.svg", "svg", 24, 24, "fixed"), {
    src: "/i.svg", width: 24, height: 24, layout: "fixed", sources: [{ type: "image/svg+xml", srcset: "/i.svg" }],
  });
  assert.equal(mimeType("jpeg"), "image/jpeg");
});
