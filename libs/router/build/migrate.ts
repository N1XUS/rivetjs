// `rivet migrate server-exports`: rename the old sibling `*.server.ts` export names (`load`, `guard`,
// `actions`, `entries`, `headers`, `GET`…) to the in-file names (`serverLoad`…, `onGet`…). Renames are
// scope-aware (TypeScript language service): references in other modules (`typeof import(…).load`)
// follow; unrelated locals of the same name do not.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

export const RENAMES: Readonly<Record<string, string>> = {
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
  /** `file: old → new` per renamed export. */
  readonly renamed: readonly string[];
  /** Exports left alone, with the reason. */
  readonly skipped: readonly string[];
}

const SOURCE = /\.(m|c)?[jt]sx?$/;
const SERVER = /\.server\.(m|c)?[jt]s$/;
const IGNORED = /(^|[/\\])(node_modules|dist|\.rivet|\.[^/\\]+)([/\\]|$)/;

async function sources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && SOURCE.test(e.name) && !e.name.endsWith(".d.ts"))
    .map((e) => join(e.parentPath, e.name))
    .filter((file) => !IGNORED.test(relative(dir, file)));
}

/**
 * Compute the migration for `*.server.ts` modules under `routesDir`; references are searched in every
 * source module under `projectDir`. Nothing is written (see `writeMigration`).
 */
export async function migrateServerExports(projectDir: string, routesDir: string): Promise<MigrateReport> {
  const ts = (await import("typescript")).default;
  const files = await sources(resolve(projectDir));
  const texts = new Map<string, string>();
  for (const file of files) texts.set(file, await readFile(file, "utf8"));
  const routesRoot = resolve(projectDir, routesDir) + sep;
  const targets = files.filter((file) => file.startsWith(routesRoot) && SERVER.test(file));
  const options: import("typescript").CompilerOptions = {
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    allowImportingTsExtensions: true,
    noEmit: true,
  };
  const host: import("typescript").LanguageServiceHost = {
    getScriptFileNames: () => files,
    getScriptVersion: () => "1",
    getScriptSnapshot: (file) => {
      const text = texts.get(file) ?? ts.sys.readFile(file);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => resolve(projectDir),
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
  const edit = (file: string, start: number, end: number, text: string) => {
    let list = edits.get(file);
    if (!list) edits.set(file, (list = []));
    if (!list.some((e) => e.start === start)) list.push({ start, end, text });
  };
  for (const file of targets) {
    const program = service.getProgram()!;
    const source = program.getSourceFile(file)!;
    const name = relative(projectDir, file).split(sep).join("/");
    // Top-level names (declared or exported) decide collisions.
    const locals = new Set<string>();
    const exported: { old: string; node: import("typescript").Node; specifier?: import("typescript").ExportSpecifier }[] = [];
    for (const statement of source.statements) {
      const isExport = ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const names: import("typescript").Identifier[] = [];
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) names.push(statement.name);
      if (ts.isVariableStatement(statement))
        for (const d of statement.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name);
      for (const id of names) {
        locals.add(id.text);
        if (isExport && id.text in RENAMES) exported.push({ old: id.text, node: id });
      }
      if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause))
        for (const specifier of statement.exportClause.elements) {
          locals.add(specifier.name.text);
          if (specifier.name.text in RENAMES) exported.push({ old: specifier.name.text, node: specifier.name, specifier });
        }
      if (ts.isImportDeclaration(statement) && statement.importClause) {
        const clause = statement.importClause;
        if (clause.name) locals.add(clause.name.text);
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) for (const s of bindings.elements) locals.add(s.name.text);
        if (bindings && ts.isNamespaceImport(bindings)) locals.add(bindings.name.text);
      }
    }
    for (const { old, node, specifier } of exported) {
      const next = RENAMES[old]!;
      if (locals.has(next)) {
        skipped.push(`${name}: ${old} (\`${next}\` already exists)`);
        continue;
      }
      if (specifier && specifier.propertyName) {
        // `export { x as load }`: only the exported name changes.
        edit(file, specifier.name.getStart(source), specifier.name.getEnd(), next);
      } else {
        const locations = service.findRenameLocations(file, node.getStart(source), false, false, { providePrefixAndSuffixTextForRename: true }) ?? [];
        for (const location of locations)
          edit(location.fileName, location.textSpan.start, location.textSpan.start + location.textSpan.length, (location.prefixText ?? "") + next + (location.suffixText ?? ""));
      }
      renamed.push(`${name}: ${old} → ${next}`);
    }
  }
  const changes = new Map<string, string>();
  for (const [file, list] of edits) {
    let text = texts.get(file) ?? (await readFile(file, "utf8"));
    for (const e of list.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
    changes.set(file, text);
  }
  return { changes, renamed, skipped };
}

export async function writeMigration(report: MigrateReport): Promise<void> {
  for (const [file, text] of report.changes) await writeFile(file, text);
}
