// Production build of the dev warnings: this file runs in the `cdk` project (default `#dev` resolution, `DEV = false`),
// not in `cdk-dev`, so the warning branch is folded out whatever `NODE_ENV` says (the runtime `isDev()` checks are gone,
// DIET-CODE 2026-10-22). The dev-side assertions are in `controllable.test.ts` (`cdk-dev`).
import { expect, test, vi } from "vitest";
import { controllable } from "../interactions/controllable.ts";

test("controllable: no warning in a production build", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    controllable("x", "d", undefined);
    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
  }
});
