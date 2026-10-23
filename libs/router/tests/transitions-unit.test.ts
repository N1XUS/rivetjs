// Transitions module helpers without a browser: types precedence, shared names, indicator timing.
import { test } from "vitest";
import assert from "node:assert/strict";
import { indicator, sharedNames, transitionTypes } from "../client/transition-helpers.ts";
import type { NavigationInfo } from "../client/index.ts";

const nav = (extra: Partial<NavigationInfo> = {}): NavigationInfo => ({ from: null, to: new URL("http://x.test/b"), type: "push", trigger: "link", ...extra });

test("types: defaults first; link data-transition wins over the route; none / false skip", () => {
  assert.deepEqual(transitionTypes(nav()), ["push"]);
  assert.deepEqual(transitionTypes(nav({ type: "back", route: { types: ["zoom"] } })), ["back", "zoom"]);
  assert.deepEqual(transitionTypes(nav({ transition: " slide  up ", route: { types: ["zoom"] } })), ["push", "slide", "up"]);
  assert.equal(transitionTypes(nav({ transition: "none", route: { types: ["zoom"] } })), null);
  assert.equal(transitionTypes(nav({ route: false })), null);
  // A link's own types still animate into a route that opts out.
  assert.deepEqual(transitionTypes(nav({ route: false, transition: "zoom" })), ["push", "zoom"]);
  const seen: NavigationInfo[] = [];
  const route = (info: NavigationInfo) => (seen.push(info), info.from ? { types: ["from-somewhere"] } : false);
  assert.equal(transitionTypes(nav({ route })), null);
  assert.deepEqual(transitionTypes(nav({ route, from: new URL("http://x.test/") })), ["push", "from-somewhere"]);
  assert.equal(seen.length, 2);
});

test("shared names: present once on both sides; duplicates (null) and one-sided names drop", () => {
  const element = {} as HTMLElement;
  const before = new Map<string, HTMLElement | null>([
    ["hero", element],
    ["dup", null],
    ["old-only", element],
    ["both-dup", element],
  ]);
  const after = new Map<string, HTMLElement | null>([
    ["hero", element],
    ["dup", element],
    ["new-only", element],
    ["both-dup", null],
  ]);
  assert.deepEqual(sharedNames(before, after), ["hero"]);
});

test("indicator: shows after delay, held for minDuration, never for fast navigations", () => {
  let now = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let id = 0;
  const clock = {
    now: () => now,
    set: (fn: () => void, ms: number) => (timers.set(++id, { at: now + ms, fn }), id),
    clear: (handle: unknown) => void timers.delete(handle as number),
  };
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > until) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = until;
  };
  const log: string[] = [];
  const timing = indicator(
    200,
    300,
    () => log.push("show@" + now),
    () => log.push("hide@" + now),
    clock,
  );
  // Fast navigation: finished before the delay, never shown.
  timing.start();
  advance(150);
  timing.finish();
  advance(1000);
  assert.deepEqual(log, ["hide@150"]);
  log.length = 0;
  // Slow navigation: shown at 200 ms, finished at 250 ms, hidden at 500 ms (≥ 300 ms visible).
  now = 0;
  timing.start();
  advance(250);
  timing.finish();
  advance(1000);
  assert.deepEqual(log, ["show@200", "hide@500"]);
  log.length = 0;
  // A new navigation while held keeps it shown (no flash), then holds from the first show.
  now = 0;
  timing.start();
  advance(210);
  timing.finish();
  advance(50);
  timing.start();
  advance(20);
  timing.finish();
  advance(1000);
  assert.deepEqual(log, ["show@200", "hide@500"]);
  // Redirect: start while running keeps the original timers.
  log.length = 0;
  now = 0;
  timing.start();
  advance(150);
  timing.start();
  advance(60);
  assert.deepEqual(log, ["show@200"]);
});
