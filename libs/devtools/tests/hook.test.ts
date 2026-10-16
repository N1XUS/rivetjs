import { test } from "vitest";
import assert from "node:assert/strict";
import { createHook, isRare } from "../agent/hook.ts";

test("rare events: hot, error, hmr, resume, route", () => {
  assert.deepEqual(["hot.update", "error.hint", "error.island", "hmr.x", "resume.x", "route.x", "sig.create", "a11y"].map(isRare), [
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
  ]);
});

test("level 0 forwards rare events only; every kept event reaches the listener", () => {
  const hook = createHook(0, () => 42);
  const seen: string[] = [];
  hook.on = (event) => seen.push(event.t + "@" + event.ts);
  hook.emit("sig.create", {});
  hook.emit("hot.register", {});
  assert.deepEqual(seen, ["hot.register@42"]);
  hook.level = 2;
  hook.emit("sig.write", {});
  assert.deepEqual(seen, ["hot.register@42", "sig.write@42"]);
});

test("the hook retains no events (no write-only rings holding DOM nodes, values, errors)", () => {
  const hook = createHook(2);
  const node = {};
  hook.emit("dom.update", { node });
  assert.deepEqual(Object.keys(hook).sort(), ["edit", "emit", "level", "on", "stacks", "v"]);
});
