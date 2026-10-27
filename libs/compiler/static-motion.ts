// MOTION-CSS (user ruling 2026-10-27: "0 JS for a CSS entrance"): a `<Motion.<tag>>` call site that only renders a final
// state and a CSS entrance becomes the plain `<tag>` the component would render, and its entrance rule joins the module's
// CSS (a virtual stylesheet the module imports: the route's stylesheet in the head, also for client renders). So no
// Motion code sits in the unit of the boundary around it (a resumed page adopting that boundary ran the Motion element
// inline: element.tsx + tags + kit transition, ~33 KB raw before input), and the page needs neither a head sink nor
// `@rivetjs/motion/entrance.css` for the entrance to play.
//
// A call site is rewritten when (both checked by the Vite plugin's derived walk, `vite.ts`, builds only):
// - `motionSites` here: `Motion` imported from `@rivetjs/motion` (not shadowed), the element `<Motion.<tag>>` (or
//   `<Motion.<tag> />`), no spread, `initial` / `animate` / `transition` / `reducedMotion` compile-time constants (object
//   / array / string / number / boolean literals, `Infinity`), no other Motion prop (gestures, `whileInView`, `exit`,
//   layout, variants, `custom`, `inherit`, `style`, `ref`, the composed pointer / key / focus handlers, `children`
//   attribute) — every other attribute and the children are kept as written; `@rivetjs/motion/static` (the package's own
//   lowering, the same code as the element) returns its static form;
// - the call-site proof (`BoundaryFacts.aboveCall`, facts-callsite.ts): nothing above the call may provide a context the
//   Motion element reads — `MotionConfig` / a variant parent (motion `element.tsx`), a kit transition scope (`Presence`,
//   kit `Transition`, cdk overlays: kit `transition.tsx`), or code the proof cannot see (TOP, an unwalked package).
// Every compile of a rewritten module (both targets, the second walk round) sees the same text, so symbol ids agree.
import { parseSync } from "vite";

type Node = { type: string; start: number; end: number; [key: string]: unknown };

/** `@rivetjs/motion/static`'s `staticMotion` result. */
export type StaticMotion = { style: Record<string, string>; mve?: string; css?: string } | string;
export type MotionLowering = (props: Record<string, unknown>) => StaticMotion;

const MOTION = "@rivetjs/motion";
/** Props the static form evaluates. */
const LOWERED = new Set(["initial", "animate", "transition", "reducedMotion"]);
/** Motion props that keep the component (behaviour, live state, contexts it provides) — `element.tsx` `OWN`. */
const KEEP = new Set([
  "variants",
  "custom",
  "inherit",
  "children",
  "onAnimationStart",
  "onAnimationComplete",
  "style",
  "ref",
  "whileHover",
  "whilePress",
  "whileFocus",
  "whileInView",
  "viewport",
  "exit",
  "layout",
  "layoutId",
  "onHoverStart",
  "onHoverEnd",
  "onPressStart",
  "onPressEnd",
  "onPress",
  "onPointerEnter",
  "onPointerLeave",
  "onPointerDown",
  "onPointerUp",
  "onKeyDown",
  "onKeyUp",
  "onFocusIn",
  "onFocusOut",
]);
const TAG = /^[a-z][a-z0-9]*$/;

/** One `<Motion.<tag>>` element of a module. */
export interface MotionElementSite {
  /** The top-level component whose JSX holds it (`ModuleFacts.boundaries` key), null outside one. */
  component: string | null;
  /** The JSX tag as written (`Motion.h1`; `ComponentBoundaryFacts.calls[].tag`). */
  tag: string;
  /** Its index among the elements with this tag in `component`, source order (= among its calls with that tag). */
  ordinal: number;
  /** Component tags enclosing it in the component's JSX, innermost first (`calls[].around`: checks the match). */
  around: string[];
  /** The rewrite (null: the component stays — dynamic props, other Motion props, no static form). */
  rewrite: { edits: [start: number, end: number, text: string][]; css?: { hash: string; css: string } } | null;
}

/** Every `<Motion.<tag>>` element of the module with its static rewrite where it has one (empty: none / unparsable). */
export function motionSites(source: string, filename: string, lower: MotionLowering): MotionElementSite[] {
  if (!source.includes(MOTION)) return [];
  let program: Node;
  try {
    const parsed = parseSync(filename, source, { lang: /\.jsx$/.test(filename) ? "jsx" : "tsx" });
    if (parsed.errors.length) return [];
    program = parsed.program as unknown as Node;
  } catch {
    return [];
  }
  const locals = new Set<string>();
  for (const statement of program.body as Node[]) {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type" || (statement.source as { value: string }).value !== MOTION) continue;
    for (const specifier of statement.specifiers as Node[]) {
      if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
      const imported = specifier.imported as { name?: string; value?: string };
      if ((imported.name ?? imported.value) === "Motion") locals.add((specifier.local as { name: string }).name);
    }
  }
  if (!locals.size) return [];
  // A local binding reusing the name could shadow the import somewhere: leave the module alone.
  let shadowed = false;
  walk(program, (node) => {
    if (node.type === "Identifier" && locals.has(node.name as string) && declares(node)) shadowed = true;
  });
  if (shadowed) return [];
  const out: MotionElementSite[] = [];
  const ordinals = new Map<string, number>();
  for (const statement of program.body as Node[]) {
    const owner = componentOf(statement);
    const component = owner?.name ?? null;
    walk(statement, (node) => {
      if (node.type !== "JSXElement") return;
      const open = node.openingElement as Node;
      const name = open.name as Node;
      if (name.type !== "JSXMemberExpression") return;
      const object = name.object as Node;
      const property = name.property as Node;
      if (object.type !== "JSXIdentifier" || !locals.has(object.name as string) || property.type !== "JSXIdentifier") return;
      const tag = (object.name as string) + "." + (property.name as string);
      const key = (component ?? "") + "\0" + tag;
      const ordinal = ordinals.get(key) ?? 0;
      ordinals.set(key, ordinal + 1);
      const around: string[] = [];
      for (let i = parents.length - 1; i >= 0; i--) {
        const p = parents[i]!;
        if (p.type !== "JSXElement") continue;
        const n = jsxName((p.openingElement as Node).name as Node);
        if (n !== null && (n.includes(".") || /^[A-Z]/.test(n))) around.push(n);
      }
      const placed = !!owner && inPlace([...parents, node], owner.fn);
      out.push({ component, tag, ordinal, around, rewrite: placed && TAG.test(property.name as string) ? rewrite(node, source, lower) : null });
    });
  }
  return out;
}

/** The source with the given element rewrites applied (non-overlapping edits) and their stylesheets imported. */
export function applyMotion(source: string, sites: readonly MotionElementSite[], importOf: (hash: string) => string): string {
  const edits = sites.flatMap((site) => site.rewrite?.edits ?? []).sort((a, b) => a[0] - b[0]);
  if (!edits.length) return source;
  let out = "",
    at = 0;
  for (const [start, end, text] of edits) {
    if (start < at) return source; // overlapping (cannot happen: opening / closing tags only)
    out += source.slice(at, start) + text;
    at = end;
  }
  out += source.slice(at);
  // Appended (imports hoist): later lines and source map lines stay put.
  const hashes = [...new Set(sites.flatMap((site) => (site.rewrite?.css ? [site.rewrite.css.hash] : [])))];
  for (const hash of hashes) out += `\nimport ${JSON.stringify(importOf(hash))};`;
  return out;
}

function rewrite(element: Node, source: string, lower: MotionLowering): MotionElementSite["rewrite"] {
  const open = element.openingElement as Node;
  const close = element.closingElement as Node | null;
  const props: Record<string, unknown> = {};
  const kept: string[] = [];
  for (const attribute of open.attributes as Node[]) {
    if (attribute.type !== "JSXAttribute") return null; // spread: unknown props
    const nameNode = attribute.name as Node;
    const name = nameNode.type === "JSXIdentifier" ? (nameNode.name as string) : null;
    if (name !== null && KEEP.has(name)) return null;
    if (name !== null && LOWERED.has(name)) {
      if (name in props) return null;
      const value = attribute.value as Node | null;
      if (!value) return null;
      const v = value.type === "JSXExpressionContainer" ? constant(value.expression as Node) : value.type === "Literal" ? (value.value as unknown) : NOT;
      if (v === NOT) return null;
      props[name] = v;
    } else kept.push(source.slice(attribute.start, attribute.end));
  }
  const lowered = lower(props);
  if (typeof lowered === "string") return null;
  const tag = ((open.name as Node).property as Node).name as string;
  const attrs = [...kept];
  if (Object.keys(lowered.style).length) attrs.push(`style={${JSON.stringify(lowered.style)}}`);
  if (lowered.mve) attrs.push(`data-mve=${JSON.stringify(lowered.mve)}`);
  // Same line count as the opening tag it replaces.
  const lines = "\n".repeat((source.slice(open.start, open.end).match(/\n/g) ?? []).length);
  const opening = "<" + tag + (attrs.length ? " " + attrs.join(" ") : "") + lines + (open.selfClosing ? " />" : ">");
  const edits: [number, number, string][] = [[open.start, open.end, opening]];
  if (close) edits.push([close.start, close.end, "</" + tag + ">"]);
  return { edits, ...(lowered.mve && lowered.css ? { css: { hash: lowered.mve, css: lowered.css } } : {}) };
}

/** A JSX element name as written (`Tag`, `ns.Tag`), null for namespaced names. */
function jsxName(node: Node): string | null {
  if (node.type === "JSXIdentifier") return node.name as string;
  if (node.type === "JSXMemberExpression") {
    const head = jsxName(node.object as Node);
    return head === null ? null : head + "." + ((node.property as Node).name as string);
  }
  return null;
}

const NOT = Symbol("not constant");
/** A compile-time constant expression (JSON-like literals, `-n`, `Infinity`, `x as const`), else NOT. */
function constant(node: Node): unknown {
  switch (node.type) {
    case "Literal": {
      const v = node.value;
      return typeof v === "string" || typeof v === "boolean" || v === null || (typeof v === "number" && Number.isFinite(v)) ? v : NOT;
    }
    case "Identifier":
      return node.name === "Infinity" ? Infinity : NOT;
    case "UnaryExpression": {
      if (node.operator !== "-") return NOT;
      const v = constant(node.argument as Node);
      return typeof v === "number" ? -v : NOT;
    }
    case "TemplateLiteral":
      return (node.expressions as Node[]).length ? NOT : ((node.quasis as Node[])[0]!.value as { cooked: string }).cooked;
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
      return constant(node.expression as Node);
    case "ArrayExpression": {
      const out: unknown[] = [];
      for (const item of node.elements as (Node | null)[]) {
        if (!item || item.type === "SpreadElement") return NOT;
        const v = constant(item);
        if (v === NOT) return NOT;
        out.push(v);
      }
      return out;
    }
    case "ObjectExpression": {
      const out: Record<string, unknown> = {};
      for (const property of node.properties as Node[]) {
        if (property.type !== "Property" || property.kind !== "init" || property.computed || property.method || property.shorthand) return NOT;
        const key = property.key as Node;
        const name = key.type === "Identifier" ? (key.name as string) : key.type === "Literal" && typeof key.value === "string" ? key.value : null;
        if (name === null || name === "__proto__") return NOT;
        const v = constant(property.value as Node);
        if (v === NOT) return NOT;
        out[name] = v;
      }
      return out;
    }
    default:
      return NOT;
  }
}

/** The component a top-level statement declares (`ModuleFacts.boundaries` key + its function), or null. */
function componentOf(statement: Node): { name: string; fn: Node } | null {
  let node = statement;
  const isFn = (n: Node | null | undefined): n is Node =>
    !!n && (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression");
  if (node.type === "ExportNamedDeclaration") {
    if (!node.declaration) return null;
    node = node.declaration as Node;
  } else if (node.type === "ExportDefaultDeclaration") {
    const declaration = node.declaration as Node;
    if (!isFn(declaration)) return null;
    return { name: (declaration.id as { name: string } | null | undefined)?.name ?? "default", fn: declaration };
  }
  if (node.type === "FunctionDeclaration") {
    const name = (node.id as { name: string } | null)?.name;
    return name ? { name, fn: node } : null;
  }
  if (node.type === "VariableDeclaration") {
    const list = node.declarations as Node[];
    if (list.length !== 1) return null;
    const id = list[0]!.id as Node;
    const init = list[0]!.init as Node | null;
    return id.type === "Identifier" && isFn(init) ? { name: id.name as string, fn: init } : null;
  }
  return null;
}

const JSX = new Set(["JSXElement", "JSXFragment"]);
const WRAPS = new Set([
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "ConditionalExpression",
  "LogicalExpression",
  "ArrayExpression",
]);
const FUNCTIONS = new Set(["ArrowFunctionExpression", "FunctionExpression"]);
const STATEMENTS = new Set(["BlockStatement", "IfStatement", "SwitchCase", "SwitchStatement"]);
/**
 * The element renders where it is written in the component's JSX (`chain`: its ancestors, outermost first, ending at its
 * parent), so the call's `around` (the component tags enclosing it lexically) is everything that can enclose it in the
 * component: JSX children / function children, `?:` / `&&` / arrays, `.map` / `.flatMap` callbacks placed in JSX,
 * attribute values of a component (that component is in `around`), the component's own `return`. JSX kept in a variable,
 * passed to a helper or returned by an inner function used elsewhere may be inserted under a provider the call site does
 * not show: the component stays.
 */
function inPlace(chain: readonly Node[], fn: Node): boolean {
  let child = chain[chain.length - 1]!;
  for (let i = chain.length - 2; i >= -1; i--) {
    const node = i >= 0 ? chain[i]! : null;
    const at = child;
    child = node!;
    if (at === fn) return true;
    if (!node) return false;
    if (JSX.has(node.type) || WRAPS.has(node.type) || STATEMENTS.has(node.type)) {
      if (node.type === "ConditionalExpression" && node.test === at) return false;
      continue;
    }
    switch (node.type) {
      case "JSXExpressionContainer":
        continue;
      case "JSXAttribute": {
        // An attribute value of a component element (the component is in `around`); of a native element: not rendered.
        const element = chain[i - 1];
        const name = element && jsxName(element.name as Node);
        if (!name || !(name.includes(".") || /^[A-Z]/.test(name))) return false;
        continue;
      }
      case "JSXOpeningElement":
        continue;
      case "ReturnStatement":
        continue;
      case "ArrowFunctionExpression":
      case "FunctionExpression": {
        if (node === fn) return true;
        // A callback rendered in place: a JSX expression (function child, a component's render prop) or `.map` placed in JSX.
        const parent = chain[i - 1];
        if (!parent) return false;
        if (parent.type === "JSXExpressionContainer") continue;
        const callee = parent.type === "CallExpression" ? (parent.callee as Node) : null;
        const method = callee?.type === "MemberExpression" && !callee.computed ? ((callee.property as Node).name as string) : null;
        if ((method === "map" || method === "flatMap") && (parent.arguments as Node[])[0] === node) continue;
        return false;
      }
      case "CallExpression": {
        // Only `.map(callback)` / `.flatMap(callback)` reached from its callback (above).
        const callee = node.callee as Node;
        if (callee.type === "MemberExpression" && FUNCTIONS.has(at.type) && (node.arguments as Node[])[0] === at) continue;
        return false;
      }
      default:
        return node === fn;
    }
  }
  return false;
}

let parents: Node[] = [];
function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  parents.push(node);
  for (const key in node) {
    if (key === "type" || key === "start" || key === "end") continue;
    const value = node[key];
    if (Array.isArray(value)) for (const item of value) item && typeof item === "object" && typeof item.type === "string" && walk(item, visit);
    else if (value && typeof value === "object" && typeof (value as Node).type === "string") walk(value as Node, visit);
  }
  parents.pop();
}
// An identifier in a declaring position (conservative: any pattern / declaration / parameter slot).
function declares(node: Node): boolean {
  const parent = parents[parents.length - 1];
  if (!parent) return false;
  switch (parent.type) {
    case "VariableDeclarator":
      return parent.id === node;
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return parent.id === node || (parent.params as Node[]).includes(node);
    case "ClassDeclaration":
    case "ClassExpression":
      return parent.id === node;
    case "CatchClause":
      return parent.param === node;
    case "ArrayPattern":
      return (parent.elements as Node[]).includes(node);
    case "RestElement":
      return parent.argument === node;
    case "AssignmentPattern":
      return parent.left === node;
    case "Property":
      return parents[parents.length - 2]?.type === "ObjectPattern" && parent.value === node;
    default:
      return false;
  }
}

/** Tokens (`facts-callsite.ts` names) that mean a Motion element may read a provided context: motion `element.tsx`'s
 * (`MotionConfig`, variant parents, `LayoutGroup`), kit `transition.tsx`'s scope, and pseudo-tokens of packages that may
 * provide them out of the walk's sight. TOP is checked by the caller. */
export function motionContextToken(name: string): boolean {
  if (/[/\\]motion[/\\]element\.[jt]sx?#/.test(name) || /[/\\]kit[/\\]transition\.[jt]sx?#/.test(name)) return true;
  if (name.startsWith("pkg:")) return !SAFE_PACKAGES.has(name.slice(4));
  return name.startsWith("mod:");
}
// Packages that provide no Motion context (their own tokens are theirs; none renders a Motion element or a kit scope).
const SAFE_PACKAGES = new Set([
  "@rivetjs/router",
  "@rivetjs/i18n",
  "@rivetjs/forms",
  "@rivetjs/reactivity",
  "@rivetjs/runtime",
  "@rivetjs/bridge",
  "@rivetjs/bridge-react",
  "@rivetjs/bridge-preact",
  "@rivetjs/devtools",
]);
