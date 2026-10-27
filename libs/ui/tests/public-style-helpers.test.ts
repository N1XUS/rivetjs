import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { focusRingClasses, disabledClasses, ariaDisabledClasses } from "@rivetjs/ui/styles/src/utils/index.ts";
import { merge } from "@rivetjs/ui/styles/src/utils/merge-on.ts";
import { provideMerge, tv } from "@rivetjs/ui/styles/src/utils/tv.ts";

test("focus-ring utilities accept a width override while preserving color, offset, and keyboard gating", () => {
  const classes = merge(focusRingClasses, "focus-visible:ring-4")!.split(" ");
  assert.ok(classes.includes("focus-visible:ring-4"));
  assert.ok(!classes.includes("focus-visible:ring-2"));
  for (const token of ["ring-focus", "ring-offset-background", "outline-none", "ring-offset-2"]) assert.ok(classes.includes(`focus-visible:${token}`));
  assert.ok(classes.every((token) => token.startsWith("focus-visible:")));
});

test("native and ARIA disabled utilities independently allow opacity overrides without losing interaction guards", () => {
  for (const [variant, base] of [
    ["disabled", disabledClasses],
    ["aria-disabled", ariaDisabledClasses],
  ]) {
    const classes = merge(base, `${variant}:opacity-100`)!.split(" ");
    assert.deepEqual(new Set(classes), new Set([`${variant}:pointer-events-none`, `${variant}:cursor-not-allowed`, `${variant}:opacity-100`]));
  }
});

test("registering a merge provider preserves the server's installed conflict resolver", () => {
  const replacement = vi.fn(() => "replacement");
  provideMerge(replacement);
  assert.equal(tv({ base: "control" })({ class: "p-2 p-4" }), "control p-4");
  assert.equal(replacement.mock.calls.length, 0);
});
