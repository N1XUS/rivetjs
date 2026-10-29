// Build-time evaluation (COMPTIME, user-approved design 2026-10-25): calls of allowlisted third-party functions or
// `@comptime`-annotated own functions whose arguments are compile-time constants run at build time in Node, with the
// real modules (`comptime-eval.ts` worker), and the call becomes its result:
// - `value` functions (tailwind-variants `cn` / `cx`, `@comptime` own helpers): a data result → a literal.
// - `tv` functions (tailwind-variants `tv`, `@comptime tv` wrappers such as `@rivetjs/ui`'s): the resolver becomes a
//   lookup table over its finite input domain (proven for every enumerated combination, `buildTvTable`), served by
//   `@rivetjs/runtime/comptime-tv`. Call sites that cannot pass a `class` / `className` override (no argument, or an
//   object literal without those keys / spreads) read the table directly (`tvCore` / `tvSlot`, or a literal when their
//   arguments are constant); every other use keeps the full resolver (`tvFull`), whose merge the build's merge module
//   registers; only modules with such a use import it, so only pages reaching one load tailwind-merge.
// - defer mode (a `tv` wrapper module with `/** @comptime defer */ import { … }`, `@rivetjs/ui`'s `cn`): no tables; the
//   definitions stay runtime calls, the deferred imports become lookups (`tvDeferred`) of what the provider module
//   registers (`tvProvide`), and the same use analysis decides which modules import the provider.
// Purity is never guessed: only the allowlist / annotation. Non-deterministic results (time, randomness, locale,
// environment) are refused (RV2108, the call stays at runtime). Builds only: dev keeps every runtime call.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseAst } from "vite";
import { decode, evaluator, type EvalResult, type Flavour, type Recipe, type Spec, type TvPaths } from "./comptime-eval.ts";

export { evaluator, encode, decode, tvDomain, OVERRIDE_SAMPLES, TV_BUDGET, TV_DENSE_CELLS } from "./comptime-eval.ts";
export type { EvalResult, Flavour, Recipe, Spec, TvPaths } from "./comptime-eval.ts";

export type ComptimeAdapter = "value" | "tv";

/** `rivet({ comptime })`: `false` turns the pass off; `functions` extends the allowlist (module specifier → export → adapter). */
export interface ComptimeOptions {
  readonly functions?: Readonly<Record<string, Readonly<Record<string, ComptimeAdapter>>>>;
}

/** Built-in allowlist: tailwind-variants 3.x (`tv` resolvers, `cn` / `cx` class joins). */
export const COMPTIME_BUILTINS: Readonly<Record<string, Readonly<Record<string, ComptimeAdapter>>>> = {
  "tailwind-variants": { tv: "tv", cn: "value", cx: "value" },
  "tailwind-variants/lite": { tv: "tv", cx: "value" },
};

/** Export name suffix of a folded definition's table (`<name>$rvt`). */
export const TABLE_SUFFIX = "$rvt";
/** Virtual module id prefix of the override merge provider (tailwind-merge; `[helper, tailwind-variants id, merge file?, merge export?, key?]` JSON). */
export const MERGE_PREFIX = "\0rivet-tv-merge:";

interface Node {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [key: string]: unknown;
}

const NOT = Symbol("not constant");
type Maybe<T> = T | typeof NOT;

export interface ComptimeStats {
  /** Definitions folded into tables (`tv` adapter). */
  tables: number;
  /** Constant calls replaced by their result (`value` adapter + constant resolver calls). */
  values: number;
  /** Call sites rewritten to read a table directly. */
  coreCalls: number;
  /** Modules importing the override merge (a full-resolver use). */
  mergeImports: number;
  /** `tv` wrapper modules whose `@comptime defer` imports were turned into provider lookups. */
  deferred: number;
  /** Refused evaluations (reason → count). */
  refused: Record<string, number>;
}

interface Host {
  /** A bundled module's id (externals: null). */
  resolve(spec: string, importer: string): Promise<string | null>;
  /** The id an emitted import may name, externals included (default: `resolve`). */
  resolveId?(spec: string, importer: string): Promise<string | null>;
  warn(message: string, file: string, at?: number): void;
}

interface ImportBinding {
  readonly spec: string;
  readonly imported: string; // "*" namespace, "default"
}

interface ModuleInfo {
  readonly file: string;
  readonly code: string;
  readonly program: Node;
  readonly imports: Map<string, ImportBinding>;
  /** Top-level `const` declarators: name → init. */
  readonly consts: Map<string, Node>;
  /** Export name → local name, or a re-export. */
  readonly exports: Map<string, { local?: string; from?: ImportBinding }>;
  readonly stars: string[];
  /** `@comptime` annotations: export name → adapter. */
  readonly annotations: Map<string, ComptimeAdapter>;
  /** Names exported (locally declared). */
  readonly exportedLocals: Set<string>;
  /** Bare side-effect imports (`import "./x.css"`): the module must stay reachable from its users. */
  readonly sideEffects: boolean;
  /** `/** @comptime defer *\/ import { a, b as c } from "x"` declarations (a `tv` wrapper module's override-only imports). */
  readonly deferred: readonly DeferredImport[];
}

interface DeferredImport {
  readonly start: number;
  readonly end: number;
  readonly spec: string;
  /** `[imported, local]` pairs. */
  readonly names: readonly (readonly [string, string])[];
}

/** A folded `tv` definition (`file`'s top-level `const name = …`). */
interface TvDef {
  readonly file: string;
  readonly name: string;
  readonly recipe: Recipe;
  readonly table: unknown; // decoded table (main thread helper input)
  readonly tableSpec: Spec;
  readonly slots: readonly string[] | null;
  readonly meta: Spec;
  readonly flavour: Flavour;
  readonly paths: TvPaths;
  /** The defining module has side-effect imports (`@rivetjs/ui`: its stylesheet): call sites keep a table reference. */
  readonly keep: boolean;
  /**
   * Defer mode (the callee module has `@comptime defer` imports): the definition stays a runtime call (no table); this is
   * the provider module id that modules with a possible override use import (it supplies the deferred imports).
   */
  readonly provider?: string;
}

const ANNOTATION = /\/\*\*(?:(?!\*\/)[\s\S])*?@comptime(?![\w-])(?:[ \t]+(tv|value)\b)?(?:(?!\*\/)[\s\S])*?\*\/\s*export\s+(?:const|let|function)\s+([\w$]+)/g;

/** `@comptime` / `@comptime tv` / `@comptime value` JSDoc tags on `export const` / `export function` declarations. */
export function comptimeAnnotations(code: string): Map<string, ComptimeAdapter> {
  const out = new Map<string, ComptimeAdapter>();
  if (!code.includes("@comptime")) return out;
  for (const match of code.matchAll(ANNOTATION)) out.set(match[2]!, (match[1] as ComptimeAdapter | undefined) ?? "value");
  return out;
}

const langOf = (file: string): "js" | "jsx" | "ts" | "tsx" =>
  /\.tsx$/.test(file) ? "tsx" : /\.[cm]?ts$/.test(file) ? "ts" : /\.jsx$/.test(file) ? "jsx" : "js";

function parse(code: string, lang: "js" | "jsx" | "ts" | "tsx"): Node | null {
  try {
    return parseAst(code, { lang }) as unknown as Node;
  } catch {
    return null;
  }
}

const isNode = (value: unknown): value is Node => value !== null && typeof value === "object" && typeof (value as Node).type === "string";

/** Children of an AST node (arrays flattened). */
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
    n.type === "TSInstantiationExpression"
  )
    n = n.expression as Node;
  return n;
};

function moduleInfo(file: string, code: string, program: Node): ModuleInfo {
  const imports = new Map<string, ImportBinding>();
  const consts = new Map<string, Node>();
  const exports = new Map<string, { local?: string; from?: ImportBinding }>();
  const stars: string[] = [];
  const exportedLocals = new Set<string>();
  const declare = (decl: Node, exported: boolean) => {
    if (decl.type === "VariableDeclaration") {
      for (const d of decl.declarations as Node[]) {
        const id = d.id as Node;
        if (id.type !== "Identifier") continue;
        const name = id.name as string;
        if (decl.kind === "const" && d.init) consts.set(name, d.init as Node);
        if (exported) (exports.set(name, { local: name }), exportedLocals.add(name));
      }
    } else if ((decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") && decl.id && exported) {
      const name = (decl.id as Node).name as string;
      exports.set(name, { local: name });
      exportedLocals.add(name);
    }
  };
  for (const stmt of program.body as Node[]) {
    if (stmt.type === "ImportDeclaration") {
      if (stmt.importKind === "type") continue;
      const spec = (stmt.source as Node).value as string;
      for (const s of (stmt.specifiers as Node[]) ?? []) {
        if (s.importKind === "type") continue;
        const local = (s.local as Node).name as string;
        if (s.type === "ImportSpecifier") {
          const imported = s.imported as Node;
          imports.set(local, { spec, imported: (imported.type === "Identifier" ? imported.name : imported.value) as string });
        } else if (s.type === "ImportDefaultSpecifier") imports.set(local, { spec, imported: "default" });
        else if (s.type === "ImportNamespaceSpecifier") imports.set(local, { spec, imported: "*" });
      }
    } else if (stmt.type === "ExportNamedDeclaration") {
      if (stmt.exportKind === "type") continue;
      if (stmt.declaration) declare(stmt.declaration as Node, true);
      const source = stmt.source ? ((stmt.source as Node).value as string) : null;
      for (const s of (stmt.specifiers as Node[]) ?? []) {
        if (s.exportKind === "type") continue;
        const local = s.local as Node;
        const exported = s.exported as Node;
        const localName = (local.type === "Identifier" ? local.name : local.value) as string;
        const exportedName = (exported.type === "Identifier" ? exported.name : exported.value) as string;
        exports.set(exportedName, source ? { from: { spec: source, imported: localName } } : { local: localName });
        if (!source) exportedLocals.add(localName);
      }
    } else if (stmt.type === "ExportAllDeclaration") {
      if (!stmt.exported && stmt.exportKind !== "type") stars.push((stmt.source as Node).value as string);
    } else if (stmt.type === "ExportDefaultDeclaration") {
      const decl = stmt.declaration as Node;
      if (decl.type === "Identifier") exports.set("default", { local: decl.name as string });
    } else declare(stmt, false);
  }
  // `export { x }` of an imported binding = a re-export.
  for (const [name, entry] of exports)
    if (entry.local && imports.has(entry.local) && !consts.has(entry.local)) exports.set(name, { from: imports.get(entry.local)! });
  const sideEffects = (program.body as Node[]).some(
    (stmt) => stmt.type === "ImportDeclaration" && !(stmt.specifiers as Node[] | undefined)?.length && stmt.importKind !== "type",
  );
  const deferred: DeferredImport[] = [];
  if (code.includes("@comptime"))
    for (const stmt of program.body as Node[]) {
      if (stmt.type !== "ImportDeclaration" || stmt.importKind === "type") continue;
      const before = code.slice(0, stmt.start);
      const doc = before.lastIndexOf("/**");
      if (doc < 0 || !DEFER.test(before.slice(doc)) || !/\*\/\s*$/.test(before)) continue;
      const names: [string, string][] = [];
      let ok = true;
      for (const sp of (stmt.specifiers as Node[]) ?? []) {
        if (sp.type !== "ImportSpecifier" || sp.importKind === "type") {
          ok = false;
          break;
        }
        const imported = sp.imported as Node;
        names.push([(imported.type === "Identifier" ? imported.name : imported.value) as string, (sp.local as Node).name as string]);
      }
      if (ok && names.length) deferred.push({ start: stmt.start, end: stmt.end, spec: (stmt.source as Node).value as string, names });
    }
  return { file, code, program, imports, consts, exports, stars, annotations: comptimeAnnotations(code), exportedLocals, sideEffects, deferred };
}

/** `@comptime defer` in the doc comment right before an import declaration. */
const DEFER = /^\/\*\*(?:(?!\*\/)[\s\S])*?@comptime[ \t]+defer\b(?:(?!\*\/)[\s\S])*\*\/\s*$/;

/** Names bound inside `scope` (params, declarations; nested functions only by their name). Over-approximates. */
const boundCache = new WeakMap<Node, Set<string>>();
function boundNames(scope: Node): Set<string> {
  let names = boundCache.get(scope);
  if (names) return names;
  names = new Set<string>();
  const set = names;
  const pattern = (p: Node | null | undefined) => {
    if (!p) return;
    switch (p.type) {
      case "Identifier":
        set.add(p.name as string);
        return;
      case "ObjectPattern":
        for (const prop of p.properties as Node[]) pattern(prop.type === "RestElement" ? (prop.argument as Node) : (prop.value as Node));
        return;
      case "ArrayPattern":
        for (const el of p.elements as (Node | null)[]) pattern(el);
        return;
      case "RestElement":
        pattern(p.argument as Node);
        return;
      case "AssignmentPattern":
        pattern(p.left as Node);
        return;
      case "TSParameterProperty":
        pattern(p.parameter as Node);
        return;
    }
  };
  const fn = /Function/.test(scope.type);
  if (fn) for (const p of (scope.params as Node[]) ?? []) pattern(p);
  if (scope.type === "CatchClause") pattern(scope.param as Node);
  const walk = (node: Node, top: boolean) => {
    if (!top && /Function/.test(node.type)) {
      if (node.type === "FunctionDeclaration" && node.id) set.add((node.id as Node).name as string);
      return;
    }
    if (node.type === "VariableDeclarator") pattern(node.id as Node);
    else if ((node.type === "ClassDeclaration" || node.type === "FunctionDeclaration") && node.id) set.add((node.id as Node).name as string);
    else if (node.type === "CatchClause") pattern(node.param as Node);
    else if (!top && (node.type === "ClassExpression" || node.type === "FunctionExpression") && node.id) set.add((node.id as Node).name as string);
    for (const child of children(node)) walk(child, false);
  };
  if (fn) walk(scope.body as Node, false);
  else for (const child of children(scope)) walk(child, false);
  if (fn && scope.id && scope.type === "FunctionExpression") set.add((scope.id as Node).name as string);
  boundCache.set(scope, set);
  return set;
}
const SCOPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "BlockStatement",
  "StaticBlock",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "CatchClause",
  "SwitchStatement",
  "ClassBody",
]);
// TypeScript type positions (`typeof X` in `VariantProps<typeof X>`, annotations): not value uses.
const TYPE_NODES = new Set([
  "TSTypeAnnotation",
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "TSTypeQuery",
  "TSTypeReference",
  "TSTypeParameterInstantiation",
  "TSTypeParameterDeclaration",
  "TSDeclareFunction",
  "TSImportType",
]);
const inType = (ancestors: readonly Node[]): boolean => ancestors.some((a) => TYPE_NODES.has(a.type));
const shadowed = (name: string, ancestors: readonly Node[]): boolean => ancestors.some((a) => SCOPES.has(a.type) && boundNames(a).has(name));

/** Visits every node with its ancestors (outermost first). */
function visit(root: Node, fn: (node: Node, ancestors: readonly Node[]) => void): void {
  const stack: Node[] = [];
  const go = (node: Node) => {
    fn(node, stack);
    stack.push(node);
    for (const child of children(node)) go(child);
    stack.pop();
  };
  go(root);
}

/** `{ a: x, b }` without `class` / `className` / `__proto__` keys, spreads, accessors or computed keys (`undefined` / absent too). */
function overrideFree(arg: Node | undefined): boolean {
  if (!arg) return true;
  const node = unwrap(arg);
  if (node.type === "Identifier" && node.name === "undefined") return true;
  if (node.type === "UnaryExpression" && node.operator === "void" && unwrap(node.argument as Node).type === "Literal") return true;
  if (node.type !== "ObjectExpression") return false;
  for (const prop of node.properties as Node[]) {
    if (prop.type !== "Property" || prop.kind !== "init" || prop.method) return false;
    const key = prop.key as Node;
    let name: unknown;
    if (prop.computed) {
      if (key.type !== "Literal") return false;
      name = key.value;
    } else name = key.type === "Identifier" ? key.name : key.value;
    if (typeof name !== "string" && typeof name !== "number") return false;
    if (name === "class" || name === "className" || name === "__proto__") return false;
  }
  return true;
}

const EVALUATOR_SOURCE = (() => {
  try {
    return readFileSync(fileURLToPath(new URL("./comptime-eval.ts", import.meta.url)), "utf8");
  } catch {
    return String(Date.now()); // unreadable (bundled): no cross-build cache hits
  }
})();

// ---------------------------------------------------------------------------------------------------------------------
// JS literal emission
// ---------------------------------------------------------------------------------------------------------------------

/** A decoded value as JS source (data only; `refName(spec)` names `def` references). */
function literal(spec: Spec, refName?: (recipe: Recipe) => string): string {
  if (spec === null) return "null";
  if (typeof spec === "string") return JSON.stringify(spec);
  if (typeof spec === "number" || typeof spec === "boolean") return String(spec);
  if (Array.isArray(spec)) return "[" + spec.map((item) => literal(item, refName)).join(",") + "]";
  switch (spec["\0"]) {
    case "u":
      return "void 0";
    case "nan":
      return "NaN";
    case "-0":
      return "-0";
    case "inf":
      return "Infinity";
    case "-inf":
      return "-Infinity";
    case "big":
      return (spec.v as string) + "n";
    case "o":
      return "{" + (spec.e as [string, Spec][]).map(([key, value]) => JSON.stringify(key) + ":" + literal(value, refName)).join(",") + "}";
    case "def":
      if (refName) return refName(spec.r as Recipe);
      throw new Error("comptime: unexpected reference");
    default:
      throw new Error("comptime: cannot emit " + String(spec["\0"]));
  }
}
const encodeConst = (value: unknown): Spec => {
  if (value === undefined) return { "\0": "u" };
  if (typeof value === "string" || typeof value === "boolean" || value === null) return value as Spec;
  if (typeof value === "number")
    return Number.isNaN(value)
      ? { "\0": "nan" }
      : Object.is(value, -0)
        ? { "\0": "-0" }
        : Number.isFinite(value)
          ? value
          : { "\0": value > 0 ? "inf" : "-inf" };
  if (typeof value === "bigint") return { "\0": "big", v: String(value) };
  throw new Error("comptime: not a primitive");
};

// ---------------------------------------------------------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------------------------------------------------------

// Specifiers no definition / foldable function can come through (the runtime ABI the compiler emits imports from).
const INERT_IMPORT = /^@rivetjs\/(?:runtime|reactivity)(?:\/|$)/;
const IMPORT_SOURCES = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

/** Whether a module may hold work for the pass (sync, cheap): a `@comptime` tag or an import from outside the runtime. */
export function comptimeCandidate(code: string): boolean {
  if (code.includes("@comptime")) return true;
  for (const match of code.matchAll(IMPORT_SOURCES)) if (!INERT_IMPORT.test(match[1]!) && !match[1]!.endsWith(".css")) return true;
  return false;
}

export interface Comptime {
  /** Rewrites one module (`code` = its current text, `file` its path); null when nothing changed. */
  transform(code: string, file: string, host: Host): Promise<string | null>;
  /** The merge provider module text for a `MERGE_PREFIX` id. */
  loadMerge(id: string): Promise<string | null>;
  readonly stats: ComptimeStats;
  close(): Promise<void>;
}

export function createComptime(options: ComptimeOptions = {}, cacheDir?: string): Comptime {
  const functions: Record<string, Record<string, ComptimeAdapter>> = { ...COMPTIME_BUILTINS };
  for (const [spec, names] of Object.entries(options.functions ?? {})) functions[spec] = { ...functions[spec], ...names };
  const worker = evaluator();
  const stats: ComptimeStats = { tables: 0, values: 0, coreCalls: 0, mergeImports: 0, deferred: 0, refused: {} };
  const infos = new Map<string, Promise<ModuleInfo | null>>();
  const defs = new Map<string, Promise<TvDef | null>>();
  const results = new Map<string, Promise<EvalResult>>();
  const defByRecipe = new Map<string, { file: string; name: string }>();
  const resolved = new Map<string, Promise<string | null>>();
  let helperMod: Promise<typeof import("@rivetjs/runtime/comptime-tv")> | null = null;
  const warned = new Set<string>();

  const resolveIdFrom = (host: Host, spec: string, importer: string): Promise<string | null> => {
    const key = importer + "\0" + spec;
    let hit = resolved.get(key);
    if (!hit) resolved.set(key, (hit = host.resolve(spec, importer)));
    return hit;
  };
  const resolveFrom = (host: Host, spec: string, importer: string): Promise<string | null> =>
    resolveIdFrom(host, spec, importer).then((id) => (id ? id.split("?", 1)[0]! : null));
  /** An id for an emitted import (externals included). */
  const importIds = new Map<string, Promise<string | null>>();
  const importIdFrom = (host: Host, spec: string, importer: string): Promise<string | null> => {
    const key = importer + "\0" + spec;
    let hit = importIds.get(key);
    if (!hit) importIds.set(key, (hit = host.resolveId ? host.resolveId(spec, importer) : host.resolve(spec, importer)));
    return hit;
  };

  const infoOf = (file: string): Promise<ModuleInfo | null> => {
    let hit = infos.get(file);
    if (!hit) {
      hit = (async () => {
        if (file.startsWith("\0") || !existsSync(file)) return null;
        const code = readFileSync(file, "utf8");
        const program = parse(code, langOf(file));
        return program ? moduleInfo(file, code, program) : null;
      })();
      infos.set(file, hit);
    }
    return hit;
  };

  /** The adapter of an imported function binding: built-in allowlist by specifier, else a `@comptime` annotation. */
  const adapterOf = async (info: ModuleInfo, local: string, host: Host): Promise<{ adapter: ComptimeAdapter; file: string; name: string } | null> => {
    const binding = info.imports.get(local);
    if (!binding || binding.imported === "*" || binding.imported === "default") {
      // Own module: an annotated local export.
      const own = info.annotations.get(local);
      if (!binding && own && info.exportedLocals.has(local)) return { adapter: own, file: info.file, name: local };
      return null;
    }
    const builtin = functions[binding.spec]?.[binding.imported];
    const file = await resolveFrom(host, binding.spec, info.file);
    if (!file) return null;
    if (builtin) return { adapter: builtin, file, name: binding.imported };
    const target = await infoOf(file);
    const annotated = target?.annotations.get(binding.imported);
    return annotated ? { adapter: annotated, file, name: binding.imported } : null;
  };

  /** Constant value of an expression as a `Spec` (nested foldable calls / tv definitions as references). */
  const specOf = async (info: ModuleInfo, raw: Node, host: Host, seen: Set<string>): Promise<Maybe<Spec>> => {
    const node = unwrap(raw);
    switch (node.type) {
      case "Literal": {
        if (node.regex) return NOT;
        if (typeof node.bigint === "string") return { "\0": "big", v: node.bigint };
        return encodeConst(node.value);
      }
      case "TemplateLiteral":
        if ((node.expressions as Node[]).length) return NOT;
        return ((node.quasis as Node[])[0]!.value as { cooked: string | null }).cooked ?? NOT;
      case "ArrayExpression": {
        const out: Spec[] = [];
        for (const el of node.elements as (Node | null)[]) {
          if (!el) return NOT;
          if (el.type === "SpreadElement") {
            const inner = await specOf(info, el.argument as Node, host, seen);
            if (inner === NOT || !Array.isArray(inner)) return NOT;
            out.push(...inner);
          } else {
            const value = await specOf(info, el, host, seen);
            if (value === NOT) return NOT;
            out.push(value);
          }
        }
        return out;
      }
      case "ObjectExpression": {
        const entries = new Map<string, Spec>();
        for (const prop of node.properties as Node[]) {
          if (prop.type === "SpreadElement") {
            const inner = await specOf(info, prop.argument as Node, host, seen);
            if (inner === NOT || inner === null || typeof inner !== "object" || Array.isArray(inner) || inner["\0"] !== "o") return NOT;
            for (const [key, value] of inner.e as [string, Spec][]) (entries.delete(key), entries.set(key, value));
            continue;
          }
          if (prop.kind !== "init" || prop.method) return NOT;
          const key = prop.key as Node;
          let name: unknown;
          if (prop.computed) {
            const k = await specOf(info, key, host, seen);
            if (k === NOT || (typeof k !== "string" && typeof k !== "number")) return NOT;
            name = String(k);
          } else name = key.type === "Identifier" ? key.name : key.value;
          if (typeof name === "number") name = String(name);
          if (typeof name !== "string" || name === "__proto__") return NOT;
          const value = await specOf(info, prop.value as Node, host, seen);
          if (value === NOT) return NOT;
          entries.delete(name);
          entries.set(name, value);
        }
        return { "\0": "o", e: [...entries] };
      }
      case "UnaryExpression": {
        const arg = await specOf(info, node.argument as Node, host, seen);
        if (arg === NOT) return NOT;
        if (node.operator === "void") return { "\0": "u" };
        const value = decode(arg, () => {
          throw new Error("ref");
        });
        if (node.operator === "-" && (typeof value === "number" || typeof value === "bigint")) return encodeConst(-(value as number));
        if (node.operator === "+" && typeof value === "number") return encodeConst(value);
        if (node.operator === "!" && (value === null || typeof value !== "object")) return !value;
        return NOT;
      }
      case "Identifier": {
        const name = node.name as string;
        if (!info.consts.has(name) && !info.imports.has(name)) {
          if (name === "undefined") return { "\0": "u" };
          if (name === "NaN") return { "\0": "nan" };
          if (name === "Infinity") return { "\0": "inf" };
          return NOT;
        }
        const init = info.consts.get(name);
        if (init) {
          if (seen.has(info.file + "#" + name)) return NOT;
          // A tv definition of this module: a reference (its resolver, made in the worker).
          const def = await localDef(info, name, host);
          if (def) return { "\0": "def", r: def.recipe };
          const inner = unwrap(init);
          // Objects / arrays could be mutated elsewhere: only module-private ones referenced from constant contexts.
          if ((inner.type === "ObjectExpression" || inner.type === "ArrayExpression") && !privateConst(info, name)) return NOT;
          const next = new Set(seen).add(info.file + "#" + name);
          return specOf(info, init, host, next);
        }
        const binding = info.imports.get(name)!;
        if (binding.imported === "*" || binding.imported === "default") return NOT;
        const file = await resolveFrom(host, binding.spec, info.file);
        if (!file) return NOT;
        return exportedSpec(file, binding.imported, host, seen);
      }
      case "CallExpression": {
        const callee = unwrap(node.callee as Node);
        if (callee.type !== "Identifier" || node.optional) return NOT;
        const fn = await adapterOf(info, callee.name as string, host);
        if (!fn || fn.adapter !== "value") return NOT;
        const args: Spec[] = [];
        for (const arg of node.arguments as Node[]) {
          if (arg.type === "SpreadElement") return NOT;
          const value = await specOf(info, arg, host, seen);
          if (value === NOT) return NOT;
          args.push(value);
        }
        return { "\0": "call", r: { file: fn.file, name: fn.name, args, adapter: "value" } };
      }
      default:
        return NOT;
    }
  };

  /** An export's constant value: primitives and tv definitions only (exported objects could be mutated). */
  const exportedSpec = async (file: string, name: string, host: Host, seen: Set<string>): Promise<Maybe<Spec>> => {
    const target = await infoOf(file);
    if (!target) return NOT;
    const entry = target.exports.get(name);
    if (entry?.from) {
      const next = await resolveFrom(host, entry.from.spec, file);
      return next ? exportedSpec(next, entry.from.imported, host, seen) : NOT;
    }
    if (!entry) {
      for (const star of target.stars) {
        const next = await resolveFrom(host, star, file);
        if (!next) continue;
        const nextInfo = await infoOf(next);
        if (nextInfo && (nextInfo.exports.has(name) || nextInfo.stars.length)) {
          const value = await exportedSpec(next, name, host, seen);
          if (value !== NOT) return value;
        }
      }
      return NOT;
    }
    const local = entry.local!;
    const def = await localDef(target, local, host);
    if (def) return { "\0": "def", r: def.recipe };
    const init = target.consts.get(local);
    if (!init) return NOT;
    const inner = unwrap(init);
    if (inner.type === "ObjectExpression" || inner.type === "ArrayExpression") return NOT;
    const key = file + "#" + local;
    if (seen.has(key)) return NOT;
    const value = await specOf(target, init, host, new Set(seen).add(key));
    return value !== NOT && value !== null && typeof value === "object" && !Array.isArray(value) && (value["\0"] === "o" || value["\0"] === "def")
      ? NOT
      : value;
  };

  /** A module-private object / array const every reference of which sits in a constant context (call arguments, other const inits, spreads). */
  const privateCache = new WeakMap<ModuleInfo, Map<string, boolean>>();
  const privateConst = (info: ModuleInfo, name: string): boolean => {
    let cache = privateCache.get(info);
    if (!cache) privateCache.set(info, (cache = new Map()));
    const hit = cache.get(name);
    if (hit !== undefined) return hit;
    let ok = !info.exportedLocals.has(name) && ![...info.exports.values()].some((e) => e.local === name);
    if (ok)
      visit(info.program, (node, ancestors) => {
        if (!ok || node.type !== "Identifier" || node.name !== name || inType(ancestors)) return;
        const parent = ancestors[ancestors.length - 1];
        if (!parent) return;
        // The declaration itself.
        if (parent.type === "VariableDeclarator" && parent.id === node) return;
        if (parent.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) return;
        if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return;
        // Allowed: inside a call's arguments, a spread, or another top-level const initializer made of literals.
        let ctx = false;
        for (let i = ancestors.length - 1; i >= 0; i--) {
          const a = ancestors[i]!;
          if (a.type === "ObjectExpression" || a.type === "ArrayExpression" || a.type === "SpreadElement" || a.type === "Property") continue;
          if (a.type === "CallExpression" && ancestors[i + 1] !== a.callee) ctx = true;
          if (a.type === "VariableDeclarator" && ancestors[i - 2]?.type === "Program") ctx = true;
          break;
        }
        if (!ctx) ok = false;
      });
    cache.set(name, ok);
    return ok;
  };

  const cacheFile = (recipe: Recipe, paths?: TvPaths): string | null => {
    if (!cacheDir) return null;
    try {
      const hash = createHash("sha256");
      hash.update(JSON.stringify(recipe));
      const files = new Set<string>();
      const add = (file: string, depth: number) => {
        if (files.has(file) || files.size > 400 || depth > 40) return;
        files.add(file);
        let text = "";
        try {
          text = readFileSync(file, "utf8");
        } catch {
          return;
        }
        hash.update(file + "\0" + text);
        if (/[/\\]node_modules[/\\]/.test(file)) return; // package content: its own files are hashed as reached
        const req = createRequire(file);
        for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
          const spec = m[1]!;
          try {
            if (spec.startsWith(".")) {
              const next = resolvePath(dirname(file), spec);
              if (existsSync(next) && statSync(next).isFile()) add(next, depth + 1);
            } else {
              const pkg = req.resolve(spec);
              add(pkg, depth + 1);
            }
          } catch {}
        }
      };
      const walkRecipe = (r: Recipe) => {
        add(r.file, 0);
        const walk = (spec: Spec) => {
          if (spec === null || typeof spec !== "object") return;
          if (Array.isArray(spec)) return spec.forEach(walk);
          if (spec["\0"] === "o") (spec.e as [string, Spec][]).forEach(([, v]) => walk(v));
          if (spec["\0"] === "def" || spec["\0"] === "call") walkRecipe(spec.r as Recipe);
        };
        r.args.forEach(walk);
      };
      walkRecipe(recipe);
      if (paths) for (const file of [paths.helper, paths.tailwindVariants]) add(file, 0);
      // The evaluator's own code (its proofs and encodings) is part of the key.
      hash.update(EVALUATOR_SOURCE);
      return join(cacheDir, "comptime", hash.digest("hex").slice(0, 32) + ".json");
    } catch {
      return null;
    }
  };

  const run = (recipe: Recipe, paths?: TvPaths): Promise<EvalResult> => {
    const key = JSON.stringify(recipe);
    let hit = results.get(key);
    if (!hit) {
      hit = (async () => {
        const file = cacheFile(recipe, paths);
        if (file && existsSync(file)) {
          try {
            return JSON.parse(readFileSync(file, "utf8")) as EvalResult;
          } catch {}
        }
        const result = await worker.evaluate(recipe, paths);
        if (file && result.ok) {
          try {
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, JSON.stringify(result));
          } catch {}
        }
        return result;
      })();
      results.set(key, hit);
    }
    return hit;
  };

  const refuse = (host: Host, file: string, at: number, what: string, reason: string) => {
    stats.refused[reason] = (stats.refused[reason] ?? 0) + 1;
    const key = file + ":" + at;
    if (warned.has(key)) return;
    warned.add(key);
    host.warn(`[RV2108] Build-time evaluation of ${what} kept at runtime: ${reason}`, file, at);
  };

  const tvPaths = async (host: Host, calleeFile: string, importer: string): Promise<TvPaths | null> => {
    const helper = await resolveFrom(host, "@rivetjs/runtime/comptime-tv", importer);
    // The bundle id keeps its query (ZERO B3 resolves ui's `tailwind-variants` to the merge-only copy: same module as
    // `tv.ts`'s `cn`); an external (server builds) is imported as is, the evaluator loads the file Node resolves.
    const twImport = await importIdFrom(host, "tailwind-variants", calleeFile);
    const bare = twImport?.split("?", 1)[0];
    const file = (await resolveFrom(host, "tailwind-variants", calleeFile)) ?? (bare && isAbsolute(bare) ? bare : null);
    if (!helper || !twImport || !file) return null;
    return { helper, tailwindVariants: file, twImport };
  };

  /**
   * Defer mode: the provider module id of a `tv` wrapper module with `@comptime defer` imports (null: none). The id
   * carries the helper, the module's key and every deferred import's resolved id (query kept) + names.
   */
  const providers = new Map<string, Promise<string | null>>();
  const deferProvider = (host: Host, calleeFile: string): Promise<string | null> => {
    let hit = providers.get(calleeFile);
    if (!hit) {
      hit = (async () => {
        const target = await infoOf(calleeFile);
        if (!target?.deferred.length) return null;
        const helper = await resolveFrom(host, "@rivetjs/runtime/comptime-tv", calleeFile);
        if (!helper) return null;
        const imports: [string, (readonly [string, string])[]][] = [];
        for (const d of target.deferred) {
          const id = await importIdFrom(host, d.spec, calleeFile);
          if (!id) return null;
          imports.push([id, [...d.names]]);
        }
        return MERGE_PREFIX + JSON.stringify(["defer", helper, deferKey(calleeFile), imports]);
      })();
      providers.set(calleeFile, hit);
    }
    return hit;
  };

  /** `info`'s top-level `const name = tv(…)` folded into a table, or null. */
  const localDef = (info: ModuleInfo, name: string, host: Host): Promise<TvDef | null> => {
    const key = info.file + "#" + name;
    let hit = defs.get(key);
    if (!hit) {
      hit = (async () => {
        const init = info.consts.get(name);
        if (!init) return null;
        const call = unwrap(init);
        if (call.type !== "CallExpression" || call.optional) return null;
        const callee = unwrap(call.callee as Node);
        if (callee.type !== "Identifier") return null;
        const fn = await adapterOf(info, callee.name as string, host);
        if (!fn || fn.adapter !== "tv") return null;
        // Defer mode: no evaluation; slots or not from the options literal (`slots` key), else unrecognised.
        const provider = await deferProvider(host, fn.file);
        if (provider) {
          const options = (call.arguments as Node[]).length === 1 ? unwrap((call.arguments as Node[])[0]!) : null;
          if (!options || options.type !== "ObjectExpression") return null;
          let slotted = false;
          for (const prop of options.properties as Node[]) {
            if (prop.type !== "Property" || prop.computed) return null;
            const k = prop.key as Node;
            if ((k.type === "Identifier" ? k.name : k.value) !== "slots") continue;
            const value = unwrap(prop.value as Node);
            if (value.type !== "ObjectExpression") return null;
            slotted = true;
          }
          const helper = await resolveFrom(host, "@rivetjs/runtime/comptime-tv", info.file);
          if (!helper) return null;
          return {
            file: info.file,
            name,
            recipe: { file: fn.file, name: fn.name, args: [], adapter: "tv" },
            tableSpec: null,
            table: null,
            slots: slotted ? [] : null,
            meta: null,
            flavour: "merge-cx",
            paths: { helper, tailwindVariants: "", twImport: "" },
            keep: info.sideEffects,
            provider,
          } satisfies TvDef;
        }
        const args: Spec[] = [];
        for (const arg of call.arguments as Node[]) {
          if (arg.type === "SpreadElement") return null;
          const value = await specOf(info, arg, host, new Set([key]));
          if (value === NOT) return null;
          args.push(value);
        }
        const paths = await tvPaths(host, fn.file, info.file);
        if (!paths) return null;
        const recipe: Recipe = { file: fn.file, name: fn.name, args, adapter: "tv" };
        defByRecipe.set(JSON.stringify(recipe), { file: info.file, name });
        const result = await run(recipe, paths);
        if (!result.ok) {
          refuse(host, info.file, call.start, `${callee.name as string}(…) (${name})`, result.reason);
          return null;
        }
        if (!("table" in result)) return null;
        return {
          file: info.file,
          name,
          recipe,
          tableSpec: result.table,
          table: decode(result.table, () => null),
          slots: result.slots,
          meta: result.meta,
          flavour: result.flavour,
          paths,
          keep: info.sideEffects,
        };
      })();
      defs.set(key, hit);
    }
    return hit;
  };

  /** The tv definition an imported binding names (re-exports followed). */
  const importedMemo = new Map<string, Promise<TvDef | null>>();
  const importedDef = (file: string, name: string, host: Host, depth = 0): Promise<TvDef | null> => {
    const key = file + "#" + name;
    let hit = importedMemo.get(key);
    if (!hit) importedMemo.set(key, (hit = importedDefOf(file, name, host, depth)));
    return hit;
  };
  const importedDefOf = async (file: string, name: string, host: Host, depth: number): Promise<TvDef | null> => {
    if (depth > 20) return null;
    const info = await infoOf(file);
    if (!info) return null;
    const entry = info.exports.get(name);
    if (entry?.local) return localDef(info, entry.local, host);
    if (entry?.from) {
      const next = await resolveFrom(host, entry.from.spec, file);
      return next ? importedDef(next, entry.from.imported, host, depth + 1) : null;
    }
    for (const star of info.stars) {
      const next = await resolveFrom(host, star, file);
      if (!next) continue;
      const def = await importedDef(next, name, host, depth + 1);
      if (def) return def;
    }
    return null;
  };

  /** A merge-flavour definition `file` exports (own, re-exported, `export *`), or null. */
  const exportsMemo = new Map<string, Promise<TvDef | null>>();
  const exportsDef = (file: string, host: Host, depth = 0): Promise<TvDef | null> => {
    let hit = exportsMemo.get(file);
    if (!hit) {
      hit = (async () => {
        if (depth > 20) return null;
        const info = await infoOf(file);
        if (!info) return null;
        for (const [name, entry] of info.exports) {
          const def = entry.local ? await localDef(info, entry.local, host) : await importedDef(file, name, host);
          if (def && def.flavour !== "join") return def;
        }
        for (const star of info.stars) {
          const next = await resolveFrom(host, star, file);
          const def = next ? await exportsDef(next, host, depth + 1) : null;
          if (def) return def;
        }
        return null;
      })();
      exportsMemo.set(file, hit);
    }
    return hit;
  };
  /** A definition reachable through a namespace import or a literal dynamic `import()` (members called opaquely). */
  const reachesDefs = async (info: ModuleInfo, program: Node, host: Host): Promise<TvDef | null> => {
    const specs = new Set<string>();
    for (const binding of info.imports.values()) if (binding.imported === "*") specs.add(binding.spec);
    visit(program, (node) => {
      if (node.type !== "ImportExpression") return;
      const source = unwrap(node.source as Node);
      if (source.type === "Literal" && typeof source.value === "string") specs.add(source.value);
    });
    for (const spec of specs) {
      if (functions[spec]) continue;
      const target = await resolveFrom(host, spec, info.file);
      const def = target && target !== info.file ? await exportsDef(target, host) : null;
      if (def) return def;
    }
    return null;
  };

  return {
    stats,
    async close() {
      await worker.close();
    },
    async loadMerge(id) {
      if (!id.startsWith(MERGE_PREFIX)) return null;
      const parsed = JSON.parse(id.slice(MERGE_PREFIX.length)) as unknown[];
      if (parsed[0] === "defer") {
        const [, helper, key, imports] = parsed as [string, string, string, [string, [string, string][]][]];
        const lines = [`import { tvProvide } from ${JSON.stringify(helper)};`];
        const entries: string[] = [];
        imports.forEach(([from, names], i) => {
          lines.push(`import { ${names.map(([imported], j) => `${imported} as __rvtP${i}_${j}`).join(", ")} } from ${JSON.stringify(from)};`);
          names.forEach(([, local], j) => entries.push(`${JSON.stringify(local)}: __rvtP${i}_${j}`));
        });
        lines.push(`tvProvide(${JSON.stringify(key)}, { ${entries.join(", ")} });`, "");
        return lines.join("\n");
      }
      const [helper, tw] = parsed as [string, string];
      return [`import { tvMergeWith } from ${JSON.stringify(helper)};`, `import { cn, cx } from ${JSON.stringify(tw)};`, "tvMergeWith(cn, cx);", ""].join("\n");
    },
    async transform(code, file, host) {
      if (!comptimeCandidate(code)) return null;
      const program = parse(code, langOf(file));
      if (!program) return null;
      const info = moduleInfo(file, code, program);
      // Imported tv definitions (by local name).
      const imported = new Map<string, TvDef>();
      for (const [local, binding] of info.imports) {
        if (binding.imported === "*" || binding.imported === "default") continue;
        if (functions[binding.spec]) continue;
        const target = await resolveFrom(host, binding.spec, file);
        if (!target || target === file) continue;
        const def = await importedDef(target, binding.imported, host);
        if (def) imported.set(local, def);
      }
      // Local tv definitions (top-level `const X = tv(…)`) and value calls.
      const local = new Map<string, TvDef>();
      for (const name of info.consts.keys()) {
        const def = await localDef(info, name, host);
        if (def) local.set(name, def);
      }
      const edits: { start: number; end: number; text: string }[] = [];
      const head: string[] = [];
      // Defer mode, the `tv` wrapper module itself: its deferred imports become lookups of what the provider module
      // registers (`tvProvide`), so the module (and every page holding it) no longer reaches them statically.
      if (info.deferred.length) {
        const helper = await resolveFrom(host, "@rivetjs/runtime/comptime-tv", file);
        if (helper) {
          head.push(`import { tvDeferred as __rvtDeferred } from ${JSON.stringify(helper)};`);
          const key = JSON.stringify(deferKey(file));
          for (const d of info.deferred) {
            const end = code[d.end - 1] === ";" ? d.end - 1 : d.end;
            const decls = d.names.map(([, local]) => `${local} = /* @__PURE__ */ __rvtDeferred(${key}, ${JSON.stringify(local)})`).join(", ");
            edits.push({ start: d.start, end, text: `const ${decls}` });
          }
          stats.deferred++;
        }
      }
      const tableRefs = new Map<TvDef, string>();
      const tableRef = (def: TvDef): string => {
        if (def.file === file) return def.name + TABLE_SUFFIX;
        let ref = tableRefs.get(def);
        if (!ref) {
          ref = "__rvtT" + tableRefs.size;
          tableRefs.set(def, ref);
          head.push(`import { ${def.name}${TABLE_SUFFIX} as ${ref} } from ${JSON.stringify(def.file)};`);
        }
        return ref;
      };
      const helpers = { core: false, slot: false };
      // The shipped table helpers (constant call sites fold through the same code the browser runs).
      const tables = (def: TvDef): Promise<typeof import("@rivetjs/runtime/comptime-tv")> =>
        (helperMod ??= import(pathToFileURL(def.paths.helper).href) as Promise<typeof import("@rivetjs/runtime/comptime-tv")>);
      const constArg = async (arg: Node | undefined): Promise<Maybe<unknown>> => {
        if (!arg) return undefined;
        const spec = await specOf(info, arg, host, new Set());
        if (spec === NOT) return NOT;
        if (JSON.stringify(spec).includes('"\\u0000":"def"') || JSON.stringify(spec).includes('"\\u0000":"call"')) return NOT;
        return decode(spec, () => null);
      };
      const candidates: { node: Node; ancestors: Node[]; def: TvDef; name: string }[] = [];
      const valueCalls: { node: Node; ancestors: Node[] }[] = [];
      const names = new Map<string, TvDef>([...imported, ...local]);
      visit(program, (node, ancestors) => {
        if (node.type !== "CallExpression") return;
        const callee = unwrap(node.callee as Node);
        if (callee.type !== "Identifier") return;
        const name = callee.name as string;
        const def = names.get(name);
        if (def && !shadowed(name, ancestors)) candidates.push({ node, ancestors: [...ancestors], def, name });
        else if (!def && (info.imports.has(name) || info.annotations.has(name)) && !shadowed(name, ancestors))
          valueCalls.push({ node, ancestors: [...ancestors] });
      });
      // Constant value calls (`cn("a", "b")`) → literals (innermost first is unnecessary: a constant call's args are constants).
      const covered: [number, number][] = [];
      for (const { node } of valueCalls) {
        if (covered.some(([s, e]) => node.start >= s && node.end <= e)) continue;
        const callee = unwrap(node.callee as Node);
        const fn = await adapterOf(info, callee.name as string, host);
        if (!fn || fn.adapter !== "value") continue;
        const spec = await specOf(info, node, host, new Set());
        if (spec === NOT) continue;
        const result = await run((spec as unknown as { r: Recipe }).r);
        if (!result.ok) {
          refuse(host, file, node.start, `${callee.name as string}(…)`, result.reason);
          continue;
        }
        if (!("value" in result)) continue;
        edits.push({ start: node.start, end: node.end, text: "(" + literal(result.value) + ")" });
        covered.push([node.start, node.end]);
        stats.values++;
      }
      // Table reads at override-free call sites.
      for (const { node, ancestors, def } of candidates) {
        if (covered.some(([s, e]) => node.start >= s && node.end <= e)) continue;
        const args = node.arguments as Node[];
        if (args.length > 1 || node.optional || (args[0] && args[0].type === "SpreadElement")) continue;
        if (!overrideFree(args[0])) continue;
        if (def.provider) {
          // Defer mode: an override-free use needs nothing (the resolver never reaches its deferred imports); left as is.
          if (!def.slots) {
            covered.push([node.start, node.end]);
            continue;
          }
          const member = ancestors[ancestors.length - 1];
          const outer = ancestors[ancestors.length - 2];
          if (!member || member.type !== "MemberExpression" || member.object !== node || member.computed || member.optional) continue;
          if (!outer || outer.type !== "CallExpression" || outer.callee !== member || outer.optional) continue;
          const sargs = outer.arguments as Node[];
          if (sargs.length > 1 || (sargs[0] && sargs[0].type === "SpreadElement") || !overrideFree(sargs[0])) continue;
          covered.push([outer.start, outer.end]);
          continue;
        }
        const mod = await tables(def);
        const table = def.table as import("@rivetjs/runtime/comptime-tv").TvTable;
        if (!def.slots) {
          // A literal would leave the definition's module unreferenced (its stylesheet import dropped with it).
          const constant = def.keep ? NOT : await constArg(args[0]);
          if (constant !== NOT) {
            edits.push({ start: node.start, end: node.end, text: "(" + literal(encodeConst(mod.tvCore(table, constant as never))) + ")" });
            stats.values++;
          } else {
            helpers.core = true;
            const argText = args[0] ? code.slice(args[0].start, args[0].end) : "void 0";
            edits.push({ start: node.start, end: node.end, text: `__rvtCore(${tableRef(def)}, ${argText})` });
            stats.coreCalls++;
          }
          covered.push([node.start, node.end]);
          continue;
        }
        // Slots: `X(a).slot(b)`.
        const member = ancestors[ancestors.length - 1];
        const outer = ancestors[ancestors.length - 2];
        if (!member || member.type !== "MemberExpression" || member.object !== node || member.computed || member.optional) continue;
        if (!outer || outer.type !== "CallExpression" || outer.callee !== member || outer.optional) continue;
        const slot = (member.property as Node).name as string;
        const si = def.slots.indexOf(slot);
        if (si < 0) continue;
        const sargs = outer.arguments as Node[];
        if (sargs.length > 1 || (sargs[0] && sargs[0].type === "SpreadElement") || !overrideFree(sargs[0])) continue;
        const a = await constArg(args[0]);
        const b = await constArg(sargs[0]);
        if (a !== NOT && b !== NOT && !def.keep) {
          edits.push({ start: outer.start, end: outer.end, text: "(" + literal(encodeConst(mod.tvSlot(table, a as never, si, b as never))) + ")" });
          stats.values++;
        } else {
          helpers.slot = true;
          const aText = args[0] ? code.slice(args[0].start, args[0].end) : "void 0";
          const bText = sargs[0] ? code.slice(sargs[0].start, sargs[0].end) : "void 0";
          edits.push({ start: outer.start, end: outer.end, text: `__rvtSlot(${tableRef(def)}, ${aText}, ${si}, ${bText})` });
          stats.coreCalls++;
        }
        covered.push([outer.start, outer.end]);
      }
      // Local definitions: `const X = tv(…)` → the table, and the full resolver (table core + the library's own override
      // merge) when still referenced or exported. Its merge function comes from the merge module (tailwind-merge), which
      // only modules with a full-resolver use import: the table's module never imports it, so pages reading tables only
      // never load tailwind-merge (a static import here would put the merge in every page holding the table's chunk).
      const fullHelpers = new Set<string>();
      // Definitions this module may call with an override (their merge / provider module is imported here).
      const needing = new Set<TvDef>();
      let joinImported = false;
      const metaRefs = new Map<string, string>();
      const refName = (recipe: Recipe): string => {
        const owner = defByRecipe.get(JSON.stringify(recipe));
        if (!owner) throw new Error("comptime: metadata references an unknown definition");
        if (owner.file === file) return owner.name;
        let ref = metaRefs.get(owner.file + "#" + owner.name);
        if (!ref) {
          ref = "__rvtM" + metaRefs.size;
          metaRefs.set(owner.file + "#" + owner.name, ref);
          head.push(`import { ${owner.name} as ${ref} } from ${JSON.stringify(owner.file)};`);
        }
        return ref;
      };
      const remaining = (name: string, skip?: Node): boolean => {
        let found = false;
        visit(program, (node, ancestors) => {
          if (found || node.type !== "Identifier" || node.name !== name) return;
          if (skip && node.start >= skip.start && node.end <= (skip.id as Node).end) return;
          const parent = ancestors[ancestors.length - 1];
          // Bindings, not uses: import specifiers, and `export { X }` (a re-export: its importers are checked themselves).
          if (parent && /^(?:Import|Export)(?:Default|Namespace)?Specifier$/.test(parent.type)) return;
          if (parent && parent.type === "MemberExpression" && parent.property === node && !parent.computed) return;
          if (parent && parent.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) return;
          if (shadowed(name, ancestors) || inType(ancestors)) return;
          if (!covered.some(([s, e]) => node.start >= s && node.end <= e)) found = true;
        });
        return found;
      };
      for (const [name, def] of local) {
        const decl = findDeclarator(program, name);
        if (!decl) continue;
        const init = decl.init as Node;
        if (def.provider) {
          // Defer mode: the definition stays; a use with a possible override needs the provider here.
          if (remaining(name, decl)) needing.add(def);
          continue;
        }
        const tableText = literal(def.tableSpec);
        const exported = info.exportedLocals.has(name) || [...info.exports.values()].some((e) => e.local === name);
        const used = remaining(name, decl);
        let fullText = "void 0";
        if (exported || used) {
          fullHelpers.add("tvFull as __rvtFull");
          let merge: string;
          if (def.flavour === "join") {
            if (!joinImported) head.push(`import { cx as __rvtCx } from ${JSON.stringify(def.paths.twImport)};`);
            joinImported = true;
            merge = "__rvtCx";
          } else {
            fullHelpers.add("tvMerge as __rvtMerge");
            merge = `__rvtMerge(${def.flavour === "merge-cx" ? 1 : 2})`;
            if (used) needing.add(def);
          }
          fullText = `/* @__PURE__ */ __rvtFull(() => ${name}${TABLE_SUFFIX}, ${def.slots ? "true" : "false"}, ${literal(def.meta, refName)}, ${merge})`;
        }
        edits.push({
          start: (decl.id as Node).start,
          end: init.end,
          text: `${name}${TABLE_SUFFIX} = /* @__PURE__ */ Object.freeze(${tableText}), ${name} = (${fullText})`,
        });
        stats.tables++;
        if (exported && !isExportedDeclaration(program, decl)) head.push(`export { ${name}${TABLE_SUFFIX} };`);
      }
      // Imported definitions still used as resolvers (an override, a value use): this module needs the merge.
      for (const [name, def] of imported) if (def.flavour !== "join" && remaining(name)) needing.add(def);
      // Defer mode, conservatively: a deferred `tv` used here other than as a recognised definition's callee (a
      // non-literal options argument, a value use) makes resolvers this pass does not follow: their module provides.
      const extraProviders = new Set<string>();
      for (const [localName, binding] of info.imports) {
        if (binding.imported === "*" || binding.imported === "default") continue;
        const fn = await adapterOf(info, localName, host);
        if (!fn || fn.adapter !== "tv") continue;
        const provider = await deferProvider(host, fn.file);
        if (!provider) continue;
        const callees: [number, number][] = [];
        for (const def of local.values())
          if (def.provider === provider) {
            const decl = findDeclarator(program, def.name);
            const call = decl ? unwrap(decl.init as Node) : null;
            if (call) callees.push([call.start, (call.callee as Node).end]);
          }
        const before = covered.length;
        covered.push(...callees);
        if (remaining(localName)) extraProviders.add(provider);
        covered.length = before;
      }
      // Namespace / dynamic imports of modules exporting definitions: their members may be called with overrides.
      const reached = await reachesDefs(info, program, host);
      if (reached) needing.add(reached);
      let mergeId: string | null = null;
      if (needing.size || extraProviders.size) {
        // One registration per distinct provider among the definitions this module can call with an override.
        const ids = new Set<string>(extraProviders);
        for (const def of needing)
          if (def.provider) ids.add(def.provider);
          else if (def.flavour !== "join") {
            ids.add(MERGE_PREFIX + JSON.stringify([def.paths.helper, def.paths.twImport]));
          }
        for (const id of [...ids].reverse()) {
          head.unshift(`import ${JSON.stringify(id)};`);
          stats.mergeImports++;
          mergeId = id;
        }
      }
      if (!edits.length && !mergeId) return null;
      if (helpers.core || helpers.slot || fullHelpers.size) {
        const path = await resolveFrom(host, "@rivetjs/runtime/comptime-tv", file);
        if (!path) return null;
        const names = [helpers.core ? "tvCore as __rvtCore" : "", helpers.slot ? "tvSlot as __rvtSlot" : "", ...fullHelpers].filter(Boolean).join(", ");
        head.push(`import { ${names} } from ${JSON.stringify(path)};`);
      }
      edits.sort((a, b) => b.start - a.start);
      let out = code;
      for (const edit of edits) {
        // Line numbers stay (the input's source map keeps holding): the lines a replaced span covered go inside its last paren.
        const lost = countLines(out.slice(edit.start, edit.end)) - countLines(edit.text);
        const text = lost > 0 ? edit.text.slice(0, -1) + "\n".repeat(lost) + ")" : edit.text;
        out = out.slice(0, edit.start) + text + out.slice(edit.end);
      }
      // Imports go last (hoisted anyway): line numbers of the module's own code stay.
      return out + (out.endsWith("\n") ? "" : "\n") + head.join("\n") + "\n";
    },
  };
}

/** The provider key of a defer-mode `tv` wrapper module (stable within a build: both environments compute it). */
const deferKey = (file: string): string => createHash("sha256").update(file).digest("hex").slice(0, 8);

const countLines = (text: string): number => {
  let n = 0;
  for (let i = text.indexOf("\n"); i >= 0; i = text.indexOf("\n", i + 1)) n++;
  return n;
};

function findDeclarator(program: Node, name: string): Node | null {
  for (const stmt of program.body as Node[]) {
    const decl = stmt.type === "ExportNamedDeclaration" ? (stmt.declaration as Node | null) : stmt;
    if (!decl || decl.type !== "VariableDeclaration" || decl.kind !== "const") continue;
    for (const d of decl.declarations as Node[]) if ((d.id as Node).type === "Identifier" && (d.id as Node).name === name && d.init) return d;
  }
  return null;
}
function isExportedDeclaration(program: Node, declarator: Node): boolean {
  for (const stmt of program.body as Node[])
    if (
      stmt.type === "ExportNamedDeclaration" &&
      stmt.declaration &&
      (stmt.declaration as Node).start <= declarator.start &&
      declarator.end <= (stmt.declaration as Node).end
    )
      return true;
  return false;
}
