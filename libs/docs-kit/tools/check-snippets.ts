// Check the code fences of an app's content (`content/**.md`) without building the site:
// - every ```ts / tsx / js / jsx fence must parse (a JSX fence with several root elements is read as a fragment);
// - fences that import something are typechecked together against the workspace packages; by default only
//   import drift fails (a `@rivetjs/*` module or export that no longer exists), because most fences are
//   excerpts that use names from the surrounding prose;
// - fence meta `check` (```tsx check title="…") makes the fence a full typecheck (every diagnostic fails);
//   fence meta `nocheck` skips the fence (pseudo-code, deliberately invalid code).
//   node libs/docs-kit/cli.ts check-snippets apps/docs
import ts from "typescript";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";

export interface Snippet {
  /** Markdown file (absolute). */
  file: string;
  /** 1-based line of the opening fence. */
  line: number;
  lang: "ts" | "tsx" | "js" | "jsx";
  meta: string;
  code: string;
}

export interface SnippetFailure {
  file: string;
  /** 1-based Markdown line of the failing code line. */
  line: number;
  message: string;
}

const LANGS: Record<string, Snippet["lang"]> = { ts: "ts", typescript: "ts", tsx: "tsx", js: "js", javascript: "js", jsx: "jsx", mjs: "js" };
/** Diagnostics that mean a fence's imports drifted from the packages (checked in every importing fence). */
const DRIFT = new Set([2305, 2307, 2459, 2460, 2614, 2724]);

interface MdNode {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  children?: MdNode[];
  position?: { start: { line: number } };
}

/** The ts/tsx/js/jsx fences of one Markdown document (other languages ignored). */
export function extractSnippets(markdown: string, file: string): Snippet[] {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(markdown) as MdNode;
  const out: Snippet[] = [];
  const visit = (node: MdNode) => {
    if (node.type === "code") {
      const lang = LANGS[(node.lang ?? "").toLowerCase()];
      if (lang) out.push({ file, line: node.position?.start.line ?? 1, lang, meta: node.meta ?? "", code: node.value ?? "" });
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  return out;
}

const metaFlag = (meta: string, flag: string) => meta.split(/\s+/).includes(flag);

function parseErrors(code: string, lang: Snippet["lang"]): readonly ts.Diagnostic[] {
  const options = { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, allowJs: true };
  return ts.transpileModule(code, { fileName: `snippet.${lang}`, reportDiagnostics: true, compilerOptions: options }).diagnostics ?? [];
}

/**
 * Ways an excerpt is read before it counts as broken: `…` elisions as a value, markup siblings as a
 * fragment, `key: value,` members as an object literal, `call({ … }),` items as an array, and JSX
 * elements written one per statement (`<A />` then `<B />` on later lines).
 */
const EXCERPT_FORMS: ((code: string, jsx: boolean) => string | undefined)[] = [
  (code, jsx) => (jsx ? `<>\n${code}\n</>` : undefined),
  (code) => `({\n${code}\n})`,
  (code) => `[\n${code}\n]`,
  (code, jsx) => (jsx ? code.replace(/(\/>|<\/[\w.:-]*>)([ \t]*(?:\/\/[^\n]*)?)(?=\n(?:[ \t]*(?:\/\/[^\n]*)?\n)*[ \t]*<[\w>])/g, "$1;$2") : undefined),
];

/** Syntax errors of one fence (empty when it parses as a module or as one of the excerpt forms). */
export function syntaxErrors(snippet: Snippet): SnippetFailure[] {
  const errors = parseErrors(snippet.code, snippet.lang);
  if (!errors.length) return [];
  const jsx = snippet.lang === "tsx" || snippet.lang === "jsx";
  const elided = snippet.code.replaceAll("\u2026", "0");
  for (const form of [(code: string) => code, ...EXCERPT_FORMS]) {
    const variant = form(elided, jsx);
    if (variant !== undefined && !parseErrors(variant, snippet.lang).length) return [];
  }
  const first = errors[0]!;
  const source = ts.createSourceFile("x", snippet.code, ts.ScriptTarget.Latest);
  const { line } = source.getLineAndCharacterOfPosition(first.start ?? 0);
  return [{ file: snippet.file, line: snippet.line + 1 + line, message: ts.flattenDiagnosticMessageText(first.messageText, " ") }];
}

function markdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(path));
    else if (entry.name.endsWith(".md")) files.push(path);
  }
  return files.sort();
}

/**
 * Typecheck the importing fences as modules under `<root>/.artifacts/snippets/` with the app's
 * `tsconfig.json` options. Drift diagnostics fail every fence; any diagnostic fails a `check` fence.
 */
export function typeErrors(root: string, snippets: Snippet[]): SnippetFailure[] {
  const typed = snippets.filter((s) => metaFlag(s.meta, "check") || /^\s*import\s/m.test(s.code));
  if (!typed.length) return [];
  const dir = resolve(root, ".artifacts/snippets");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const byFile = new Map<string, Snippet>();
  typed.forEach((snippet, i) => {
    const path = join(dir, `snippet-${i}.${snippet.lang}`);
    writeFileSync(path, snippet.code);
    byFile.set(path, snippet);
  });
  const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, " "));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const extra = parsed.fileNames.filter((f) => f.endsWith(".d.ts"));
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true, noUnusedLocals: false, noUnusedParameters: false, allowJs: true, checkJs: false };
  const program = ts.createProgram({ rootNames: [...byFile.keys(), ...extra], options });
  const failures: SnippetFailure[] = [];
  for (const [path, snippet] of byFile) {
    const source = program.getSourceFile(path);
    if (!source) continue;
    const strict = metaFlag(snippet.meta, "check");
    for (const d of [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]) {
      if (!strict) {
        if (!DRIFT.has(d.code)) continue;
        // A missing relative module is the page's own (illustrative) file, not drift.
        if (d.code === 2307 && !/'@rivetjs\//.test(ts.flattenDiagnosticMessageText(d.messageText, " "))) continue;
      }
      const { line } = source.getLineAndCharacterOfPosition(d.start ?? 0);
      failures.push({ file: snippet.file, line: snippet.line + 1 + line, message: `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}` });
    }
  }
  return failures;
}

/** All fences of `<root>/content`: syntax first, then the typecheck of the fences that parse. */
export function checkSnippets(root: string): { snippets: Snippet[]; failures: SnippetFailure[] } {
  const snippets = markdownFiles(resolve(root, "content"))
    .flatMap((file) => extractSnippets(readFileSync(file, "utf8"), file))
    .filter((s) => !metaFlag(s.meta, "nocheck"));
  const failures: SnippetFailure[] = [];
  const parsed: Snippet[] = [];
  for (const snippet of snippets) {
    const errors = syntaxErrors(snippet);
    if (errors.length) failures.push(...errors);
    else parsed.push(snippet);
  }
  failures.push(...typeErrors(root, parsed));
  return { snippets, failures };
}

/** CLI: `docs-kit check-snippets <app root>`. */
export async function checkSnippetsCommand(root: string, _args: string[]): Promise<void> {
  const { snippets, failures } = checkSnippets(root);
  const repo = resolve(root, "../..");
  for (const f of failures) console.error(`${relative(repo, f.file)}:${f.line}: ${f.message}`);
  console.log(`snippets: ${snippets.length} fences, ${failures.length} problem(s)`);
  if (failures.length) process.exitCode = 1;
}
