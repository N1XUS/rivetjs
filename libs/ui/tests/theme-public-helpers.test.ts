import { test } from "vitest";
import assert from "node:assert/strict";
import { inSrgb, RADIUS_IDS, RADIUS_CSS, themeVariables, RIVET_PRESET } from "@rivetjs/ui/theme";

test("sRGB gamut accepts neutral endpoints and rejects saturated out-of-gamut colors", () => {
  for (const l of [0, 0.5, 1]) assert.equal(inSrgb({ l, c: 0, h: 0, alpha: 1 }), true);
  assert.equal(inSrgb({ l: 0.5, c: 0.5, h: 140, alpha: 1 }), false);
  assert.equal(inSrgb({ l: 1.1, c: 0, h: 0, alpha: 1 }), false);
  assert.equal(inSrgb({ l: 0.5, c: 0.5, h: 140, alpha: 0 }), false, "transparency does not change channel gamut");
});

test("each advertised radius is accepted independently for surfaces and fields in both modes", () => {
  assert.deepEqual(RADIUS_IDS, ["none", "extra-small", "small", "medium", "large", "extra-large"]);
  for (const radius of RADIUS_IDS)
    for (const mode of ["light", "dark"] as const) {
      const variables = themeVariables({ ...RIVET_PRESET, radius, formRadius: radius }, mode);
      assert.equal(variables["--radius"], RADIUS_CSS[radius]);
      assert.equal(variables["--field-radius"], RADIUS_CSS[radius]);
    }
});
