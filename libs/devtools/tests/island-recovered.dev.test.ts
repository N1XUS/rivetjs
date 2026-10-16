// RV2149 through the devtools hook (vitest project `devtools-dev`, `--conditions=development`): `@rivetjs/bridge/adapter` islandRecovered (development build) emits `error.island`
// with the framework, island id, RV2149 message and the island root; every build logs console.error with the code.
import { afterEach, expect, test, vi } from "vitest";
import { createHook } from "../agent/hook.ts";
import { islandRecovered } from "@rivetjs/bridge/adapter";

const KEY = Symbol.for("rivet.devtools");
const previous = (globalThis as Record<symbol, unknown>)[KEY];
afterEach(() => {
  (globalThis as Record<symbol, unknown>)[KEY] = previous;
  vi.restoreAllMocks();
});

test("islandRecovered: error.island on the hook (level 0 keeps it: rare), root as element, console.error with RV2149", () => {
  const hook = createHook(0, () => 7);
  const seen: { t: string; d: Record<string, unknown> }[] = [];
  hook.on = (event) => void seen.push(event);
  (globalThis as Record<symbol, unknown>)[KEY] = hook;
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = { tagName: "RIVET-ISLAND" };
  islandRecovered("react", "i3", new Error("Hydration failed"), root as unknown as Element);
  expect(seen).toHaveLength(1);
  expect(seen[0]!.t).toBe("error.island");
  expect(seen[0]!.d).toMatchObject({
    framework: "react",
    id: "i3",
    element: root,
    message: "[RV2149] react island i3 recovered from an error: Hydration failed",
  });
  expect(error).toHaveBeenCalledWith("[RV2149] react island i3 recovered from an error: Hydration failed", expect.any(Error));
});
