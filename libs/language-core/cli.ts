#!/usr/bin/env node
// `rivet check`: the editor's Rivet diagnostics for whole projects (CI, non-editor users).
//   rivet-check [-p tsconfig.json]... [--no-types] [--format text|json] [--help]
// Text: per diagnostic a `file:line:col - error RVxxxx: message` line, its code frame and `fix:` / `docs:` lines, then a
// summary; JSON: one object on stdout (each diagnostic with `docs` and `fix`).
// Exit 0 clean (warnings do not fail), 1 on errors (incl. a missing .rivet/editor.json, RV7101),
// 1 also covers setup failures; 2 is reserved for invalid arguments.
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { docsUrl } from "@rivetjs/compiler/codes";
import { codeFrame, remedyLines, paint, suggestion, groupDiagnostics, debugEnabled } from "@rivetjs/compiler/format";
import { explainCode } from "./explain.ts";
import { analyzeFile, createLanguageCore, findCompiler, manifestStatus, viteRoot, workspaceCompilerWasm, type CheckDiagnostic } from "./index.ts";

export interface CheckRun {
  diagnostics: CheckDiagnostic[];
  files: number;
  /** Projects not checked: tsconfigs without `jsxImportSource: "@rivetjs/runtime"` (or with no Rivet files). */
  skipped: { config: string; reason: string }[];
}

/** A setup problem (no compiler wasm, unreadable tsconfig): `main` exits 1. */
export class CheckSetupError extends Error {
  override name = "CheckSetupError";
}

class CheckUsageError extends Error {}

const USAGE = `Usage:
  rivet-check [-p tsconfig.json]... [--no-types] [--no-manifest] [--format text|json]

Rivet compiler diagnostics (both targets, resume mode per .rivet/editor.json) plus the language
service's type-aware checks for every Rivet file (.tsx / .jsx) of the given tsconfig projects
(and the projects they reference). An app whose .rivet/editor.json is missing is an error (RV7101),
a stale one a warning (RV7102): run \`rivet sync\` first.

Options:
  -p, --project <path>      tsconfig file or directory (repeatable; default tsconfig.json)
  --no-types                skip type-aware checks (RV3101 route links)
  --no-manifest             skip the .rivet/editor.json checks (RV7101 / RV7102)
  --format text|json        output format (default text)
  --json                    alias for --format json
  --quiet                   errors only (JSON keeps counts)
  --verbose                 include error stacks (also DEBUG=rivet)
  -h, --help                show this help

Examples:
  rivet-check -p tsconfig.json
  rivet-check --json --quiet

Exit status: 0 no errors (warnings do not fail), 1 errors or setup failure,
2 usage error (invalid arguments or a non-tsconfig project path).`;

/** `-p` argument → tsconfig path: a directory means its `tsconfig.json`; anything else must be a `.json` file. */
function configPath(cwd: string, config: string): string {
  const path = resolve(cwd, config);
  if (ts.sys.directoryExists(path)) return join(path, "tsconfig.json");
  if (!/\.json$/i.test(path)) throw new CheckUsageError(`rivet check: ${config}: not a tsconfig (expected a .json file or a directory)`);
  return path;
}

/** Project-level manifest problems of the checked app roots (RV7101 missing, RV7102 stale). */
function manifestDiagnostics(roots: Iterable<string>): CheckDiagnostic[] {
  const out: CheckDiagnostic[] = [];
  for (const root of roots) {
    const { status, reason } = manifestStatus(root);
    if (status === "ok") continue;
    const filename = join(root, ".rivet", "editor.json");
    const base = { filename, start: 0, end: 0, targets: ["server", "dom"] as CheckDiagnostic["targets"] };
    out.push(
      status === "missing"
        ? {
            ...base,
            code: "RV7101",
            severity: "error",
            message: "Editor manifest missing: resume-mode and route checks cannot run. Run `rivet sync` (or `vite build`) first.",
          }
        : { ...base, code: "RV7102", severity: "warning", message: `Editor manifest stale (${reason} changed after it was written). Run \`rivet sync\`.` },
    );
  }
  return out.map((d) => ({ ...d, docs: docsUrl(d.code) }));
}

/** Check every Rivet file of the given tsconfig projects (and the projects they reference). Also
 * reports each checked app root (nearest Vite config) whose `.rivet/editor.json` is missing (error)
 * or stale (warning) unless `manifest: false`. */
export function checkProjects(
  configs: readonly string[],
  { typeAware = true, manifest = true, cwd = process.cwd() }: { typeAware?: boolean; manifest?: boolean; cwd?: string } = {},
): CheckRun {
  const problems: string[] = [];
  const compiler = findCompiler([workspaceCompilerWasm(cwd), workspaceCompilerWasm(import.meta.dirname)], (message) => problems.push(message));
  if (!compiler) throw new CheckSetupError(["rivet check: no usable @rivetjs/compiler (rivet_compiler.wasm with the check op)", ...problems].join("\n  "));
  const core = createLanguageCore({ compiler });
  const diagnostics: CheckDiagnostic[] = [];
  const skipped: CheckRun["skipped"] = [];
  const seen = new Set<string>();
  const roots = new Set<string>();
  const visited = new Set<string>();
  let files = 0;
  const pending = configs.map((config) => ({ config, path: configPath(cwd, config) }));
  for (let next; (next = pending.shift());) {
    const { config, path } = next;
    if (visited.has(path)) continue;
    visited.add(path);
    if (!ts.sys.fileExists(path)) throw new CheckSetupError(`rivet check: ${config}: file not found`);
    const parsed = ts.getParsedCommandLineOfConfigFile(
      path,
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (d) => {
          throw new CheckSetupError(`rivet check: ${config}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
        },
      },
    );
    if (!parsed) throw new CheckSetupError(`rivet check: ${config}: unreadable tsconfig`);
    // Config errors (missing `extends`, bad options) change what is checked: never a silent pass.
    // An empty project (TS18002 empty `files`, TS18003 no inputs) is not one: nothing to check.
    const errors = parsed.errors.filter((d) => d.category === ts.DiagnosticCategory.Error && d.code !== 18002 && d.code !== 18003);
    if (errors.length)
      throw new CheckSetupError(errors.map((d) => `rivet check: ${config}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`).join("\n"));
    // Solution-style configs: walk `references` (checked like `-p` projects).
    for (const reference of parsed.projectReferences ?? []) {
      const referenced = ts.resolveProjectReferencePath(reference);
      pending.push({ config: relative(cwd, referenced) || referenced, path: referenced });
    }
    if (parsed.options.jsxImportSource !== "@rivetjs/runtime") {
      if (parsed.fileNames.length || !parsed.projectReferences?.length)
        skipped.push({ config, reason: `jsxImportSource is ${JSON.stringify(parsed.options.jsxImportSource ?? null)}, not "@rivetjs/runtime"` });
      continue;
    }
    const names = parsed.fileNames.filter((name) => core.isRivetFile(name) && !seen.has(name));
    if (!names.length) {
      if (!parsed.projectReferences?.length) skipped.push({ config, reason: "no Rivet files (.tsx / .jsx)" });
      continue;
    }
    const program = ts.createProgram({
      rootNames: parsed.fileNames,
      options: { ...parsed.options, noEmit: true },
      projectReferences: parsed.projectReferences ?? [],
    });
    for (const name of names) {
      seen.add(name);
      const file = program.getSourceFile(name);
      if (!file) continue;
      files++;
      const root = viteRoot(name);
      if (root) roots.add(root);
      diagnostics.push(...analyzeFile(ts, core, program, file, { typeAware }).diagnostics);
    }
  }
  if (manifest) diagnostics.unshift(...manifestDiagnostics(roots));
  return { diagnostics, files, skipped };
}

/**
 * Text output of one diagnostic: the tsc-style header `file:line:col - error RVnnnn: message` (editor problem matchers
 * read this line), then the code frame, `fix:` (the code's explanation, `explain.json`) and `docs:` lines.
 */
export function format(d: CheckDiagnostic, cwd = process.cwd()): string {
  const head = `${relative(cwd, d.filename)}:${d.line ?? 1}:${d.column ?? 1} - ${paint(d.severity === "error" ? "red" : "yellow", d.severity, process.stdout)} ${d.code}: ${d.message}`;
  let source: string | undefined;
  try {
    source = d.line ? readFileSync(d.filename, "utf8") : undefined;
  } catch {
    source = undefined;
  }
  const frame = source === undefined ? "" : codeFrame(source, d.line!, d.column ?? 1);
  return head + (frame ? "\n" + frame : "") + remedyLines(d.code, explainCode(d.code)?.fix, d.docs ?? docsUrl(d.code));
}

export function main(argv: readonly string[]): number {
  const configs: string[] = [];
  let typeAware = true,
    manifest = true,
    json = argv.includes("--json") || argv.includes("--format=json") || argv.some((arg, i) => arg === "--format" && argv[i + 1] === "json"),
    quiet = false,
    verbose = debugEnabled();
  const fail = (message: string, code = 2, error?: unknown): number => {
    const fix = "Check the project path/configuration; run rivet-check --help for options and rivet sync before checking an app.";
    if (json) console.log(JSON.stringify({ error: message, fix, exitCode: code, ...(verbose && error instanceof Error ? { stack: error.stack } : {}) }));
    else console.error(`${message}\n  fix: ${fix}${verbose && error instanceof Error ? "\n" + error.stack : ""}`);
    return code;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") {
      console.log(USAGE);
      return 0;
    } else if (arg === "-p" || arg === "--project") {
      const value = argv[++i];
      if (!value || value.startsWith("-")) return fail(`rivet check: ${arg} requires a project path.`);
      configs.push(value);
    } else if (arg === "--json") json = true;
    else if (arg === "--quiet") quiet = true;
    else if (arg === "--verbose") verbose = true;
    else if (arg === "--no-types") typeAware = false;
    else if (arg === "--no-manifest") manifest = false;
    else if (arg === "--format" || arg.startsWith("--format=")) {
      const value = arg === "--format" ? argv[++i] : arg.slice("--format=".length);
      if (value !== "text" && value !== "json") {
        return fail(`rivet check: --format must be text or json (got ${value ?? "nothing"})`);
      }
      json = value === "json";
    } else {
      return fail(
        `rivet check: unknown argument ${arg}.${suggestion(arg, ["--project", "--no-types", "--no-manifest", "--format", "--json", "--quiet", "--verbose", "--help"])} Run rivet-check --help.`,
      );
    }
  }
  let run: CheckRun;
  try {
    run = checkProjects(configs.length ? configs : ["tsconfig.json"], { typeAware, manifest });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error), error instanceof CheckUsageError ? 2 : 1, error);
  }
  const { diagnostics, files, skipped } = run;
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  if (json) {
    const cwd = process.cwd();
    const list = groupDiagnostics(diagnostics)
      .filter(({ diagnostic }) => !quiet || diagnostic.severity === "error")
      .map(({ diagnostic: d, count, occurrences }) => ({
        ...d,
        file: relative(cwd, d.filename),
        fix: explainCode(d.code)?.fix,
        count,
        ...(count > 1 ? { occurrences: occurrences.map(({ line, column, message }) => ({ line, column, message })) } : {}),
      }));
    console.log(JSON.stringify({ files, errors, warnings: diagnostics.length - errors, skipped, diagnostics: list }, null, 2));
    return errors ? 1 : 0;
  }
  for (const { diagnostic: d, count } of groupDiagnostics(diagnostics)) {
    if (!quiet || d.severity === "error")
      console.log(format(d) + (count > 1 ? `\n  occurrences: ${count} (same code and file; --json lists every location)` : ""));
  }
  if (quiet) return errors ? 1 : 0;
  for (const s of skipped) console.log(`rivet check: skipped ${s.config} (${s.reason})`);
  console.log(
    `rivet check: ${files} file${files === 1 ? "" : "s"}, ${errors} error${errors === 1 ? "" : "s"}, ${diagnostics.length - errors} warning${diagnostics.length - errors === 1 ? "" : "s"}`,
  );
  return errors ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
