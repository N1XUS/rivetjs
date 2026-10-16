// P5: `client.d.ts` can only type image imports whose keyword is the last query key (one wildcard per
// ambient module): `parseImageId` flags other orders (the Vite plugin warns), and the types resolve for
// `?width=800&image` but not `?image&width=800`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseImageId } from "../images/options.ts";

test("parseImageId warns when ?image / ?jsx / ?svg is not the last key (Vite keys ignored)", () => {
  assert.equal(parseImageId("/a/x.jpg?image")!.warning, undefined);
  assert.equal(parseImageId("/a/x.jpg?width=800&image")!.warning, undefined);
  assert.equal(parseImageId("/a/x.jpg?width=800&image&import&t=123")!.warning, undefined);
  assert.equal(parseImageId("/a/l.svg?currentColor&svg")!.warning, undefined);
  assert.match(parseImageId("/a/x.jpg?image&width=800")!.warning!, /\/a\/x\.jpg: put \?image last \(`\?width=800&image`\)/);
  assert.match(parseImageId("/a/x.jpg?jsx&width=800&formats=avif")!.warning!, /put \?jsx last \(`\?width=800&formats=avif&jsx`\)/);
  assert.match(parseImageId("/a/l.svg?svg&currentColor")!.warning!, /put \?svg last/);
});

test("client.d.ts types imports ending in the keyword only", async () => {
  const { default: ts } = await import("typescript");
  const dir = mkdtempSync(join(tmpdir(), "rivet-image-types-"));
  const file = join(dir, "use.ts");
  writeFileSync(
    file,
    [
      `/// <reference path="${new URL("../images/client.d.ts", import.meta.url).pathname}" />`,
      `import a from "./x.jpg?image";`,
      `import b from "./x.jpg?width=800&image";`,
      `import c from "./x.jpg?image&width=800";`,
      `export const used = [a.src, b.src, c];`,
    ].join("\n"),
  );
  const program = ts.createProgram([file], {
    strict: true,
    noEmit: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
    allowImportingTsExtensions: true,
    types: [],
  });
  const errors = ts.getPreEmitDiagnostics(program, program.getSourceFile(file)).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  assert.deepEqual(errors, [`Cannot find module './x.jpg?image&width=800' or its corresponding type declarations.`]);
});
