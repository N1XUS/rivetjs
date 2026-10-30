import { test, expect } from "vitest";
import { createRequire } from "node:module";
import { solid } from "../vite.ts";
import { slotProp } from "../slot.ts";

test("this adapter resolves Solid 1.9 rather than the repository's Solid 2 benchmark toolchain", () => {
  expect(createRequire(import.meta.url)("solid-js/package.json").version).toBe("1.9.15");
});
test("ownership accepts suffixes, pragma and include, with exclusions taking precedence", () => {
  const bridge = solid({ include: ["src/foreign/**"], exclude: ["**/skip.solid.tsx"] });
  bridge.configure?.({ root: "/app" } as never);
  expect(bridge.owns("/app/src/Counter.solid.tsx")).toBe(true);
  expect(bridge.owns("/app/src/Counter.solid.jsx")).toBe(true);
  expect(bridge.owns("/app/src/plain.tsx", "/** @jsxImportSource solid-js */\nexport const A=()=> <b/>;")).toBe(true);
  expect(bridge.owns("/app/src/foreign/Counter.tsx")).toBe(true);
  expect(bridge.owns("/app/src/skip.solid.tsx")).toBe(false);
  expect(bridge.owns("/app/src/plain.tsx", "export const A=()=> <b/>;")).toBe(false);
});
test("slot names use Solid content props", () => {
  expect(slotProp("default")).toBe("children");
  expect(slotProp("card-title")).toBe("cardTitle");
});
