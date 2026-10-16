// API reference model: TypeDoc reads the public entry points (package `exports`), this file
// normalizes its JSON into a compact `src/generated/api.json` (committed: diffs show public API
// changes). Underscore-prefixed and `@internal` exports are left out.
import { writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Application, type JSONOutput } from "typedoc";
import { app, loadApp, type RunsOn } from "./app.ts";

export type { RunsOn };


export interface ApiParam {
  name: string;
  type: string;
  optional: boolean;
  doc: string;
  default?: string;
}
export interface ApiMember {
  name: string;
  kind: string;
  signature: string;
  doc: string;
  optional: boolean;
  default?: string;
}
export interface ApiSymbol {
  /** `@rivetjs/runtime/dom#For` */
  key: string;
  entry: string;
  name: string;
  /** function | class | interface | type | variable | namespace | enum */
  kind: string;
  summary: string;
  /** Further documentation (Markdown-ish text: paragraphs and `code`). */
  remarks: string;
  signatures: string[];
  params: ApiParam[];
  returns?: string;
  members: ApiMember[];
  runsOn: RunsOn;
  status: "stable" | "experimental";
  since?: string;
  deprecated?: string;
  examples: string[];
  source: { file: string; line: number; url: string };
  /** URL path of the symbol page. */
  href: string;
}
export interface ApiModel {
  entries: { entry: string; summary: string; runsOn: RunsOn; href: string; symbols: string[] }[];
  symbols: ApiSymbol[];
}

type Reflection = JSONOutput.DeclarationReflection | JSONOutput.SignatureReflection | JSONOutput.ParameterReflection | JSONOutput.TypeParameterReflection;
type Type = JSONOutput.SomeType;
const KIND: Record<number, string> = { 2: "namespace", 4: "namespace", 8: "enum", 32: "variable", 64: "function", 128: "class", 256: "interface", 1024: "property", 2048: "method", 2097152: "type", 262144: "accessor", 512: "constructor", 4194304: "reference" };

const commentText = (parts: JSONOutput.CommentDisplayPart[] | undefined): string =>
  (parts ?? [])
    .map((part) => (part.kind === "inline-tag" ? (part.text || "").trim() : part.text))
    .join("")
    .trim();
const tag = (comment: JSONOutput.Comment | undefined, name: string): string | undefined => {
  const found = comment?.blockTags?.find((t) => t.tag === name);
  return found ? commentText(found.content).replace(/^```\w*\n?|\n?```$/g, "") : undefined;
};
const firstSentence = (text: string): string => {
  const paragraph = text.split(/\n\s*\n/)[0]!.replace(/\s+/g, " ").trim();
  const match = /^(.+?[.!?])(\s|$)/.exec(paragraph.replace(/`[^`]*`/g, (code) => code.replace(/[.!?]/g, "․")));
  return (match ? match[1]! : paragraph).replace(/․/g, ".");
};

/** Render a TypeDoc type as TypeScript-like text. */
export function typeText(type: Type | undefined, depth = 0): string {
  if (!type) return "unknown";
  if (depth > 6) return "…";
  const t = (x: Type | undefined) => typeText(x, depth + 1);
  switch (type.type) {
    case "intrinsic":
      return type.name;
    case "literal":
      return typeof type.value === "string" ? JSON.stringify(type.value) : type.value === null ? "null" : typeof type.value === "object" ? `${type.value.negative ? "-" : ""}${type.value.value}n` : String(type.value);
    case "reference":
      return type.name + (type.typeArguments?.length ? `<${type.typeArguments.map(t).join(", ")}>` : "");
    case "union":
      return type.types.map((x) => (x.type === "reflection" && x.declaration.signatures ? `(${t(x)})` : t(x))).join(" | ");
    case "intersection":
      return type.types.map(t).join(" & ");
    case "array":
      return (["union", "intersection", "reflection"].includes(type.elementType.type) ? `(${t(type.elementType)})` : t(type.elementType)) + "[]";
    case "tuple":
      return `[${(type.elements ?? []).map(t).join(", ")}]`;
    case "namedTupleMember":
      return `${type.name}${type.isOptional ? "?" : ""}: ${t(type.element)}`;
    case "optional":
      return t(type.elementType) + "?";
    case "rest":
      return "..." + t(type.elementType);
    case "typeOperator":
      return `${type.operator} ${t(type.target)}`;
    case "indexedAccess":
      return `${t(type.objectType)}[${t(type.indexType)}]`;
    case "conditional":
      return `${t(type.checkType)} extends ${t(type.extendsType)} ? ${t(type.trueType)} : ${t(type.falseType)}`;
    case "query":
      return "typeof " + t(type.queryType);
    case "predicate":
      return type.asserts ? `asserts ${type.name}${type.targetType ? " is " + t(type.targetType) : ""}` : `${type.name} is ${t(type.targetType)}`;
    case "inferred":
      return "infer " + type.name;
    case "templateLiteral":
      return "`" + type.head + type.tail.map(([x, text]) => "${" + t(x) + "}" + text).join("") + "`";
    case "mapped":
      return `{ [${type.parameter} in ${t(type.parameterType)}]${type.optionalModifier === "+" ? "?" : type.optionalModifier === "-" ? "-?" : ""}: ${t(type.templateType)} }`;
    case "reflection": {
      const decl = type.declaration;
      if (decl.signatures?.length) return decl.signatures.map((s) => signatureText(s, "arrow", depth + 1)).join(" & ");
      if (decl.children?.length) return `{ ${decl.children.map((c) => `${c.flags?.isReadonly ? "readonly " : ""}${c.name}${c.flags?.isOptional ? "?" : ""}: ${c.signatures ? c.signatures.map((s) => signatureText(s, "arrow", depth + 1)).join(" & ") : t(c.type)}`).join("; ")} }`;
      if (decl.indexSignatures?.length) return `{ [${decl.indexSignatures[0]!.parameters?.[0]?.name ?? "key"}: ${t(decl.indexSignatures[0]!.parameters?.[0]?.type)}]: ${t(decl.indexSignatures[0]!.type)} }`;
      return "{}";
    }
    case "unknown":
      return type.name;
    default:
      return (type as { name?: string }).name ?? "unknown";
  }
}

function typeParams(params: JSONOutput.TypeParameterReflection[] | undefined, depth: number): string {
  if (!params?.length) return "";
  return `<${params.map((p) => p.name + (p.type ? " extends " + typeText(p.type, depth) : "") + (p.default ? " = " + typeText(p.default, depth) : "")).join(", ")}>`;
}
function signatureText(sig: JSONOutput.SignatureReflection, style: "declaration" | "arrow", depth = 0, name = sig.name): string {
  const params = (sig.parameters ?? []).map((p) => `${p.flags?.isRest ? "..." : ""}${p.name}${p.flags?.isOptional || p.defaultValue ? "?" : ""}: ${typeText(p.type, depth + 1)}`).join(", ");
  const tps = typeParams(sig.typeParameters, depth + 1);
  return style === "arrow" ? `${tps}(${params}) => ${typeText(sig.type, depth + 1)}` : `${name}${tps}(${params}): ${typeText(sig.type, depth + 1)}`;
}

/** Turn TypeDoc's project JSON into the docs model. */
export function normalize(project: JSONOutput.ProjectReflection): ApiModel {
  const modules = project.children ?? [];
  const byFile = new Map<string, JSONOutput.DeclarationReflection>();
  for (const mod of modules) {
    const file = mod.sources?.[0]?.fileName;
    if (file) byFile.set(file.replace(/^libs\//, ""), mod);
    byFile.set(mod.name, mod);
  }
  const symbols: ApiSymbol[] = [];
  const entries: ApiModel["entries"] = [];
  for (const { entry, file, runsOn, summary } of app().api.entries) {
    const mod = byFile.get(file) ?? byFile.get(file.replace(/\.ts$/, "").replace(/\/index$/, "")) ?? (modules.length === 1 ? modules[0] : undefined);
    if (!mod) throw new Error(`api: no TypeDoc module for ${file} (modules: ${modules.map((m) => m.name).join(", ")})`);
    const href = "/api/" + entry.replace(/^@/, "") + "/";
    const names: string[] = [];
    for (const child of mod.children ?? []) {
      if (child.name.startsWith("_") || child.comment?.modifierTags?.includes("@internal")) continue;
      const symbol = describe(child, entry, runsOn);
      if (!symbol) continue;
      symbols.push(symbol);
      names.push(symbol.name);
    }
    entries.push({ entry, summary, runsOn, href, symbols: names.sort() });
  }
  return assignHrefs({ entries, symbols });
}

/** Kinds in the order they claim the plain URL when names differ only in letter case: values before types. */
const HREF_RANK = ["function", "class", "variable", "enum", "namespace", "interface", "type"];
const rank = (kind: string) => (HREF_RANK.includes(kind) ? HREF_RANK.indexOf(kind) : HREF_RANK.length);

/**
 * Give every page a URL that is unique ignoring letter case (`codeInfo` and `CodeInfo` would be one file
 * on macOS / Windows file systems and on case-insensitive hosts). Entry pages keep `/api/<entry>/`; a
 * symbol keeps `<entry href><name>/` unless a page already took that path in another case, then it gets
 * `<name>-<kind>/` (`CodeInfo-interface`) when no other name in its case group has that kind, else
 * `<name>-<n>/` (both functions: `JsonLd` / `jsonLd-2`). Among names equal ignoring case, values (function, class, variable, …) claim the plain
 * URL before types (interface, type), then code point order. Declarations merged under one name (same
 * key: namespace + interface) share a page. Deterministic: independent of TypeDoc's order.
 */
export function assignHrefs(model: ApiModel): ApiModel {
  const taken = new Set<string>();
  const claim = (href: string) => {
    const key = href.toLowerCase();
    if (taken.has(key)) return false;
    taken.add(key);
    return true;
  };
  for (const entry of model.entries) {
    entry.href = "/api/" + entry.entry.replace(/^@/, "") + "/";
    if (!claim(entry.href)) throw new Error(`api: entry pages ${entry.href} and another one differ only in letter case`);
  }
  const ordered = [...model.symbols].sort(
    (a, b) =>
      (a.entry < b.entry ? -1 : a.entry > b.entry ? 1 : 0) ||
      (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0) ||
      rank(a.kind) - rank(b.kind) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
  // Kinds per case-insensitive name (distinct keys): a kind suffix only tells apart a kind that occurs once.
  const kinds = new Map<string, Map<string, Set<string>>>();
  for (const symbol of ordered) {
    const group = (symbol.entry + "#" + symbol.name).toLowerCase();
    const keys = kinds.get(group) ?? kinds.set(group, new Map()).get(group)!;
    (keys.get(symbol.kind) ?? keys.set(symbol.kind, new Set()).get(symbol.kind)!).add(symbol.key);
  }
  const byKey = new Map<string, string>();
  for (const symbol of ordered) {
    const shared = byKey.get(symbol.key);
    if (shared) {
      symbol.href = shared;
      continue;
    }
    const base = "/api/" + symbol.entry.replace(/^@/, "") + "/" + symbol.name;
    let href = base + "/";
    const unique = kinds.get((symbol.entry + "#" + symbol.name).toLowerCase())!.get(symbol.kind)!.size === 1;
    if (!claim(href) && !(unique && claim((href = `${base}-${symbol.kind}/`)))) for (let n = 2; !claim((href = `${base}-${n}/`)); n++);
    symbol.href = href;
    byKey.set(symbol.key, href);
  }
  return model;
}

function describe(child: JSONOutput.DeclarationReflection, entry: string, runsOn: RunsOn): ApiSymbol | undefined {
  const kind = KIND[child.kind] ?? "symbol";
  if (kind === "reference") return undefined; // re-exported under another name; documented at its own entry
  const signatures = child.signatures ?? [];
  const comment = child.comment ?? signatures.find((s) => s.comment)?.comment;
  const text = commentText(comment?.summary);
  const sigTexts: string[] = [];
  let params: ApiParam[] = [];
  let returns: string | undefined;
  if (signatures.length) {
    for (const sig of signatures) sigTexts.push(`function ${signatureText(sig, "declaration", 0, child.name)}`);
    const main = signatures[signatures.length - 1]!;
    params = (main.parameters ?? []).map((p) => ({
      name: p.name,
      type: typeText(p.type),
      optional: Boolean(p.flags?.isOptional || p.defaultValue),
      doc: commentText(p.comment?.summary),
      ...(p.defaultValue && p.defaultValue !== "..." ? { default: p.defaultValue } : {}),
    }));
    returns = typeText(main.type);
  } else if (kind === "type") sigTexts.push(`type ${child.name}${typeParams(child.typeParameters, 0)} = ${typeText(child.type)}`);
  else if (kind === "variable") sigTexts.push(`const ${child.name}: ${typeText(child.type)}`);
  else if (kind === "interface" || kind === "class") {
    const heritage = (child.extendedTypes ?? []).map((t) => typeText(t));
    sigTexts.push(`${kind} ${child.name}${typeParams(child.typeParameters, 0)}${heritage.length ? " extends " + heritage.join(", ") : ""}`);
  }
  const members: ApiMember[] = [];
  for (const member of child.children ?? []) {
    if (member.name.startsWith("_") || member.flags?.isPrivate || member.comment?.modifierTags?.includes("@internal")) continue;
    const memberKind = KIND[member.kind] ?? "member";
    const doc = commentText((member.comment ?? member.signatures?.[0]?.comment)?.summary);
    const signature = member.signatures?.length
      ? member.signatures.map((s) => signatureText(s, "declaration", 0, member.name)).join("\n")
      : `${member.flags?.isReadonly ? "readonly " : ""}${member.name}${member.flags?.isOptional ? "?" : ""}: ${typeText(member.type)}`;
    const fallback = tag(member.comment, "@default") ?? (member.defaultValue && member.defaultValue !== "..." ? member.defaultValue : undefined);
    members.push({ name: member.name, kind: memberKind, signature, doc, optional: Boolean(member.flags?.isOptional), ...(fallback ? { default: fallback } : {}) });
  }
  const source = child.sources?.[0] ?? signatures[0]?.sources?.[0];
  const file = source ? source.fileName : "";
  const line = source?.line ?? 1;
  const examples = (comment?.blockTags ?? []).filter((t) => t.tag === "@example").map((t) => commentText(t.content));
  const since = tag(comment, "@since");
  const deprecated = tag(comment, "@deprecated");
  const experimental = comment?.modifierTags?.includes("@experimental");
  return {
    key: `${entry}#${child.name}`,
    entry,
    name: child.name,
    kind,
    summary: text ? firstSentence(text) : "",
    remarks: text,
    signatures: sigTexts,
    params,
    ...(returns ? { returns } : {}),
    members,
    runsOn,
    status: experimental ? "experimental" : "stable",
    ...(since ? { since } : {}),
    ...(deprecated !== undefined ? { deprecated } : {}),
    examples,
    source: { file, line, url: `${app().site.repo}/blob/${app().site.repoRef}/${file}#L${line}` },
    // Final URL from `assignHrefs` (unique ignoring letter case).
    href: "/api/" + entry.replace(/^@/, "") + "/" + child.name + "/",
  };
}

/** Run TypeDoc over the app's `api.config.ts` entries and write `<root>/src/generated/api.json`. */
export async function buildApi(root: string): Promise<ApiModel> {
  const { repo, site, api } = await loadApp(root);
  const typedoc = await Application.bootstrapWithPlugins({
    entryPoints: api.entries.map((e) => resolve(repo, "libs", e.file)),
    tsconfig: fileURLToPath(new URL("tsconfig.api.json", import.meta.url)),
    skipErrorChecking: true,
    excludePrivate: true,
    excludeInternal: true,
    excludeExternals: true,
    disableSources: false,
    sourceLinkTemplate: `${site.repo}/blob/${site.repoRef}/{path}#L{line}`,
    gitRevision: site.repoRef,
    disableGit: true,
    basePath: repo,
    logLevel: "Error",
  });
  const project = await typedoc.convert();
  if (!project) throw new Error("api: TypeDoc failed to convert the entry points");
  const json = typedoc.serializer.projectToObject(project, repo as Parameters<typeof typedoc.serializer.projectToObject>[1]);
  const model = normalize(json);
  model.symbols.sort((a, b) => (a.key < b.key ? -1 : 1));
  await writeFile(resolve(root, "src/generated/api.json"), JSON.stringify(model, null, 1) + "\n");
  return model;
}

/** CLI: `docs-kit api <app root> [--missing]`. */
export async function apiCommand(root: string, args: string[]): Promise<void> {
  const model = await buildApi(root);
  const { repo } = app();
  const missing = model.symbols.filter((s) => !s.summary);
  console.log(`api: ${model.symbols.length} symbols in ${model.entries.length} entry points (${missing.length} without a summary)`);
  if (args.includes("--missing")) for (const s of missing) console.log("  " + s.key + "  " + relative(repo, resolve(repo, s.source.file)) + ":" + s.source.line);
}
