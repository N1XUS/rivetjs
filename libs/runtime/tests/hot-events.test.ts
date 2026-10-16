// Hot replacement and dev hints report to the devtools hook in development (`#dev` → dev/on.ts); the
// default resolution reports nothing. The runtime suite runs in both resolutions.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createRoot } from "@rivetjs/reactivity";
import { DEV } from "#dev";
import { hot } from "../hot.ts";
import { signal } from "../hot-reactivity.ts";

const development = process.execArgv.includes("--conditions=development");
const KEY = Symbol.for("rivet.devtools");
function record(fn: () => void): [string, Record<string, unknown>][] {
  const events: [string, Record<string, unknown>][] = [];
  const scope = globalThis as { [KEY]?: unknown };
  const previous = scope[KEY];
  scope[KEY] = { v: 1, level: 1, stacks: false, emit: (type: string, data: Record<string, unknown>) => void events.push([type, data]) };
  try {
    fn();
  } finally {
    scope[KEY] = previous;
  }
  return events;
}

test("hot(): registration, updates, and state resets by kind and shape", () => {
  const events = record(() => {
    const first = () => (signal(1), "a");
    const wrapper = hot(first, "hot-events.tsx#A");
    let render!: () => unknown;
    const root = createRoot((dispose) => {
      render = wrapper({}) as () => unknown;
      render();
      return dispose;
    });
    // Same id: an update. A string where the number was resets that signal (kind).
    hot(() => (signal("x"), "b"), "hot-events.tsx#A");
    render();
    // Two signals where one was: the whole instance starts fresh (shape).
    hot(() => (signal("x"), signal(2), "c"), "hot-events.tsx#A");
    render();
    // `@refresh reset` modules ask for fresh state on every update.
    hot(() => "d", "hot-events.tsx#A", true);
    render();
    root.value();
  }).filter(([type]) => type.startsWith("hot.") || type === "sig.internal");
  if (!development) return assert.deepEqual(events, []);
  const types = events.map(([type, data]) => type + (data.reason ? ":" + data.reason : ""));
  assert.deepEqual(types, ["sig.internal", "hot.register", "sig.internal", "hot.update", "hot.reset:kind", "hot.update", "hot.reset:shape", "hot.update"]);
  assert.equal(events[1]![1].id, "hot-events.tsx#A");
  assert.equal(typeof events[1]![1].wrapper, "function");
  assert.equal((events[1]![1].impl as () => unknown).name, "first");
  assert.deepEqual({ ...events[3]![1] }, { id: "hot-events.tsx#A", instances: 1, reset: null });
  assert.equal(events[7]![1].reset, "refresh-reset");
});

test("DEV.hint reports the hint it appends", () => {
  const events = record(() => {
    if (DEV) assert.match(DEV.hint("Missing resumable element 1", "drift"), /^Missing resumable element 1 — the HTML changed/);
  });
  if (!development) return assert.deepEqual(events, []);
  assert.equal(events.length, 1);
  assert.equal(events[0]![0], "error.hint");
  assert.equal(events[0]![1].key, "drift");
  assert.match(String(events[0]![1].message), /^Missing resumable element 1 — /);
});
