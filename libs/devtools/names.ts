// Dev-server transform naming signals and computeds after their source bindings, for the panel
// (`const count = signal(0)` → `count`). Runs on compiled client modules in `vite serve` only (never in
// builds or `compile()`): each named call becomes `__rivetName(signal(0), "count")`, and a hoisted helper
// appended to the module reports `name { value, name }` to the page's devtools hook. Edits stay on their
// lines and the source map's generated columns are shifted to match, so line-based hot replacement and
// source-mapped stacks keep working.
import { parseAst } from "vite";

/** Creators named by the transform (imported from `@rivetjs/*`): signals, computeds, context tokens. */
const CREATORS = new Set(["signal", "computed", "createContext"]);
const HELPER = "__rivetName";
const HELPER_SOURCE = `function ${HELPER}(value, name) { const hook = globalThis[Symbol.for("rivet.devtools")]; if (hook) hook.emit("name", { value, name }); return value; }\n`;

interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}
const isNode = (value: unknown): value is AstNode => typeof value === "object" && value !== null && typeof (value as AstNode).type === "string";

/** The binding name a creator call is assigned to, if any. */
function bindingName(call: AstNode, parent: AstNode | null): string | undefined {
  if (!parent) return undefined;
  const keyName = (key: unknown, computed: unknown): string | undefined => {
    if (computed || !isNode(key)) return undefined;
    if (key.type === "Identifier" || key.type === "PrivateIdentifier") return key.name as string;
    return key.type === "Literal" && typeof key.value === "string" ? key.value : undefined;
  };
  switch (parent.type) {
    case "VariableDeclarator":
      return parent.init === call && isNode(parent.id) && parent.id.type === "Identifier" ? (parent.id.name as string) : undefined;
    case "Property":
      return parent.value === call && parent.kind === "init" ? keyName(parent.key, parent.computed) : undefined;
    case "PropertyDefinition":
      return parent.value === call ? keyName(parent.key, parent.computed) : undefined;
    case "AssignmentExpression": {
      if (parent.right !== call || !isNode(parent.left)) return undefined;
      const left = parent.left;
      if (left.type === "Identifier") return left.name as string;
      return left.type === "MemberExpression" ? keyName(left.property, left.computed) : undefined;
    }
  }
  return undefined;
}

/** Calls to name: `{ start, end, name }` of each creator call assigned to a binding. */
export function namedCalls(code: string, lang: "js" | "ts" = "js"): { start: number; end: number; name: string }[] {
  if (!code.includes("@rivetjs/")) return [];
  let program: AstNode;
  try {
    program = (lang === "ts" ? parseAst(code, { lang: "ts" }) : parseAst(code)) as unknown as AstNode;
  } catch {
    return [];
  }
  // Local names of the creators, and namespace imports (`r.signal(…)`).
  const locals = new Set<string>(), namespaces = new Set<string>();
  for (const statement of program.body as AstNode[]) {
    if (statement.type !== "ImportDeclaration" || !/^@rivetjs\//.test((statement.source as { value: string }).value)) continue;
    for (const spec of statement.specifiers as AstNode[]) {
      const local = (spec.local as { name: string }).name;
      if (spec.type === "ImportNamespaceSpecifier") namespaces.add(local);
      else if (spec.type === "ImportSpecifier") {
        const imported = spec.imported as AstNode;
        const name = imported.type === "Identifier" ? (imported.name as string) : (imported.value as string);
        if (CREATORS.has(name)) locals.add(local);
      }
    }
  }
  if (!locals.size && !namespaces.size) return [];
  const isCreator = (callee: unknown): boolean => {
    if (!isNode(callee)) return false;
    if (callee.type === "Identifier") return locals.has(callee.name as string);
    if (callee.type !== "MemberExpression" || callee.computed) return false;
    const object = callee.object as AstNode, property = callee.property as AstNode;
    return object.type === "Identifier" && namespaces.has(object.name as string) && property.type === "Identifier" && CREATORS.has(property.name as string);
  };
  const found: { start: number; end: number; name: string }[] = [];
  const walk = (node: AstNode, parent: AstNode | null): void => {
    if (node.type === "CallExpression" && isCreator(node.callee)) {
      const name = bindingName(node, parent);
      if (name) found.push({ start: node.start, end: node.end, name });
    }
    for (const key in node) {
      if (key === "type" || key === "start" || key === "end") continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) if (isNode(item)) walk(item, node);
      } else if (isNode(value)) walk(value, node);
    }
  };
  walk(program, null);
  return found;
}

// Source map VLQ (base64): only each segment's first field (generated column) is rewritten.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeFirst(segment: string): [value: number, rest: string] {
  let value = 0, shift = 0, i = 0;
  for (;;) {
    const digit = B64.indexOf(segment[i++]!);
    value += (digit & 31) << shift;
    shift += 5;
    if (!(digit & 32)) break;
  }
  return [value & 1 ? -(value >>> 1) : value >>> 1, segment.slice(i)];
}
function encode(value: number): string {
  let rest = value < 0 ? (-value << 1) | 1 : value << 1, out = "";
  do {
    let digit = rest & 31;
    rest >>>= 5;
    if (rest) digit |= 32;
    out += B64[digit];
  } while (rest);
  return out;
}
/** `mappings` with the generated columns of `lines` shifted: per line, insertions `[column, length]`. */
export function shiftMappings(mappings: string, lines: Map<number, [number, number][]>): string {
  const out = mappings.split(";");
  for (const [line, inserts] of lines) {
    if (line >= out.length || !out[line]) continue;
    let column = 0, previous = 0;
    out[line] = out[line]!.split(",")
      .map((segment) => {
        if (!segment) return segment;
        const [delta, rest] = decodeFirst(segment);
        column += delta;
        let moved = column;
        for (const [at, length] of inserts) if (at <= column) moved += length;
        const encoded = encode(moved - previous) + rest;
        previous = moved;
        return encoded;
      })
      .join(",");
  }
  return out.join(";");
}

/**
 * Compiled client module with its signals / computeds / contexts named, or null when nothing is named.
 * `lang: "ts"`: a plain TypeScript app module (before type stripping; edits are valid TypeScript).
 */
export function nameSignals(code: string, map?: string | null, lang: "js" | "ts" = "js"): { code: string; map: string | null } | null {
  const calls = namedCalls(code, lang);
  if (!calls.length) return null;
  const inserts: { at: number; text: string }[] = [];
  for (const call of calls) inserts.push({ at: call.start, text: HELPER + "(" }, { at: call.end, text: ", " + JSON.stringify(call.name) + ")" });
  inserts.sort((a, b) => a.at - b.at);
  // Line / column of each insertion (columns in the original line, UTF-16 like source maps).
  const lineStarts = [0];
  for (let i = code.indexOf("\n"); i !== -1; i = code.indexOf("\n", i + 1)) lineStarts.push(i + 1);
  const lines = new Map<number, [number, number][]>();
  let out = "", last = 0, line = 0;
  for (const { at, text } of inserts) {
    out += code.slice(last, at) + text;
    last = at;
    while (line + 1 < lineStarts.length && lineStarts[line + 1]! <= at) line++;
    let list = lines.get(line);
    if (!list) lines.set(line, (list = []));
    list.push([at - lineStarts[line]!, text.length]);
  }
  out += code.slice(last);
  out += (out.endsWith("\n") ? "" : "\n") + HELPER_SOURCE;
  let shifted: string | null = null;
  if (map) {
    const json = JSON.parse(map) as { mappings: string };
    json.mappings = shiftMappings(json.mappings, lines);
    shifted = JSON.stringify(json);
  }
  return { code: out, map: shifted };
}
