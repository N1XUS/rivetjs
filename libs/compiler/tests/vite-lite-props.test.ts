// JS-DIET-2: the manifest's `lite.props` names the residuals that read their record's props (`__rivetLr.p`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { _liteReadsProps } from "../vite.ts";

test("a residual reads props when its own `$a` body reads `__rivetLr.p`", () => {
  const code = `import { _ls as __rivetL_s } from "@rivetjs/runtime/dom-lite";
export function A$a(__rivetLn, __rivetLr) {
\tconst props = __rivetLr.p;
}
export function B$a(__rivetLn, __rivetLr) {
\tconst n = __rivetL_s(__rivetLr, "k", 0);
}
export const A$c = () => import("a.tsx");`;
  assert.equal(_liteReadsProps(code, "A"), true);
  assert.equal(_liteReadsProps(code, "B"), false);
  assert.equal(_liteReadsProps(code, "C"), false);
});
