// CTX-SOUND (2026-10-27): where a component call runs, for the call-site context proof (`facts-callsite.ts`).
//
// The proof reads what may be provided above a call from the component tags enclosing it in the caller's JSX
// (`calls[].around`, Rust `enclosing`: lexical). That holds for JSX the caller evaluates in place — its body, its JSX,
// a function child / render prop written in a component element's JSX (the element is in `around`), `.map` callbacks.
// JSX inside a nested function runs where that function is called: a function bound to a variable and called or passed
// in a provider's JSX (`const row = () => <X />; <P>{row()}</P>`, `<P>{row}</P>`, `<P render={row} />`), a local
// component (`const Inner = () => <X />; <P><Inner /></P>`), a callback handed to arbitrary code. Such a call
// `escapes`: the proof counts TOP above it. JSX outside every module-level component (a top-level helper `function
// rows() { return <X />; }`, a factory the facts do not count as a component, module scope) is no call site at all:
// its callee is `hidden` (an instance the proof cannot see; TOP above it, never `free`).
//
// Eager JSX (`const t = <X />` in the body, `.map` in the body) is created where it is written, under the caller's own
// owner, before any provider it is later inserted into runs: its lexical `around` is right (server and browser agree).
import { parseSync } from "vite";
import type { ModuleFacts } from "./index.ts";

type Node = { type: string; start: number; end: number; [key: string]: unknown };

const WRAPS = new Set([
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "ConditionalExpression",
  "LogicalExpression",
  "SequenceExpression",
  "ArrayExpression",
]);
const FUNCTIONS = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);
// Reactivity calls whose callback runs in place (now, or later under an owner created here): argument index.
const IN_PLACE: Record<string, number> = { provide: 2, untrack: 0, batch: 0, catchError: 0, computed: 0, effect: 0 };
// Array methods that call their callback before they return (in place). `Array.from(items, callback)` too.
const EAGER = new Set(["map", "flatMap", "forEach", "filter", "reduce", "reduceRight", "find", "findLast", "findIndex", "some", "every", "sort", "toSorted"]);

/** Census (`RIVET_CALLSITE_TRACE`): components whose parsed calls did not match the facts (all their calls escape). */
export const placementMismatches: string[] = [];

/**
 * Mark `facts`' component calls that may run under a provider their lexical position does not show (`escapes`) and
 * record the component tags written outside every component (`hidden`). Returns `facts`. Unparsable source: every call
 * escapes and nothing is known about hidden calls (`hidden: ["*"]`).
 */
export function placeCalls(source: string, filename: string, facts: ModuleFacts): ModuleFacts {
  if (!facts.boundaries.size && !/<[A-Z]|<[\w$]+\./.test(source)) return facts;
  let program: Node;
  try {
    const parsed = parseSync(filename, source, {
      lang: /\.jsx$/.test(filename) ? "jsx" : /\.tsx$/.test(filename) ? "tsx" : /\.ts$/.test(filename) ? "ts" : "js",
    });
    if (parsed.errors.length) throw new Error("parse");
    program = parsed.program as unknown as Node;
  } catch {
    for (const c of facts.boundaries.values()) for (const call of c.calls) call.escapes = true;
    facts.hidden = ["*"];
    return facts;
  }
  // Local names of the reactivity calls that run a callback in place.
  const inPlace = new Map<string, number>();
  for (const statement of program.body as Node[]) {
    if (statement.type !== "ImportDeclaration") continue;
    const from = (statement.source as { value: string }).value;
    if (from !== "@rivetjs/reactivity") continue;
    for (const specifier of statement.specifiers as Node[]) {
      if (specifier.type !== "ImportSpecifier") continue;
      const imported = specifier.imported as { name?: string; value?: string };
      const index = IN_PLACE[(imported.name ?? imported.value)!];
      if (index !== undefined) inPlace.set((specifier.local as { name: string }).name, index);
    }
  }
  const components = new Map<string, Node>();
  for (const [name, fn] of moduleComponents(program)) if (facts.boundaries.has(name) && !components.has(name)) components.set(name, fn);
  const inComponent = new Set<Node>(components.values());
  const hidden = new Set<string>();
  // Calls per component function, source order (the facts' order: a pre-order walk of the function).
  const found = new Map<Node, { tag: string; escapes: boolean }[]>();
  const stack: Node[] = [];
  let owner: Node | null = null;
  let ownerDepth = -1;
  const visit = (node: Node): void => {
    const enter = owner === null && inComponent.has(node);
    if (enter) ((owner = node), (ownerDepth = stack.length), found.set(node, []));
    if (node.type === "JSXElement") {
      const tag = componentTag(source, (node.openingElement as Node).name as Node);
      if (tag !== null) {
        if (owner === null) hidden.add(tag);
        else found.get(owner)!.push({ tag, escapes: escapes(stack, ownerDepth, inPlace) });
      }
    }
    stack.push(node);
    for (const key in node) {
      if (key === "type" || key === "start" || key === "end") continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) if (item && typeof item === "object" && typeof (item as Node).type === "string") visit(item as Node);
      } else if (value && typeof value === "object" && typeof (value as Node).type === "string") visit(value as Node);
    }
    stack.pop();
    if (enter) ((owner = null), (ownerDepth = -1));
  };
  visit(program);
  for (const [name, c] of facts.boundaries) {
    const fn = components.get(name);
    const list = fn ? found.get(fn) : undefined;
    // The parse must see the facts' calls (count and tags, source order); otherwise nothing is known: all escape.
    if (!list || list.length !== c.calls.length || list.some((call, i) => call.tag !== c.calls[i]!.tag)) {
      placementMismatches.push(filename + "?" + name);
      for (const call of c.calls) call.escapes = true;
      continue;
    }
    list.forEach((call, i) => {
      if (call.escapes) c.calls[i]!.escapes = true;
    });
  }
  if (hidden.size) facts.hidden = [...hidden];
  return facts;
}

/** Module-level components as the facts count them (Rust `module_components`): name → function node. */
function moduleComponents(program: Node): [string, Node][] {
  const out: [string, Node][] = [];
  const pascal = (name: string) => /^[A-Z]/.test(name);
  const fnDecl = (f: Node, fallback: string | null) => {
    const id = (f.id as { name: string } | null | undefined)?.name;
    if (id !== undefined && pascal(id)) out.push([id, f]);
    else if (id === undefined && fallback !== null) out.push([fallback, f]);
  };
  const declarators = (v: Node) => {
    for (const d of v.declarations as Node[]) {
      const id = d.id as Node;
      if (id.type !== "Identifier" || !pascal(id.name as string) || !d.init) continue;
      const init = unwrap(d.init as Node);
      if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") out.push([id.name as string, init]);
    }
  };
  for (const statement of program.body as Node[]) {
    if (statement.type === "FunctionDeclaration") fnDecl(statement, null);
    else if (statement.type === "VariableDeclaration") declarators(statement);
    else if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
      const d = statement.declaration as Node;
      if (d.type === "FunctionDeclaration") fnDecl(d, null);
      else if (d.type === "VariableDeclaration") declarators(d);
    } else if (statement.type === "ExportDefaultDeclaration") {
      const d = statement.declaration as Node;
      if (d.type === "FunctionDeclaration" || d.type === "FunctionExpression") fnDecl(d, "default");
      else if (d.type === "ArrowFunctionExpression") out.push(["default", d]);
    }
  }
  return out;
}

const unwrap = (node: Node): Node => {
  let n = node;
  while (
    n.type === "ParenthesizedExpression" ||
    n.type === "TSAsExpression" ||
    n.type === "TSSatisfiesExpression" ||
    n.type === "TSNonNullExpression" ||
    n.type === "TSTypeAssertion"
  )
    n = n.expression as Node;
  return n;
};

/** A component element's tag as written (`Tag`, `ns.Tag`, Rust `component_tag`), null for a native element. */
function componentTag(source: string, name: Node): string | null {
  if (name.type === "JSXIdentifier") return /^[A-Z]/.test(name.name as string) ? (name.name as string) : null;
  if (name.type === "JSXMemberExpression") return source.slice(name.start, name.end);
  return null;
}

const isComponentElement = (opening: Node | undefined): boolean => {
  if (!opening || opening.type !== "JSXOpeningElement") return false;
  const name = opening.name as Node;
  return name.type === "JSXMemberExpression" || (name.type === "JSXIdentifier" && /^[A-Z]/.test(name.name as string));
};

/**
 * Does the element (ancestors `stack`, the component function at `from`) sit in a nested function whose call site the
 * lexical `around` may not show? Every function between the component and the element must be placed in place: a JSX
 * child (function child), an attribute value of a component element (its render prop: the component is in `around`),
 * the callback of an eager array method or of a reactivity call that runs it in place (`provide`, `untrack`, `batch`,
 * `catchError`, `computed`, `effect`: now, or under an owner created here), an IIFE callee, or the value a placed
 * function returns.
 */
function escapes(stack: readonly Node[], from: number, inPlace: ReadonlyMap<string, number>): boolean {
  for (let i = from + 1; i < stack.length; i++) {
    const fn = stack[i]!;
    if (!FUNCTIONS.has(fn.type)) continue;
    if (!placed(stack, i, inPlace)) return true;
  }
  return false;
}

function placed(stack: readonly Node[], at: number, inPlace: ReadonlyMap<string, number>): boolean {
  let child = stack[at]!;
  for (let i = at - 1; i >= 0; i--) {
    const node = stack[i]!;
    if (WRAPS.has(node.type)) {
      if (node.type === "ConditionalExpression" && node.test === child) return false;
      if (node.type === "SequenceExpression" && (node.expressions as Node[]).at(-1) !== child) return false;
      child = node;
      continue;
    }
    switch (node.type) {
      case "JSXExpressionContainer": {
        const parent = stack[i - 1];
        if (!parent) return false;
        if (parent.type === "JSXElement" || parent.type === "JSXFragment") return true;
        // An attribute value: of a component element (it is in `around`), not of a native one (a handler, a ref).
        if (parent.type === "JSXAttribute") return isComponentElement(stack[i - 2]);
        return false;
      }
      case "CallExpression": {
        if (node.callee === child) return true; // IIFE
        const args = node.arguments as Node[];
        const callee = unwrap(node.callee as Node);
        if (callee.type === "Identifier") return inPlace.get(callee.name as string) === args.indexOf(child) && args.indexOf(child) >= 0;
        if (callee.type !== "MemberExpression" || callee.computed) return false;
        const method = (callee.property as Node).name as string;
        if (EAGER.has(method) && args[0] === child) return true;
        const object = callee.object as Node;
        return method === "from" && object.type === "Identifier" && object.name === "Array" && args[1] === child;
      }
      case "ArrowFunctionExpression":
        // The expression body of a function: returned by it (that function's own placement is checked too).
        return node.body === child;
      case "ReturnStatement":
        return true;
      default:
        return false;
    }
  }
  return false;
}
