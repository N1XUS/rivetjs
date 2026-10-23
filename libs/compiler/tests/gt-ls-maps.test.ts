// T9: source maps — hot rewrite of an anonymous default function keeps columns.
import { test } from "vitest";
import assert from "node:assert/strict";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { compile } from "../index.ts";
import { hotModule } from "../hot.ts";

test("hotModule: an anonymous `export default function` keeps every column (same-width rewrite)", () => {
  for (const head of ["export default function (props) {", "export default function(props) {", "export default function   (props) {"]) {
    const code = `${head}\n  return props;\n}\n`;
    const out = hotModule(code, "m")!;
    const line = out.split("\n")[0]!;
    assert.equal(line.length, head.length, JSON.stringify(line));
    assert.equal(line.indexOf("(props)"), head.indexOf("(props)"));
    assert.match(line, /function __rivetDefault\s*\(props\)/);
  }
});
