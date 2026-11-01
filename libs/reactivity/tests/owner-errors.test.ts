// Error paths of the owner tree: work under a disposed owner is rejected.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createRoot, getOwner, runWithOwner } from "@rivetjs/reactivity";

test("runWithOwner rejects a disposed owner", () => {
  const { value: owner, dispose } = createRoot(() => getOwner());
  assert.equal(
    runWithOwner(owner, () => 1),
    1,
  );
  dispose();
  assert.throws(() => runWithOwner(owner, () => 1), { message: "Cannot run with a disposed owner" });
});
