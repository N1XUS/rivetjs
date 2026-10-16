// Server `mergeIds` per request (CDK-PINS review finding 7): ids restart per render scope (`withIdScope("rv")`, the
// router opens one per request), so concurrent streaming renders share id strings. The reactive-id registry
// (`idSignal`) is scoped to the render's id scope on the server, so a merge in request B never changes request A's ids.
import { test } from "vitest";
import assert from "node:assert/strict";
import { _inIdScope, type IdScope } from "@rivetjs/runtime/id";
import { idSignal, mergeIds } from "../utils/id.ts";

const scope = (): IdScope => ({ prefix: "rv", n: 0 });

test("server: a merge in one render scope leaves another in-flight render's reactive ids alone", async () => {
  const a = scope(),
    b = scope();
  // Request A renders its field's input id, then suspends (async data / streaming).
  const inputA = _inIdScope(a, () => idSignal());
  assert.equal(inputA(), "rv0");
  await Promise.resolve();
  // Request B renders the same tree meanwhile: same id string, and its Input merges its own id (field probe).
  const inputB = _inIdScope(b, () => idSignal());
  assert.equal(inputB(), "rv0");
  assert.equal(
    _inIdScope(b, () => mergeIds(inputB(), "b-own")),
    "b-own",
  );
  assert.equal(inputB(), "b-own");
  assert.equal(inputA(), "rv0", "request B's merge must not reach request A");
  await Promise.resolve();
  // Request A resumes: its own merges still apply to its ids.
  assert.equal(
    _inIdScope(a, () => mergeIds(inputA(), "a-own")),
    "a-own",
  );
  assert.equal(inputA(), "a-own");
  assert.equal(inputB(), "b-own");
});

test("server: outside any render scope the process-wide registry still merges (rvs ids are process-unique)", () => {
  const id = idSignal("fixed-outside");
  assert.equal(mergeIds("fixed-outside", "merged-outside"), "merged-outside");
  assert.equal(id(), "merged-outside");
});
