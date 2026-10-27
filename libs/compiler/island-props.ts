// Live island props on the server (lane BRIDGE-FIX E1): the server target passes component props by value
// (`Live({ "value": v() })`: nothing re-renders on the server), so a framework island (`@rivetjs/bridge` facade) whose
// only Rivet-needing prop reads a signal looked like plain JSON to `@rivetjs/bridge` `leanValues` and booted lean — it
// never followed the signal in the browser. This pass turns such an island call's props into getters
// (`get "value"() { return v(); }`), exactly the entries the DOM target makes live (`dom_v2.rs` `live_props`: the value
// can read reactive state, it is not already lazy, a getter body is safe), so `leanValues` sees the signal read and the
// island hydrates from its boundary's adopt run (live props kept). Server output of island facade calls only: other
// component calls keep plain values (SSR hot path). Not in the Rust compiler: it does not know which imports are islands.
import { parseAst } from "vite";

type Node = { type: string; start: number; end: number; [key: string]: unknown };

/** Island-level props read once by the bridge (`server.tsx` `OWN`), plus slots: never getters. */
const OWN = new Set(["client", "preload", "persist", "fallback", "children"]);

/** Can evaluating `e` read reactive state? (`dom_v2.rs` `dynamic`, over ESTree.) */
function dynamic(e: Node | null | undefined): boolean {
  if (!e) return false;
  switch (e.type) {
    case "CallExpression":
    case "NewExpression":
    case "MemberExpression":
    case "TaggedTemplateExpression":
    case "AwaitExpression":
    case "YieldExpression":
    case "ChainExpression":
    case "ImportExpression":
    case "Super":
      return true;
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "ClassExpression":
    case "Literal":
    case "Identifier":
    case "ThisExpression":
    case "MetaProperty":
      return false;
    case "TemplateLiteral":
      return (e.expressions as Node[]).some(dynamic);
    case "ParenthesizedExpression":
    case "UnaryExpression":
    case "SpreadElement":
      return dynamic((e.expression ?? e.argument) as Node);
    case "BinaryExpression":
    case "LogicalExpression":
      return dynamic(e.left as Node) || dynamic(e.right as Node);
    case "ConditionalExpression":
      return dynamic(e.test as Node) || dynamic(e.consequent as Node) || dynamic(e.alternate as Node);
    case "SequenceExpression":
      return (e.expressions as Node[]).some(dynamic);
    case "ArrayExpression":
      return (e.elements as (Node | null)[]).some(dynamic);
    case "ObjectExpression":
      return (e.properties as Node[]).some((p) =>
        p.type === "SpreadElement" ? dynamic(p.argument as Node) : (p.computed && dynamic(p.key as Node)) || dynamic(p.value as Node),
      );
    default:
      return true;
  }
}

/** A getter body must not read `this` / `arguments` / `new.target` or hold `await` / `yield` (`getter_safe`). */
function getterSafe(e: Node): boolean {
  let safe = true;
  const visit = (n: unknown): void => {
    if (!safe || n === null || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(visit);
    const node = n as Node;
    if (typeof node.type === "string") {
      if (
        node.type === "ThisExpression" ||
        node.type === "Super" ||
        node.type === "MetaProperty" ||
        node.type === "AwaitExpression" ||
        node.type === "YieldExpression" ||
        (node.type === "Identifier" && node.name === "arguments")
      )
        return void (safe = false);
    }
    for (const key in node) if (key !== "type" && key !== "start" && key !== "end") visit(node[key]);
  };
  visit(e);
  return safe;
}

/**
 * @internal Server output of a Rivet module: the props of its island facade calls (`Island({ … })`, `NS.Island({ … })`)
 * with the entries that can read reactive state as getters. `islandSource(specifier)` answers whether an import
 * specifier resolves to an island facade; it is asked only for specifiers whose bindings are called with an object
 * literal. Returns null when nothing changed (no island call, nothing live).
 */
export async function islandGetters(code: string, islandSource: (specifier: string) => Promise<boolean>): Promise<string | null> {
  if (!code.includes("({")) return null;
  let program: { body: Node[] };
  try {
    program = parseAst(code, { lang: "js" }) as unknown as { body: Node[] };
  } catch {
    return null;
  }
  // Imported bindings: local name → specifier (namespace imports flagged).
  const imported = new Map<string, { spec: string; namespace: boolean }>();
  for (const node of program.body) {
    if (node.type !== "ImportDeclaration" || (node.importKind as string | undefined) === "type") continue;
    const spec = (node.source as { value: string }).value;
    if (spec.startsWith("@rivetjs/")) continue;
    for (const s of node.specifiers as Node[]) imported.set((s.local as { name: string }).name, { spec, namespace: s.type === "ImportNamespaceSpecifier" });
  }
  if (!imported.size) return null;
  // Island call candidates: callee bound to an import, one object literal argument (or `_rS({ … })`, a proven call site).
  const calls: { spec: string; props: Node }[] = [];
  const visit = (n: unknown): void => {
    if (n === null || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(visit);
    const node = n as Node;
    if (node.type === "CallExpression") {
      const callee = node.callee as Node;
      const binding =
        callee.type === "Identifier"
          ? imported.get(callee.name as string)
          : callee.type === "MemberExpression" && !callee.computed && (callee.object as Node).type === "Identifier"
            ? imported.get((callee.object as Node).name as string)
            : undefined;
      const args = node.arguments as Node[];
      if (binding && (callee.type === "Identifier" ? !binding.namespace : binding.namespace) && args.length === 1) {
        let arg = args[0]!;
        if (arg.type === "CallExpression" && (arg.arguments as Node[]).length === 1) arg = (arg.arguments as Node[])[0]!;
        if (arg.type === "ObjectExpression") calls.push({ spec: binding.spec, props: arg });
      }
    }
    for (const key in node) if (key !== "type" && key !== "start" && key !== "end") visit(node[key]);
  };
  visit(program.body);
  if (!calls.length) return null;
  const answers = new Map<string, Promise<boolean>>();
  const edits: { start: number; end: number; text: string }[] = [];
  for (const { spec, props } of calls) {
    const live = (props.properties as Node[]).filter((p) => {
      if (p.type !== "Property" || p.kind !== "init" || p.computed || p.method || p.shorthand) return false;
      const key = p.key as Node;
      const name = key.type === "Identifier" ? (key.name as string) : key.type === "Literal" ? String(key.value) : null;
      if (name === null || OWN.has(name)) return false;
      const value = p.value as Node;
      // Rivet content (compiled JSX, `_slot` thunks: the compiler's `__rivet*` helpers) stays a value: a slot.
      return dynamic(value) && getterSafe(value) && !code.slice(value.start, value.end).includes("__rivet");
    });
    if (!live.length) continue;
    let answer = answers.get(spec);
    if (!answer) answers.set(spec, (answer = islandSource(spec)));
    if (!(await answer)) continue;
    for (const p of live) {
      const key = p.key as Node,
        value = p.value as Node;
      // Insertions around the value (never a copy of it): a nested island call inside the value gets its own edits.
      edits.push({ start: p.start, end: value.start, text: "get " + code.slice(key.start, key.end) + "() { return " });
      edits.push({ start: value.end, end: value.end, text: "; }" });
    }
  }
  if (!edits.length) return null;
  edits.sort((a, b) => b.start - a.start);
  let out = code;
  for (const edit of edits) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}
