import { test } from "vitest";
import assert from "node:assert/strict";
import { baselineAfterUpdate } from "../size-report/baseline.mjs";

test("size-report: selected-app update preserves unmeasured app and lane baselines", () => {
  const previous = { apps: { existing: { bytes: 10 }, changed: { bytes: 20 } }, lanes: { ssr: { bytes: 30 } } };
  const measured = { apps: { changed: { bytes: 21 }, scheduler: { bytes: 40 } } };
  assert.deepEqual(baselineAfterUpdate(previous, measured, true), {
    apps: { existing: { bytes: 10 }, changed: { bytes: 21 }, scheduler: { bytes: 40 } },
    lanes: { ssr: { bytes: 30 } },
  });
  assert.equal(previous.apps.changed.bytes, 20);
});

test("size-report: a complete update replaces the complete baseline", () => {
  const measured = { apps: { scheduler: { bytes: 40 } }, lanes: {} };
  assert.equal(baselineAfterUpdate({ apps: { removed: {} }, lanes: { old: {} } }, measured, false), measured);
});

test("size-report: selected UI subpaths preserve other components, pages and bundle measurements", () => {
  const previous = { components: { button: { bytes: 10 } }, pages: { dashboard: { bytes: 20 } }, bundle: [30, 15] };
  const measured = { components: { scheduler: { bytes: 40 } }, pages: {}, bundle: null };
  assert.deepEqual(baselineAfterUpdate(previous, measured, true, ["components", "pages"]), {
    components: { button: { bytes: 10 }, scheduler: { bytes: 40 } },
    pages: { dashboard: { bytes: 20 } },
    bundle: [30, 15],
  });
});
