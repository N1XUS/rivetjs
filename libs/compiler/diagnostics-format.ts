// Shared rendering of Rivet diagnostics for terminals (Vite plugin errors / warnings, `rivet check`, router and i18n
// build warnings): where the problem is (file:line:col + code frame), which package reported it (`[rivet:<origin>]`),
// what the code means and how to fix it (`fix:` = the code's explanation in `@rivetjs/language-core/explain.json` when
// that package is installed, `docs:` = the code's docs page). Node-only helpers, no runtime / browser use.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join, relative } from "node:path";
import { docsUrl } from "./codes.ts";

/** One diagnostic to render. Lines and columns are 1-based. */
export interface DiagnosticReport {
  /** Reporting package / plugin: `compiler`, `router`, `i18n`, … → `[rivet:compiler]`. */
  origin?: string;
  /** `RVnnnn` code, if the diagnostic has one (its docs URL and fix text are looked up). */
  code?: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  /** Text of `file`, for the code frame (read from disk when absent and `file` exists). */
  source?: string;
  /** Remedy; defaults to the code's fix text. */
  fix?: string;
  /** Docs link; defaults to the code's docs URL. */
  docs?: string;
}

export interface FormatOptions {
  /** Paths inside `root` print root-relative (default: absolute paths stay absolute). */
  root?: string;
  /** Code frame under the location (default true when a line is known). */
  frame?: boolean;
}

/** `file` relative to `root` when inside it, else unchanged (clickable in terminals and editors either way). */
export function displayPath(file: string, root?: string): string {
  if (!root || !isAbsolute(file)) return file;
  const rel = relative(root, file);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : file;
}

/** `file:line:col` (line / column omitted when unknown). */
export function location(file: string, line?: number, column?: number, root?: string): string {
  return displayPath(file, root) + (line ? ":" + line + (column ? ":" + column : "") : "");
}

/**
 * A code frame of `source` around `line` (1-based) with a caret under `column` (1-based, UTF-16), `context` lines
 * before and after; "" when the line is outside the source.
 */
export function codeFrame(source: string, line: number, column = 1, context = 2): string {
  const lines = source.split(/\r?\n/);
  if (line < 1 || line > lines.length) return "";
  const first = Math.max(1, line - context),
    last = Math.min(lines.length, line + context),
    width = String(last).length,
    out: string[] = [];
  for (let n = first; n <= last; n++) {
    const text = lines[n - 1]!.replace(/\t/g, "  ");
    out.push((n === line ? "  > " : "    ") + String(n).padStart(width) + " | " + text);
    if (n === line) {
      const before = lines[n - 1]!.slice(0, Math.max(0, column - 1)).replace(/\t/g, "  ");
      out.push("    " + " ".repeat(width) + " | " + " ".repeat(before.length) + "^");
    }
  }
  return out.join("\n");
}

let explanations: Map<string, string> | undefined;
// Bases already tried without success (a later call with another `root` still looks there).
const missed = new Set<string>();
/** Fix texts of `@rivetjs/language-core/explain.json` (resolved from this package, then from `root`); null when absent. */
function fixTable(root?: string): Map<string, string> | null {
  if (explanations) return explanations;
  for (const base of [import.meta.url, ...(root ? [join(root, "package.json")] : [])]) {
    if (missed.has(base)) continue;
    try {
      const file = createRequire(base).resolve("@rivetjs/language-core/explain.json");
      const table = JSON.parse(readFileSync(file, "utf8")) as { codes: { code: string; fix: string }[] };
      return (explanations = new Map(table.codes.map((entry) => [entry.code, entry.fix])));
    } catch {
      // Not installed (the language service is optional): `docs:` still points at the explanation.
      missed.add(base);
    }
  }
  return null;
}

/** The mechanical fix of `code` (one to three sentences), when the explanation table is installed. */
export function remedyOf(code: string, root?: string): string | undefined {
  return fixTable(root)?.get(code);
}

/** `fix:` / `docs:` lines (indented, each line prefixed with `\n`) for `code`; "" for neither. */
export function remedyLines(code: string | undefined, fix?: string, docs?: string, root?: string): string {
  const remedy = fix ?? (code ? remedyOf(code, root) : undefined),
    link = docs ?? (code ? docsUrl(code) : undefined);
  return (remedy ? "\n  fix: " + remedy : "") + (link ? "\n  docs: " + link : "");
}

/**
 * Render one diagnostic:
 *
 *     [rivet:compiler] RV1016 Event handler onClick expression is evaluated once at render …
 *       at src/routes/index.tsx:12:7
 *         11 |   return (
 *       > 12 |     <button onClick={handler()}>
 *            |                     ^
 *       fix: Wrap the handler in an arrow …
 *       docs: https://rivetjs.severyn.pro/errors/RV1016
 */
export function formatDiagnostic(report: DiagnosticReport, options: FormatOptions = {}): string {
  const head = (report.origin ? "[rivet:" + report.origin + "] " : "") + (report.code ? report.code + " " : "") + report.message;
  let out = head;
  if (report.file) {
    out += "\n  at " + location(report.file, report.line, report.column, options.root);
    if (report.line && options.frame !== false) {
      let source = report.source;
      if (source === undefined)
        try {
          source = readFileSync(report.file, "utf8");
        } catch {
          source = undefined;
        }
      const frame = source === undefined ? "" : codeFrame(source, report.line, report.column ?? 1);
      if (frame) out += "\n" + frame;
    }
  }
  return out + remedyLines(report.code, report.fix, report.docs, options.root);
}

const FRAME = /^\s*at (?:(?:async )?(.+?) \()?(?:file:\/\/)?((?:\/|[A-Za-z]:[\\/])[^?()]*?)(?:\?[^():]*)?:(\d+):(\d+)\)?$/;

/**
 * App frames of a (source-mapped) stack: the first `max` frames whose file is inside `root` and outside `node_modules`,
 * as `at Name (src/routes/index.tsx:12:7) ← at …`; "" when none (framework-only stack). The dev server's
 * `Symbol.for("rivet.locate")` (`vite.ts`) runs it over `ssrFixStacktrace`-mapped stacks for server-side dev warnings.
 */
export function appFrames(stack: string, root: string, max = 2): string {
  const out: string[] = [];
  for (const line of stack.split("\n")) {
    const m = FRAME.exec(line);
    if (!m) continue;
    const file = m[2]!;
    const rel = relative(root, file);
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || /[/\\]node_modules[/\\]/.test(file) || rel.startsWith(".rivet")) continue;
    out.push("at " + (m[1] ? m[1].replace(/^Module\./, "") + " (" : "") + rel + ":" + m[3] + ":" + m[4] + (m[1] ? ")" : ""));
    if (out.length === max) break;
  }
  return out.join(" ← ");
}
