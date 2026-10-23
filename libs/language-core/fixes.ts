// Quick fixes for compiler diagnostics, computed over the TypeScript AST from the compiler's ranges.
// `ts` is the host's TypeScript module (tsserver passes its own); parser APIs, plus a one-file checker (no lib, no imports)
// where a fix needs binding resolution (`rivetWrapServerExport`).
import type TS from "typescript";
import { MAGIC_SERVER_EXPORTS, ROUTER } from "./server-exports.ts";

export interface TextEdit {
  start: number;
  end: number;
  newText: string;
}

export interface CodeFix {
  fixName: string;
  description: string;
  edits: TextEdit[];
}

/** Codes with fixes below. */
export const FIXABLE_CODES = ["RV1008", "RV1009", "RV1016", "RV1102", "RV2001", "RV3002", "RV3010"] as const;

const PRELOAD = ["eager", "idle", "visible", "intent", "interaction"] as const;

/** Levenshtein distance (short strings). */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

/** Valid `preload` strategies, nearest to `value` first. */
export function preloadSuggestions(value: string): string[] {
  const lower = value.toLowerCase();
  return [...PRELOAD].sort((a, b) => {
    const prefix = Number(!a.startsWith(lower.slice(0, 2))) - Number(!b.startsWith(lower.slice(0, 2)));
    return prefix || distance(lower, a) - distance(lower, b);
  });
}

/** Innermost node containing [start, end). */
export function nodeAt(ts: typeof TS, file: TS.SourceFile, start: number, end: number): TS.Node | undefined {
  let best: TS.Node | undefined;
  const visit = (node: TS.Node): void => {
    if (node.getStart(file) > start || node.end < end) return;
    best = node;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(file, visit);
  return best;
}

/** The file's line break (its first one; `\n` when it has none): edits never mix line endings. */
export const newLineOf = (file: TS.SourceFile): string => /\r\n|\r|\n/.exec(file.text)?.[0] ?? "\n";

/** Edit adding `name` to a named import from `module` (or a new import line). Empty when present. */
export function addNamedImport(ts: typeof TS, file: TS.SourceFile, module: string, name: string): TextEdit[] {
  const nl = newLineOf(file);
  let last: TS.ImportDeclaration | undefined;
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    last = statement;
    const clause = statement.importClause;
    if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== module || !clause || clause.isTypeOnly) continue;
    const bindings = clause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    if (bindings.elements.some((element) => !element.isTypeOnly && element.name.text === name)) return [];
    const after = bindings.elements[bindings.elements.length - 1];
    return after
      ? [{ start: after.end, end: after.end, newText: `, ${name}` }]
      : [{ start: bindings.getStart(file) + 1, end: bindings.getStart(file) + 1, newText: ` ${name} ` }];
  }
  const text = `import { ${name} } from ${JSON.stringify(module)};`;
  return last ? [{ start: last.end, end: last.end, newText: nl + text }] : [{ start: 0, end: 0, newText: text + nl }];
}

/** Statement directly inside a function body block that contains `node`. */
function bodyStatement(ts: typeof TS, node: TS.Node): TS.Statement | undefined {
  for (let n: TS.Node | undefined = node; n?.parent; n = n.parent)
    if (ts.isBlock(n.parent) && n.parent.parent && ts.isFunctionLike(n.parent.parent)) return n as TS.Statement;
  return undefined;
}

const indentOf = (file: TS.SourceFile, position: number): string => {
  const lineStart = Math.max(file.text.lastIndexOf("\n", position - 1), file.text.lastIndexOf("\r", position - 1)) + 1;
  return /^[ \t]*/.exec(file.text.slice(lineStart))![0];
};

/** `text` one level (two spaces) deeper: every line after the first (the caller places the first). */
const indentMore = (text: string, nl: string): string =>
  text
    .split(/\r\n|\r|\n/)
    .map((line, i) => (i && line ? "  " + line : line))
    .join(nl);

function uniqueName(file: TS.SourceFile, base: string): string {
  let name = base;
  for (let n = 2; new RegExp(`\\b${name}\\b`).test(file.text); n++) name = base + n;
  return name;
}

/** `</ns.Tag>` matching an opening `<ns.Tag>` tag name. */
function closingTag(ts: typeof TS, tagName: TS.Node): TS.Node | undefined {
  const opening = tagName.parent;
  return ts.isJsxOpeningElement(opening) && opening.tagName === tagName ? opening.parent.closingElement.tagName : undefined;
}

/** A checker over a fresh parse of this one file alone (no lib, no imports): it binds the file's scopes, so a reference
 * resolves to the symbol of the declaration it reads. Built only when a fix needs binding resolution. */
function fileChecker(ts: typeof TS, file: TS.SourceFile): { copy: TS.SourceFile; checker: TS.TypeChecker } {
  const kind = (file as TS.SourceFile & { scriptKind?: TS.ScriptKind }).scriptKind;
  const copy = ts.createSourceFile(file.fileName, file.text, ts.ScriptTarget.Latest, true, kind);
  const host: TS.CompilerHost = {
    getSourceFile: (name) => (name === copy.fileName ? copy : undefined),
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => {},
    getCurrentDirectory: () => "/",
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => newLineOf(file),
    fileExists: (name) => name === copy.fileName,
    readFile: (name) => (name === copy.fileName ? copy.text : undefined),
  };
  const options: TS.CompilerOptions = { noLib: true, noResolve: true, allowJs: true, jsx: ts.JsxEmit.Preserve, types: [], noEmit: true };
  return { copy, checker: ts.createProgram({ rootNames: [copy.fileName], options, host }).getTypeChecker() };
}

/** The local name of `name` when a value import of it from one of `modules` is already in the file. */
function importedAs(ts: typeof TS, file: TS.SourceFile, modules: readonly string[], name: string): string | undefined {
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !modules.includes(statement.moduleSpecifier.text)) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    for (const element of clause.namedBindings.elements)
      if (!element.isTypeOnly && (element.propertyName ?? element.name).text === name) return element.name.text;
  }
  return undefined;
}

/** `body` reads `this` / `arguments` / `super` of its own function (an arrow would change them). */
function usesFunctionScope(ts: typeof TS, body: TS.Node): boolean {
  let found = false;
  const visit = (n: TS.Node): void => {
    if (found) return;
    if (n.kind === ts.SyntaxKind.ThisKeyword || n.kind === ts.SyntaxKind.SuperKeyword || (ts.isIdentifier(n) && n.text === "arguments")) found = true;
    else if (!(ts.isFunctionLike(n) && !ts.isArrowFunction(n)) && !ts.isClassLike(n)) ts.forEachChild(n, visit);
  };
  ts.forEachChild(body, visit);
  return found;
}

/** Module-scope binding names (declarations, destructured names, imports). */
function moduleNames(ts: typeof TS, file: TS.SourceFile): Set<string> {
  const names = new Set<string>();
  const bind = (name: TS.BindingName): void => {
    if (ts.isIdentifier(name)) names.add(name.text);
    else for (const element of name.elements) if (!ts.isOmittedExpression(element)) bind(element.name);
  };
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) for (const d of statement.declarationList.declarations) bind(d.name);
    else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name)
      names.add(statement.name.text);
    else if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause;
      if (clause.name) names.add(clause.name.text);
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) names.add(clause.namedBindings.name.text);
      else if (clause.namedBindings) for (const element of clause.namedBindings.elements) names.add(element.name.text);
    }
  }
  return names;
}

/** RV3010 `rivetWrapServerExport`: `export const onGet = (e) => …` → `export const GET = onGet((e) => …)`; an exported
 * function declaration becomes an arrow (a function expression when it uses `this` / `arguments` / `super`, is a generator
 * or has type parameters); `let` → `const`; a `: T` annotation → `satisfies T`. In-file references follow the new name
 * (symbol identity through the one-file checker); the wrapper is imported from `@rivetjs/router` unless already imported. */
function wrapServerExport(ts: typeof TS, file: TS.SourceFile, node: TS.Node): CodeFix[] {
  if (!ts.isIdentifier(node)) return [];
  const old = node.text;
  const magic = MAGIC_SERVER_EXPORTS[old];
  if (!magic) return [];
  const statement = ts.findAncestor(node, (n) => n.parent === file) as TS.Statement | undefined;
  if (!statement) return [];
  const local = importedAs(ts, file, [ROUTER], magic.wrapper);
  const names = moduleNames(ts, file);
  // The export itself goes (renamed): `onGet` may then be the wrapper import.
  const declared = (name: string) => name !== old && names.has(name);
  // A local named like the wrapper (not the router's import): no fix (the rename would be a guess).
  if (!local && declared(magic.wrapper)) return [];
  const call = local ?? magic.wrapper;
  const next = !declared(magic.name) ? magic.name : !declared(magic.name + "Export") ? magic.name + "Export" : undefined;
  if (!next) return [];
  const edits: TextEdit[] = [];
  const text = file.text;
  if (ts.isVariableStatement(statement)) {
    const [d, ...rest] = statement.declarationList.declarations;
    if (!d || rest.length || d.name !== node || !d.initializer) return [];
    const init = d.initializer;
    const type = d.type ? text.slice(d.type.getStart(file), d.type.end) : undefined;
    edits.push({ start: statement.getStart(file), end: init.getStart(file), newText: `export const ${next} = ${call}(${type ? "(" : ""}` });
    edits.push({ start: init.end, end: init.end, newText: type ? `) satisfies ${type})` : ")" });
  } else if (ts.isFunctionDeclaration(statement) && statement.name === node && statement.body) {
    const async = (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
    const open = statement.parameters.pos - 1;
    if (statement.asteriskToken || statement.typeParameters || usesFunctionScope(ts, statement.body)) {
      const from = statement.typeParameters ? statement.typeParameters.pos - 1 : open;
      edits.push({
        start: statement.getStart(file),
        end: from,
        newText: `export const ${next} = ${call}(${async ? "async " : ""}function${statement.asteriskToken ? "*" : ""} ${next}`,
      });
    } else {
      edits.push({ start: statement.getStart(file), end: open, newText: `export const ${next} = ${call}(${async ? "async " : ""}` });
      const head = statement.type ? statement.type.end : statement.parameters.end + 1;
      edits.push({ start: head, end: statement.body.getStart(file), newText: " => " });
    }
    edits.push({ start: statement.body.end, end: statement.body.end, newText: ");" });
  } else return [];
  // References: by symbol, not by name (shadowing locals keep theirs).
  const { copy, checker } = fileChecker(ts, file);
  const own = nodeAt(ts, copy, node.getStart(file), node.end);
  const target = own && checker.getSymbolAtLocation(own);
  if (target) {
    const visit = (n: TS.Node): void => {
      if (ts.isIdentifier(n) && n.text === old && n !== own) {
        if (ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n) {
          if (checker.getShorthandAssignmentValueSymbol(n.parent) === target) edits.push({ start: n.getStart(copy), end: n.end, newText: `${old}: ${next}` });
        } else if (checker.getSymbolAtLocation(n) === target) edits.push({ start: n.getStart(copy), end: n.end, newText: next });
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(copy);
  }
  if (!local) edits.push(...addNamedImport(ts, file, ROUTER, magic.wrapper));
  return [{ fixName: "rivetWrapServerExport", description: `Wrap in \`${magic.wrapper}(…)\`: export const ${next} = ${magic.wrapper}(…)`, edits }];
}

/** Fixes for one compiler diagnostic. */
export function codeFixes(ts: typeof TS, file: TS.SourceFile, diagnostic: { code: string; start: number; end: number; message?: string }): CodeFix[] {
  const node = nodeAt(ts, file, diagnostic.start, diagnostic.end);
  if (!node) return [];
  switch (diagnostic.code) {
    case "RV3010":
      return wrapServerExport(ts, file, node);
    case "RV1102": {
      const attribute = ts.findAncestor(node, ts.isJsxAttribute);
      const value = attribute?.initializer;
      if (!value || !ts.isStringLiteral(value)) return [];
      const [best] = preloadSuggestions(value.text);
      return [
        {
          fixName: "rivetPreload",
          description: `Change preload to "${best}"`,
          edits: [{ start: value.getStart(file), end: value.end, newText: JSON.stringify(best) }],
        },
      ];
    }
    case "RV1008":
    case "RV1009": {
      const element = ts.findAncestor(node, ts.isJsxElement);
      if (!element) return [];
      const opening = element.openingElement;
      const selfClosed = file.text.slice(opening.getStart(file), opening.end - 1).trimEnd() + " />";
      const description =
        diagnostic.code === "RV1008" ? "Self-close the void element (drop its children)" : "Remove the textarea children (model supplies the value)";
      return [{ fixName: "rivetSelfClose", description, edits: [{ start: element.getStart(file), end: element.end, newText: selfClosed }] }];
    }
    case "RV2001": {
      const statement = bodyStatement(ts, node);
      if (!statement || ts.isVariableStatement(statement) || ts.isReturnStatement(statement) || ts.isFunctionDeclaration(statement)) return [];
      const indent = indentOf(file, statement.getStart(file));
      const nl = newLineOf(file);
      const body = indentMore(file.text.slice(statement.getStart(file), statement.end), nl);
      return [
        {
          fixName: "rivetClientEffect",
          description: "Run it in the browser: wrap in clientEffect(() => { … })",
          edits: [
            ...addNamedImport(ts, file, "@rivetjs/runtime/dom", "clientEffect"),
            { start: statement.getStart(file), end: statement.end, newText: `clientEffect(() => {${nl}${indent}  ${body}${nl}${indent}});` },
          ],
        },
      ];
    }
    case "RV3002": {
      const member = ts.findAncestor(node, ts.isPropertyAccessExpression);
      if (!member || !ts.isIdentifier(member.expression)) return [];
      const namespace = member.expression.text,
        helper = member.name.text;
      const source = file.statements.find(
        (s): s is TS.ImportDeclaration =>
          ts.isImportDeclaration(s) &&
          !!s.importClause?.namedBindings &&
          ts.isNamespaceImport(s.importClause.namedBindings) &&
          s.importClause.namedBindings.name.text === namespace,
      );
      if (!source || !ts.isStringLiteral(source.moduleSpecifier)) return [];
      return [
        {
          fixName: "rivetNamedImport",
          description: `Import ${helper} as a named binding from ${source.moduleSpecifier.text}`,
          edits: [
            ...addNamedImport(ts, file, source.moduleSpecifier.text, helper),
            ...[member, closingTag(ts, member)].flatMap((n) => (n ? [{ start: n.getStart(file), end: n.end, newText: helper }] : [])),
          ],
        },
      ];
    }
    case "RV1016": {
      // Bind-once handler that reads state: re-select it per event, keeping "no handler" (`?.`).
      const attribute = ts.findAncestor(node, ts.isJsxAttribute);
      const value = attribute?.initializer;
      if (!value || !ts.isJsxExpression(value) || !value.expression) return [];
      let expression = value.expression;
      while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
      const text = file.text.slice(expression.getStart(file), expression.end);
      const parameter = ["event", "e", "ev"].find((name) => !new RegExp(`(^|[^\\w$])${name}([^\\w$]|$)`).test(text)) ?? uniqueName(file, "event");
      return [
        {
          fixName: "rivetHandlerArrow",
          description: "Wrap handler in arrow function",
          edits: [{ start: value.expression.getStart(file), end: value.expression.end, newText: `(${parameter}) => (${text})?.(${parameter})` }],
        },
      ];
    }
  }
  return [];
}

/** Apply non-overlapping edits (tests, CLI `--fix`). */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start || b.end - a.end)) out = out.slice(0, edit.start) + edit.newText + out.slice(edit.end);
  return out;
}
