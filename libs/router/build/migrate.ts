// `rivet migrate server-exports`: rewrite magic route server export names to wrapper calls (spec
// docs/design/specs/2026-10-20-server-exports-design.md). In-file names (`serverLoad`, `serverGuard`,
// `serverActions`, `serverEntries`, `serverHeaders`, `onRequest`, `onGet`…) in every route module and the
// sibling `*.server.ts` names (`load`, `guard`, `actions`, `entries`, `headers`, `GET`…):
//   export async function serverLoad(event) { … }  →  export const loader = load(async (event) => { … });
//   export const onGet = (event) => …               →  export const GET = onGet((event) => …);
// with `import { load, onGet } from "@rivetjs/router"` added. Renames are scope-aware (TypeScript
// language service): references in other modules (`typeof import(…).serverLoad`, `PageProps<typeof
// serverLoad>`) follow; unrelated locals of the same name do not.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import type TS from "typescript";

/** Wrapper and conventional export name per former magic name. */
export const WRAPPERS: Readonly<Record<string, { readonly wrapper: string; readonly name: string }>> = {
  serverLoad: { wrapper: "load", name: "loader" },
  serverGuard: { wrapper: "guard", name: "access" },
  serverActions: { wrapper: "actions", name: "forms" },
  serverEntries: { wrapper: "entries", name: "paths" },
  serverHeaders: { wrapper: "headers", name: "responseHeaders" },
  onRequest: { wrapper: "onRequest", name: "middleware" },
  onGet: { wrapper: "onGet", name: "GET" },
  onPost: { wrapper: "onPost", name: "POST" },
  onPut: { wrapper: "onPut", name: "PUT" },
  onPatch: { wrapper: "onPatch", name: "PATCH" },
  onDelete: { wrapper: "onDelete", name: "DELETE" },
  onOptions: { wrapper: "onOptions", name: "OPTIONS" },
};
/** Former sibling `*.server.ts` names → the in-file name they meant. */
export const SIBLING: Readonly<Record<string, string>> = {
  load: "serverLoad",
  guard: "serverGuard",
  actions: "serverActions",
  entries: "serverEntries",
  headers: "serverHeaders",
  GET: "onGet",
  POST: "onPost",
  PUT: "onPut",
  PATCH: "onPatch",
  DELETE: "onDelete",
};

export interface MigrateReport {
  /** Changed files (absolute) → new contents. */
  readonly changes: ReadonlyMap<string, string>;
  /** `file: old → new = wrapper(…)` per rewritten export. */
  readonly renamed: readonly string[];
  /** Exports left alone, with the reason. */
  readonly skipped: readonly string[];
}

const SOURCE = /\.(m|c)?[jt]sx?$/;
const SERVER = /\.server\.(m|c)?[jt]s$/;
const IGNORED = /(^|[/\\])(node_modules|dist|\.rivet|\.[^/\\]+)([/\\]|$)/;
const NOT_ROUTE = /\.(test|spec)\.[^/\\]+$|\.d\.ts$/;

async function sources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && SOURCE.test(e.name) && !e.name.endsWith(".d.ts"))
    .map((e) => join(e.parentPath, e.name))
    .filter((file) => !IGNORED.test(relative(dir, file)));
}

/**
 * Compute the migration for route modules under `routesDir` (pages, layouts, plain `.ts` endpoints,
 * sibling `*.server.ts`); references are searched in every source module under `projectDir`. Nothing is
 * written (see `writeMigration`).
 */
export async function migrateServerExports(projectDir: string, routesDir: string): Promise<MigrateReport> {
  const ts = (await import("typescript")).default;
  const files = await sources(resolve(projectDir));
  const texts = new Map<string, string>();
  for (const file of files) texts.set(file, await readFile(file, "utf8"));
  const routesRoot = resolve(projectDir, routesDir) + sep;
  const targets = files.filter((file) => file.startsWith(routesRoot) && !NOT_ROUTE.test(file));
  return migrateTexts(ts, texts, targets, resolve(projectDir));
}

/** Migrate one module's text on its own (no other modules: references elsewhere are not renamed). */
export function migrateSource(ts: typeof TS, text: string, fileName: string): { text: string; renamed: readonly string[]; skipped: readonly string[] } {
  const file = resolve("/", fileName);
  const report = migrateTexts(ts, new Map([[file, text]]), [file], "/");
  return { text: report.changes.get(file) ?? text, renamed: report.renamed, skipped: report.skipped };
}

interface Planned {
  readonly old: string;
  readonly name: string;
  readonly wrapper: string;
}

/** The migration over in-memory `texts` (absolute paths); `targets`: the route modules to rewrite. */
export function migrateTexts(ts: typeof TS, texts: ReadonlyMap<string, string>, targets: readonly string[], root: string): MigrateReport {
  const current = new Map(texts);
  const files = [...texts.keys()];
  const options: TS.CompilerOptions = {
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    allowImportingTsExtensions: true,
    noEmit: true,
  };
  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => files,
    getScriptVersion: () => "1",
    getScriptSnapshot: (file) => {
      const text = texts.get(file) ?? ts.sys.readFile(file);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => root,
    getCompilationSettings: () => options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (file) => texts.has(file) || ts.sys.fileExists(file),
    readFile: (file) => texts.get(file) ?? ts.sys.readFile(file),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  const edits = new Map<string, { start: number; end: number; text: string }[]>();
  const renamed: string[] = [];
  const skipped: string[] = [];
  const planned = new Map<string, Planned[]>();
  const edit = (file: string, start: number, end: number, text: string) => {
    let list = edits.get(file);
    if (!list) edits.set(file, (list = []));
    if (!list.some((e) => e.start === start && e.end === end)) list.push({ start, end, text });
  };
  const display = (file: string) => relative(root, file).split(sep).join("/");
  // Phase 1: renames (project-wide, scope-aware) and the plan per target.
  for (const file of targets) {
    const source = service.getProgram()!.getSourceFile(file);
    if (!source) continue;
    const sibling = SERVER.test(file);
    const locals = topLevelNames(ts, source);
    const plan: Planned[] = [];
    for (const statement of source.statements) {
      const exported = ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const ids: TS.Identifier[] = [];
      if (exported && ts.isFunctionDeclaration(statement) && statement.name && !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword))
        ids.push(statement.name);
      if (exported && ts.isVariableStatement(statement))
        for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name)) ids.push(d.name);
      const specifiers =
        ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause) ? statement.exportClause.elements : [];
      for (const id of ids) {
        const meant = magic(id.text, sibling);
        if (!meant) continue;
        if (ts.isVariableStatement(statement) && statement.declarationList.declarations.length > 1) {
          skipped.push(`${display(file)}: ${id.text} (declared with other variables: give it its own statement)`);
          continue;
        }
        if (ts.isVariableStatement(statement) && !statement.declarationList.declarations[0]!.initializer) {
          skipped.push(`${display(file)}: ${id.text} (no initializer)`);
          continue;
        }
        const { wrapper, name } = WRAPPERS[meant]!;
        const next = name === id.text ? name : free(name, locals);
        if (!next) {
          skipped.push(`${display(file)}: ${id.text} (\`${name}\` already exists)`);
          continue;
        }
        locals.add(next);
        const locations = service.findRenameLocations(file, id.getStart(source), false, false, { providePrefixAndSuffixTextForRename: true }) ?? [];
        for (const location of locations)
          edit(location.fileName, location.textSpan.start, location.textSpan.start + location.textSpan.length, (location.prefixText ?? "") + next + (location.suffixText ?? ""));
        plan.push({ old: id.text, name: next, wrapper });
        renamed.push(`${display(file)}: ${id.text} → ${next} = ${wrapper}(…)`);
      }
      for (const specifier of specifiers) {
        const meant = magic(specifier.name.text, sibling);
        if (!meant) continue;
        if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
          skipped.push(`${display(file)}: ${specifier.name.text} (re-exported: wrap it where it is declared, then re-export it from a *.server.ts module)`);
          continue;
        }
        if (!specifier.propertyName || magic(specifier.propertyName.text, sibling)) {
          skipped.push(`${display(file)}: ${specifier.name.text} (\`export { ${specifier.name.text} }\`: rename the local, then wrap it)`);
          continue;
        }
        const { wrapper, name } = WRAPPERS[meant]!;
        const next = name === specifier.name.text ? name : free(name, locals);
        if (!next) {
          skipped.push(`${display(file)}: ${specifier.name.text} (\`${name}\` already exists)`);
          continue;
        }
        locals.add(next);
        const locations = service.findRenameLocations(file, specifier.name.getStart(source), false, false, { providePrefixAndSuffixTextForRename: true }) ?? [];
        for (const location of locations)
          edit(location.fileName, location.textSpan.start, location.textSpan.start + location.textSpan.length, (location.prefixText ?? "") + next + (location.suffixText ?? ""));
        plan.push({ old: specifier.name.text, name: next, wrapper });
        renamed.push(`${display(file)}: ${specifier.name.text} → ${next} = ${wrapper}(${specifier.propertyName.text})`);
      }
    }
    if (plan.length) planned.set(file, plan);
  }
  for (const [file, list] of edits) current.set(file, applyEdits(current.get(file) ?? "", list));
  // Phase 2 (per target, parser only): wrap the renamed exports, add the wrapper import.
  for (const [file, plan] of planned) current.set(file, wrapExports(ts, current.get(file)!, file, plan));
  const changes = new Map<string, string>();
  for (const [file, text] of current) if (text !== texts.get(file)) changes.set(file, text);
  return { changes, renamed, skipped };
}

/** The in-file name an export name stands for (sibling modules: their former names too). */
function magic(name: string, sibling: boolean): string | undefined {
  if (Object.hasOwn(WRAPPERS, name)) return name;
  return sibling && Object.hasOwn(SIBLING, name) ? SIBLING[name] : undefined;
}

function free(name: string, taken: ReadonlySet<string>): string | undefined {
  for (const candidate of [name, name + "Export"]) if (!taken.has(candidate)) return candidate;
  return undefined;
}

function topLevelNames(ts: typeof TS, source: TS.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) names.add(statement.name.text);
    if (ts.isVariableStatement(statement)) for (const d of statement.declarationList.declarations) collectBindings(ts, d.name, names);
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause))
      for (const specifier of statement.exportClause.elements) names.add(specifier.name.text);
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause;
      if (clause.name) names.add(clause.name.text);
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const s of bindings.elements) names.add(s.name.text);
      if (bindings && ts.isNamespaceImport(bindings)) names.add(bindings.name.text);
    }
    if ((ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)) && ts.isIdentifier(statement.name)) names.add(statement.name.text);
  }
  return names;
}

function collectBindings(ts: typeof TS, name: TS.BindingName, out: Set<string>): void {
  if (ts.isIdentifier(name)) out.add(name.text);
  else for (const element of name.elements) if (!ts.isOmittedExpression(element)) collectBindings(ts, element.name, out);
}

function applyEdits(text: string, list: readonly { start: number; end: number; text: string }[]): string {
  for (const e of [...list].sort((a, b) => b.start - a.start || b.end - a.end)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  return text;
}

/** Whether a function body needs a function expression (`this`, `arguments`, `super`, `new.target`), not an arrow. */
function needsFunction(ts: typeof TS, node: TS.Node): boolean {
  let found = false;
  const visit = (n: TS.Node): void => {
    if (found) return;
    if (n.kind === ts.SyntaxKind.ThisKeyword || n.kind === ts.SyntaxKind.SuperKeyword || ts.isMetaProperty(n) || (ts.isIdentifier(n) && n.text === "arguments")) {
      found = true;
      return;
    }
    // Own `this` / `arguments` of nested functions and classes do not count.
    if (
      ts.isFunctionDeclaration(n) ||
      ts.isFunctionExpression(n) ||
      ts.isClassDeclaration(n) ||
      ts.isClassExpression(n) ||
      ts.isMethodDeclaration(n) ||
      ts.isGetAccessorDeclaration(n) ||
      ts.isSetAccessorDeclaration(n)
    )
      return;
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

function wrapExports(ts: typeof TS, text: string, file: string, plan: readonly Planned[]): string {
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const typed = kind === ts.ScriptKind.TS || kind === ts.ScriptKind.TSX;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const edits: { start: number; end: number; text: string }[] = [];
  const slice = (node: TS.Node) => text.slice(node.getStart(source), node.getEnd());
  const locals = topLevelNames(ts, source);
  // Wrapper local names: an existing value import of `@rivetjs/router` (aliases kept), else added.
  const imported = new Map<string, string>();
  let routerImport: TS.ImportDeclaration | undefined;
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== "@rivetjs/router") continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    routerImport ??= statement;
    for (const s of clause.namedBindings.elements) if (!s.isTypeOnly) imported.set((s.propertyName ?? s.name).text, s.name.text);
  }
  const added: string[] = [];
  const local = (wrapper: string): string => {
    const known = imported.get(wrapper);
    if (known) return known;
    const name = locals.has(wrapper) ? "rivet" + wrapper[0]!.toUpperCase() + wrapper.slice(1) : wrapper;
    imported.set(wrapper, name);
    added.push(name === wrapper ? wrapper : `${wrapper} as ${name}`);
    locals.add(name);
    return name;
  };
  const appended: string[] = [];
  for (const { name, wrapper } of plan) {
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement)) {
        const d = statement.declarationList.declarations[0];
        if (!d || !ts.isIdentifier(d.name) || d.name.text !== name || !d.initializer) continue;
        const call = local(wrapper);
        let init = slice(d.initializer);
        if (d.type && typed) {
          init = `(${init}) satisfies ${slice(d.type)}`;
          edits.push({ start: d.name.getEnd(), end: d.type.getEnd(), text: "" });
        }
        edits.push({ start: d.initializer.getStart(source), end: d.initializer.getEnd(), text: `${call}(${init})` });
        if (!(statement.declarationList.flags & ts.NodeFlags.Const)) {
          const keyword = statement.declarationList.getStart(source);
          const word = /^(let|var)/.exec(text.slice(keyword))![1]!;
          edits.push({ start: keyword, end: keyword + word.length, text: "const" });
        }
      } else if (ts.isFunctionDeclaration(statement) && statement.name?.text === name && statement.body) {
        const call = local(wrapper);
        const isAsync = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
        const params = text.slice(statement.parameters.pos - 1, statement.parameters.end + 1);
        const returns = statement.type ? `: ${slice(statement.type)}` : "";
        const typeParams = statement.typeParameters ? `<${statement.typeParameters.map(slice).join(", ")}>` : "";
        const fn =
          statement.asteriskToken || needsFunction(ts, statement.body) || typeParams
            ? `${isAsync ? "async " : ""}function${statement.asteriskToken ? "*" : ""} ${name}${typeParams}${params}${returns} ${slice(statement.body)}`
            : `${isAsync ? "async " : ""}${params}${returns} => ${slice(statement.body)}`;
        const start = statement.getStart(source);
        edits.push({ start, end: statement.getEnd(), text: `export const ${name} = ${call}(${fn});` });
      } else if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        const elements = statement.exportClause.elements;
        const target = elements.find((s) => s.name.text === name && s.propertyName);
        if (!target) continue;
        const call = local(wrapper);
        const rest = elements.filter((s) => s !== target).map(slice);
        const end = statement.getEnd() + (text[statement.getEnd()] === "\n" ? 1 : 0);
        edits.push({ start: statement.getStart(source), end: rest.length ? statement.getEnd() : end, text: rest.length ? `export { ${rest.join(", ")} };` : "" });
        appended.push(`export const ${name} = ${call}(${target.propertyName!.text});`);
      }
    }
  }
  if (added.length) {
    if (routerImport && ts.isNamedImports(routerImport.importClause!.namedBindings!)) {
      const named = routerImport.importClause!.namedBindings!;
      const last = named.elements[named.elements.length - 1];
      if (last) edits.push({ start: last.getEnd(), end: last.getEnd(), text: `, ${added.join(", ")}` });
      else edits.push({ start: named.getStart(source) + 1, end: named.getStart(source) + 1, text: ` ${added.join(", ")} ` });
    } else {
      const imports = source.statements.filter(ts.isImportDeclaration);
      const line = `import { ${added.join(", ")} } from "@rivetjs/router";`;
      const after = imports[imports.length - 1];
      if (after) {
        // At the end of the last import's line (after a trailing comment, which stays with its import).
        const eol = text.indexOf("\n", after.getEnd());
        const at = eol === -1 ? text.length : eol;
        edits.push({ start: at, end: at, text: "\n" + line });
      }
      else {
        // After a leading comment block / directive prologue: before the first statement.
        const first = source.statements[0];
        const at = first ? first.getStart(source) : text.length;
        edits.push({ start: at, end: at, text: line + "\n" });
      }
    }
  }
  let out = applyEdits(text, edits);
  if (appended.length) out = out.replace(/\s*$/, "\n") + appended.join("\n") + "\n";
  return out;
}

export async function writeMigration(report: MigrateReport): Promise<void> {
  for (const [file, text] of report.changes) await writeFile(file, text);
}
