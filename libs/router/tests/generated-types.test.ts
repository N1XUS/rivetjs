// Generated `.rivet/*` code type-checks under `strict`, for each fixture app's options (server,
// static, CSR, transitions, in-file server code, component head). Files stay virtual: the program
// sees them in `<fixture>/.rivet-strict/`, so their relative imports reach the real route modules.
import { test } from "vitest";
import assert from "node:assert/strict";
import { generate, type CodegenOptions } from "../build/codegen.ts";
import { scanRoutes } from "../build/routes.ts";

async function diagnostics(fixture: string, options: Omit<CodegenOptions, "routesDir" | "outDir">): Promise<string[]> {
  const { default: ts } = await import("typescript");
  const root = new URL(`./${fixture}/`, import.meta.url).pathname;
  const dir = root + ".rivet-strict/";
  const table = await scanRoutes(root + "src/routes");
  const { files } = generate(table, { routesDir: "src/routes", outDir: ".rivet-strict", document: "src/document.ts", ...options });
  const compilerOptions = {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    types: ["node"],
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(compilerOptions);
  const read = host.readFile.bind(host), exists = host.fileExists.bind(host), source = host.getSourceFile.bind(host);
  const virtual = (name: string) => (name.startsWith(dir) ? files[name.slice(dir.length)] : undefined);
  host.readFile = (name) => virtual(name) ?? read(name);
  host.fileExists = (name) => virtual(name) !== undefined || exists(name);
  host.directoryExists = (name) => name.replace(/\/?$/, "/") === dir || ts.sys.directoryExists(name);
  host.getSourceFile = (name, version, onError, create) => {
    const text = virtual(name);
    return text !== undefined ? ts.createSourceFile(name, text, version, true) : source(name, version, onError, create);
  };
  const program = ts.createProgram(Object.keys(files).filter((name) => /\.tsx?$/.test(name)).map((name) => dir + name), compilerOptions, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file?.fileName.startsWith(dir))
    .map((d) => d.file!.fileName.slice(dir.length) + ":" + (d.file!.getLineAndCharacterOfPosition(d.start ?? 0).line + 1) + ": " + ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

const cases: [string, string, Omit<CodegenOptions, "routesDir" | "outDir">][] = [
  ["server mode (layouts, typed page props, 404/error views)", "fixture", {}],
  ["component head", "fixture", { head: "components" }],
  ["static mode", "fixture-static", { mode: "static" }],
  ["CSR mode", "fixture-csr", { mode: "csr" }],
  ["transitions", "fixture-transitions", { transitions: { pending: { delay: 100, minDuration: 200 } } }],
  ["in-file server code", "fixture-inline", {}],
  ["nested layouts (levels, kept loaders)", "fixture-nested", {}],
  ["nested layouts with component head and transitions", "fixture-nested", { head: "components", transitions: true }],
  ["derived resume model (Root + revived loads)", "fixture", { derived: true }],
  ["derived resume model, nested layouts with transitions", "fixture-nested", { derived: true, transitions: true }],
  ["derived resume model, static mode", "fixture-static", { mode: "static", derived: true }],
];
for (const [name, fixture, options] of cases)
  test(`generated code type-checks under strict: ${name}`, async () => {
    const errors = await diagnostics(fixture, options);
    assert.deepEqual(errors, [], errors.join("\n"));
  });
