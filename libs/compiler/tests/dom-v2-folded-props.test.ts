import assert from "node:assert/strict";
import { test } from "vitest";
import { compile } from "../index.ts";

// C2 (V2-FIX 2026-10-07): a css`` class lookup passed as a component prop folds to a string literal, so the v2
// component call is static (`_c`), exactly like a hand-written literal.
test("DOM v2: a css``-folded component prop is static", () => {
  const source = (value: string) =>
    `import { css } from "@rivetjs/runtime/css";\nconst s = css\`.busy{color:red}\`;\nfunction Child(p: { label: string }) { return <i>{p.label}</i>; }\nexport const A = () => <Child label={${value}} />;`;
  const folded = compile(source("s.busy"), { target: "dom", filename: "src/a.tsx", styles: { scope: "src/a.tsx" } }).code;
  assert.doesNotMatch(folded, /_cp\(/);
  const literal = /"label": ("[^"]+")/.exec(folded)?.[1];
  assert.ok(literal, folded);
  const handwritten = compile(source(literal), { target: "dom", filename: "src/a.tsx", styles: { scope: "src/a.tsx" } }).code;
  assert.equal(folded, handwritten);
});
