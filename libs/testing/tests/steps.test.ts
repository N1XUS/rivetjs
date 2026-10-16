import { test } from "vitest";
import assert from "node:assert/strict";
import { steps } from "../steps.ts";

test("steps run in order, failures are collected and the rest still run", async () => {
  const ran: string[] = [];
  const body = steps(async (t) => {
    await t.test("one", () => void ran.push("one"));
    await t.test("two", () => {
      ran.push("two");
      throw new Error("boom");
    });
    await t.test("skipped", { skip: "not here" }, () => void ran.push("skipped"));
    await t.test("three", async () => void ran.push("three"));
  });
  await assert.rejects(body, /step "two" failed: boom/);
  assert.deepEqual(ran, ["one", "two", "three"]);
});

test("several failures reject with an AggregateError", async () => {
  const body = steps(async (t) => {
    await t.test("a", () => assert.fail("x"));
    await t.test("b", () => assert.fail("y"));
  });
  await assert.rejects(body, (error: unknown) => error instanceof AggregateError && error.errors.length === 2);
});

test("node-env: NODE_ENV is not Vitest's 'test' and source maps are off", () => {
  assert.notEqual(process.env.NODE_ENV, "test");
  assert.equal(process.sourceMapsEnabled, false);
});
