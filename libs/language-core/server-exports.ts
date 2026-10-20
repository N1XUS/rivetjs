// RV3010 in route modules: an export named like a former magic server export (`serverLoad`, `onGet`, …) that is not a
// `@rivetjs/router` wrapper call. Parser-only, the compiler's rule (`server_split.rs` `untagged`); the build reports it
// through the compiler's `serverExports` pass, the editor from here (it compiles without that pass). Spec:
// docs/design/specs/2026-10-20-server-exports-design.md.
import { isAbsolute, join, relative } from "node:path";
import type TS from "typescript";
import type { CheckDiagnostic } from "./compiler.ts";

export const ROUTER = "@rivetjs/router";

/** Former magic export name → its wrapper, the docs' default export name and the argument shape shown in messages. */
export const MAGIC_SERVER_EXPORTS: Readonly<Record<string, { readonly wrapper: string; readonly name: string; readonly argument: string }>> = {
  serverLoad: { wrapper: "load", name: "loader", argument: "(event) => …" },
  serverGuard: { wrapper: "guard", name: "access", argument: "(event) => …" },
  serverActions: { wrapper: "actions", name: "forms", argument: "{ name: (event) => … }" },
  serverEntries: { wrapper: "entries", name: "paths", argument: "() => […]" },
  serverHeaders: { wrapper: "headers", name: "responseHeaders", argument: "(event) => ({ … })" },
  onRequest: { wrapper: "onRequest", name: "middleware", argument: "(event) => …" },
  onGet: { wrapper: "onGet", name: "GET", argument: "(event) => …" },
  onPost: { wrapper: "onPost", name: "POST", argument: "(event) => …" },
  onPut: { wrapper: "onPut", name: "PUT", argument: "(event) => …" },
  onPatch: { wrapper: "onPatch", name: "PATCH", argument: "(event) => …" },
  onDelete: { wrapper: "onDelete", name: "DELETE", argument: "(event) => …" },
  onOptions: { wrapper: "onOptions", name: "OPTIONS", argument: "(event) => …" },
};

/** The compiler's RV3010 message. */
export function untaggedMessage(name: string): string | undefined {
  const magic = MAGIC_SERVER_EXPORTS[name];
  if (!magic) return undefined;
  return `Untagged server export \`${name}\`: route server code is a wrapper call — \`export const ${magic.name} = ${magic.wrapper}(${magic.argument})\` with \`import { ${magic.wrapper} } from "${ROUTER}"\``;
}

/** Route module of the app: a source file under the manifest's routes dir. */
export function isRouteModule(root: string, routesDir: string | undefined, fileName: string): boolean {
  if (!routesDir || !/\.[cm]?[jt]sx?$/.test(fileName) || /\.d\.[cm]?ts$/.test(fileName)) return false;
  const path = relative(join(root, routesDir), fileName);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}

/** Local names of the `@rivetjs/router` wrappers (named imports, aliases) and its namespace imports. */
function wrapperBindings(ts: typeof TS, file: TS.SourceFile): { named: Set<string>; namespaces: Set<string> } {
  const named = new Set<string>();
  const namespaces = new Set<string>();
  const wrappers = new Set(Object.values(MAGIC_SERVER_EXPORTS).map((m) => m.wrapper));
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== ROUTER) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly || !clause.namedBindings) continue;
    if (ts.isNamespaceImport(clause.namedBindings)) namespaces.add(clause.namedBindings.name.text);
    else
      for (const element of clause.namedBindings.elements)
        if (!element.isTypeOnly && wrappers.has((element.propertyName ?? element.name).text)) named.add(element.name.text);
  }
  return { named, namespaces };
}

/** `init` is a direct call of a router wrapper (parentheses allowed). */
function isWrapperCall(ts: typeof TS, init: TS.Expression | undefined, bindings: ReturnType<typeof wrapperBindings>): boolean {
  while (init && ts.isParenthesizedExpression(init)) init = init.expression;
  if (!init || !ts.isCallExpression(init)) return false;
  const callee = init.expression;
  if (ts.isIdentifier(callee)) return bindings.named.has(callee.text);
  return ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && bindings.namespaces.has(callee.expression.text);
}

const exported = (ts: typeof TS, node: TS.Node): boolean =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** RV3010 per untagged export with a former magic name (declarations and `export { x as onGet }`). */
export function untaggedServerExports(ts: typeof TS, file: TS.SourceFile): CheckDiagnostic[] {
  if (!/\b(server(Load|Guard|Actions|Entries|Headers)|on(Request|Get|Post|Put|Patch|Delete|Options))\b/.test(file.text)) return [];
  const bindings = wrapperBindings(ts, file);
  const out: CheckDiagnostic[] = [];
  const report = (name: TS.Identifier | TS.ModuleExportName) => {
    const message = untaggedMessage(name.text);
    if (!message) return;
    const start = name.getStart(file);
    const { line, character } = file.getLineAndCharacterOfPosition(start);
    out.push({ code: "RV3010", severity: "error", message, filename: file.fileName, start, end: name.end, line: line + 1, column: character + 1, targets: [] });
  };
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement) && exported(ts, statement)) {
      const isConst = Boolean(statement.declarationList.flags & ts.NodeFlags.Const);
      for (const d of statement.declarationList.declarations)
        if (ts.isIdentifier(d.name) && !(isConst && isWrapperCall(ts, d.initializer, bindings))) report(d.name);
    } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name && exported(ts, statement)) report(statement.name);
    else if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    )
      for (const element of statement.exportClause.elements) {
        if (element.isTypeOnly || !MAGIC_SERVER_EXPORTS[element.name.text]) continue;
        // `export { x as onGet }` is fine when `x` is a wrapper-initialized const (a server binding).
        const local = (element.propertyName ?? element.name).text;
        const declared = file.statements.some(
          (s) =>
            ts.isVariableStatement(s) &&
            s.declarationList.flags & ts.NodeFlags.Const &&
            s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === local && isWrapperCall(ts, d.initializer, bindings)),
        );
        if (!declared) report(element.name);
      }
  }
  return out;
}
