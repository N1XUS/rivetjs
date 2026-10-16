import { test, afterAll as after } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { FIXABLE_CODES } from "@rivetjs/language-core";
import { at, fixture, sources } from "./fixture.ts";

const fx = fixture();
after(() => rmSync(fx.root, { recursive: true, force: true }));

const rivet = (file: string) => fx.service.getSemanticDiagnostics(file).filter((d) => d.source === "rivet");
const text = (d: ts.Diagnostic) => d.file!.text.slice(d.start, d.start! + d.length!);

test("compiler diagnostics appear with code, range and category", () => {
  const diagnostics = rivet(fx.file("src/broken.tsx"));
  const byCode = Object.fromEntries(diagnostics.map((d) => [d.code, d]));
  assert.deepEqual(Object.keys(byCode).sort(), ["71002", "71008"]);
  assert.equal(text(byCode[71002]!), "{...p}");
  assert.match(byCode[71002]!.messageText as string, /^Spread children are not supported: /);
  assert.equal(byCode[71002]!.category, ts.DiagnosticCategory.Error);
  assert.equal(text(byCode[71008]!), "<br>text</br>");
  // The invalid preload literal is a TypeScript error (typed directive), so RV1102 is not repeated.
  const typeErrors = fx.service.getSemanticDiagnostics(fx.file("src/broken.tsx")).filter((d) => d.source !== "rivet");
  assert.ok(typeErrors.some((d) => /"idel"/.test(ts.flattenDiagnosticMessageText(d.messageText, "\n"))));
});

test("resume mode follows the manifest: browser globals only in resume modules", () => {
  assert.deepEqual(rivet(fx.file("src/plain.tsx")), []);
  const counter = rivet(fx.file("src/counter.tsx"));
  // RV2101: `store` is a class instance the compiler cannot see (made by a call); `#items` keeps Store from resuming as a data class.
  assert.deepEqual(
    counter.map((d) => [d.code, d.category, text(d)]),
    [[72101, ts.DiagnosticCategory.Warning, "store"]],
  );
});

test("TypeScript syntax errors win over the compiler's parse errors", () => {
  fx.edit("src/plain.tsx", "export const A = () => <div>;\n");
  assert.ok(fx.service.getSyntacticDiagnostics(fx.file("src/plain.tsx")).length > 0);
  assert.deepEqual(
    rivet(fx.file("src/plain.tsx")).filter((d) => d.code === 71000),
    [],
  );
  fx.edit("src/plain.tsx", sources["src/plain.tsx"]);
});

test("quick fixes for compiler diagnostics; codes do not collide with TypeScript's fixes", () => {
  const file = fx.file("src/broken.tsx");
  const [voidError] = rivet(file).filter((d) => d.code === 71008);
  const fixes = fx.service.getCodeFixesAtPosition(file, voidError!.start!, voidError!.start! + voidError!.length!, [71008], {}, {});
  assert.equal(fixes.length, 1);
  assert.deepEqual(
    fixes[0]!.changes[0]!.textChanges.map((c) => c.newText),
    ["<br />"],
  );
  const supported = fx.service.getSupportedCodeFixes!(file);
  // Every language-core fixable code (RVxxxx → 7xxxx), so the list cannot drift from the registry.
  for (const code of FIXABLE_CODES) assert.ok(supported.includes("7" + code.slice(2)), code);
  // RVxxxx → 7xxxx: a range TypeScript uses neither for diagnostics nor fixes.
  const taken = new Set([
    ...ts.getSupportedCodeFixes(),
    ...Object.values((ts as unknown as { Diagnostics: Record<string, { code: number }> }).Diagnostics).map((d) => String(d.code)),
  ]);
  assert.ok(![...taken].some((code) => /^7\d{4}$/.test(code)));
});

test("inlay hints mark browser-only closures and their captures", () => {
  const file = fx.file("src/counter.tsx");
  const hints = fx.service.provideInlayHints(file, { start: 0, length: sources["src/counter.tsx"].length }, {});
  const rivetHints = hints.filter((h) => h.text.startsWith("client"));
  assert.deepEqual(
    rivetHints.map((h) => [h.text, h.position]).sort(),
    [
      ["client · count, step", at(sources["src/counter.tsx"], "closure")],
      ["client · store", sources["src/counter.tsx"].indexOf("() => { void store")],
    ].sort(),
  );
});

test("hover: resume symbol on the handler, serialization on captured variables", () => {
  const file = fx.file("src/counter.tsx");
  const source = sources["src/counter.tsx"];
  const doc = (position: number) => ts.displayPartsToString(fx.service.getQuickInfoAtPosition(file, position)?.documentation ?? []);
  assert.match(doc(at(source, "on") + 1), /Rivet resume.*event handler `src\/counter\.tsx#Counter\$\w+`.*browser.*captures `count`, `step`/);
  assert.match(doc(at(source, "count") + 1), /`count` is serialized into resume state \(captured by `Counter\$\w+`, `Counter\$\w+`\)/);
});

test("links: unknown routes warn when `to` is a plain string; nothing extra when TS narrows it", () => {
  const file = fx.file("src/links.tsx");
  const warnings = rivet(file);
  assert.deepEqual(
    warnings.map((d) => [d.code, d.category, text(d)]),
    [[73101, ts.DiagnosticCategory.Warning, '"/nope"']],
  );
});

test("links: route path completions, definitions and hover", () => {
  const file = fx.file("src/links.tsx");
  const source = sources["src/links.tsx"];
  const completions = fx.service.getCompletionsAtPosition(file, at(source, "complete") + 1, {})!;
  const names = completions.entries.filter((e) => e.labelDetails?.description).map((e) => e.name);
  assert.deepEqual(names, ["/items/", "/about", "/"]);
  const position = source.indexOf('"/items/1"') + 3;
  const definition = fx.service.getDefinitionAndBoundSpan(file, position)!;
  assert.equal(definition.definitions![0]!.fileName, join(fx.root, "src/routes/items/[id].tsx"));
  assert.equal(source.slice(definition.textSpan.start, definition.textSpan.start + definition.textSpan.length), '"/items/1"');
  const hover = ts.displayPartsToString(fx.service.getQuickInfoAtPosition(file, position)!.documentation);
  assert.match(hover, /Rivet route.*`items\/\[id\]`.*params id="1"/);
  // Narrowed `to` (route union): TypeScript completes it; the plugin adds nothing.
  const typed = fx.service.getCompletionsAtPosition(file, source.indexOf('"/items/2"') + 2, {});
  assert.ok(!typed?.entries.some((e) => e.labelDetails?.description));
});

test("inert without Rivet JSX settings", () => {
  const other = fixture();
  try {
    writeFileSync(join(other.root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "preserve", strict: true }, include: ["src"] }));
    const parsed = ts.getParsedCommandLineOfConfigFile(join(other.root, "tsconfig.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} })!;
    const service = ts.createLanguageService({
      getCompilationSettings: () => parsed.options,
      getScriptFileNames: () => parsed.fileNames,
      getScriptVersion: () => "0",
      getScriptSnapshot: (f) => (ts.sys.fileExists(f) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(f)!) : undefined),
      getCurrentDirectory: () => other.root,
      getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
    });
    const project = {
      getCompilerOptions: () => parsed.options,
      getCurrentDirectory: () => other.root,
      projectService: { logger: { info() {} } },
    } as unknown as ts.server.Project;
    const proxied = other.plugin.create({ languageService: service, project, config: {} } as unknown as ts.server.PluginCreateInfo);
    assert.deepEqual(
      proxied.getSemanticDiagnostics(other.file("src/broken.tsx")).filter((d) => d.source === "rivet"),
      [],
    );
  } finally {
    rmSync(other.root, { recursive: true, force: true });
  }
});

test("getExternalFiles adds generated .rivet/*.d.ts to Rivet app projects", () => {
  mkdirSync(join(fx.root, ".rivet"), { recursive: true });
  writeFileSync(join(fx.root, ".rivet/routes.d.ts"), "export {};\n");
  const project = (jsxImportSource: string | undefined) =>
    ({
      getCompilerOptions: () => ({ jsxImportSource }),
      projectKind: ts.server.ProjectKind.Configured,
      getProjectName: () => join(fx.root, "tsconfig.json"),
      getRootFiles: () => [],
    }) as unknown as ts.server.Project;
  const external = fx.plugin.getExternalFiles!(project("@rivetjs/runtime"), 0 as never);
  assert.deepEqual(external, [join(fx.root, ".rivet/routes.d.ts")]);
  assert.deepEqual(fx.plugin.getExternalFiles!(project(undefined), 0 as never), []);
});
