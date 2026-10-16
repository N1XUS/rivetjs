// Compile-time icons (lane IMPL-ICON, 2026-10-09): `<Icon icon={Check} size={16} class="x" />` with `Icon` from
// `@rivetjs/kit/icon` and `Check` imported from `lucide` becomes the inline `<svg>` the component would render, so
// it compiles to one static template (client: a clone, server: one pre-escaped chunk; no component call, no
// resume state). Applied by the Vite plugin to the source before every compile (both targets see the same text,
// so resume symbol ids agree). Only constant, simple props are rewritten; anything else keeps the component call.
// Output bytes equal `Icon`'s (`libs/compiler/tests/static-icons.test.ts` checks every lucide icon).
import { parseSync } from "vite";

/** lucide icon data: `[tag, attributes]` per shape. */
type IconNode = readonly (readonly [string, Readonly<Record<string, unknown>>])[];
/** Loads the `lucide` module the importer resolves (its exports by name), or null. */
export type LucideLoader = (importer: string) => Record<string, unknown> | null;

const KIT = "@rivetjs/kit/icon",
  LUCIDE = "lucide";
const SHAPES = new Set(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]);
// Values written into JSX attribute strings verbatim: nothing the JSX parser or the HTML escaper would change.
const PLAIN = /^[^"&<>{}\\\r\n]*$/,
  NAME = /^(?!on)[A-Za-z_][\w:.-]*$/i;

type Node = { type: string; start: number; end: number; [key: string]: unknown };

/** The source with every rewritable `<Icon …/>` inlined (the same string when there is none). */
export function staticIcons(source: string, filename: string, load: LucideLoader): string {
  if (!source.includes(KIT) || !source.includes(LUCIDE)) return source;
  let program: Node;
  try {
    const parsed = parseSync(filename, source, { lang: /\.jsx$/.test(filename) ? "jsx" : "tsx" });
    if (parsed.errors.length) return source;
    program = parsed.program as unknown as Node;
  } catch {
    return source;
  }
  const icons = new Set<string>(),
    lucide = new Map<string, string>();

  for (const statement of program.body as Node[]) {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue;
    const from = (statement.source as { value: string }).value;
    if (from !== KIT && from !== LUCIDE) continue;
    for (const specifier of statement.specifiers as Node[]) {
      if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
      const name = (specifier.imported as { name?: string; value?: string }).name ?? (specifier.imported as { value: string }).value;
      const local = (specifier.local as { name: string }).name;
      if (from === KIT && name === "Icon") icons.add(local);
      else if (from === LUCIDE) lucide.set(local, name);
    }
  }
  if (!icons.size || !lucide.size) return source;
  // A local binding or parameter reusing an imported name could shadow it somewhere: leave those names alone
  // (imports bind at module level; a second import of one name is a syntax error).
  walk(program, (node) => {
    if (node.type === "Identifier" && declares(node)) (icons.delete(node.name as string), lucide.delete(node.name as string));
  });
  const elements: Node[] = [];
  walk(program, (node) => {
    if (node.type !== "JSXElement") return;
    const open = node.openingElement as Node;
    const name = open.name as Node;
    if (name.type === "JSXIdentifier" && icons.has(name.name as string) && !(node.children as Node[]).length) elements.push(node);
  });
  if (!elements.length) return source;
  const exports = load(filename);
  if (!exports) return source;
  let out = "",
    at = 0;
  for (const element of elements.sort((a, b) => a.start - b.start)) {
    if (element.start < at) continue; // nested inside an element already rewritten (cannot happen: no children)
    const svg = inline(element, lucide, exports, source);
    if (svg === null) continue;
    out += source.slice(at, element.start) + svg;
    at = element.end;
  }
  return at === 0 ? source : out + source.slice(at);
}

/** Parents hold the binding position: patterns, declarators, params, function / class names. */
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
    case "RestElement":
    case "AssignmentPattern":
    case "TSImportEqualsDeclaration":
      return parent.id === node;
    case "Property":
      return parents[parents.length - 2]?.type === "ObjectPattern" && parent.value === node;
    default:
      return false;
  }
}

/** `<svg …>…</svg>` for one `<Icon …/>`, or null when a prop is not a rewritable constant. */
function inline(element: Node, lucide: Map<string, string>, exports: Record<string, unknown>, source: string): string | null {
  let icon: IconNode | null = null,
    size: string | number = 24,
    stroke: string | number = 2,
    color = "currentColor",
    absolute = false;
  const extra: [string, string][] = [];
  const seen = new Set<string>();
  for (const attribute of (element.openingElement as Node).attributes as Node[]) {
    if (attribute.type !== "JSXAttribute" || (attribute.name as Node).type !== "JSXIdentifier") return null;
    const name = (attribute.name as { name: string }).name;
    if (seen.has(name)) return null;
    seen.add(name);
    const value = constant(attribute.value as Node | null);
    if (name === "icon") {
      const expression = (attribute.value as Node | null)?.type === "JSXExpressionContainer" ? ((attribute.value as Node).expression as Node) : null;
      const imported = expression?.type === "Identifier" ? lucide.get(expression.name as string) : undefined;
      if (imported === undefined) return null;
      const data = exports[imported];
      if (!isIconNode(data)) return null;
      icon = data;
    } else if (name === "absoluteStrokeWidth") {
      if (value !== true && value !== false) return null;
      absolute = value;
    } else if (name === "size" || name === "strokeWidth") {
      if (typeof value !== "string" && typeof value !== "number") return null;
      if (name === "size") size = value;
      else stroke = value;
    } else if (name === "color") {
      if (typeof value !== "string") return null;
      color = value;
    } else if (name === "class" || name.startsWith("data-")) {
      if (typeof value !== "string" || !NAME.test(name)) return null;
      extra.push([name, value]);
    } else return null; // title, aria-*, role, style, events, … keep the component
  }
  if (icon === null) return null;
  // `Icon`'s root (`libs/kit/icon.tsx` `root`): lucide defaults, then the caller's attributes in source order.
  const width = absolute ? (Number(stroke) * 24) / Number(size) : stroke;
  const attributes: [string, string][] = [
    ["xmlns", "http://www.w3.org/2000/svg"],
    ["width", String(size)],
    ["height", String(size)],
    ["viewBox", "0 0 24 24"],
    ["fill", "none"],
    ["stroke", color],
    ["stroke-width", String(width)],
    ["stroke-linecap", "round"],
    ["stroke-linejoin", "round"],
    ["aria-hidden", "true"],
    ...extra,
  ];
  let shapes = "";
  for (const [tag, attrs] of icon) {
    if (!SHAPES.has(tag)) return null;
    shapes += "<" + tag;
    for (const key in attrs) {
      const v = attrs[key];
      if (v == null) continue;
      if ((typeof v !== "string" && typeof v !== "number") || !NAME.test(key) || !PLAIN.test(String(v))) return null;
      shapes += " " + key + '="' + String(v) + '"';
    }
    shapes += " />";
  }
  if (attributes.some(([, v]) => !PLAIN.test(v))) return null;
  // Same line count as the element it replaces: later diagnostics / source map lines stay put.
  const lines = "\n".repeat((source.slice(element.start, element.end).match(/\n/g) ?? []).length);
  return "<svg " + attributes.map(([k, v]) => k + '="' + v + '"').join(" ") + lines + ">" + shapes + "</svg>";
}

/** A JSX attribute's constant value: bare (true), a string, or `{literal}`; undefined otherwise. */
function constant(value: Node | null): unknown {
  if (value === null) return true;
  if (value.type === "Literal") return typeof value.value === "string" && value.raw === JSON.stringify(value.value) ? value.value : undefined;
  if (value.type !== "JSXExpressionContainer") return undefined;
  const expression = value.expression as Node;
  if (expression.type !== "Literal") return undefined;
  const v = expression.value;
  return typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)) ? v : undefined;
}

function isIconNode(value: unknown): value is IconNode {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((shape) => Array.isArray(shape) && shape.length === 2 && typeof shape[0] === "string" && shape[1] !== null && typeof shape[1] === "object")
  );
}
