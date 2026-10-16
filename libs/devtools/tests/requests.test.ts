// Agent request dispatch (agent/requests.ts): responses carry the request id; failures and unknown
// request types answer with `error.request` so the panel never waits on them.
import { test } from "vitest";
import assert from "node:assert/strict";
import { dispatch, type Handlers } from "../agent/requests.ts";

const handlers = {
  "tree.get": () => [],
  "owner.get": () => {
    throw new Error("boom");
  },
} as unknown as Handlers;
const run = async (t: string) => {
  const posted: [string, unknown, number?][] = [],
    failed: unknown[] = [];
  await dispatch(
    handlers,
    { t, d: {}, r: 7 },
    (...args) => void posted.push(args),
    (error) => void failed.push(error),
  );
  return { posted, failed };
};

test("a handler's result is posted with the request id", async () => {
  assert.deepEqual((await run("tree.get")).posted, [["tree.get", [], 7]]);
});

test("a throwing handler answers error.request and reports the error", async () => {
  const { posted, failed } = await run("owner.get");
  assert.deepEqual(posted, [["error.request", { message: "boom" }, 7]]);
  assert.equal(failed.length, 1);
});

test("an unknown request type answers error.request (the panel would wait forever otherwise)", async () => {
  const { posted, failed } = await run("nope.get");
  assert.deepEqual(posted, [["error.request", { message: "unknown request nope.get" }, 7]]);
  assert.deepEqual(failed, [], "not an agent error");
});
