// Type-aware resume capture check (RV2101, warning). The compiler is syntax-only; this asks the
// TypeScript checker whether each captured value's type is one resume state can carry
// (runtime/resume-format.ts): primitives, arrays, plain objects, Date, URL, Map, Set, plus signals,
// contexts, refs and symbol functions (all callables are skipped: statically indistinguishable).
// Class instances: the compiler's verdict decides (Function Bridge T28, review T24 L4) — a data class of a resume module
// encodes its fields (checked like a plain object), a `static [revive]` class its own data (never flagged).
import type TS from "typescript";
import type { CheckDiagnostic, CheckSite } from "./compiler.ts";
import { nodeAt } from "./fixes.ts";

const OK_GENERIC = new Set(["Array", "ReadonlyArray", "Map", "ReadonlyMap", "Set", "ReadonlySet"]);
const OK_LEAF = new Set(["Date", "URL"]);
const BAD = new Set(["Promise", "PromiseLike", "WeakMap", "WeakSet", "WeakRef", "RegExp", "Error", "ReadableStream", "AbortController", "AbortSignal"]);

/** The compiler's resume verdict for a class declaration (`check` result `classes` of its module): undefined when not registered. */
export type ClassVerdict = (declaration: TS.Declaration) => "data" | "revive" | undefined;

/** Why values of `type` cannot be serialized into resume state (null: they can, or unknown). */
export function serializationProblem(
  ts: typeof TS,
  checker: TS.TypeChecker,
  type: TS.Type,
  depth = 0,
  seen = new Set<TS.Type>(),
  verdict?: ClassVerdict,
): string | null {
  const F = ts.TypeFlags;
  if (type.flags & (F.Any | F.Unknown | F.Never | F.TypeParameter | F.Intersection)) return null;
  if (type.flags & (F.ESSymbol | F.UniqueESSymbol)) return "symbol";
  if (type.flags & (F.StringLike | F.NumberLike | F.BooleanLike | F.BigIntLike | F.Null | F.Undefined | F.Void | F.EnumLike)) return null;
  if (type.isUnion()) {
    for (const member of type.types) {
      const problem = serializationProblem(ts, checker, member, depth, seen, verdict);
      if (problem) return problem;
    }
    return null;
  }
  if (!(type.flags & F.Object) || seen.has(type) || depth > 4) return null;
  seen.add(type);
  if (type.getCallSignatures().length || type.getConstructSignatures().length) return null;
  const symbol = type.aliasSymbol ?? type.getSymbol();
  const name = symbol?.getName() ?? "";
  const args = (): readonly TS.Type[] => ((type as TS.ObjectType).objectFlags & ts.ObjectFlags.Reference ? checker.getTypeArguments(type as TS.TypeReference) : []);
  const tuple = ((type as TS.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0 && ((type as TS.TypeReference).target.objectFlags & ts.ObjectFlags.Tuple) !== 0;
  if (tuple || OK_GENERIC.has(name)) {
    for (const arg of args()) {
      const problem = serializationProblem(ts, checker, arg, depth + 1, seen, verdict);
      if (problem) return problem;
    }
    return null;
  }
  if (OK_LEAF.has(name)) return null;
  if (BAD.has(name)) return name;
  if (type.getProperty("nodeType") && type.getProperty("nodeName")) return `DOM node (${name || "Node"})`;
  if (symbol && symbol.flags & ts.SymbolFlags.Class) {
    const kind = symbol.valueDeclaration && verdict?.(symbol.valueDeclaration);
    if (kind === "revive") return null;
    // A data class instance encodes its own fields: checked below like a plain object (methods are callables: skipped).
    if (kind !== "data") return `class instance (${name})`;
  }
  for (const property of type.getProperties()) {
    const declaration = property.valueDeclaration ?? property.declarations?.[0];
    if (!declaration) continue;
    const problem = serializationProblem(ts, checker, checker.getTypeOfSymbolAtLocation(property, declaration), depth + 1, seen, verdict);
    if (problem) return `.${property.getName()}: ${problem}`;
  }
  return null;
}

/** RV2101 warnings for a resume-compiled file's value captures (one per captured binding). */
export function serializabilityDiagnostics(
  ts: typeof TS,
  checker: TS.TypeChecker,
  file: TS.SourceFile,
  sites: readonly CheckSite[],
  verdict?: ClassVerdict,
): CheckDiagnostic[] {
  const byBinding = new Map<number, { capture: CheckSite["captures"][number]; sites: string[] }>();
  for (const site of sites)
    for (const capture of site.captures) {
      if (capture.kind !== "value") continue;
      const entry = byBinding.get(capture.start) ?? { capture, sites: [] };
      entry.sites.push(site.name);
      byBinding.set(capture.start, entry);
    }
  const out: CheckDiagnostic[] = [];
  for (const { capture, sites: names } of byBinding.values()) {
    const node = nodeAt(ts, file, capture.start, capture.end);
    if (!node || !ts.isIdentifier(node)) continue;
    const problem = serializationProblem(ts, checker, checker.getTypeAtLocation(node), 0, new Set(), verdict);
    if (!problem) continue;
    const { line, character } = file.getLineAndCharacterOfPosition(capture.start);
    out.push({
      code: "RV2101",
      severity: "warning",
      message: `\`${capture.name}\` is captured by ${names.join(", ")} and serialized into resume state, but its type is not serializable: ${problem}. Create it inside the closure or keep it out of browser code.`,
      filename: file.fileName,
      start: capture.start,
      end: capture.end,
      line: line + 1,
      column: character + 1,
      targets: [],
    });
  }
  return out;
}
