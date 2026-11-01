// FIX2 small client / module fixes: scroll entries capped (router#22), magic-name lookup (router#2).
import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { leave } from "../client/scroll.ts";
import { serverExports } from "../server/module.ts";

afterEach(() => vi.unstubAllGlobals());

test("scroll positions in sessionStorage stay capped, oldest dropped", () => {
  const map = new Map<string, string>();
  for (let i = 0; i < 600; i++) map.set("rivet:scroll:" + i, "[0,0]");
  map.set("other", "kept");
  vi.stubGlobal("sessionStorage", {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (name: string) => map.delete(name),
    setItem: (name: string, value: string) => map.set(name, value),
  });
  vi.stubGlobal("history", { state: null, replaceState() {}, scrollRestoration: "auto" });
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("scrollX", 0);
  vi.stubGlobal("scrollY", 0);
  leave(true, 0);
  assert.equal(map.has("rivet:scroll:0"), false);
  assert.equal(map.has("rivet:scroll:599"), true);
  assert.equal(map.has("other"), true);
  assert.ok(map.size <= 502, String(map.size));
});

test("an export named like an Object.prototype member is no magic export", () => {
  assert.doesNotThrow(() => serverExports({ constructor: 1, toString: 2, valueOf: 3 } as never, "a.server.ts", true));
});
