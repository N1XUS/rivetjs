// Condition parity: every conditional `exports` / `imports` entry of the libs/* packages must resolve to
// modules with the SAME runtime (value) export names under every condition as its `types` target — a
// name the types promise but the production (`default`) or `development` file lacks typechecks and then
// breaks at bundle/run time (X5: `/dev/a11y` default exported only `start`). Modules whose body is a
// top-level `throw` (server-only guards such as `forms/server/browser.ts`) are exempt by design.
// Prints `condition parity: ok (N entries)`; exit 1 with the missing/extra names otherwise.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(process.argv[2] ?? ".");
const ts = createRequire(path.join(root, "package.json"))("typescript");

/** [package, entry, { condition: absolute file }] for every entry with more than one distinct target. */
const entries = [];
for (const dir of fs.readdirSync(path.join(root, "libs"))) {
  const file = path.join(root, "libs", dir, "package.json");
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const field of ["exports", "imports"])
    for (const [key, value] of Object.entries(pkg[field] ?? {})) {
      if (!value || typeof value !== "object") continue;
      const targets = {};
      const flat = (object, prefix) => {
        for (const [condition, target] of Object.entries(object))
          if (typeof target === "string") targets[prefix + condition] = path.join(root, "libs", dir, target);
          else if (target && typeof target === "object") flat(target, prefix + condition + ".");
      };
      flat(value, "");
      const files = Object.values(targets).filter((target) => /\.tsx?$/.test(target));
      if (new Set(files).size > 1) entries.push([pkg.name, key, targets]);
    }
}

const files = [...new Set(entries.flatMap(([, , targets]) => Object.values(targets)).filter((file) => /\.tsx?$/.test(file)))];
const program = ts.createProgram(files, {
  allowImportingTsExtensions: true,
  noEmit: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ESNext,
  jsx: ts.JsxEmit.Preserve,
  skipLibCheck: true,
  noResolve: false,
});
const checker = program.getTypeChecker();

/** Value export names of `file`, or null for a top-level-throw guard module. */
function valueExports(file) {
  const source = program.getSourceFile(file);
  if (!source) throw new Error(`condition parity: cannot load ${path.relative(root, file)}`);
  if (source.statements.some((statement) => ts.isThrowStatement(statement))) return null;
  const module = checker.getSymbolAtLocation(source);
  if (!module) return new Set();
  const names = new Set();
  for (const symbol of checker.getExportsOfModule(module)) {
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    // `export type { X }` re-exports alias a value-less symbol; type-only declarations carry no Value flag.
    const typeOnly = symbol.declarations?.some(
      (d) => (ts.isExportSpecifier(d) && (d.isTypeOnly || d.parent.parent.isTypeOnly)) || ts.isTypeOnlyImportOrExportDeclaration?.(d),
    );
    if (!typeOnly && target.flags & ts.SymbolFlags.Value) names.add(symbol.escapedName.toString());
  }
  return names;
}

const failures = [];
for (const [name, key, targets] of entries) {
  const reference = targets.types ?? Object.values(targets)[0];
  const expected = valueExports(reference);
  for (const [condition, file] of Object.entries(targets)) {
    if (file === reference || !/\.tsx?$/.test(file)) continue;
    const actual = valueExports(file);
    if (actual === null || expected === null) continue;
    const missing = [...expected].filter((n) => !actual.has(n));
    const extra = [...actual].filter((n) => !expected.has(n));
    if (missing.length || extra.length)
      failures.push(
        `${name} ${key} [${condition}] ${path.relative(root, file)}:` +
          (missing.length ? ` missing ${missing.join(", ")}` : "") +
          (extra.length ? ` extra ${extra.join(", ")}` : ""),
      );
  }
}
if (failures.length) {
  console.error("condition parity: value exports differ from the `types` target\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log(`condition parity: ok (${entries.length} entries)`);
