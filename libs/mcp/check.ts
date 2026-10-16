// `check_code`: the Rivet compiler (both targets, resume mode by default) + language-core checks on one snippet, as
// the editor and `rivet check` report them: RV diagnostics with line / column, the explanation's fix text, the quick
// fixes that apply (with the fixed source), RV2101 / RV3101 when a TypeScript program can be built, and TypeScript's
// own errors when the `@rivetjs/*` packages resolve from the working directory.
import { resolve } from "node:path";
import ts from "typescript";
import {
  analyzeFile,
  applyEdits,
  codeFixes,
  explainCode,
  findCompiler,
  workspaceCompilerWasm,
  type CheckDiagnostic,
  type Compiler,
  type FileCheck,
  type LanguageCore,
} from "@rivetjs/language-core";

export interface CheckedDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  line?: number;
  column?: number;
  /** Source text the diagnostic covers (≤ 120 chars). */
  excerpt: string;
  /** Mechanical fix text (`explain.json`). */
  fix?: string;
  docs?: string;
  /** Quick fixes that apply, with the whole fixed source. */
  quickFixes: { description: string; fixed: string }[];
}

export interface CheckCodeResult {
  filename: string;
  resume: boolean;
  diagnostics: CheckedDiagnostic[];
  /** TypeScript errors (`TSnnnn`), only when the Rivet packages resolve from `cwd`. */
  typescript: { code: string; message: string; line: number; column: number }[];
  /** Why type-aware checks were skipped, if they were. */
  note?: string;
}

let compiler: Compiler | null | undefined;

/** The Rivet compiler of the app in `cwd`, else the one this package depends on. */
export function rivetCompiler(cwd = process.cwd()): Compiler {
  compiler ??= findCompiler([workspaceCompilerWasm(cwd), workspaceCompilerWasm(import.meta.dirname)]);
  if (!compiler) throw new Error("@rivetjs/mcp: no Rivet compiler (rivet_compiler.wasm) found");
  return compiler;
}

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve,
  jsxImportSource: "@rivetjs/runtime",
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
  lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  types: [],
};

/**
 * Check `code` as the file `filename` (default `src/routes/index.tsx`) of an app rooted at `cwd`. `resume` (default
 * true): compile as a resumable module, as the starters do (handler / capture rules apply).
 */
export function checkCode(code: string, options: { filename?: string; resume?: boolean; cwd?: string; types?: boolean } = {}): CheckCodeResult {
  const filename = options.filename ?? "src/routes/index.tsx";
  const resume = options.resume ?? /\.[jt]sx$/.test(filename);
  const cwd = options.cwd ?? process.cwd();
  const absolute = resolve(cwd, filename);
  const rivet = rivetCompiler(cwd);
  const checked = rivet.check(code, { filename, ...(resume ? { resume: { module: filename.replaceAll("\\", "/") } } : {}) });
  const result: FileCheck = {
    diagnostics: checked.diagnostics,
    sites: checked.sites,
    classes: checked.classes ?? [],
    resume,
    moduleId: resume ? filename : null,
    project: null,
  };
  // Other files of the program (packages) are not checked here: no class verdicts for them.
  const other: FileCheck = { diagnostics: [], sites: [], classes: [], resume: false, moduleId: null, project: null };
  const core: LanguageCore = {
    compiler: rivet,
    isRivetFile: (file) => /\.[jt]sx$/.test(file),
    check: (file) => (resolve(file) === absolute ? result : other),
    project: () => null,
    routes: () => [],
    routeFile: () => "",
  };
  const source = ts.createSourceFile(
    absolute,
    code,
    ts.ScriptTarget.Latest,
    true,
    /\.tsx$/.test(filename) ? ts.ScriptKind.TSX : /\.jsx$/.test(filename) ? ts.ScriptKind.JSX : undefined,
  );
  let diagnostics: CheckDiagnostic[] = result.diagnostics;
  const typescript: CheckCodeResult["typescript"] = [];
  let note: string | undefined;
  if (options.types !== false) {
    const host = ts.createCompilerHost(OPTIONS, true);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (file, language, onError, create) => (resolve(file) === absolute ? source : getSourceFile(file, language, onError, create));
    const fileExists = host.fileExists.bind(host);
    host.fileExists = (file) => resolve(file) === absolute || fileExists(file);
    host.getCurrentDirectory = () => cwd;
    const program = ts.createProgram([absolute], OPTIONS, host);
    const file = program.getSourceFile(absolute)!;
    const all = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)];
    // TS2307 on a @rivetjs/* import, TS2875 (JSX runtime module missing): the app's packages are not reachable.
    const unresolved = all.some((d) => (d.code === 2307 || d.code === 2875) && /@rivetjs\//.test(ts.flattenDiagnosticMessageText(d.messageText, "\n")));
    if (unresolved) note = `TypeScript checks skipped: the @rivetjs/* packages do not resolve from ${cwd} (run the server in a Rivet app).`;
    else
      for (const d of all) {
        const at = file.getLineAndCharacterOfPosition(d.start ?? 0);
        typescript.push({ code: `TS${d.code}`, message: ts.flattenDiagnosticMessageText(d.messageText, "\n"), line: at.line + 1, column: at.character + 1 });
      }
    diagnostics = analyzeFile(ts, core, program, file, unresolved ? { typeAware: false } : {}).diagnostics;
  } else {
    diagnostics = diagnostics.map((d) => {
      const at = d.line !== undefined ? source.getLineAndCharacterOfPosition(d.start) : null;
      return { ...d, ...(at ? { line: at.line + 1, column: at.character + 1 } : {}) };
    });
  }
  return {
    filename,
    resume,
    diagnostics: diagnostics.map((d) => {
      const explanation = explainCode(d.code);
      const quickFixes = codeFixes(ts, source, d).map((fix) => ({ description: fix.description, fixed: applyEdits(code, fix.edits) }));
      return {
        code: d.code,
        severity: d.severity,
        message: d.message,
        ...(d.line !== undefined ? { line: d.line, column: d.column } : {}),
        excerpt: code.slice(d.start, Math.min(d.end, d.start + 120)),
        ...(explanation ? { fix: explanation.fix } : {}),
        ...(d.docs ? { docs: d.docs } : {}),
        quickFixes,
      };
    }),
    typescript,
    ...(note ? { note } : {}),
  };
}

/** Plain-text report of a check (what the MCP tool returns). */
export function formatCheck(result: CheckCodeResult): string {
  const lines: string[] = [];
  const errors = result.diagnostics.filter((d) => d.severity === "error").length + result.typescript.length;
  lines.push(
    `${result.filename} (${result.resume ? "resumable module" : "not resumable"}): ${result.diagnostics.length} Rivet diagnostic(s), ${result.typescript.length} TypeScript error(s)${errors ? "" : " — clean"}`,
  );
  for (const d of result.diagnostics) {
    lines.push("", `${d.code} ${d.severity}${d.line !== undefined ? ` at ${d.line}:${d.column}` : ""}: ${d.message}`);
    if (d.excerpt) lines.push(`  code: ${d.excerpt.replace(/\s+/g, " ")}`);
    if (d.fix) lines.push(`  fix: ${d.fix}`);
    for (const fix of d.quickFixes) lines.push(`  quick fix "${fix.description}" →`, "```tsx", fix.fixed.trimEnd(), "```");
    if (d.docs) lines.push(`  more: explain_diagnostic("${d.code}")`);
  }
  for (const d of result.typescript) lines.push("", `${d.code} at ${d.line}:${d.column}: ${d.message}`);
  if (result.note) lines.push("", result.note);
  return lines.join("\n");
}
