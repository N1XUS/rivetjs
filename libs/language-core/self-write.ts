// RV1017 (language service, warning): a signal written with a value read from itself inside a provably tracked scope —
// `x.set(x() + 1)` in the function of an `effect` / `clientEffect` / `computed` (directly or through `batch(() => …)`).
// The read subscribes the scope to its own write: an effect re-runs until the 10000-run cutoff, a computed throws on the
// write. `x.update((v) => …)` reads untracked. Silent everywhere a scope is not provably tracked: event handlers, `on*`
// props, callbacks, `untrack` bodies, component bodies (`_c` calls them untracked), JSX, async functions; there plain
// `x.set(x() + 1)` is the faster form (no closure, no observer swap). Type-aware: the receiver's type is the
// `@rivetjs/reactivity` `Signal` (stores have another API).
import type TS from "typescript";
import type { CheckDiagnostic } from "./compiler.ts";
import type { CodeFix } from "./fixes.ts";

export const SELF_WRITE_CODE = "RV1017";

type Role = "effect" | "computed" | "batch";

/** Tracked-scope helpers per module (export name → role). */
const ROLES: Readonly<Record<string, Readonly<Record<string, Role>>>> = {
  "@rivetjs/reactivity": { effect: "effect", computed: "computed", batch: "batch" },
  "@rivetjs/runtime/dom": { clientEffect: "effect" },
};

/** The emitted message. */
export function selfWriteMessage(name: string, scope: "effect" | "computed"): string {
  return scope === "effect"
    ? `\`${name}\` is read and written in an effect: the read subscribes the effect to its own write, so it re-runs until the 10000-run cutoff. Use \`${name}.update((v) => …)\`: it reads without subscribing`
    : `\`${name}\` is read and written in a computed: the read subscribes the computed to its own write, and signal writes throw during computed evaluation. Derive the value instead, or write it from an effect or handler with \`${name}.update((v) => …)\``;
}

interface Bindings {
  named: Map<string, Role>;
  namespaces: Map<string, Readonly<Record<string, Role>>>;
}

function bindingsOf(ts: typeof TS, file: TS.SourceFile): Bindings {
  const named = new Map<string, Role>();
  const namespaces = new Map<string, Readonly<Record<string, Role>>>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const roles = ROLES[statement.moduleSpecifier.text];
    const clause = statement.importClause;
    if (!roles || !clause || clause.isTypeOnly || !clause.namedBindings) continue;
    if (ts.isNamespaceImport(clause.namedBindings)) namespaces.set(clause.namedBindings.name.text, roles);
    else
      for (const element of clause.namedBindings.elements) {
        const role = !element.isTypeOnly && roles[(element.propertyName ?? element.name).text];
        if (role) named.set(element.name.text, role);
      }
  }
  return { named, namespaces };
}

/** Role of a call's callee (`effect(…)`, `r.effect(…)`); local shadowing of an imported name stays unknown → no role. */
function roleOf(ts: typeof TS, call: TS.CallExpression, bindings: Bindings, checker: TS.TypeChecker | undefined): Role | undefined {
  const callee = call.expression;
  let role: Role | undefined;
  if (ts.isIdentifier(callee)) role = bindings.named.get(callee.text);
  else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && ts.isIdentifier(callee.name))
    role = bindings.namespaces.get(callee.expression.text)?.[callee.name.text];
  if (!role || !checker) return role;
  // The name must still be the import (not a shadowing local).
  const head = ts.isIdentifier(callee) ? callee : (callee as TS.PropertyAccessExpression).expression;
  const symbol = checker.getSymbolAtLocation(head);
  return symbol?.declarations?.some((d) => ts.isImportSpecifier(d) || ts.isNamespaceImport(d)) ? role : undefined;
}

/** The synchronous, non-async inline function of a call's first argument. */
function inlineFunction(ts: typeof TS, call: TS.CallExpression): TS.ArrowFunction | TS.FunctionExpression | undefined {
  let fn: TS.Expression | undefined = call.arguments[0];
  while (fn && ts.isParenthesizedExpression(fn)) fn = fn.expression;
  if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) || fn.asteriskToken) return undefined;
  if ((ts.getModifiers(fn) ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) return undefined;
  return fn;
}

/** `a`, `this.a`, `a.b.c` (no calls, no optional chaining): the reference text, or undefined. */
function referenceText(ts: typeof TS, node: TS.Expression, file: TS.SourceFile): string | undefined {
  if (ts.isIdentifier(node)) return node.text;
  if (node.kind === ts.SyntaxKind.ThisKeyword) return "this";
  if (ts.isPropertyAccessExpression(node) && !node.questionDotToken && ts.isIdentifier(node.name)) {
    const base = referenceText(ts, node.expression, file);
    return base === undefined ? undefined : `${base}.${node.name.text}`;
  }
  return undefined;
}

const isFunction = (ts: typeof TS, node: TS.Node): boolean => ts.isFunctionLike(node) || ts.isClassLike(node);
const isJsx = (ts: typeof TS, node: TS.Node): boolean => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);

/** Direct reads `ref()` inside `node` (nested functions and JSX are not entered: they need not run in this scope). */
export function selfReads(ts: typeof TS, file: TS.SourceFile, node: TS.Node, ref: string): TS.CallExpression[] {
  const out: TS.CallExpression[] = [];
  const visit = (n: TS.Node): void => {
    if (isFunction(ts, n) || isJsx(ts, n)) return;
    if (ts.isCallExpression(n) && !n.questionDotToken && n.arguments.length === 0 && referenceText(ts, n.expression, file) === ref) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/** `ref.set(arg)` with a direct read of `ref` in `arg`: [receiver, ref text, arg]. */
function selfSet(ts: typeof TS, file: TS.SourceFile, node: TS.Node): { receiver: TS.Expression; ref: string; arg: TS.Expression } | undefined {
  if (!ts.isCallExpression(node) || node.questionDotToken || node.arguments.length !== 1) return undefined;
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee) || callee.questionDotToken || !ts.isIdentifier(callee.name) || callee.name.text !== "set") return undefined;
  const ref = referenceText(ts, callee.expression, file);
  const arg = node.arguments[0]!;
  if (ref === undefined || ts.isSpreadElement(arg) || !selfReads(ts, file, arg, ref).length) return undefined;
  return { receiver: callee.expression, ref, arg };
}

/** The value is a `@rivetjs/reactivity` `Signal` (by type; unknown / any / union → false). */
function isSignal(ts: typeof TS, checker: TS.TypeChecker, node: TS.Expression): boolean {
  const type = checker.getTypeAtLocation(node);
  const symbol = type.aliasSymbol ?? type.getSymbol();
  if (!symbol || symbol.getName() !== "Signal") return false;
  return (symbol.declarations ?? []).some((d) => {
    const path = d.getSourceFile().fileName.replace(/\\/g, "/");
    return /\/(libs\/reactivity|@rivetjs\/reactivity)\/index\.(d\.)?[cm]?ts$/.test(path) && ts.isInterfaceDeclaration(d);
  });
}

/** RV1017 per self-write in a tracked scope. `checker` = the program's (types decide what a signal is). */
export function selfWrites(ts: typeof TS, file: TS.SourceFile, checker: TS.TypeChecker): CheckDiagnostic[] {
  if (!/\.set\s*\(/.test(file.text) || !/\b(effect|computed|clientEffect)\b/.test(file.text)) return [];
  const bindings = bindingsOf(ts, file);
  if (!bindings.named.size && !bindings.namespaces.size) return [];
  const out: CheckDiagnostic[] = [];
  const seen = new Set<number>();
  const scan = (node: TS.Node, scope: "effect" | "computed"): void => {
    if (isFunction(ts, node) || isJsx(ts, node)) return;
    if (ts.isCallExpression(node)) {
      // `batch(() => …)` runs its function synchronously under the same observer.
      if (roleOf(ts, node, bindings, checker) === "batch") {
        const fn = inlineFunction(ts, node);
        if (fn) scan(fn.body, scope);
      }
      const write = selfSet(ts, file, node);
      if (write && !seen.has(node.getStart(file)) && isSignal(ts, checker, write.receiver)) {
        seen.add(node.getStart(file));
        const start = node.getStart(file);
        const { line, character } = file.getLineAndCharacterOfPosition(start);
        out.push({
          code: SELF_WRITE_CODE,
          severity: "warning",
          message: selfWriteMessage(write.ref, scope),
          filename: file.fileName,
          start,
          end: node.end,
          line: line + 1,
          column: character + 1,
          targets: [],
        });
      }
    }
    ts.forEachChild(node, (child) => scan(child, scope));
  };
  const visit = (node: TS.Node): void => {
    if (ts.isCallExpression(node)) {
      const role = roleOf(ts, node, bindings, checker);
      if (role === "effect" || role === "computed") {
        const fn = inlineFunction(ts, node);
        if (fn) scan(fn.body, role);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out.sort((a, b) => a.start - b.start);
}

/** Tracked scope of `node` (syntactic: the nearest enclosing function, through `batch` functions), if any. */
function scopeOf(ts: typeof TS, file: TS.SourceFile, node: TS.Node): Role | undefined {
  const bindings = bindingsOf(ts, file);
  for (let n: TS.Node | undefined = node.parent; n; n = n.parent) {
    if (isJsx(ts, n)) return undefined;
    if (!isFunction(ts, n)) continue;
    const call = n.parent;
    if (!call || !ts.isCallExpression(call) || inlineFunction(ts, call) !== n) return undefined;
    const role = roleOf(ts, call, bindings, undefined);
    if (role !== "batch") return role;
  }
  return undefined;
}

/** RV1017 quick fix `rivetSignalUpdate`: `x.set(<expr>)` → `x.update((v) => <expr with each direct x() as v>)`. Effects only
 * (in a computed every write throws: no mechanical fix). */
export function selfWriteFix(ts: typeof TS, file: TS.SourceFile, node: TS.Node): CodeFix[] {
  const call = ts.findAncestor(node, (n) => ts.isCallExpression(n) && !!selfSet(ts, file, n)) as TS.CallExpression | undefined;
  if (!call || scopeOf(ts, file, call) !== "effect") return [];
  const { receiver, ref, arg } = selfSet(ts, file, call)!;
  const text = file.text;
  const argText = text.slice(arg.getStart(file), arg.end);
  const used = (name: string) => new RegExp(`(^|[^\\w$])${name.replace("$", "\\$")}([^\\w$]|$)`).test(argText);
  let parameter = ["v", "value", "previous", "current"].find((name) => !used(name));
  for (let n = 2; !parameter; n++) if (!used("v" + n)) parameter = "v" + n;
  const base = arg.getStart(file);
  let body = argText;
  for (const read of selfReads(ts, file, arg, ref).sort((a, b) => b.getStart(file) - a.getStart(file)))
    body = body.slice(0, read.getStart(file) - base) + parameter + body.slice(read.end - base);
  if (ts.isObjectLiteralExpression(arg)) body = `(${body})`;
  const target = text.slice(receiver.getStart(file), receiver.end);
  return [
    {
      fixName: "rivetSignalUpdate",
      description: `Read untracked: ${target}.update((${parameter}) => …)`,
      edits: [{ start: call.getStart(file), end: call.end, newText: `${target}.update((${parameter}) => ${body})` }],
    },
  ];
}
