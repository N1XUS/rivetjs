import { test } from "vitest";
import assert from "node:assert/strict";
import { baselineAfterUpdate, broken, growth } from "../size-report/baseline.mjs";

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

test("size-report --check: a route that broke (non-200, failed interaction, new page errors) fails even with no growth", () => {
  const ok = { status: 200, htmlBr: 100, eagerJS: { br: 50 }, interactionRequests: 1, interactionJS: { br: 10 } };
  const base = { apps: { a: { routes: { "/": ok, "/known": { ...ok, interactionError: "Timeout", errors: ["TypeError: x"] } } } } };
  const now = {
    apps: {
      a: {
        routes: {
          "/": { status: 500, htmlBr: 90, eagerJS: { br: 0 }, interactionError: "locator.click: Timeout 5000ms exceeded.", errors: ["ReferenceError: y"] },
          "/known": { ...ok, interactionError: "Timeout", errors: ["TypeError: x"] },
        },
      },
    },
  };
  // Shrunk numbers: growth alone lets the broken route pass.
  assert.deepEqual(growth(base, now, 0), []);
  assert.deepEqual(broken(base, now), [
    "apps.a.routes./.status: 200 -> 500",
    "apps.a.routes./.interactionError: locator.click: Timeout 5000ms exceeded.",
    "apps.a.routes./.errors: ReferenceError: y",
  ]);
  // Unchanged known reds of the baseline stay out; a fresh error on them does not.
  now.apps.a.routes["/known"].errors = ["TypeError: x", "Error: z"];
  assert.deepEqual(broken(base, now).slice(3), ["apps.a.routes./known.errors: Error: z"]);
});

test("size-report --check: growth reports numeric leaves past the tolerance and any extra request", () => {
  const base = { apps: { a: { routes: { "/": { status: 200, htmlBr: 100, eagerRequests: 2 } } } } };
  const now = { apps: { a: { routes: { "/": { status: 500, htmlBr: 104, eagerRequests: 3 } } } } };
  assert.deepEqual(growth(base, now, 4), ["apps.a.routes./.eagerRequests: 2 -> 3"]);
  assert.deepEqual(growth(base, now, 3), ["apps.a.routes./.htmlBr: 100 -> 104 (+4)", "apps.a.routes./.eagerRequests: 2 -> 3"]);
});
