// VCLS (2026-10-28, user: "button.styles … even though it's not needed on this particular page"): static variant classes.
// A component whose class is a resolver (tailwind-variants style) over a few of its props renders, at a call site where
// each of those props is a compile-time constant (or absent) and no class override is passed, a class the build already
// knows: the compiler evaluates the real resolver once (Node worker, `comptime-eval.ts`) and passes the result as the
// hidden prop `$cls`. When every instance a page can create carries it, the page needs no resolver code and no variant
// table: in production browser builds the component's resolver import becomes a lazy registry read, and only modules
// that may create an instance without `$cls` import the resolver's registration.
//
// Declaration (a line comment in the component's module; `@rivetjs/ui` `button.tsx`):
//
//   // @rivet-class ButtonRoot(fullWidth,isIconOnly,size,variant) buttonVariants with(ButtonGroupContext)
//
// = "ButtonRoot's class is `buttonVariants({ fullWidth, isIconOnly, size, variant })` of those props (absent ones
// undefined) when no `class` / `className` override is passed; when `$cls` is a string the component uses it instead
// of calling `buttonVariants`, unless a value of one of the `with(…)` contexts is present (then it calls the resolver)".
// `buttonVariants` is a named import of the component module (its definition module = the evaluated callee); the
// component guarantees the contract (ui `tests/static-class{,.server}.test.tsx` check it for every declared family).
//
// Soundness (the build's derived walk, `vite.ts` `derivedWalk`, builds only): a module is flagged for a family (it
// imports the family's registration, `rivet-class-reg:<key>`) when it can create an instance without `$cls` or provide
// a `with` context:
// - an unproven JSX call site of the component (resolved by the walk: `BoundaryFacts.callers`): a spread, a `class` /
//   `className` attribute, a declared prop that is not a constant, or a site the parse below cannot match to the walk's
//   call (count / enclosing tags per tag differ);
// - a value use of a binding that names the component, a compound of it or one of its parts (`const B = Button`,
//   `render={Button}`, `Button(props)`, `Button.Root` read), a namespace binding whose module exports it (read as a
//   value), a dynamic import of a module exporting it, a non-literal `import()`, JSX outside every component (facts
//   `hidden`) or a module this parse cannot read;
// - an import of a `with` context binding (resolved to its origin; an unresolved import of the same name too);
// - (vite.ts, transform) any module of the browser build the walk did not see that lives in the family's package or
//   names the package (`@rivetjs/ui`): code the proof cannot read.
// A flagged module evaluates the registration before its own body, so the resolver is registered before any instance
// without `$cls` can run (instances need the component value, which only flagged code or proven sites hold). A family
// whose own module is flagged, or with no current or previously proven site, keeps today's static import (no lazy read, no `$cls`).
// Server builds and dev keep the static import; `$cls` is passed on both targets (same text: same ids and keys).
//
// Scope (`ClassPlanInput.scope`, default "build"; perf only, soundness above holds in both): in a multi-entry build a
// module leaving some entries re-lays the chunks it shared with modules that stay (measured: per-page proof on the
// frame gate, Button-only frame −842 B br, eight mixed frames +274…+641 B br). So by default a family is active only
// when no module needs its registration; and when a module the browser loads (import closure of the interactive
// boundaries) whose exports are used still imports what the definition imports (its resolver runtime, ui `tv`), the
// effect module keeps those bindings reachable from the declaring module (`keep`): only the table leaves, every other
// module keeps its chunk (dropping the shared runtime split `cx` off `tv` on starter-ui: +1 file, +58 B br).

import { parseAst, parseSync } from "vite";
import type { ModuleFacts } from "./index.ts";

/** The hidden prop a proven call site passes. */
export const CLASS_PROP = "$cls";
/** Specifier prefixes of the virtual modules (vite.ts resolves them to `\0` ids). */
export const CLASS_REGISTRY = "rivet-class-registry";
export const CLASS_REG = "rivet-class-reg:";
export const CLASS_FX = "rivet-class-fx:";

/** One `@rivet-class` declaration. */
export interface ClassFamily {
  /** The component (a top-level component of the declaring module). */
  component: string;
  /** Props whose values pick the class. */
  keys: string[];
  /** The resolver binding (a named import of the declaring module). */
  resolver: string;
  /** Context bindings (of the declaring module) whose value makes the component call the resolver. */
  with: string[];
}

const PRAGMA = /^[ \t]*\/\/[ \t]*@rivet-class[ \t]+([A-Za-z_$][\w$]*)\(([^)]*)\)[ \t]+([A-Za-z_$][\w$]*)(?:[ \t]+with\(([^)]*)\))?[ \t]*$/gm;
const list = (text: string | undefined): string[] =>
  (text ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** The `@rivet-class` declarations of a module source (none: empty). */
export function classFamilies(source: string): ClassFamily[] {
  if (!source.includes("@rivet-class")) return [];
  const out: ClassFamily[] = [];
  for (const m of source.matchAll(PRAGMA)) out.push({ component: m[1]!, keys: list(m[2]), resolver: m[3]!, with: list(m[4]) });
  return out;
}

type Node = { type: string; start: number; end: number; [key: string]: unknown };
export type Literal = string | number | boolean | null;
/** An attribute whose value is not a compile-time constant. */
export const DYNAMIC: unique symbol = Symbol("dynamic");

/** One component-tag JSX element of a module (`<Button …>`, `<UI.Button>`, `<Button.Root>`). */
export interface ClassElement {
  /** The top-level component whose body holds it (`ModuleFacts.boundaries` key), null outside one. */
  component: string | null;
  /** The tag as written (`ComponentBoundaryFacts.calls[].tag`). */
  tag: string;
  /** Index among the elements with this tag in `component`, source order (= among its calls with that tag). */
  ordinal: number;
  /** Component tags enclosing it in the component's JSX, innermost first (`calls[].around`). */
  around: string[];
  /** Attribute → constant value (`DYNAMIC`: anything else); a repeated name → `DYNAMIC`. */
  attrs: Map<string, Literal | typeof DYNAMIC>;
  spread: boolean;
  /** Offset right after the tag name (where `$cls` goes). */
  insert: number;
}

/** A parsed module: its component elements and what it reads as values. */
export interface ClassModule {
  elements: ClassElement[];
  /** Identifier names read as values (not JSX tags, declarations, keys, labels or types). */
  values: Set<string>;
  /** An `import(x)` whose specifier is not a string literal. */
  dynamicAny: boolean;
}

/**
 * Parse a module for the proof (null: unparsable). `compounds`: top-level declarations whose initializer is not read
 * (`const Button = Object.assign(ButtonRoot, { Root: ButtonRoot })`, facts `compounds`: uses of the compound count).
 */
export function classModule(source: string, filename: string, compounds: ReadonlySet<string> = new Set()): ClassModule | null {
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
  const elements: ClassElement[] = [];
  const values = new Set<string>();
  let dynamicAny = false;
  const ordinals = new Map<string, number>();
  const parents: Node[] = [];
  const visit = (node: Node, component: string | null): void => {
    switch (node.type) {
      case "ImportDeclaration":
      case "LabeledStatement":
      case "BreakStatement":
      case "ContinueStatement":
        if (node.type === "LabeledStatement") walkChild(node.body as Node, node, component);
        return;
      case "ExportNamedDeclaration":
        // `export { a }` / `export { a } from`: no use; a declaration: its body.
        if (node.declaration) walkChild(node.declaration as Node, node, component);
        return;
      case "ExportAllDeclaration":
        return;
      case "ImportExpression": {
        const source = node.source as Node;
        if (!(source.type === "Literal" && typeof source.value === "string") && !(source.type === "TemplateLiteral" && !(source.expressions as Node[]).length))
          dynamicAny = true;
        walkChild(source, node, component);
        return;
      }
      case "Identifier":
        if (reference(node, parents)) values.add(node.name as string);
        return;
      case "JSXElement": {
        const open = node.openingElement as Node;
        const tag = jsxName(open.name as Node);
        if (tag !== null && (tag.includes(".") || /^[A-Z]/.test(tag))) {
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
          const attrs = new Map<string, Literal | typeof DYNAMIC>();
          let spread = false;
          for (const attribute of open.attributes as Node[]) {
            if (attribute.type !== "JSXAttribute") {
              spread = true;
              continue;
            }
            const nameNode = attribute.name as Node;
            const name = nameNode.type === "JSXIdentifier" ? (nameNode.name as string) : null;
            if (name === null) continue;
            const value = attribute.value as Node | null;
            const v: Literal | typeof DYNAMIC = attrs.has(name)
              ? DYNAMIC
              : value === null
                ? true
                : value.type === "Literal"
                  ? literal(value)
                  : value.type === "JSXExpressionContainer"
                    ? literal(value.expression as Node)
                    : DYNAMIC;
            attrs.set(name, v);
          }
          elements.push({ component, tag, ordinal, around, attrs, spread, insert: (open.name as Node).end });
        }
        break;
      }
    }
    if (node.type.startsWith("TS") && !TS_EXPRESSIONS.has(node.type)) return; // type positions
    parents.push(node);
    for (const key in node) {
      if (key === "type" || key === "start" || key === "end") continue;
      if (TS_EXPRESSIONS.has(node.type) && key !== "expression") continue;
      if (key === "typeAnnotation" || key === "returnType" || key === "typeParameters" || key === "typeArguments" || key === "superTypeArguments") continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) if (item && typeof item === "object" && typeof item.type === "string") visit(item, component);
      } else if (value && typeof value === "object" && typeof (value as Node).type === "string") visit(value as Node, component);
    }
    parents.pop();
  };
  const walkChild = (child: Node, parent: Node, component: string | null) => {
    parents.push(parent);
    visit(child, component);
    parents.pop();
  };
  for (const statement of program.body as Node[]) {
    const declaration = statement.type === "ExportNamedDeclaration" && statement.declaration ? (statement.declaration as Node) : statement;
    if (declaration.type === "VariableDeclaration") {
      const decls = declaration.declarations as Node[];
      const id = decls.length === 1 ? (decls[0]!.id as Node) : null;
      if (id?.type === "Identifier" && compounds.has(id.name as string)) continue;
    }
    visit(statement, componentOf(statement));
  }
  return { elements, values, dynamicAny };
}

const TS_EXPRESSIONS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "TSInstantiationExpression", "TSTypeAssertion"]);

/** A constant JSX attribute value (string / number / boolean / null literal, a template without `${}`), else DYNAMIC. */
function literal(node: Node): Literal | typeof DYNAMIC {
  if (node.type === "Literal") {
    const v = node.value;
    return typeof v === "string" || typeof v === "boolean" || v === null || (typeof v === "number" && Number.isFinite(v)) ? (v as Literal) : DYNAMIC;
  }
  if (node.type === "TemplateLiteral") return (node.expressions as Node[]).length ? DYNAMIC : ((node.quasis as Node[])[0]!.value as { cooked: string }).cooked;
  if (node.type === "ParenthesizedExpression") return literal(node.expression as Node);
  return DYNAMIC;
}

/** An identifier read as a value (conservative: anything not clearly a declaration, key, member name or label). */
function reference(node: Node, parents: Node[]): boolean {
  const parent = parents[parents.length - 1];
  if (!parent) return true;
  switch (parent.type) {
    case "VariableDeclarator":
      return parent.init === node;
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return parent.body === node;
    case "ClassDeclaration":
    case "ClassExpression":
      return parent.superClass === node;
    case "CatchClause":
      return false;
    case "ArrayPattern":
    case "RestElement":
      return false;
    case "AssignmentPattern":
      return parent.right === node;
    case "Property":
      if (parents[parents.length - 2]?.type === "ObjectPattern") return false;
      return parent.value === node || (parent.computed === true && parent.key === node);
    case "MemberExpression":
      return parent.object === node || parent.computed === true;
    case "MethodDefinition":
    case "PropertyDefinition":
    case "AccessorProperty":
      return parent.value === node || (parent.computed === true && parent.key === node);
    default:
      return true;
  }
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

/** The component a top-level statement declares (`ModuleFacts.boundaries` key), or null (as static-motion.ts). */
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

/** The declared props of a proven element (absent ones left out), or null (spread, override, a non-constant value). */
export function provenProps(element: ClassElement, keys: readonly string[]): Record<string, Literal> | null {
  if (element.spread || element.attrs.has("class") || element.attrs.has("className") || element.attrs.has(CLASS_PROP)) return null;
  const out: Record<string, Literal> = {};
  for (const key of keys) {
    if (!element.attrs.has(key)) continue;
    const v = element.attrs.get(key)!;
    if (v === DYNAMIC) return null;
    out[key] = v;
  }
  return out;
}

/** The source with `$cls={"…"}` inserted after each proven element's tag name (same line count). */
export function applyClassProps(source: string, edits: readonly { at: number; cls: string }[]): string {
  const sorted = [...edits].sort((a, b) => a.at - b.at);
  let out = "",
    at = 0;
  for (const edit of sorted) {
    out += source.slice(at, edit.at) + " " + CLASS_PROP + "={" + JSON.stringify(edit.cls) + "}";
    at = edit.at;
  }
  return out + source.slice(at);
}

/**
 * Browser output of a declaring module: each resolver import (`import { buttonVariants } from "…"`) becomes the
 * definition's side-effect imports (`rivet-class-fx:<key>`: its stylesheet) + a lazy registry read. Same line count.
 * Null when no such import is found.
 */
export function lazyResolvers(code: string, resolvers: ReadonlyMap<string, string>, registryId = CLASS_REGISTRY): string | null {
  if (!resolvers.size) return null;
  let program: Node;
  try {
    program = parseAst(code, { lang: "js" } as never) as unknown as Node;
  } catch {
    return null;
  }
  const edits: [number, number, string][] = [];
  let registry = false;
  for (const statement of program.body as Node[]) {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue;
    const specifiers = statement.specifiers as Node[];
    const hits = specifiers.filter((s) => s.type === "ImportSpecifier" && s.importKind !== "type" && resolvers.has((s.local as { name: string }).name));
    if (!hits.length) continue;
    const rest = specifiers.filter((s) => !hits.includes(s));
    const from = JSON.stringify((statement.source as { value: string }).value);
    let text = "";
    if (rest.length) {
      const named = rest.filter((s) => s.type === "ImportSpecifier").map((s) => code.slice(s.start, s.end));
      const head = rest.filter((s) => s.type !== "ImportSpecifier").map((s) => code.slice(s.start, s.end));
      const clause = [...head, ...(named.length ? ["{ " + named.join(", ") + " }"] : [])].join(", ");
      text += `import ${clause} from ${from};`;
    }
    for (const hit of hits) {
      const local = (hit.local as { name: string }).name;
      const key = resolvers.get(local)!;
      text += `import ${JSON.stringify(CLASS_FX + key)};const ${local} = /* @__PURE__ */ __rvClassLazy(${JSON.stringify(key)});`;
    }
    registry = true;
    const lines = (code.slice(statement.start, statement.end).match(/\n/g) ?? []).length;
    edits.push([statement.start, statement.end, text + "\n".repeat(lines)]);
  }
  if (!edits.length) return null;
  let out = "",
    at = 0;
  for (const [start, end, text] of edits.sort((a, b) => a[0] - b[0])) {
    out += code.slice(at, start) + text;
    at = end;
  }
  out += code.slice(at);
  return registry ? `import { lazy as __rvClassLazy } from ${JSON.stringify(registryId)};` + out : out;
}

/** The registry module: resolvers by key; a lazy read calls the registered one (unregistered: a TypeError, loud). */
export const REGISTRY_SOURCE =
  "const resolvers = new Map();\n" +
  "export const register = (key, fn) => void resolvers.set(key, fn);\n" +
  "export const lazy = (key) => (...args) => resolvers.get(key)(...args);\n";

/** `rivet-class-fx:<key>`: the definition's bare imports (its stylesheet) and, when shared, its runtime kept reachable. */
export function effectSource(bare: readonly string[], keep: readonly { file: string; name: string }[]): string {
  let code = bare.map((spec) => `import ${JSON.stringify(spec)};\n`).join("");
  if (!keep.length) return code;
  code += `import { register as __rvClassKeep } from ${JSON.stringify(CLASS_REGISTRY)};\n`;
  keep.forEach(({ file, name }, i) => {
    code += name === "*" ? `import * as __k${i} from ${JSON.stringify(file)};\n` : `import { ${name} as __k${i} } from ${JSON.stringify(file)};\n`;
  });
  return code + `__rvClassKeep("", [${keep.map((_, i) => "__k" + i).join(", ")}]);\n`;
}

/** A family's registration module: imports the real resolver and registers it. */
export const registrationSource = (key: string, file: string, name: string, registryId = CLASS_REGISTRY): string =>
  `import { register } from ${JSON.stringify(registryId)};\nimport { ${name} as resolver } from ${JSON.stringify(file)};\nregister(${JSON.stringify(key)}, resolver);\n`;

/**
 * The side-effect imports of a definition module (its stylesheet): bare `import "…"` specifiers, and the same of the
 * modules it re-exports from (`export *` / `export { … } from`), which `follow` names. Named imports are not followed:
 * a definition's own imports (its `tv`) are pure.
 */
export function sideEffectImports(code: string, filename: string): { bare: string[]; follow: string[] } {
  const bare: string[] = [],
    follow: string[] = [];
  let program: Node;
  try {
    const parsed = parseSync(filename, code, {
      lang: /\.tsx$/.test(filename) ? "tsx" : /\.ts$/.test(filename) ? "ts" : /\.jsx$/.test(filename) ? "jsx" : "js",
    });
    program = parsed.program as unknown as Node;
  } catch {
    return { bare, follow };
  }
  for (const statement of program.body as Node[]) {
    const source = (statement.source as { value?: string } | null | undefined)?.value;
    if (typeof source !== "string") continue;
    if (statement.type === "ImportDeclaration" && !(statement.specifiers as Node[]).length && statement.importKind !== "type") bare.push(source);
    else if ((statement.type === "ExportAllDeclaration" || statement.type === "ExportNamedDeclaration") && statement.exportKind !== "type") follow.push(source);
  }
  return { bare, follow };
}

export interface ClassPlanInput {
  /** Walked module texts (resume modules and plain pass-through modules). */
  texts: ReadonlyMap<string, string>;
  facts: ReadonlyMap<string, ModuleFacts>;
  /** Import specifier of `file` → walked file (null: unresolved or not walked). */
  target(file: string, spec: string): string | null;
  resolveTag(file: string, tag: string): string | null;
  namespaceOf(file: string, name: string): string | null;
  exportsComponent(file: string, id: string): boolean;
  /** Component key (`file?Name`) → its resolved JSX call sites. */
  callers: ReadonlyMap<string, readonly { caller: string; index: number }[]>;
  /** The definition file a declaring module's resolver import names (resolved, may be outside the walk). */
  definition(file: string, spec: string): Promise<string | null>;
  /** `name` of `file` applied to `props` at build time; null: not evaluable / not a string. */
  evaluate(file: string, name: string, props: Record<string, Literal>): Promise<string | null>;
  /** Stable key of a definition export (root-relative). */
  keyOf(file: string, name: string, declaring: string): string;
  /** Modules introduced by a preceding rewrite have no original chunk layout to preserve. */
  introduced?: ReadonlySet<string>;
  /** Families proven on the graph before a preceding rewrite removed their callers; flags still veto activation. */
  previouslyActive?: ReadonlySet<string>;
  /**
   * Scope of the proof (default `"build"`): a family is active only when no walked module needs its registration (a
   * runtime the definition shares with shipped code is kept reachable: `PlannedFamily.keep`), so no other module's
   * chunk changes. `"page"`: active with any proven site; in a
   * multi-entry build the definition and the resolver then leave the chunks they shared (measured on the frame
   * gate: the one Button-only frame −842 B br, eight mixed frames +274…+641 B br, one or two extra files each).
   */
  scope?: "build" | "page";
  /** Interactive boundaries of a module (`BoundaryFacts.boundaries`): modules reaching the browser = their import closure. */
  boundaries?(file: string): readonly string[];
  /** Import edges of a walked module (resolved walked targets). */
  edges?(file: string): Iterable<string>;
  trace?: (...args: unknown[]) => void;
}

/** An active family: its declaring module reads the resolver lazily in the browser build. */
export interface PlannedFamily {
  key: string;
  /** Declaring module and component. */
  file: string;
  component: string;
  resolver: string;
  definition: { file: string; name: string };
  /** Proven call sites. */
  proven: number;
  /**
   * Build scope, the definition's runtime still shipped by another module: its imports (`file`, exported `name`) the
   * browser build keeps reachable from the declaring module (`rivet-class-fx:<key>` registers them), so only the
   * definition's own table leaves and every other module keeps its chunk. Empty: the runtime leaves with it.
   */
  keep: { file: string; name: string }[];
}

export interface ClassPlan {
  families: PlannedFamily[];
  /** Rewritten module texts (`$cls` at proven sites). */
  texts: Map<string, string>;
  /** Module → keys of the registrations it imports (browser build). */
  flags: Map<string, Set<string>>;
}

/** The build's static-class plan over the walked program (see the header). */
export async function classPlan(input: ClassPlanInput): Promise<ClassPlan> {
  const { texts, facts, target, resolveTag, namespaceOf, exportsComponent, callers, trace } = input;
  const plan: ClassPlan = { families: [], texts: new Map(), flags: new Map() };
  // Origin of a binding (`file#local`; `?spec#name` through an import the walk did not resolve).
  const origin = (file: string, name: string, depth = 0): string | null => {
    const own = facts.get(file);
    if (!own || depth > 32) return null;
    const imported = own.imports.get(name);
    if (!imported) return file + "#" + name;
    const to = target(file, imported.from);
    return to ? exportOrigin(to, imported.imported, depth + 1) : "?" + imported.imported;
  };
  const exportOrigin = (file: string, name: string, depth: number): string | null => {
    const own = facts.get(file);
    if (!own || depth > 32) return null;
    const direct = own.exports.get(name);
    if (direct !== undefined) return origin(file, direct, depth + 1);
    const re = own.reexports.get(name);
    if (re) {
      const to = target(file, re.from);
      return to ? exportOrigin(to, re.imported, depth + 1) : "?" + re.imported;
    }
    for (const from of own.stars) {
      const to = target(file, from);
      const hit = to ? exportOrigin(to, name, depth + 1) : null;
      if (hit) return hit;
    }
    return null;
  };
  type Fam = { family: ClassFamily; id: string; file: string; key: string; definition: { file: string; name: string }; contexts: string[] };
  const fams: Fam[] = [];
  for (const [file, text] of texts) {
    if (!/\.[jt]sx$/.test(file)) continue;
    for (const family of classFamilies(text)) {
      const own = facts.get(file);
      const imported = own?.imports.get(family.resolver);
      if (!own?.boundaries.has(family.component) || !imported) {
        trace?.("declaration", file, family.component, "no component / resolver import");
        continue;
      }
      const def = await input.definition(file, imported.from);
      const contexts = family.with.map((name) => origin(file, name));
      if (!def || contexts.some((c) => c === null)) {
        trace?.("declaration", file, family.component, "unresolved");
        continue;
      }
      fams.push({
        family,
        id: file + "?" + family.component,
        file,
        key: input.keyOf(def, imported.imported, file),
        definition: { file: def, name: imported.imported },
        contexts: contexts as string[],
      });
    }
  }
  if (!fams.length) return plan;
  const flagged = new Map<string, Set<number>>();
  const flag = (file: string, index: number, why: string) => {
    let set = flagged.get(file);
    if (!set) flagged.set(file, (set = new Set()));
    if (!set.has(index)) trace?.("flag", fams[index]!.family.component, file, why);
    set.add(index);
  };
  const parsed = new Map<string, ClassModule | null>();
  const parse = (file: string): ClassModule | null => {
    if (!parsed.has(file)) parsed.set(file, classModule(texts.get(file)!, file, new Set(facts.get(file)?.compounds?.keys() ?? [])));
    return parsed.get(file)!;
  };
  // Per module: value uses, namespaces, dynamic imports, hidden JSX, context imports.
  for (const [file] of texts) {
    const own = facts.get(file);
    if (!own) continue;
    const reaching = new Map<string, Set<number>>();
    const reach = (local: string, index: number) => {
      let set = reaching.get(local);
      if (!set) reaching.set(local, (set = new Set()));
      set.add(index);
    };
    const locals = new Set([...own.imports.keys(), ...own.boundaries.keys(), ...(own.compounds?.keys() ?? []), ...(own.refs?.namespaces.keys() ?? [])]);
    for (const local of locals) {
      const id = resolveTag(file, local);
      const ns = id === null ? namespaceOf(file, local) : null;
      fams.forEach((f, index) => {
        if (id === f.id || (ns !== null && exportsComponent(ns, f.id))) reach(local, index);
      });
    }
    for (const spec of own.dynamics) {
      const to = target(file, spec);
      if (to) fams.forEach((f, index) => exportsComponent(to, f.id) && flag(file, index, "dynamic import " + spec));
    }
    for (const tag of own.hidden ?? []) {
      if (tag === "*") {
        for (const set of reaching.values()) for (const index of set) flag(file, index, "unparsable module");
        continue;
      }
      const id = resolveTag(file, tag);
      fams.forEach((f, index) => id === f.id && flag(file, index, "JSX outside a component"));
    }
    for (const [local, imported] of own.imports) {
      const o = origin(file, local);
      fams.forEach((f, index) => {
        if (file === f.file) return;
        if (f.contexts.includes(o!) || (o?.startsWith("?") && f.contexts.some((c) => c.slice(c.lastIndexOf("#") + 1) === imported.imported)))
          flag(file, index, "imports context " + local);
      });
    }
    if (!reaching.size) continue;
    const mod = parse(file);
    if (!mod) {
      for (const set of reaching.values()) for (const index of set) flag(file, index, "unparsable");
      continue;
    }
    if (mod.dynamicAny) for (const set of reaching.values()) for (const index of set) flag(file, index, "non-literal import()");
    for (const name of mod.values) for (const index of reaching.get(name) ?? []) flag(file, index, "value use of " + name);
  }
  // JSX call sites: proven (constant declared props, no override) or flagged.
  const edits = new Map<string, { at: number; cls: string; index: number }[]>();
  const proven = new Array<number>(fams.length).fill(0);
  // Elements a proven site matched; every other element naming a family (JSX in a helper function or at module level:
  // no call site of the walk records it) flags its module below.
  const matched = new Set<ClassElement>();
  for (let index = 0; index < fams.length; index++) {
    const f = fams[index]!;
    for (const site of callers.get(f.id) ?? []) {
      const at = site.caller.lastIndexOf("?");
      const file = site.caller.slice(0, at);
      const component = site.caller.slice(at + 1);
      const calls = facts.get(file)?.boundaries.get(component)?.calls;
      const call = calls?.[site.index];
      const mod = texts.has(file) ? parse(file) : null;
      if (!calls || !call || !mod) {
        flag(file, index, "site without source");
        continue;
      }
      const same = calls.flatMap((c, i) => (c.tag === call.tag ? [i] : []));
      const elements = mod.elements.filter((e) => e.component === component && e.tag === call.tag);
      const element = same.length === elements.length ? elements[same.indexOf(site.index)] : undefined;
      if (!element || element.around.join("\0") !== call.around.join("\0")) {
        flag(file, index, "site not matched " + component + ":" + site.index);
        continue;
      }
      const props = provenProps(element, f.family.keys);
      const cls = props && (await input.evaluate(f.definition.file, f.definition.name, props));
      if (typeof cls !== "string") {
        flag(file, index, props ? "not evaluable" : "unproven props " + component + ":" + site.index);
        continue;
      }
      let list = edits.get(file);
      if (!list) edits.set(file, (list = []));
      list.push({ at: element.insert, cls, index });
      matched.add(element);
      proven[index]!++;
    }
  }
  for (const [file, mod] of parsed) {
    if (!mod) continue;
    for (const element of mod.elements) {
      if (matched.has(element)) continue;
      const id = resolveTag(file, element.tag);
      fams.forEach((f, index) => id === f.id && flag(file, index, "element without a proven site " + element.tag));
    }
  }
  const active = new Set<number>();
  const needed = (index: number) => [...flagged.values()].some((set) => set.has(index));
  // Build scope: the definition's own imports (the resolver runtime, ui's `tv`) must leave the build with it. When another
  // walked module still imports one of them (a sibling definition `chip.styles.ts`), the runtime stays and only the reach
  // of the modules around it changes: measured on starter-ui, `cx` split off `tv` into its own chunk (+1 file, +58 B br
  // over today) for a 94 B table. Any binding of the dependency module, a namespace or a re-export of it counts.
  // The definition module (through re-exports) and the bindings it imports from walked modules.
  const definitionHome = (index: number): string | null => {
    const def = fams[index]!.definition;
    const at = exportOrigin(def.file, def.name, 0);
    return at && !at.startsWith("?") ? at.slice(0, at.lastIndexOf("#")) : null;
  };
  const runtimeImports = (index: number): { file: string; name: string }[] => {
    const home = definitionHome(index);
    const out: { file: string; name: string }[] = [];
    for (const imported of (home ? facts.get(home)?.imports.values() : undefined) ?? []) {
      const to = target(home!, imported.from);
      if (to) out.push({ file: to, name: imported.imported });
    }
    return out;
  };
  let used: Set<string> | null = null,
    shipped: Set<string> | null = null;
  const runtimeShared = (index: number): string | null => {
    const home = definitionHome(index);
    const own = home ? facts.get(home) : undefined;
    if (!home || !own) return null;
    const deps = new Set<string>(),
      depFiles = new Set<string>();
    for (const [local, imported] of own.imports) {
      const to = target(home, imported.from);
      if (!to) continue;
      depFiles.add(to);
      const o = origin(home, local);
      if (o) deps.add(o);
    }
    if (!depFiles.size) return null;
    // Bindings some walked module imports (through barrels to their origin) and namespace-imported modules: a module
    // none of whose exports is imported is in the walk only through a barrel (ui `compose.tsx` re-exports the styles
    // index, so every definition is walked) and is tree-shaken from the bundle.
    if (!used) {
      // Modules the browser build loads: the import closure of the modules with interactive boundaries (a static
      // route's modules, docs home `Card` / `Chip`, are in the walk but ship nothing). Without the hooks: every module.
      shipped = new Set();
      if (input.boundaries && input.edges) {
        const queue = [...facts.keys()].filter((file) => input.boundaries!(file).length);
        for (let file; (file = queue.pop()) !== undefined;)
          if (!shipped.has(file)) {
            shipped.add(file);
            for (const to of input.edges(file)) queue.push(to);
          }
      } else for (const file of facts.keys()) shipped.add(file);
      used = new Set();
      for (const [file, mod] of facts) {
        if (!shipped.has(file)) continue;
        for (const [local, imported] of mod.imports) {
          if (imported.imported === "*") {
            const to = target(file, imported.from);
            if (to) used.add("*" + to);
          } else {
            const o = origin(file, local);
            if (o) used.add(o);
          }
        }
      }
    }
    const live = (file: string, mod: ModuleFacts): boolean =>
      used!.has("*" + file) || !mod.exports.size || [...mod.exports.values()].some((local) => used!.has(origin(file, local) ?? ""));
    for (const [file, mod] of facts) {
      if (file === home || !shipped!.has(file) || !live(file, mod)) continue;
      for (const [local, imported] of mod.imports) {
        const to = target(file, imported.from);
        if (!to || !depFiles.has(to)) continue;
        if (imported.imported === "*" || imported.imported === "default") return file;
        const o = origin(file, local);
        if (o && deps.has(o)) return file;
      }
      for (const re of mod.reexports.values()) {
        const to = target(file, re.from);
        if (to && depFiles.has(to) && (re.imported === "*" || deps.has(exportOrigin(to, re.imported, 0) ?? ""))) return file;
      }
      for (const from of mod.stars) {
        const to = target(file, from);
        if (to && depFiles.has(to)) return file;
      }
    }
    return null;
  };
  fams.forEach((f, index) => {
    if (!proven[index] && !input.previouslyActive?.has(f.id)) trace?.("inactive", f.family.component, "no proven site");
    else if (flagged.get(f.file)?.has(index)) trace?.("inactive", f.family.component, "own module flagged");
    else if (input.scope !== "page" && needed(index)) trace?.("inactive", f.family.component, "registration needed (scope build)");
    else active.add(index);
  });
  for (const index of active) {
    const f = fams[index]!;
    const shared = input.scope === "page" || input.introduced?.has(f.file) ? null : runtimeShared(index);
    const keep = shared ? runtimeImports(index) : [];
    if (shared) trace?.("keep runtime", f.family.component, "shared with", shared, keep);
    plan.families.push({
      key: f.key,
      file: f.file,
      component: f.family.component,
      resolver: f.family.resolver,
      definition: f.definition,
      proven: proven[index]!,
      keep,
    });
  }
  for (const [file, list] of edits) {
    const kept = list.filter((e) => active.has(e.index));
    if (kept.length) plan.texts.set(file, applyClassProps(texts.get(file)!, kept));
  }
  for (const [file, set] of flagged) {
    const keys = new Set([...set].filter((i) => active.has(i)).map((i) => fams[i]!.key));
    if (keys.size) plan.flags.set(file, keys);
  }
  return plan;
}
