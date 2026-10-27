// ZERO UI-JS2 (2026-10-26): which modules may hand a variant resolver a class override tailwind-merge could change.
//
// `@rivetjs/ui`'s resolver (`styles/src/utils/tv.ts`) joins a component core (BEM classes tailwind-merge does not
// recognise, `tests/tv-core-bem.test.ts`) with a `class` / `className` override and merges only the override:
// `cn(core, o)` = `core + " " + twMerge(o)`. In the browser it merges only once a module registered tailwind-merge
// (`@rivetjs/ui/tv-merge`); before that it returns the join, the same string exactly when `twMerge(o) === o` (a fixed
// point). This pass decides, per module of a client build, whether its code can make an override that is not one; such
// a module imports the provider (`vite.ts`), so the merge is registered before that code runs.
//
// Values are classified by what tailwind-merge can do to them:
// - B: no token tailwind-merge recognises (BEM classes, empty) — joining B parts with anything keeps them as they are;
// - U: a fixed point that may hold utilities (a literal `twMerge` returns unchanged, a forwarded prop, a resolver result);
// - R: anything else (a non-fixed literal, two U parts joined, calls / templates / functions / identifiers it cannot read).
// Joins (`cx(…)`, helpers a module declares with `// @rivet-class-join name(i,…)`, ternaries / `&&` / `||` / `??` pick
// one part) stay U with at most one U part. Where values start:
// - a class-like JSX attribute of a component tag (`class`, `className`, `classNames`, `*Class`, `*ClassName`; not
//   intrinsic tags, `@rivetjs/*` packages other than ui (they render a class, never resolve one), ui's `utils/dom` /
//   `vendor/` primitives), a class-like property of an object literal, an assignment to a class-like member: R there =
//   an override source;
// - a forwarded prop (`props.class`, `local.classNames?.slot`, `x.panelClass`: a member read of a class-like key) is U:
//   it moves what an origin made (the origin is checked where it is written).
// Prop merges that join class strings of two origins (`mergeProps`, `contextProps`, `useContextProps`) count as a source
// when the module also forwards a class.
// Not seen (documented limit, docs/guides/performance.md "tailwind-merge on demand"): class strings from run-time data
// (JSON, a loader) read through a class-like key, and values a module renders on the server and hands to a component
// that adopts in the browser without that module (record props): both are U here; they reach the browser's resolver
// unmerged when tailwind-merge would change them.
// Prop joins (BIG-UI-3, 2026-10-27): an R value that only joins two or more forwarded class props of the exported
// component it sits in (`[local.classNames?.base, local.class].filter(Boolean).join(" ")`, `cx(local.class, …)`; other
// parts B) is a source only when a caller passes two of those props (`conditional`). Callers are a whole-build fact:
// the co-load passes decide it (`vite.ts`: pass 1 records uses with `classPropUse`, pass 2 imports the provider into the
// component's module only when some caller may pass two); one-pass builds count it as a source. A local component that
// only renders such a prop as an intrinsic element's `class` resolves nothing with it (no origin at its call sites).

import { parseAst } from "vite";

interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const isNode = (value: unknown): value is Node => value !== null && typeof value === "object" && typeof (value as Node).type === "string";

function* children(node: Node): Generator<Node> {
  for (const key in node) {
    if (key === "type" || key === "start" || key === "end") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) yield item;
    } else if (isNode(value)) yield value;
  }
}

const unwrap = (node: Node): Node => {
  let n = node;
  while (
    n.type === "TSAsExpression" ||
    n.type === "TSSatisfiesExpression" ||
    n.type === "TSNonNullExpression" ||
    n.type === "TSTypeAssertion" ||
    n.type === "ParenthesizedExpression" ||
    n.type === "TSInstantiationExpression" ||
    n.type === "ChainExpression"
  )
    n = n.expression as Node;
  return n;
};

/** Class-like prop / attribute names (the values a resolver may get as overrides). */
export const CLASS_KEY = /^(?:class|className|classNames|[a-z][\w$]*Class(?:Name|Names)?)$/;
// Component tags that render a class (never resolve one): other `@rivetjs/*` packages, ui's own DOM / vendored primitives.
const RENDERING = /^@rivetjs\/(?!ui(?:\/|$))|(?:^|\/)utils\/dom(?:\.tsx?)?$|(?:^|\/)vendor\//;
// Variant resolver modules (`*.styles.ts` definitions, the styles package).
const RESOLVERS = /(?:^|\/)styles(?:\/|$)|\.styles(?:\.[jt]s)?$/;
// Prop merges that join class strings.
const CLASS_JOINERS = new Set(["mergeProps", "contextProps", "useContextProps"]);
// `// @rivet-class-join composeSlotClassName(1) composeTwRenderProps(0,1)`: helpers joining their listed arguments.
const JOIN_DECL = /\/\/\s*@rivet-class-join\b([^\n]*)/g;

/** Names a binding pattern declares. */
function patternNames(node: Node, out: string[] = []): string[] {
  const n = node.type === "AssignmentPattern" ? (node.left as Node) : node.type === "RestElement" ? (node.argument as Node) : node;
  if (n.type === "Identifier") out.push(n.name as string);
  else if (n.type === "ObjectPattern") for (const p of n.properties as Node[]) patternNames(p.type === "Property" ? (p.value as Node) : p, out);
  else if (n.type === "ArrayPattern") for (const e of n.elements as (Node | null)[]) if (e) patternNames(e, out);
  return out;
}

const B = 0,
  U = 1,
  R = 2;
type Kind = 0 | 1 | 2;

/** One override source. */
export interface ClassOverrideSite {
  /** Offset in the module text. */
  at: number;
  why: string;
  /**
   * A prop join (BIG-UI-3): the value joins forwarded props of an exported component and is an override source only when
   * a caller passes two or more of `props` (paths: `["class"]`, `["classNames", "base"]`). The module itself imports no
   * merge for it; its callers do when they pass two (`classPropUse`).
   */
  conditional?: { component: string; props: string[][] };
}

export interface ClassOverrideOptions {
  /** tailwind-merge as the resolver runs it (tailwind-variants `cn`). */
  merge(value: string): string;
  /**
   * Helpers (`name` → indexes of the arguments they join), merged with the `@rivet-class-join` declarations the scanned
   * module itself carries; the build passes every declaration it has seen.
   */
  joins?: ReadonlyMap<string, readonly number[]>;
}

const langOf = (file: string): "js" | "jsx" | "ts" | "tsx" =>
  /\.tsx$/.test(file) ? "tsx" : /\.[cm]?ts$/.test(file) ? "ts" : /\.jsx$/.test(file) ? "jsx" : "js";

/** Quick text check: a module without a class-like name holds no origin. */
export function classOverrideCandidate(code: string): boolean {
  return /class|Class/.test(code);
}

/** `@rivet-class-join` declarations of a module. */
export function classJoinDeclarations(code: string): Map<string, number[]> {
  const out = new Map<string, number[]>();
  if (!code.includes("@rivet-class-join")) return out;
  for (const match of code.matchAll(JOIN_DECL))
    for (const decl of match[1]!.matchAll(/([A-Za-z_$][\w$]*)\(([\d,\s]*)\)/g))
      out.set(
        decl[1]!,
        decl[2]!
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map(Number),
      );
  return out;
}

const tokenCache = new WeakMap<(value: string) => string, Map<string, boolean>>();

/**
 * The override sources of a module (source text, before the JSX compile). Empty: every override it can make is a
 * tailwind-merge fixed point. Unparsable code is one source (conservative). A module declaring `@rivet-class-join`
 * helpers is trusted for their bodies (their arguments are checked at each call).
 */
export function classOverrideSites(code: string, file: string, options: ClassOverrideOptions): ClassOverrideSite[] {
  let program: Node;
  try {
    program = parseAst(code, { lang: langOf(file) }) as unknown as Node;
  } catch {
    return [{ at: 0, why: "unparsable" }];
  }
  const merge = options.merge;
  let recognised = tokenCache.get(merge);
  if (!recognised) tokenCache.set(merge, (recognised = new Map()));
  const known = (token: string): boolean => {
    let hit = recognised!.get(token);
    // tailwind-merge drops a repeated token it recognises, keeps a repeated unknown one.
    if (hit === undefined) recognised!.set(token, (hit = merge(token + " " + token) === token));
    return hit;
  };
  const own = classJoinDeclarations(code);
  // `// @rivet-class-resolvers a b`: module bindings holding resolver results (memo helpers the pass cannot follow).
  const declaredResolvers = new Set<string>();
  for (const m of code.matchAll(/\/\/\s*@rivet-class-resolvers\b([^\n]*)/g))
    for (const name of m[1]!.trim().split(/\s+/)) if (name) declaredResolvers.add(name);
  const joins = new Map<string, readonly number[]>([...(options.joins ?? []), ...own]);
  const sites: ClassOverrideSite[] = [];
  const importOf = new Map<string, string>();
  for (const stmt of program.body as Node[])
    if (stmt.type === "ImportDeclaration")
      for (const s of stmt.specifiers as Node[]) importOf.set((s.local as Node).name as string, (stmt.source as Node).value as string);
  // Scopes: parents of every node (a name resolves to its nearest declaration).
  const parent = new Map<Node, Node>();
  const link = (node: Node): void => {
    for (const child of children(node)) {
      parent.set(child, node);
      link(child);
    }
  };
  link(program);
  type Binding =
    | { what: "const"; init: Node | null }
    | { what: "fn"; fn: Node }
    | { what: "import"; from: string }
    | { what: "transport" }
    | { what: "other" }
    | { what: "none" };
  // `const { class: cls, ...rest } = props`: `cls` forwards the prop (a class-like key read off an identifier / member).
  const destructured = (pattern: Node, init: Node | null | undefined, name: string): Binding => {
    const source = init ? unwrap(init) : null;
    if (pattern.type === "ObjectPattern" && source && (source.type === "Identifier" || source.type === "MemberExpression"))
      for (const p of pattern.properties as Node[]) {
        if (p.type !== "Property" || p.computed) continue;
        const key = p.key as Node;
        const keyName = key.type === "Identifier" ? (key.name as string) : (key.value as string);
        const value = unwrap(p.value as Node);
        const local = value.type === "AssignmentPattern" ? unwrap(value.left as Node) : value;
        if (local.type === "Identifier" && local.name === name)
          return CLASS_KEY.test(keyName) && value.type !== "AssignmentPattern" ? { what: "transport" } : { what: "other" };
      }
    return { what: "other" };
  };
  const declaredIn = (stmts: Node[], name: string): Binding | null => {
    for (const raw of stmts) {
      const stmt = raw.type === "ExportNamedDeclaration" && raw.declaration ? (raw.declaration as Node) : raw;
      if (stmt.type === "VariableDeclaration")
        for (const d of stmt.declarations as Node[]) {
          const id = d.id as Node;
          if (id.type === "Identifier" && id.name === name)
            return stmt.kind === "const" ? { what: "const", init: (d.init as Node | null) ?? null } : { what: "other" };
          if (id.type !== "Identifier" && patternNames(id).includes(name))
            return stmt.kind === "const" ? destructured(id, d.init as Node | null, name) : { what: "other" };
        }
      else if ((stmt.type === "FunctionDeclaration" || stmt.type === "ClassDeclaration") && stmt.id && (stmt.id as Node).name === name)
        return stmt.type === "FunctionDeclaration" ? { what: "fn", fn: stmt } : { what: "other" };
      else if (stmt.type === "ImportDeclaration")
        for (const s of stmt.specifiers as Node[]) if ((s.local as Node).name === name) return { what: "import", from: (stmt.source as Node).value as string };
    }
    return null;
  };
  const binding = (name: string, at: Node): Binding => {
    for (let n: Node | undefined = parent.get(at); n; n = parent.get(n)) {
      switch (n.type) {
        case "FunctionDeclaration":
        case "FunctionExpression":
        case "ArrowFunctionExpression":
          for (const p of n.params as Node[]) if (patternNames(p).includes(name)) return { what: "other" };
          if (n.type === "FunctionExpression" && n.id && (n.id as Node).name === name) return { what: "other" };
          break;
        case "CatchClause":
          if (n.param && patternNames(n.param as Node).includes(name)) return { what: "other" };
          break;
        case "ForStatement":
        case "ForInStatement":
        case "ForOfStatement": {
          const decl = (n.type === "ForStatement" ? n.init : n.left) as Node | null;
          if (decl && decl.type === "VariableDeclaration" && (decl.declarations as Node[]).some((d) => patternNames(d.id as Node).includes(name)))
            return { what: "other" };
          break;
        }
        case "BlockStatement":
        case "StaticBlock":
        case "Program": {
          const hit = declaredIn(n.body as Node[], name);
          if (hit) return hit;
          break;
        }
        case "SwitchCase": {
          const hit = declaredIn(n.consequent as Node[], name);
          if (hit) return hit;
          break;
        }
      }
    }
    return { what: "none" };
  };
  const fnResult = (fn: Node): Node | null => {
    const body = fn.body as Node | undefined;
    if (!body) return null;
    if (body.type !== "BlockStatement") return body;
    const stmts = body.body as Node[];
    const last = stmts[stmts.length - 1];
    return last && last.type === "ReturnStatement" ? (last.argument as Node) : null;
  };
  // Member assignments by root name (`S[v] ??= cardVariants(…)` makes `S` hold resolvers).
  const assigned = new Map<string, Node[]>();
  const collect = (node: Node): void => {
    if (node.type === "AssignmentExpression") {
      let left = unwrap(node.left as Node);
      if (left.type === "MemberExpression") {
        while (left.type === "MemberExpression") left = unwrap(left.object as Node);
        if (left.type === "Identifier") assigned.set(left.name as string, [...(assigned.get(left.name as string) ?? []), node.right as Node]);
      }
    }
    for (const child of children(node)) collect(child);
  };
  collect(program);
  // Whether `raw` evaluates to a variant resolver result or function: a chain rooted at a styles-module import, or at a
  // binding made from one (consts, functions returning one, objects whose members are assigned one).
  const resolverValue = (raw: Node | null | undefined, depth = 0): boolean => {
    if (!raw || depth > 8) return false;
    let n = unwrap(raw);
    if (n.type === "AssignmentExpression") return resolverValue(n.right as Node, depth + 1);
    if (n.type === "LogicalExpression") return resolverValue(n.left as Node, depth + 1) && resolverValue(n.right as Node, depth + 1);
    if (n.type === "ConditionalExpression") {
      const nothing = (x: Node) => {
        const v = unwrap(x);
        return (
          (v.type === "Identifier" && v.name === "undefined") ||
          (v.type === "Literal" && v.value === null) ||
          (v.type === "UnaryExpression" && v.operator === "void")
        );
      };
      const c = n.consequent as Node,
        a = n.alternate as Node;
      return (nothing(c) || resolverValue(c, depth + 1)) && (nothing(a) || resolverValue(a, depth + 1)) && !(nothing(c) && nothing(a));
    }
    while (n.type === "CallExpression" || n.type === "MemberExpression") n = unwrap((n.type === "CallExpression" ? n.callee : n.object) as Node);
    if (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression") return resolverValue(fnResult(n), depth + 1);
    if (n.type !== "Identifier") return false;
    if (declaredResolvers.has(n.name as string)) return true;
    const b = binding(n.name as string, n);
    if (b.what === "import") return RESOLVERS.test(b.from);
    if (b.what === "fn") return resolverValue(fnResult(b.fn), depth + 1);
    if (b.what !== "const" || !b.init) return false;
    const init = unwrap(b.init);
    if (init.type === "ObjectExpression" && (init.properties as Node[]).length === 0) {
      const values = assigned.get(n.name as string) ?? [];
      return values.length > 0 && values.every((v) => resolverValue(v, depth + 1));
    }
    if (init.type === "ObjectExpression")
      return (init.properties as Node[]).every((p) => p.type === "Property" && p.kind === "init" && resolverValue(p.value as Node, depth + 1));
    return resolverValue(init, depth + 1);
  };

  // Every call of a resolver chain gets object literals without class-like keys (or nothing).
  const overrideFreeChain = (raw: Node): boolean => {
    let n = unwrap(raw);
    while (n.type === "CallExpression" || n.type === "MemberExpression") {
      // A local helper's own arguments are no override (a class it forwards to a resolver is checked in its body).
      const helper =
        n.type === "CallExpression" && unwrap(n.callee as Node).type === "Identifier" && binding(unwrap(n.callee as Node).name as string, n).what !== "import";
      if (n.type === "CallExpression" && !helper)
        for (const a of n.arguments as Node[]) {
          const v = unwrap(a);
          if (v.type !== "ObjectExpression") return false;
          for (const p of v.properties as Node[]) {
            if (p.type !== "Property" || p.computed) return false;
            const k = p.key as Node;
            if (CLASS_KEY.test(k.type === "Identifier" ? (k.name as string) : String(k.value))) return false;
          }
        }
      n = unwrap((n.type === "CallExpression" ? n.callee : n.object) as Node);
    }
    return true;
  };
  const literalKind = (text: string): Kind => {
    if (text === "") return B;
    if (text !== text.trim() || /\s\s|[^\S ]/.test(text)) return R; // the merge normalises whitespace
    const tokens = text.split(" ");
    if (!tokens.some(known)) return B;
    return merge(text) === text ? U : R;
  };
  const join = (kinds: Kind[]): Kind => {
    let u = 0;
    for (const k of kinds) {
      if (k === R) return R;
      if (k === U) u++;
    }
    return u > 1 ? R : u === 1 ? U : B;
  };
  // `x.class`, `x?.className`, `x.classNames?.slot`, `x.panelClass` on an identifier / member chain: a forwarded prop.
  const transport = (raw: Node): boolean => {
    let n = unwrap(raw);
    let classLike = false;
    while (n.type === "MemberExpression") {
      if (n.computed) {
        const p = unwrap(n.property as Node);
        if (p.type !== "Literal" || typeof p.value !== "string") return false;
        if (CLASS_KEY.test(p.value)) classLike = true;
      } else if (CLASS_KEY.test((n.property as Node).name as string)) classLike = true;
      n = unwrap(n.object as Node);
    }
    return classLike && (n.type === "Identifier" || n.type === "ThisExpression");
  };
  const kind = (raw: Node | null | undefined, depth = 0): Kind => {
    if (!raw) return B;
    if (depth > 12) return R;
    const node = unwrap(raw);
    switch (node.type) {
      case "Literal":
        return typeof node.value === "string" ? literalKind(node.value) : node.value === null || node.value === false ? B : R;
      case "TemplateLiteral": {
        const quasis = (node.quasis as Node[]).map((q) => (q.value as { cooked: string }).cooked ?? "");
        const exprs = node.expressions as Node[];
        if (!exprs.length) return literalKind(quasis[0]!);
        // `${a} ${b}` over resolver results only (never empty, single-spaced): their join.
        if (quasis[0] !== "" || quasis[quasis.length - 1] !== "" || quasis.slice(1, -1).some((q) => q !== " ")) return R;
        return exprs.every((e) => resolverValue(e)) ? join(exprs.map((e) => kind(e, depth + 1))) : R;
      }
      case "Identifier": {
        if (node.name === "undefined") return B;
        const b = binding(node.name as string, node);
        return b.what === "transport" ? U : b.what === "const" && b.init ? kind(b.init, depth + 1) : R;
      }
      case "UnaryExpression":
        return node.operator === "void" ? B : R;
      case "ConditionalExpression":
        return Math.max(kind(node.consequent as Node, depth + 1), kind(node.alternate as Node, depth + 1)) as Kind;
      case "LogicalExpression":
        return node.operator === "&&"
          ? kind(node.right as Node, depth + 1)
          : (Math.max(kind(node.left as Node, depth + 1), kind(node.right as Node, depth + 1)) as Kind);
      case "MemberExpression": {
        if (transport(node)) return U;
        // `TABLE[key]` / `TABLE.key` of a const object literal: any of its values.
        const object = unwrap(node.object as Node);
        if (object.type === "Identifier") {
          const b = binding(object.name as string, object);
          const init = b.what === "const" && b.init ? unwrap(b.init) : null;
          if (init && init.type === "ObjectExpression") {
            let worst: Kind = B;
            for (const p of init.properties as Node[]) {
              if (p.type !== "Property" || p.kind !== "init" || p.method) return R;
              worst = Math.max(worst, kind(p.value as Node, depth + 1)) as Kind;
            }
            return worst;
          }
        }
        return R;
      }
      case "ArrowFunctionExpression":
      case "FunctionExpression":
        // A render-prop class: what it returns.
        return kind(fnResult(node), depth + 1);
      case "ArrayExpression":
        return join((node.elements as (Node | null)[]).map((e) => (e && e.type !== "SpreadElement" ? kind(e, depth + 1) : R)));
      case "CallExpression": {
        const args = node.arguments as Node[];
        if (args.some((a) => a.type === "SpreadElement")) return R;
        // A resolver result: its core (B: `UTILITY_CORE_TOKENS` cores aside, their component module provides) and, when an
        // argument of the chain may carry an override, that override (checked where it is written): U.
        if (resolverValue(node)) return overrideFreeChain(node) ? B : U;
        const callee = unwrap(node.callee as Node);
        if (callee.type !== "Identifier") return R;
        const name = callee.name as string;
        if (name === "cx") return join(args.map((a) => kind(a, depth + 1)));
        const joined = joins.get(name);
        if (joined) return join(joined.map((i) => kind(args[i], depth + 1)));
        // A local function: what it returns (its parameters are unknown).
        const b = binding(name, callee);
        const fn = b.what === "fn" ? b.fn : b.what === "const" && b.init && /Function/.test(unwrap(b.init).type) ? unwrap(b.init) : null;
        return fn ? kind(fnResult(fn), depth + 1) : R;
      }
      default:
        return R;
    }
  };
  // `classNames`: an object literal of per-slot values, each its own override.
  const valueKind = (name: string, node: Node | null | undefined): Kind => {
    const v = node ? unwrap(node) : null;
    if (name === "classNames" && v && v.type === "ObjectExpression") {
      let worst: Kind = B;
      for (const prop of v.properties as Node[]) {
        if (prop.type !== "Property" || prop.kind !== "init" || prop.method || prop.computed) return R;
        worst = Math.max(worst, kind(prop.value as Node)) as Kind;
      }
      return worst;
    }
    return kind(v);
  };
  const keyName = (prop: Node): string | null => {
    const key = prop.key as Node;
    // A computed key: its string literal(s); a key only known at run time is not read as a class (documented limit).
    if (prop.computed) {
      const k = unwrap(key);
      const names = k.type === "ConditionalExpression" ? [unwrap(k.consequent as Node), unwrap(k.alternate as Node)] : [k];
      const hit = names.find((n) => n.type === "Literal" && typeof n.value === "string" && CLASS_KEY.test(n.value));
      return hit ? (hit.value as string) : k.type === "Literal" && typeof k.value === "string" ? k.value : null;
    }
    return key.type === "Identifier" ? (key.name as string) : typeof key.value === "string" ? (key.value as string) : null;
  };
  const tagRoot = (name: Node): string | null => {
    let n = name;
    while (n.type === "JSXMemberExpression") n = n.object as Node;
    return n.type === "JSXIdentifier" ? (n.name as string) : null;
  };
  // Prop joins (BIG-UI-3): the top-level component a node sits in (outermost function: a top-level function declaration or
  // `const X = (props) => …`) with an identifier props parameter.
  const componentOf = (node: Node): { name: string; props: string; fn: Node } | null => {
    let fn: Node | null = null;
    for (let n = parent.get(node); n; n = parent.get(n)) if (/^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type)) fn = n;
    if (!fn) return null;
    const up = parent.get(fn);
    const top = (n: Node | undefined) => !!n && (n.type === "Program" || n.type === "ExportNamedDeclaration");
    let name: string | null = null;
    if (fn.type === "FunctionDeclaration" && fn.id && top(up)) name = (fn.id as Node).name as string;
    else if (up?.type === "VariableDeclarator" && (up.id as Node).type === "Identifier") {
      const decl = parent.get(up);
      if (decl?.kind === "const" && top(parent.get(decl))) name = (up.id as Node).name as string;
    }
    const param = (fn.params as Node[])[0];
    return name && param && param.type === "Identifier" ? { name, props: param.name as string, fn } : null;
  };
  // `const [local, rest] = splitLive(props, keys)` / `splitProps(…)` in the component body: both alias the props.
  const aliases = (comp: { props: string; fn: Node }): Set<string> => {
    const out = new Set([comp.props]);
    const body = comp.fn.body as Node;
    if (body.type !== "BlockStatement") return out;
    for (const stmt of body.body as Node[]) {
      if (stmt.type !== "VariableDeclaration" || stmt.kind !== "const") continue;
      for (const d of stmt.declarations as Node[]) {
        const init = d.init ? unwrap(d.init as Node) : null;
        if ((d.id as Node).type !== "ArrayPattern" || !init || init.type !== "CallExpression") continue;
        const callee = unwrap(init.callee as Node);
        const first = (init.arguments as Node[])[0];
        if (callee.type !== "Identifier" || !/^split(?:Live|Props)$/.test(callee.name as string) || !first || unwrap(first).type !== "Identifier") continue;
        if (unwrap(first).name !== comp.props) continue;
        for (const e of ((d.id as Node).elements as (Node | null)[]) ?? []) if (e && e.type === "Identifier") out.add(e.name as string);
      }
    }
    return out;
  };
  // `local.classNames?.base` → ["classNames", "base"] when rooted at a props alias (a forwarded class prop).
  const propPath = (raw: Node, roots: Set<string>): string[] | null => {
    if (!transport(raw)) return null;
    const path: string[] = [];
    let n = unwrap(raw);
    while (n.type === "MemberExpression") {
      const p = unwrap(n.property as Node);
      if (n.computed && !(p.type === "Literal" && typeof p.value === "string")) return null;
      path.unshift(n.computed ? (p.value as string) : (p.name as string));
      n = unwrap(n.object as Node);
    }
    return n.type === "Identifier" && roots.has(n.name as string) ? path : null;
  };
  // `[a, b].filter(Boolean).join(" ")` / `cx(a, b)`: the joined parts.
  const joinParts = (raw: Node): (Node | null)[] | null => {
    const n = unwrap(raw);
    if (n.type !== "CallExpression") return null;
    const callee = unwrap(n.callee as Node);
    const args = n.arguments as Node[];
    if (callee.type === "Identifier" && callee.name === "cx") return args;
    if (callee.type !== "MemberExpression" || callee.computed || (callee.property as Node).name !== "join") return null;
    const sep = args[0] ? unwrap(args[0]) : null;
    if (args.length !== 1 || !sep || sep.type !== "Literal" || sep.value !== " ") return null;
    const filtered = unwrap(callee.object as Node);
    if (filtered.type !== "CallExpression") return null;
    const f = unwrap(filtered.callee as Node);
    const fa = filtered.arguments as Node[];
    if (f.type !== "MemberExpression" || f.computed || (f.property as Node).name !== "filter" || fa.length !== 1) return null;
    if (unwrap(fa[0]!).type !== "Identifier" || unwrap(fa[0]!).name !== "Boolean") return null;
    const list = unwrap(f.object as Node);
    return list.type === "ArrayExpression" ? (list.elements as (Node | null)[]) : null;
  };
  const conditionalOf = (value: Node | null, at: Node): ClassOverrideSite["conditional"] | undefined => {
    if (!value) return undefined;
    const comp = componentOf(at);
    const parts = comp ? joinParts(value) : null;
    if (!comp || !parts) return undefined;
    const roots = aliases(comp);
    const props: string[][] = [];
    for (const part of parts) {
      if (!part || part.type === "SpreadElement") return undefined;
      if (kind(part) === B) continue;
      const path = propPath(part, roots);
      if (!path) return undefined;
      props.push(path);
    }
    return props.length >= 2 ? { component: comp.name, props } : undefined;
  };
  const site = (at: number, why: string, value: Node | null | undefined): ClassOverrideSite => {
    const node = value ? unwrap(value) : null;
    const conditional = node ? conditionalOf(node, node) : undefined;
    return conditional ? { at, why, conditional } : { at, why };
  };
  // A local component (top-level function of this module) whose props parameter is only read as `p.<key>…` and whose
  // `p.<attr>…` reads are each the whole value of an intrinsic element's `class` / `className`: it renders the value.
  const rendersOnly = (tag: string, attr: string, at: Node): boolean => {
    const b = binding(tag, at);
    const fn = b.what === "fn" ? b.fn : b.what === "const" && b.init && /Function/.test(unwrap(b.init).type) ? unwrap(b.init) : null;
    const param = fn ? (fn.params as Node[])[0] : null;
    if (!fn || !param || param.type !== "Identifier") return false;
    const p = param.name as string;
    let ok = true;
    const visit = (node: Node): void => {
      if (!ok) return;
      if (node.type === "Identifier" && node.name === p && node !== param) {
        const up = parent.get(node)!;
        if (up.type !== "MemberExpression" || up.object !== node) return void (ok = false);
        if (up.computed) return void (ok = false);
        if ((up.property as Node).name !== attr) return;
        let top: Node = up;
        while (parent.get(top)?.type === "MemberExpression" && (parent.get(top)!.object as Node) === top && !parent.get(top)!.computed) top = parent.get(top)!;
        const container = parent.get(top);
        const jsxAttr = container?.type === "JSXExpressionContainer" ? parent.get(container) : undefined;
        const opening = jsxAttr?.type === "JSXAttribute" ? parent.get(jsxAttr) : undefined;
        const attrName = jsxAttr ? ((jsxAttr.name as Node).name as string) : "";
        const tagName = opening?.type === "JSXOpeningElement" ? (opening.name as Node) : null;
        if (!(attrName === "class" || attrName === "className") || !tagName || tagName.type !== "JSXIdentifier" || !/^[a-z]/.test(tagName.name as string))
          ok = false;
        return;
      }
      for (const child of children(node)) visit(child);
    };
    visit(fn.body as Node);
    return ok;
  };
  // Helper bodies a module declares as joins are trusted (their arguments are checked at the call sites).
  const trusted = new Set(own.keys());
  let joinsProps = false,
    forwards = false;
  const walk = (node: Node): void => {
    switch (node.type) {
      case "FunctionDeclaration":
        if (node.id && trusted.has((node.id as Node).name as string)) return;
        break;
      case "VariableDeclarator":
        if ((node.id as Node).type === "Identifier" && trusted.has((node.id as Node).name as string)) return;
        break;
      case "JSXOpeningElement": {
        const root = tagRoot(node.name as Node);
        const intrinsic = (node.name as Node).type === "JSXIdentifier" && /^[a-z]/.test(root ?? "");
        const from = root ? importOf.get(root) : undefined;
        if (intrinsic || (from && RENDERING.test(from))) break;
        let classes: Kind[] = [];
        for (const attr of node.attributes as Node[]) {
          if (attr.type === "JSXSpreadAttribute") continue; // objects are origins where they are written
          const n = attr.name as Node;
          if (n.type !== "JSXIdentifier" || !CLASS_KEY.test(n.name as string)) continue;
          const name = n.name as string;
          const v = attr.value as Node | null;
          const expr = v && v.type === "JSXExpressionContainer" ? (v.expression as Node) : v;
          const k = expr && expr.type === "JSXEmptyExpression" ? B : valueKind(name, expr);
          if (name === "class" || name === "className") classes.push(k);
          // A local component that only renders this prop on intrinsic elements resolves nothing with it.
          if (k === R && root && rendersOnly(root, name, node)) continue;
          if (k === R) sites.push(site(attr.start, `<${root}> ${name}`, expr));
          else if (expr && transport(expr)) forwards = true;
        }
        if (classes.length > 1 && join(classes) === R && !classes.includes(R)) sites.push({ at: node.start, why: `<${root}> class + className` });
        break;
      }
      case "ObjectExpression": {
        const classes: Kind[] = [];
        for (const prop of node.properties as Node[]) {
          if (prop.type !== "Property") continue;
          const name = keyName(prop);
          if (!name || !CLASS_KEY.test(name)) continue;
          let k: Kind;
          if (prop.kind === "get") k = kind(fnResult(prop.value as Node));
          else if (prop.kind !== "init" || prop.method) k = R;
          else k = valueKind(name, prop.value as Node);
          if (name === "class" || name === "className") classes.push(k);
          if (k === R) sites.push(site(prop.start, `{ ${name} }`, prop.kind === "init" && !prop.method ? (prop.value as Node) : null));
          else if (prop.kind === "init" && transport(prop.value as Node)) forwards = true;
        }
        if (classes.length > 1 && join(classes) === R && !classes.includes(R)) sites.push({ at: node.start, why: "{ class, className }" });
        break;
      }
      case "AssignmentExpression": {
        const left = unwrap(node.left as Node);
        if (left.type === "MemberExpression") {
          const p = left.property as Node;
          const name = left.computed ? (p.type === "Literal" ? (p.value as string) : null) : (p.name as string);
          if (name && CLASS_KEY.test(name) && kind(node.right as Node) === R) sites.push({ at: node.start, why: "assignment" });
        }
        break;
      }
      case "CallExpression": {
        const callee = unwrap(node.callee as Node);
        if (callee.type === "Identifier" && CLASS_JOINERS.has(callee.name as string)) joinsProps = true;
        break;
      }
    }
    for (const child of children(node)) walk(child);
  };
  walk(program);
  if (joinsProps && forwards) sites.push({ at: 0, why: "prop merge + forwarded class" });
  // A prop join stays conditional only when its component is referenced by nothing in this module but its declaration
  // and exports (its callers are other modules, checked by `classPropUse`).
  const named = new Set(sites.flatMap((s) => (s.conditional ? [s.conditional.component] : [])));
  if (named.size) {
    const used = new Set<string>();
    const visit = (node: Node): void => {
      if ((node.type === "Identifier" || node.type === "JSXIdentifier") && named.has(node.name as string)) {
        const up = parent.get(node);
        // Not a reference: the declaration, an export of it, an import's or a property's name (`{ X as Y }`, `a.X`, `{ X: 1 }`).
        const declares =
          (up?.type === "FunctionDeclaration" && up.id === node) ||
          (up?.type === "VariableDeclarator" && up.id === node) ||
          up?.type === "ExportSpecifier" ||
          up?.type === "ExportDefaultDeclaration" ||
          (up?.type === "ImportSpecifier" && up.imported === node && up.local !== node) ||
          (up?.type === "MemberExpression" && up.property === node && !up.computed) ||
          (up?.type === "Property" && up.key === node && !up.computed && !up.shorthand) ||
          up?.type === "JSXAttribute";
        if (!declares) used.add(node.name as string);
      }
      // Types name no value.
      if (/^TS/.test(node.type) && !/^TS(?:As|Satisfies|NonNull|Instantiation)Expression$|^TSTypeAssertion$/.test(node.type)) return;
      for (const child of children(node)) visit(child);
    };
    visit(program);
    for (const s of sites) if (s.conditional && used.has(s.conditional.component)) delete s.conditional;
  }
  return sites;
}

/** A module's class-override facts for the prop-join passes (`vite.ts`): own sources, prop joins, exports, imports. */
export interface ClassModuleInfo {
  /** Override sources that are not prop joins: the module imports the merge itself. */
  hard: boolean;
  /** Exported component name → its prop-join sets (`ClassOverrideSite.conditional.props` per site). */
  conditional: Map<string, string[][][]>;
  /** Names the module declares and exports itself. */
  locals: Set<string>;
  /** `export { a as b } from "m"` (imported `*`: `export * as b from`). */
  reexports: { exported: string; from: string; imported: string }[];
  /** `export * from "m"`. */
  stars: string[];
  /** Import declarations: local → source + imported (`default`, `*`). */
  imports: Map<string, { from: string; imported: string }>;
}

/** A module's override facts for the build's cross-module prop-join check (`vite.ts`): sources, exports, imports. */
export function classModuleInfo(code: string, file: string, options: ClassOverrideOptions): ClassModuleInfo {
  const info: ClassModuleInfo = { hard: false, conditional: new Map(), locals: new Set(), reexports: [], stars: [], imports: new Map() };
  let program: Node;
  try {
    program = parseAst(code, { lang: langOf(file) }) as unknown as Node;
  } catch {
    return { ...info, hard: true };
  }
  const exportedAs = new Map<string, string[]>();
  const alias = (local: string, exported: string) => exportedAs.set(local, [...(exportedAs.get(local) ?? []), exported]);
  const nameOf = (n: Node) => (n.type === "Identifier" ? (n.name as string) : String(n.value));
  for (const stmt of program.body as Node[]) {
    if (stmt.type === "ImportDeclaration") {
      if (stmt.importKind === "type") continue;
      for (const s of stmt.specifiers as Node[]) {
        if (s.importKind === "type") continue;
        const imported = s.type === "ImportDefaultSpecifier" ? "default" : s.type === "ImportNamespaceSpecifier" ? "*" : nameOf(s.imported as Node);
        info.imports.set((s.local as Node).name as string, { from: (stmt.source as Node).value as string, imported });
      }
    } else if (stmt.type === "ExportAllDeclaration") {
      if (stmt.exportKind === "type") continue;
      if (stmt.exported) info.reexports.push({ exported: nameOf(stmt.exported as Node), from: (stmt.source as Node).value as string, imported: "*" });
      else info.stars.push((stmt.source as Node).value as string);
    } else if (stmt.type === "ExportNamedDeclaration") {
      if (stmt.exportKind === "type") continue;
      const decl = stmt.declaration as Node | null;
      if (decl) {
        if ((decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") && decl.id)
          alias((decl.id as Node).name as string, (decl.id as Node).name as string);
        else if (decl.type === "VariableDeclaration") for (const d of decl.declarations as Node[]) for (const n of patternNames(d.id as Node)) alias(n, n);
      }
      for (const s of (stmt.specifiers as Node[]) ?? []) {
        if (s.exportKind === "type") continue;
        if (stmt.source)
          info.reexports.push({ exported: nameOf(s.exported as Node), from: (stmt.source as Node).value as string, imported: nameOf(s.local as Node) });
        else alias(nameOf(s.local as Node), nameOf(s.exported as Node));
      }
    } else if (stmt.type === "ExportDefaultDeclaration") {
      const decl = stmt.declaration as Node;
      if ((decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") && decl.id) alias((decl.id as Node).name as string, "default");
      else if (decl.type === "Identifier") alias(decl.name as string, "default");
      else info.locals.add("default");
    }
  }
  for (const [local, names] of exportedAs) {
    // A re-exported import is the imported module's binding: resolved through the import, not a local.
    const imp = info.imports.get(local);
    for (const name of names) {
      if (imp) info.reexports.push({ exported: name, from: imp.from, imported: imp.imported });
      else info.locals.add(name);
    }
  }
  if (!classOverrideCandidate(code)) return info;
  for (const s of classOverrideSites(code, file, options)) {
    if (!s.conditional) {
      info.hard = true;
      continue;
    }
    const names = exportedAs.get(s.conditional.component);
    // Not exported (and not used here): no caller to check, a source as before.
    if (!names) info.hard = true;
    for (const name of names ?? []) info.conditional.set(name, [...(info.conditional.get(name) ?? []), s.conditional.props]);
  }
  return info;
}

/** What `classPropUse` checks per import local: a component's prop-join sets, or a namespace's per-member lookup. */
export type ClassPropTarget = { sets: string[][][] } | { members: (name: string) => string[][][] | null };

/**
 * Which imported prop-join components (`targets`: import local → sets) a module's uses can pass two or more of a join's
 * props: a JSX call site passing two (a value tailwind-merge recognises a token of, a forwarded / unknown value, a
 * spread), or any use as a value (it may be rendered with anything). Keys: the import local (`S`), a namespace member
 * (`UI.S`), or `UI.*` (the namespace itself is used: any of its prop joins).
 */
export function classPropUse(
  code: string,
  file: string,
  targets: ReadonlyMap<string, ClassPropTarget>,
  options: Pick<ClassOverrideOptions, "merge">,
): Set<string> {
  const hits = new Set<string>();
  let program: Node;
  try {
    program = parseAst(code, { lang: langOf(file) }) as unknown as Node;
  } catch {
    for (const local of targets.keys()) hits.add("sets" in targets.get(local)! ? local : local + ".*");
    return hits;
  }
  const known = (token: string) => options.merge(token + " " + token) === token;
  const given = (value: Node | null | undefined): boolean => {
    if (value === undefined) return false;
    if (value === null) return true;
    const v = unwrap(value.type === "JSXExpressionContainer" ? (value.expression as Node) : value);
    if (v.type === "JSXEmptyExpression") return false;
    if (v.type === "Identifier" && v.name === "undefined") return false;
    if (v.type === "Literal") return typeof v.value === "string" ? v.value.split(/\s+/).filter(Boolean).some(known) : v.value !== null && v.value !== false;
    return true;
  };
  const passes = (opening: Node, path: string[]): boolean => {
    const attr = (opening.attributes as Node[]).find(
      (a) => a.type === "JSXAttribute" && (a.name as Node).type === "JSXIdentifier" && (a.name as Node).name === path[0],
    );
    if (!attr) return false;
    if (path.length === 1) return given(attr.value as Node | null);
    const raw = attr.value as Node | null;
    const v = raw && raw.type === "JSXExpressionContainer" ? unwrap(raw.expression as Node) : null;
    if (!v || v.type !== "ObjectExpression" || path.length !== 2) return given(raw);
    for (const p of v.properties as Node[]) {
      if (p.type !== "Property" || p.computed || p.kind !== "init") return true;
      const k = p.key as Node;
      if ((k.type === "Identifier" ? k.name : k.value) === path[1]) return given(p.value as Node);
    }
    return false;
  };
  const callSite = (opening: Node, sets: string[][][]): boolean => {
    if ((opening.attributes as Node[]).some((a) => a.type === "JSXSpreadAttribute")) return true;
    return sets.some((props) => props.filter((path) => passes(opening, path)).length >= 2);
  };
  const parent = new Map<Node, Node>();
  const visit = (node: Node): void => {
    for (const child of children(node)) parent.set(child, node);
    if (node.type === "ImportDeclaration" || node.type === "JSXClosingElement") return;
    // Types name no value (`typeof X` in a type is no use either).
    if (/^TS/.test(node.type) && !/^TS(?:As|Satisfies|NonNull|Instantiation)Expression$|^TSTypeAssertion$/.test(node.type)) return;
    if (node.type === "JSXOpeningElement") {
      const name = node.name as Node;
      if (name.type === "JSXIdentifier") {
        const local = name.name as string;
        const t = targets.get(local);
        if (t && "sets" in t && callSite(node, t.sets)) hits.add(local);
        if (t && !("sets" in t)) hits.add(local + ".*");
      } else if (name.type === "JSXMemberExpression") {
        let root = name;
        while (root.type === "JSXMemberExpression") root = root.object as Node;
        const local = root.type === "JSXIdentifier" ? (root.name as string) : "";
        const t = targets.get(local);
        if (t && "sets" in t)
          hits.add(local); // a part of the component (`<X.Part>`): not followed
        else if (t && (name.object as Node) === root) {
          const member = (name.property as Node).name as string;
          const sets = t.members(member);
          if (sets && callSite(node, sets)) hits.add(`${local}.${member}`);
        } else if (t) hits.add(local + ".*");
      }
      for (const attr of node.attributes as Node[]) visit(attr);
      return;
    }
    if (node.type === "Identifier" && targets.has(node.name as string)) {
      const local = node.name as string;
      const t = targets.get(local)!;
      const up = parent.get(node);
      if ("sets" in t) hits.add(local);
      // `NS.Member` of a namespace: only a prop-join member counts (as a value).
      else if (up?.type === "MemberExpression" && up.object === node && !up.computed) {
        const member = (up.property as Node).name as string;
        if (t.members(member)) hits.add(`${local}.${member}`);
      } else hits.add(local + ".*");
      return;
    }
    for (const child of children(node)) visit(child);
  };
  visit(program);
  return hits;
}
