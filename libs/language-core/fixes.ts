// Quick fixes for compiler diagnostics, computed over the TypeScript AST from the compiler's ranges.
// `ts` is the host's TypeScript module (tsserver passes its own); parser APIs, plus a one-file checker (no lib, no imports)
// where a fix needs binding resolution (`rivetReconstruct`).
import type TS from "typescript";

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
export const FIXABLE_CODES = ["RV1008", "RV1009", "RV1016", "RV1102", "RV2001", "RV2002", "RV2003", "RV2102", "RV3002"] as const;

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
export const newLineOf = (file: TS.SourceFile): string => (/\r\n|\r|\n/.exec(file.text)?.[0] ?? "\n");

/** JavaScript (`.js` / `.jsx` …) files take no type syntax. */
const isJavaScript = (ts: typeof TS, file: TS.SourceFile): boolean =>
  (file as TS.SourceFile & { scriptKind?: TS.ScriptKind }).scriptKind === ts.ScriptKind.JS ||
  (file as TS.SourceFile & { scriptKind?: TS.ScriptKind }).scriptKind === ts.ScriptKind.JSX ||
  /\.[cm]?jsx?$/.test(file.fileName);

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
    return after ? [{ start: after.end, end: after.end, newText: `, ${name}` }] : [{ start: bindings.getStart(file) + 1, end: bindings.getStart(file) + 1, newText: ` ${name} ` }];
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

// SVG element names (SVGElementTagNameMap); `a`, `script`, `style`, `title` are SVG only inside `<svg>`.
const SVG_TAGS = new Set(
  "animate animateMotion animateTransform circle clipPath defs desc ellipse feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence filter foreignObject g image line linearGradient marker mask metadata mpath path pattern polygon polyline radialGradient rect set stop svg switch symbol text textPath tspan use view".split(
    " ",
  ),
);
const SVG_AND_HTML = new Set(["a", "script", "style", "title"]);

/** Element type of a JSX intrinsic tag for a ref declaration. */
function elementType(ts: typeof TS, tag: string, attribute: TS.JsxAttribute): string {
  if (!/^[a-z][\w-]*$/.test(tag) && !SVG_TAGS.has(tag)) return "Element";
  let inSvg = false;
  for (let n: TS.Node | undefined = attribute.parent.parent.parent; n && !inSvg; n = n.parent)
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === "svg") inSvg = true;
  if (SVG_TAGS.has(tag) || (inSvg && SVG_AND_HTML.has(tag))) return `SVGElementTagNameMap[${JSON.stringify(tag)}]`;
  if (inSvg) return "SVGElement";
  return tag.includes("-") ? "HTMLElement" : `HTMLElementTagNameMap[${JSON.stringify(tag)}]`;
}

function uniqueName(file: TS.SourceFile, base: string): string {
  let name = base;
  for (let n = 2; new RegExp(`\\b${name}\\b`).test(file.text); n++) name = base + n;
  return name;
}

function jsxTag(ts: typeof TS, attribute: TS.JsxAttribute): string | undefined {
  const element = attribute.parent.parent;
  return ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element) ? element.tagName.getText() : undefined;
}

/** `</ns.Tag>` matching an opening `<ns.Tag>` tag name. */
function closingTag(ts: typeof TS, tagName: TS.Node): TS.Node | undefined {
  const opening = tagName.parent;
  return ts.isJsxOpeningElement(opening) && opening.tagName === tagName ? opening.parent.closingElement.tagName : undefined;
}

/** The nearest `const name = init` visible from `from` (a statement of an enclosing block or the file). */
function constDeclaration(ts: typeof TS, from: TS.Node, name: string): { declaration: TS.VariableDeclaration; scope: TS.Node } | undefined {
  for (let scope: TS.Node | undefined = from.parent; scope; scope = scope.parent) {
    if (!ts.isBlock(scope) && !ts.isSourceFile(scope) && !ts.isModuleBlock(scope)) continue;
    for (const statement of scope.statements) {
      if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) return { declaration, scope };
    }
  }
  return undefined;
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

/** Edits turning every read of `declaration`'s binding (a value now behind an accessor) into a call `name()`. References are
 * matched by symbol identity, so members, enum members, labels, destructuring keys, JSX attribute names and shadowing
 * bindings with the same name are left alone; `typeof name` in a type becomes `ReturnType<typeof name>` (`typeof name.a.b` →
 * `ReturnType<typeof name>["a"]["b"]`). Undefined (no fix) when a read is an instantiation expression (`name<T>`): an accessor
 * has no such form. */
function accessorReads(ts: typeof TS, file: TS.SourceFile, declaration: TS.VariableDeclaration, name: string): TextEdit[] | undefined {
  const { copy, checker } = fileChecker(ts, file);
  const own = nodeAt(ts, copy, declaration.name.getStart(file), declaration.name.end);
  const target = own && checker.getSymbolAtLocation(own);
  if (!target) return [];
  const edits: TextEdit[] = [];
  let refused = false;
  const visit = (n: TS.Node): void => {
    if (ts.isIdentifier(n) && n.text === name && n !== own) {
      const parent = n.parent;
      // `typeof name` / `typeof name.a.b`: the left end of the type query's entity name.
      let entity: TS.EntityName = n;
      const keys: string[] = [];
      while (ts.isQualifiedName(entity.parent) && entity.parent.left === entity) (entity = entity.parent), keys.push(JSON.stringify(entity.right.text));
      if (ts.isShorthandPropertyAssignment(parent) && parent.name === n) {
        if (checker.getShorthandAssignmentValueSymbol(parent) === target) edits.push({ start: n.end, end: n.end, newText: `: ${name}()` });
      } else if (ts.isTypeQueryNode(entity.parent) && entity.parent.exprName === entity) {
        const query = entity.parent;
        if (checker.getSymbolAtLocation(n) !== target) return;
        if (query.typeArguments) refused = true;
        else edits.push({ start: query.getStart(copy), end: query.end, newText: `ReturnType<typeof ${name}>` + keys.map((k) => `[${k}]`).join("") });
      } else if (ts.isExpressionWithTypeArguments(parent) && parent.expression === n && !ts.isHeritageClause(parent.parent)) {
        if (checker.getSymbolAtLocation(n) === target) refused = true;
      } else if (
        !ts.findAncestor(parent, ts.isTypeNode) &&
        !ts.isImportSpecifier(parent) &&
        !ts.isExportSpecifier(parent) &&
        checker.getSymbolAtLocation(n) === target
      )
        edits.push({ start: n.end, end: n.end, newText: "()" });
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(copy);
  return refused ? undefined : edits;
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

/** Fixes for one compiler diagnostic. */
export function codeFixes(ts: typeof TS, file: TS.SourceFile, diagnostic: { code: string; start: number; end: number; message?: string }): CodeFix[] {
  const node = nodeAt(ts, file, diagnostic.start, diagnostic.end);
  if (!node) return [];
  switch (diagnostic.code) {
    case "RV1102": {
      const attribute = ts.findAncestor(node, ts.isJsxAttribute);
      const value = attribute?.initializer;
      if (!value || !ts.isStringLiteral(value)) return [];
      const [best] = preloadSuggestions(value.text);
      return [{ fixName: "rivetPreload", description: `Change preload to "${best}"`, edits: [{ start: value.getStart(file), end: value.end, newText: JSON.stringify(best) }] }];
    }
    case "RV1008":
    case "RV1009": {
      const element = ts.findAncestor(node, ts.isJsxElement);
      if (!element) return [];
      const opening = element.openingElement;
      const selfClosed = file.text.slice(opening.getStart(file), opening.end - 1).trimEnd() + " />";
      const description = diagnostic.code === "RV1008" ? "Self-close the void element (drop its children)" : "Remove the textarea children (model supplies the value)";
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
    case "RV2002": {
      const attribute = ts.findAncestor(node, ts.isJsxAttribute);
      const tag = attribute && jsxTag(ts, attribute);
      const statement = attribute && bodyStatement(ts, attribute);
      if (!attribute?.initializer || !tag || !statement) return [];
      const name = uniqueName(file, tag.replace(/[^\w$]/g, "") + "Ref");
      const type = elementType(ts, tag, attribute);
      const js = isJavaScript(ts, file);
      const nl = newLineOf(file);
      const at = statement.getStart(file);
      return [
        {
          fixName: "rivetRefObject",
          description: `Use an element ref: const ${name} = ref${js ? "" : "<…>"}(); ref={${name}}`,
          edits: [
            ...addNamedImport(ts, file, "@rivetjs/runtime/dom", "ref"),
            { start: at, end: at, newText: `const ${name} = ref${js ? "" : `<${type}>`}();${nl}${indentOf(file, at)}` },
            { start: attribute.initializer.getStart(file), end: attribute.initializer.end, newText: `{${name}}` },
          ],
        },
        {
          fixName: "rivetRefLocal",
          description: `Bind the element to a local: ref={(el) => (${name} = el)}`,
          edits: [
            { start: at, end: at, newText: `let ${name}${js ? "" : `!: ${type}`};${nl}${indentOf(file, at)}` },
            { start: attribute.initializer.getStart(file), end: attribute.initializer.end, newText: `{(el) => (${name} = el)}` },
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
          ts.isImportDeclaration(s) && !!s.importClause?.namedBindings && ts.isNamespaceImport(s.importClause.namedBindings) && s.importClause.namedBindings.name.text === namespace,
      );
      if (!source || !ts.isStringLiteral(source.moduleSpecifier)) return [];
      return [
        {
          fixName: "rivetNamedImport",
          description: `Import ${helper} as a named binding from ${source.moduleSpecifier.text}`,
          edits: [...addNamedImport(ts, file, source.moduleSpecifier.text, helper), ...[member, closingTag(ts, member)].flatMap((n) => (n ? [{ start: n.getStart(file), end: n.end, newText: helper }] : []))],
        },
      ];
    }
    case "RV2003":
    case "RV2102": {
      // Function Bridge T28: build the captured value in the browser — `const x = reconstruct(() => init)`; reads become `x()`.
      // The diagnostic names the capture (`m`, `conn.live`): its base binding is the declaration to wrap. Only component
      // modules (`.tsx` / `.jsx`) may import `@rivetjs/runtime/dom` (a `.ts` module is not server-rewritten): no fix elsewhere.
      if (!/\.[jt]sx$/.test(file.fileName)) return [];
      const captured = /`([^`.[\s]+)/.exec(diagnostic.message ?? "")?.[1];
      const found = captured && constDeclaration(ts, node, captured);
      if (!found) return [];
      const { declaration } = found;
      const init = declaration.initializer!;
      let text = file.text.slice(init.getStart(file), init.end);
      if (ts.isObjectLiteralExpression(init)) text = `(${text})`;
      const type = declaration.type ? `<${file.text.slice(declaration.type.getStart(file), declaration.type.end)}>` : "";
      const local = importedAs(ts, file, ["@rivetjs/runtime/dom", "@rivetjs/runtime/server"], "reconstruct");
      const reads = accessorReads(ts, file, declaration, captured);
      if (!reads) return [];
      return [
        {
          fixName: "rivetReconstruct",
          description: `Build it in the browser: reconstruct(() => …)`,
          edits: [
            ...(local ? [] : addNamedImport(ts, file, "@rivetjs/runtime/dom", "reconstruct")),
            ...(declaration.type ? [{ start: declaration.name.end, end: declaration.type.end, newText: "" }] : []),
            { start: init.getStart(file), end: init.end, newText: `${local ?? "reconstruct"}${type}(() => ${text})` },
            ...reads,
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
