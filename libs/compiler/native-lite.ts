// PRESS-LITE (2026-10-28, user ruling "native"): the handler extension of native automata (ZERO STATESPACE,
// `facts-native.ts`). A component whose behaviour at a call site is only "call this handler on activation" renders, at a
// call site the build proves needs nothing more, a light twin component instead (ui `Button` → `ButtonLite`: a native
// `<button>` with a plain `click` listener, no cdk press / hover / focus-visible / slots code). The walk (vite.ts
// `derivedWalk`, builds only) rewrites the proven call's tag to the twin and imports it, then walks and closes the program
// again, so verdicts, boundary names and the static-class pass (`static-class.ts`) see the twin; server and browser
// compile the same text (same markup, same ids). Dev (no walk) keeps the component.
//
// Declaration (a line comment in the component's module; ui `button.tsx`), the root, its allowed props, the twin:
//
//   // @rivet-native-lite ButtonRoot(children,variant,size,fullWidth,isIconOnly,id,radius,type=button,isDisabled*,onPress!) ButtonLite(./button-lite.tsx)
//
// `name`: a plain value (not a signal read / expression over state, `calls[].attrs` without `*`); `name*`: may be live;
// `name!`: a handler whose arguments are never read (it gets the native event); `name=value`: absent or that string
// literal. `data-*` / `aria-*` attributes are allowed as plain values. A call site (component C, call `index`) is proven
// when:
// - its attributes are declared (no spread, no function child `()`), each of its kind (above), and C's module styles no
//   component state (`stylesState`: `[data-pressed]` styling the twin does not set);
// - each handler is an inline arrow / function expression, or a binding with one declaration in the module whose scope
//   holds the site (a `const` initialised by one, or a never-assigned function declaration), whose parameters are plain
//   identifiers its body never names, without defaults / destructuring, not a generator, and (non-arrow) never reads
//   `this` / `arguments`;
// - nothing the root may read is provided above the site: `touches(root) ∩ aboveCall(site)` is empty (`!err` aside: an
//   error handler above changes no rendered value), neither TOP (`facts-callsite.ts`; this covers the root's slot /
//   press-responder / focusable / group / form / collection contexts in one rule);
// - nothing below may read what the root provides: every component element inside the element touches no token of
//   `provides(root)` (ui Button: cdk `ProgressBarContext`), and no JSX child expression is a bare reference
//   (`{props.children}`, `{icon}`: content from outside the proof);
// - the walk's call and the parsed element agree (same count per tag in C, same enclosing tags).
// Unproven sites keep the component (today's code).
import { parseSync } from "vite";
import { posix, relative, dirname, sep } from "node:path";
import type { ModuleFacts } from "./index.ts";

/** How a declared prop may be passed. */
export type LiteProp = { kind: "plain" } | { kind: "live" } | { kind: "handler" } | { kind: "literal"; value: string };

/** One `@rivet-native-lite` declaration. */
export interface LiteFamily {
  root: string;
  props: Map<string, LiteProp>;
  /** The twin component (a named export of `spec`). */
  lite: string;
  /** Its module, as the declaring module imports it (relative). */
  spec: string;
}

const PRAGMA = /^[ \t]*\/\/[ \t]*@rivet-native-lite[ \t]+([A-Za-z_$][\w$]*)\(([^)]*)\)[ \t]+([A-Za-z_$][\w$]*)\(([^)\s]+)\)[ \t]*$/gm;

/** The `@rivet-native-lite` declarations of a module source (none: empty). */
export function liteFamilies(source: string): LiteFamily[] {
  if (!source.includes("@rivet-native-lite")) return [];
  const out: LiteFamily[] = [];
  for (const m of source.matchAll(PRAGMA)) {
    const props = new Map<string, LiteProp>();
    for (const raw of m[2]!.split(",").map((s) => s.trim())) {
      if (!raw) continue;
      const eq = raw.indexOf("=");
      if (eq > 0) props.set(raw.slice(0, eq), { kind: "literal", value: raw.slice(eq + 1) });
      else if (raw.endsWith("*")) props.set(raw.slice(0, -1), { kind: "live" });
      else if (raw.endsWith("!")) props.set(raw.slice(0, -1), { kind: "handler" });
      else props.set(raw, { kind: "plain" });
    }
    out.push({ root: m[1]!, props, lite: m[3]!, spec: m[4]! });
  }
  return out;
}

type Node = { type: string; start: number; end: number; [key: string]: unknown };

/** One component-tag JSX element of a module. */
export interface LiteElement {
  component: string | null;
  tag: string;
  ordinal: number;
  around: string[];
  /** Attribute → its value node (null: a bare attribute). */
  attrs: Map<string, Node | null>;
  spread: boolean;
  open: [number, number];
  close: [number, number] | null;
  start: number;
  end: number;
  /** Its JSX children nodes. */
  children: Node[];
}

interface Binding {
  /** The declaring node: a `VariableDeclarator` (with `kind`), a `FunctionDeclaration`, or another binding. */
  node: Node | null;
  kind: "const" | "function" | "other";
  scope: [number, number];
}

/** A parsed module for the proof. */
export interface LiteModule {
  elements: LiteElement[];
  bindings: Map<string, Binding[]>;
  assigned: Set<string>;
}

const SCOPES = new Set([
  "Program",
  "BlockStatement",
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "CatchClause",
  "SwitchStatement",
  "StaticBlock",
  "ClassDeclaration",
  "ClassExpression",
]);
const isTag = (tag: string | null): tag is string => tag !== null && (tag.includes(".") || /^[A-Z]/.test(tag));

function jsxName(node: Node): string | null {
  if (node.type === "JSXIdentifier") return node.name as string;
  if (node.type === "JSXMemberExpression") {
    const head = jsxName(node.object as Node);
    return head === null ? null : head + "." + ((node.property as Node).name as string);
  }
  return null;
}

/** The component a top-level statement declares (`ModuleFacts.boundaries` key), or null (as static-class.ts). */
function componentOf(statement: Node): string | null {
  let node = statement;
  const isFn = (n: Node | null | undefined): n is Node =>
    !!n && (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression");
  if (node.type === "ExportNamedDeclaration") {
    if (!node.declaration) return null;
    node = node.declaration as Node;
  } else if (node.type === "ExportDefaultDeclaration") {
    const declaration = node.declaration as Node;
    if (!isFn(declaration)) return null;
    return (declaration.id as { name: string } | null | undefined)?.name ?? "default";
  }
  if (node.type === "FunctionDeclaration") return (node.id as { name: string } | null)?.name ?? null;
  if (node.type === "VariableDeclaration") {
    const decls = node.declarations as Node[];
    if (decls.length !== 1) return null;
    const id = decls[0]!.id as Node;
    return id.type === "Identifier" && isFn(decls[0]!.init as Node | null) ? (id.name as string) : null;
  }
  return null;
}

const children = (node: Node): Node[] => {
  const out: Node[] = [];
  for (const key in node) {
    if (key === "type" || key === "start" || key === "end") continue;
    if (key === "typeAnnotation" || key === "returnType" || key === "typeParameters" || key === "typeArguments" || key === "superTypeArguments") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) if (item && typeof item === "object" && typeof item.type === "string") out.push(item);
    } else if (value && typeof value === "object" && typeof (value as Node).type === "string") out.push(value as Node);
  }
  return out;
};

/** Every node of a subtree (pre-order), type positions skipped. */
function* nodes(node: Node): Generator<Node> {
  yield node;
  if (node.type.startsWith("TS") && !TS_EXPRESSIONS.has(node.type)) return;
  for (const child of children(node)) yield* nodes(child);
}
const TS_EXPRESSIONS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "TSInstantiationExpression", "TSTypeAssertion"]);

/** Parse a module for the proof (null: unparsable). */
export function liteModule(source: string, filename: string): LiteModule | null {
  let program: Node;
  try {
    const parsed = parseSync(filename, source, {
      lang: /\.jsx$/.test(filename) ? "jsx" : /\.tsx$/.test(filename) ? "tsx" : /\.ts$/.test(filename) ? "ts" : "js",
    });
    if (parsed.errors.length) return null;
    program = parsed.program as unknown as Node;
  } catch {
    return null;
  }
  const elements: LiteElement[] = [];
  const bindings = new Map<string, Binding[]>();
  const assigned = new Set<string>();
  const ordinals = new Map<string, number>();
  const parents: Node[] = [];
  const scopeOf = (): [number, number] => {
    for (let i = parents.length - 1; i >= 0; i--) if (SCOPES.has(parents[i]!.type)) return [parents[i]!.start, parents[i]!.end];
    return [program.start, program.end];
  };
  const bind = (name: string, binding: Binding) => {
    const list = bindings.get(name);
    if (list) list.push(binding);
    else bindings.set(name, [binding]);
  };
  const pattern = (node: Node | null | undefined, binding: Omit<Binding, "kind"> & { kind: Binding["kind"] }): void => {
    if (!node) return;
    switch (node.type) {
      case "Identifier":
        bind(node.name as string, binding);
        return;
      case "ObjectPattern":
        for (const p of node.properties as Node[]) pattern(p.type === "RestElement" ? (p.argument as Node) : (p.value as Node), { ...binding, kind: "other" });
        return;
      case "ArrayPattern":
        for (const e of node.elements as (Node | null)[]) pattern(e, { ...binding, kind: "other" });
        return;
      case "AssignmentPattern":
        pattern(node.left as Node, { ...binding, kind: "other" });
        return;
      case "RestElement":
        pattern(node.argument as Node, { ...binding, kind: "other" });
        return;
      case "TSParameterProperty":
        pattern(node.parameter as Node, { ...binding, kind: "other" });
        return;
    }
  };
  const visit = (node: Node, component: string | null): void => {
    switch (node.type) {
      case "VariableDeclarator": {
        const kind = (parents[parents.length - 1]?.kind as string) === "const" ? "const" : "other";
        pattern(node.id as Node, { node, kind: (node.id as Node).type === "Identifier" ? kind : "other", scope: scopeOf() });
        break;
      }
      case "FunctionDeclaration":
      case "ClassDeclaration":
        if (node.id) bind((node.id as Node).name as string, { node, kind: node.type === "FunctionDeclaration" ? "function" : "other", scope: scopeOf() });
        break;
      case "ImportSpecifier":
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
        bind((node.local as Node).name as string, { node: null, kind: "other", scope: [program.start, program.end] });
        break;
      case "AssignmentExpression":
        for (const n of nodes(node.left as Node)) if (n.type === "Identifier") assigned.add(n.name as string);
        break;
      case "UpdateExpression":
        if ((node.argument as Node).type === "Identifier") assigned.add((node.argument as Node).name as string);
        break;
      case "JSXElement": {
        const open = node.openingElement as Node;
        const tag = jsxName(open.name as Node);
        if (isTag(tag)) {
          const key = (component ?? "") + "\0" + tag;
          const ordinal = ordinals.get(key) ?? 0;
          ordinals.set(key, ordinal + 1);
          const around: string[] = [];
          for (let i = parents.length - 1; i >= 0; i--) {
            const p = parents[i]!;
            if (p.type !== "JSXElement") continue;
            const n = jsxName((p.openingElement as Node).name as Node);
            if (isTag(n)) around.push(n);
          }
          const attrs = new Map<string, Node | null>();
          let spread = false;
          for (const attribute of open.attributes as Node[]) {
            if (attribute.type !== "JSXAttribute" || (attribute.name as Node).type !== "JSXIdentifier") {
              spread = true;
              continue;
            }
            const name = (attribute.name as Node).name as string;
            if (attrs.has(name)) spread = true; // a repeated name: unproven
            attrs.set(name, (attribute.value as Node | null) ?? null);
          }
          const closing = node.closingElement as Node | null;
          const closeName = closing ? (closing.name as Node) : null;
          elements.push({
            component,
            tag,
            ordinal,
            around,
            attrs,
            spread,
            open: [(open.name as Node).start, (open.name as Node).end],
            close: closeName ? [closeName.start, closeName.end] : null,
            start: node.start,
            end: node.end,
            children: node.children as Node[],
          });
        }
        break;
      }
    }
    if (node.type.startsWith("TS") && !TS_EXPRESSIONS.has(node.type)) return;
    if ((node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") && node.id) {
      parents.push(node);
      bind((node.id as Node).name as string, { node: null, kind: "other", scope: [node.start, node.end] });
      parents.pop();
    }
    if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
      parents.push(node);
      for (const p of node.params as Node[]) pattern(p, { node: null, kind: "other", scope: [node.start, node.end] });
      parents.pop();
    }
    if (node.type === "CatchClause" && node.param) pattern(node.param as Node, { node: null, kind: "other", scope: [node.start, node.end] });
    parents.push(node);
    for (const child of children(node)) visit(child, component);
    parents.pop();
  };
  for (const statement of program.body as Node[]) {
    parents.push(program);
    visit(statement, componentOf(statement));
    parents.pop();
  }
  return { elements, bindings, assigned };
}

const unwrap = (node: Node): Node => (node.type === "ParenthesizedExpression" ? unwrap(node.expression as Node) : node);

/** A function node that never reads its arguments (see the header). */
export function ignoresArguments(fn: Node): boolean {
  if (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression" && fn.type !== "FunctionDeclaration") return false;
  if (fn.generator) return false;
  const params = fn.params as Node[];
  const names: string[] = [];
  for (const p of params) {
    if (p.type !== "Identifier") return false;
    names.push(p.name as string);
  }
  for (const n of nodes(fn.body as Node)) {
    if (n.type === "Identifier" && names.includes(n.name as string)) return false;
    if (fn.type !== "ArrowFunctionExpression" && (n.type === "ThisExpression" || (n.type === "Identifier" && n.name === "arguments"))) return false;
  }
  return true;
}

/** The handler attribute value of an element ignores its arguments (inline, or a resolved binding). */
export function handlerIgnoresArguments(value: Node | null, mod: LiteModule, at: number): boolean {
  if (!value || value.type !== "JSXExpressionContainer") return false;
  const expr = unwrap(value.expression as Node);
  if (expr.type === "ArrowFunctionExpression" || expr.type === "FunctionExpression") return ignoresArguments(expr);
  if (expr.type !== "Identifier") return false;
  const name = expr.name as string;
  const list = mod.bindings.get(name);
  if (!list || list.length !== 1 || mod.assigned.has(name)) return false;
  const b = list[0]!;
  if (!(b.scope[0] <= at && at < b.scope[1]) || !b.node) return false;
  if (b.kind === "function") return ignoresArguments(b.node);
  if (b.kind !== "const") return false;
  const init = b.node.init as Node | null;
  return !!init && ignoresArguments(unwrap(init));
}

/** A JSX child whose content the proof sees: no bare-reference expression (`{props.children}`, `{icon}`), no spread child. */
const noBareChild = (node: Node): boolean => {
  if (node.type === "JSXSpreadChild") return false;
  if (node.type === "JSXExpressionContainer") {
    const e = node.expression as Node;
    if (e.type === "JSXEmptyExpression") return true;
    const u = unwrap(e);
    if (u.type === "Identifier" || u.type === "MemberExpression") return false;
    // JSX inside the expression (`{ok && <b>{x}</b>}`): its own children too.
    for (const n of nodes(u)) if ((n.type === "JSXElement" || n.type === "JSXFragment") && !(n.children as Node[]).every(noBareChild)) return false;
    return true;
  }
  if (node.type === "JSXElement" || node.type === "JSXFragment") return (node.children as Node[]).every(noBareChild);
  return true;
};

export interface LitePlanInput {
  texts: ReadonlyMap<string, string>;
  facts: ReadonlyMap<string, ModuleFacts>;
  /** file → its declared families (`liteFamilies`). */
  families: ReadonlyMap<string, LiteFamily[]>;
  /** Files whose source styles a component state (`facts-native.ts` `stylesState`). */
  stateStyled: ReadonlySet<string>;
  /** Resolved twin module of a declaring file's spec (null: not found). */
  twin(file: string, spec: string): string | null;
  callers: ReadonlyMap<string, readonly { caller: string; index: number }[]>;
  aboveCall(caller: string, index: number): string[] | null;
  touches(id: string): string[] | null;
  provides(id: string): string[] | null;
  resolveTag(file: string, tag: string): string | null;
  /**
   * Page scope (bytes, not soundness): the page modules (routes) and the walk's static / dynamic import edges. A proven
   * site is rewritten only when no page that loads its module keeps the root's code anyway (see `litePlan`). Without:
   * every proven site.
   */
  pages?: readonly string[];
  edges?(file: string): Iterable<string>;
  dynamicEdges?(file: string): Iterable<string>;
  /** The source package directory of a file (null: the app): the root's foreign dependencies are its other-package imports. */
  packageOf?(file: string): string | null;
  /** A caller component (`file?Name`) ships no code to the browser (no adopt walk reaches it: `resume.static`). */
  isStatic?(id: string): boolean;
  trace?: (...args: unknown[]) => void;
}

export interface LitePlan {
  /** Rewritten module texts (proven call sites renamed to the twin, its import prepended on line 1). */
  texts: Map<string, string>;
  /** Twin modules the rewritten texts import. */
  twins: Set<string>;
  /** Rewritten sites, `file?Caller:index`. */
  proven: string[];
}

/** The local binding a rewritten module imports the twin as. */
export const liteLocal = (lite: string): string => "RvLite$" + lite;

interface Candidate {
  rootId: string;
  file: string;
  site: { caller: string; index: number };
  element: LiteElement;
  family: LiteFamily;
  twin: string;
}

/**
 * The build's PRESS-LITE plan over the walked program (see the header).
 *
 * Page scope (measured 2026-10-28 on ui-docs frames: a page that keeps the cdk Button for another component pays the
 * twin on top, +536…+640 B br and +1 file). Load units: the `pages` and every dynamic import target (a docs frame's
 * example module, a lazy route), each with its static import closure over `edges` (the root module's own imports not
 * followed); what loads together with a unit = its closure + the closures of the pages that dynamically import it
 * (one level: a lazy module inside a lazy module counts only its own closure and its pages'). Such a set keeps the root's code when a module in it has a site of the root that is not rewritten (its
 * caller ships code), or imports one of the root module's foreign dependencies (another package's module the root
 * imports: ui Button's cdk `button` / `interactions/press` / `interactions/focus` / `collections/hidden`, e.g. a ui
 * `CloseButton` on a toast page). Then its proven sites stay as they are, which can keep another set's root code in
 * turn: a fixpoint. A module no unit loads keeps its proven sites.
 */
export function litePlan(input: LitePlanInput): LitePlan {
  const { texts, facts, families, stateStyled, callers, trace } = input;
  const plan: LitePlan = { texts: new Map(), twins: new Set(), proven: [] };
  const parsed = new Map<string, LiteModule | null>();
  const parse = (file: string): LiteModule | null => {
    if (!parsed.has(file)) parsed.set(file, texts.has(file) ? liteModule(texts.get(file)!, file) : null);
    return parsed.get(file)!;
  };
  const candidates: Candidate[] = [];
  /** Per family root id: the caller files of its sites that stay (unproven, caller shipping code). */
  const kept = new Map<string, Set<string>>();
  const roots: { id: string; file: string; foreign: Set<string> }[] = [];
  for (const [file, list] of families)
    for (const family of list) {
      const rootId = file + "?" + family.root;
      const twin = input.twin(file, family.spec);
      if (!twin || !facts.get(file)?.boundaries.has(family.root)) {
        trace?.("declaration", file, family.root, twin ? "no component" : "twin unresolved");
        continue;
      }
      const touch = input.touches(rootId);
      const provided = input.provides(rootId);
      if (touch === null || provided === null) {
        trace?.("declaration", file, family.root, "touches TOP");
        continue;
      }
      const stays = new Set<string>();
      kept.set(rootId, stays);
      const own = input.packageOf?.(file) ?? null;
      roots.push({
        id: rootId,
        file,
        foreign: new Set([...(input.edges?.(file) ?? [])].filter((to) => to !== twin && (input.packageOf?.(to) ?? null) !== own)),
      });
      const reads = touch.filter((t) => t !== "!err");
      for (const site of callers.get(rootId) ?? []) {
        const at = site.caller.lastIndexOf("?");
        const callerFile = site.caller.slice(0, at);
        const component = site.caller.slice(at + 1);
        const why = (reason: string, ...more: unknown[]): null => {
          trace?.(family.root, component + ":" + site.index, reason, ...more);
          if (reason !== "proven" && !input.isStatic?.(site.caller)) stays.add(callerFile);
          return null;
        };
        const element = ((): LiteElement | null => {
          if (callerFile === file) return why("own module");
          if (stateStyled.has(callerFile)) return why("state styles");
          const calls = facts.get(callerFile)?.boundaries.get(component)?.calls;
          const call = calls?.[site.index];
          if (!calls || !call?.attrs) return why("no call facts");
          if (call.escapes) return why("escapes");
          const bad = call.attrs.find((a) => {
            if (a === "..." || a === "()") return true;
            const live = a.endsWith("*");
            const name = live ? a.slice(0, -1) : a;
            if (name.startsWith("data-") || name.startsWith("aria-")) return live;
            const kind = family.props.get(name);
            return !kind || (live && kind.kind !== "live" && kind.kind !== "handler");
          });
          if (bad !== undefined) return why("attr", bad);
          const above = input.aboveCall(site.caller, site.index);
          if (above === null) return why("above TOP");
          const overlap = reads.filter((t) => above.includes(t));
          if (overlap.length) return why("provided above", overlap);
          const mod = parse(callerFile);
          if (!mod) return why("unparsable");
          const same = calls.flatMap((c, i) => (c.tag === call.tag ? [i] : []));
          const elements = mod.elements.filter((e) => e.component === component && e.tag === call.tag);
          const element = same.length === elements.length ? elements[same.indexOf(site.index)] : undefined;
          if (!element || element.around.join("\0") !== call.around.join("\0") || element.spread) return why("element not matched");
          for (const [name, value] of element.attrs) {
            const kind = family.props.get(name);
            if (!kind) continue; // data-* / aria-* (checked above)
            if (kind.kind === "handler" && !handlerIgnoresArguments(value, mod, element.start)) return why("handler reads arguments", name);
            if (kind.kind === "literal" && !(value?.type === "Literal" && value.value === kind.value)) return why("not literal", name);
          }
          if (!element.children.every(noBareChild)) return why("children from outside");
          // Nothing inside reads what the root provides (component elements inside the element, resolved).
          const reader = mod.elements.find((e) => {
            if (e === element || e.start <= element.start || e.end > element.end) return false;
            const id = input.resolveTag(callerFile, e.tag);
            const t = id ? input.touches(id) : null;
            return t === null || t.some((x) => x !== "!err" && provided.includes(x));
          });
          if (reader) return why("inner reads", reader.tag);
          const local = liteLocal(family.lite);
          if (texts.get(callerFile)!.includes(local)) return why("local name taken");
          return element;
        })();
        if (element) {
          trace?.(family.root, component + ":" + site.index, "proven", callerFile);
          candidates.push({ rootId, file: callerFile, site, element, family, twin });
        }
      }
    }
  // Page scope: drop the candidates of pages that keep a root's code (fixpoint; see above).
  let chosen = candidates;
  if (input.pages && input.edges) {
    const skip = new Set(roots.map((r) => r.file));
    const units = new Map<string, { seen: Set<string>; parents: Set<string> }>();
    const queue = [...new Set(input.pages)];
    const queued = new Set(queue);
    for (let i = 0; i < queue.length; i++) {
      const unit = queue[i]!;
      const seen = new Set<string>();
      units.set(unit, { seen, parents: new Set() });
      const stack = [unit];
      for (let f; (f = stack.pop()) !== undefined;)
        if (!seen.has(f)) {
          seen.add(f);
          if (skip.has(f)) continue;
          for (const to of input.edges!(f)) stack.push(to);
        }
      for (const f of seen) if (!skip.has(f)) for (const to of input.dynamicEdges?.(f) ?? []) if (!queued.has(to)) (queued.add(to), queue.push(to));
    }
    // A unit loads with the pages that import it dynamically (a docs frame route's example modules); not with a sibling
    // unit that reaches the same lazy index (every docs example module reaches the frames index: all would be one page).
    const pageSet = new Set(input.pages);
    for (const [unit, { seen }] of units)
      if (pageSet.has(unit))
        for (const f of seen) if (!skip.has(f)) for (const to of input.dynamicEdges?.(f) ?? []) if (to !== unit) units.get(to)?.parents.add(unit);
    // What loads together with each unit: its closure + its importers' (up the chain).
    const closures = [...units.keys()].map((page) => {
      const seen = new Set<string>();
      const up = [page],
        done = new Set<string>();
      for (let u; (u = up.pop()) !== undefined;)
        if (!done.has(u)) {
          done.add(u);
          for (const f of units.get(u)!.seen) seen.add(f);
          up.push(...units.get(u)!.parents);
        }
      return { page, seen };
    });
    for (const root of roots) {
      const stays = kept.get(root.id)!;
      // Modules that keep the root's code on any page loading them: sites that stay, importers of a foreign dependency
      // (the root module's own imports aside: not followed).
      const bad = new Set(stays);
      for (const { seen } of units.values()) for (const f of seen) if (!skip.has(f) && [...input.edges!(f)].some((to) => root.foreign.has(to))) bad.add(f);
      const mine = new Set(chosen.filter((c) => c.rootId === root.id).map((c) => c.file));
      const relevant = closures.filter(({ seen }) => [...mine].some((f) => seen.has(f)));
      for (let changed = true; changed;) {
        changed = false;
        for (const { page, seen } of relevant) {
          if (![...seen].some((f) => bad.has(f))) continue;
          for (const f of mine)
            if (seen.has(f) && !stays.has(f)) {
              trace?.(root.id.slice(root.id.lastIndexOf("?") + 1), f, "page keeps root", page);
              stays.add(f);
              bad.add(f);
              changed = true;
            }
        }
      }
    }
    chosen = chosen.filter((c) => !kept.get(c.rootId)!.has(c.file));
  }
  // Per caller file: edits and the twins it imports.
  const edits = new Map<string, { at: [number, number]; text: string }[]>();
  const imports = new Map<string, Map<string, string>>();
  for (const c of chosen) {
    const local = liteLocal(c.family.lite);
    let list = edits.get(c.file);
    if (!list) edits.set(c.file, (list = []));
    list.push({ at: c.element.open, text: local });
    if (c.element.close) list.push({ at: c.element.close, text: local });
    let own = imports.get(c.file);
    if (!own) imports.set(c.file, (own = new Map()));
    let spec = posix.normalize(relative(dirname(c.file), c.twin).split(sep).join("/"));
    if (!spec.startsWith(".")) spec = "./" + spec;
    own.set(local, `import { ${c.family.lite} as ${local} } from ${JSON.stringify(spec)};`);
    plan.twins.add(c.twin);
    plan.proven.push(c.site.caller + ":" + c.site.index);
  }
  for (const [file, list] of edits) {
    const source = texts.get(file)!;
    let out = "",
      at = 0;
    for (const edit of [...list].sort((a, b) => a.at[0] - b.at[0])) {
      out += source.slice(at, edit.at[0]) + edit.text;
      at = edit.at[1];
    }
    out += source.slice(at);
    plan.texts.set(file, [...imports.get(file)!.values()].join("") + out);
  }
  return plan;
}
