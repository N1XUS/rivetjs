// RV3010 (untagged former magic server export) in route modules + its quick fix `rivetWrapServerExport`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { analyzeFile, applyEdits, codeFixes, createLanguageCore, isRouteModule, untaggedServerExports } from "../index.ts";
import { compiler, tempApp } from "./helpers.ts";

const parse = (text: string, name = "/app/src/routes/a.tsx") => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const codes = (text: string) => untaggedServerExports(ts, parse(text)).map((d) => text.slice(d.start, d.end));

test("RV3010: magic names without a wrapper call; wrapper calls (aliases, namespaces, any name) are fine", () => {
  assert.deepEqual(
    codes(`export const serverLoad = () => 1;\nexport async function onGet() {}\nexport let onPost = 1;\nconst h = 1;\nexport { h as onPut };\n`),
    ["serverLoad", "onGet", "onPost", "onPut"],
  );
  assert.deepEqual(
    codes(
      `import { load, onGet as g } from "@rivetjs/router";\nimport * as r from "@rivetjs/router";\nexport const serverLoad = load(() => 1);\nexport const onGet = g(() => undefined);\nconst p = r.onPost(() => undefined);\nexport { p as onPost };\nexport const loader = 1;\n`,
    ),
    [],
  );
  // A type-only import is no wrapper; a non-router `load` neither.
  assert.deepEqual(codes(`import type { load } from "@rivetjs/router";\nexport const serverLoad = load(() => 1);\n`), ["serverLoad"]);
  assert.deepEqual(codes(`import { load } from "./x.ts";\nexport const onGet = load(() => 1);\n`), ["onGet"]);
  const [d] = untaggedServerExports(ts, parse(`export const onGet = () => 1;`));
  assert.equal(d!.code, "RV3010");
  assert.match(
    d!.message,
    /^Untagged server export `onGet`: .*`export const GET = onGet\(\(event\) => …\)` with `import \{ onGet \} from "@rivetjs\/router"`$/,
  );
});

test("route modules: files under the manifest routesDir", () => {
  assert.ok(isRouteModule("/app", "src/routes", "/app/src/routes/a/b.tsx"));
  assert.ok(isRouteModule("/app", "src/routes", "/app/src/routes/api/x.ts"));
  assert.ok(!isRouteModule("/app", "src/routes", "/app/src/lib/a.tsx"));
  assert.ok(!isRouteModule("/app", "src/routes", "/app/src/routes/a.d.ts"));
  assert.ok(!isRouteModule("/app", undefined, "/app/src/routes/a.tsx"));
});

test("analyzeFile reports RV3010 in route modules only, with its docs link", () => {
  const source = `export const serverLoad = () => 1;\nexport default function A() { return <p />; }\n`;
  const root = tempApp({
    "src/routes/index.tsx": source,
    "src/lib/x.tsx": source,
    ".rivet/editor.json": JSON.stringify({ version: 1, routesDir: "src/routes" }),
  });
  try {
    const core = createLanguageCore({ compiler });
    const files = [join(root, "src/routes/index.tsx"), join(root, "src/lib/x.tsx")];
    const program = ts.createProgram({ rootNames: files, options: { jsx: ts.JsxEmit.Preserve, noEmit: true, noLib: true, types: [] } });
    const [route, lib] = files.map((f) =>
      analyzeFile(ts, core, program, program.getSourceFile(f)!, { typeAware: false }).diagnostics.filter((d) => d.code === "RV3010"),
    );
    assert.equal(route!.length, 1);
    assert.equal(route![0]!.line, 1);
    assert.equal(route![0]!.docs, "https://rivetjs.severyn.pro/errors/RV3010");
    assert.equal(lib!.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** The quick fix of the first RV3010 in `text`, applied. */
function fix(text: string): string | undefined {
  const file = parse(text);
  const [d] = untaggedServerExports(ts, file);
  assert.ok(d, text);
  const [first] = codeFixes(ts, file, d);
  return first && applyEdits(text, first.edits);
}

test("rivetWrapServerExport: consts, functions (arrow / expression), let, annotations; references by symbol; import merged", () => {
  assert.equal(
    fix(
      `import { redirect, type PageProps } from "@rivetjs/router";\nexport const serverLoad = async () => ({ n: 1 });\nexport default function P({ data }: PageProps<typeof serverLoad>) {\n  const f = (serverLoad: number) => serverLoad;\n  return <p>{data.n + f(1)}</p>;\n}\n`,
    ),
    `import { redirect, type PageProps, load } from "@rivetjs/router";\nexport const loader = load(async () => ({ n: 1 }));\nexport default function P({ data }: PageProps<typeof loader>) {\n  const f = (serverLoad: number) => serverLoad;\n  return <p>{data.n + f(1)}</p>;\n}\n`,
  );
  assert.equal(
    fix(
      `export async function onGet({ url }: { url: URL }): Promise<Response | undefined> {\n  return url.search ? new Response("x") : undefined;\n}\nexport const other = { onGet };\n`,
    ),
    `import { onGet } from "@rivetjs/router";\nexport const GET = onGet(async ({ url }: { url: URL }): Promise<Response | undefined> => {\n  return url.search ? new Response("x") : undefined;\n});\nexport const other = { onGet: GET };\n`,
  );
  assert.equal(
    fix(`export function onPost(this: void) { return arguments.length ? undefined : new Response(); }\n`),
    `import { onPost } from "@rivetjs/router";\nexport const POST = onPost(function POST(this: void) { return arguments.length ? undefined : new Response(); });\n`,
  );
  assert.equal(
    fix(`type H = () => Record<string, string>;\nexport let serverHeaders: H = () => ({ a: "1" });\n`),
    `import { headers } from "@rivetjs/router";\ntype H = () => Record<string, string>;\nexport const responseHeaders = headers((() => ({ a: "1" })) satisfies H);\n`,
  );
  // Aliased wrapper import: used as is. The default name taken: `<name>Export`.
  assert.equal(
    fix(`import { actions as a } from "@rivetjs/router";\nconst forms = 1;\nexport const serverActions = { save: () => forms };\n`),
    `import { actions as a } from "@rivetjs/router";\nconst forms = 1;\nexport const formsExport = a({ save: () => forms });\n`,
  );
  // A local named like the wrapper: no fix.
  assert.equal(fix(`const load = 1;\nexport const serverLoad = () => load;\n`), undefined);
});
