// Dev `DEV.selector` (clientEvent `match`): an invalid CSS selector throws a SyntaxError at registration
// that names the selector and keeps the DOM error as `cause`; a valid one passes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { DEV } from "../dev/on.ts";

test("DEV.selector throws a SyntaxError for an invalid clientEvent match selector", () => {
  const scope = globalThis as { document?: unknown };
  const previous = scope.document;
  const invalid = new Error("'a[' is not a valid selector");
  scope.document = {
    createDocumentFragment: () => ({
      querySelector(selector: string) {
        if (selector === "a[") throw invalid;
        return null;
      },
    }),
  };
  try {
    DEV.selector("a,form");
    assert.throws(
      () => DEV.selector("a["),
      (error: unknown) =>
        error instanceof SyntaxError && error.message.startsWith('clientEvent match: "a[" is not a valid CSS selector') && error.cause === invalid,
    );
  } finally {
    scope.document = previous;
  }
});
