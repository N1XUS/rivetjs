// ZERO UI-JS2 (2026-10-26): locale tables ship only the languages a build can render.
//
// A locale table is a module-level `export const name = { "ar-AE": …, "de-DE": …, "en-US": …, … }` (pure data: string
// keys, string / object / array values) marked `// @rivet-locale-table` on the line before it (cdk `*/intl.ts`: every
// react-aria locale, 34 entries). Lookups (`stringsFor`, `getStringsForLocale`, `dismissLabel`) pick the exact key, else
// the first key of the locale's language, else `en-US` — so keeping, in source order, EVERY key of a language keeps
// every lookup of that language exact.
//
// Production client builds (not dev, not server builds) of an app that DECLARES its locales (`rivet({ locales })`, else
// the `@rivetjs/i18n/vite` plugin's `locales`) replace the table with the keys of the declared languages + an `en-US`
// fallback, and attach `{ l: languages, f: () => import(full table) }` under `Symbol.for("rivet.locales")` (cdk
// lookups' file-local `localeTable`). A lookup for a language outside `l` starts loading the full table (its own chunk)
// and reads it from then on: that first render may show `en-US` strings, so apps list every language they serve.
// Undeclared (ruling 2026-10-26): every table ships whole — exact for any locale, no fallback flash.

import { parseAst } from "vite";

interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/** The marker comment of a locale table (on the line before its `export const`). */
export const LOCALE_TABLE_MARK = "@rivet-locale-table";

/**
 * Languages of `locales` (lower-case first subtag, and its canonical form: `iw` → `he`), always with `en`. Strings Node's
 * ICU knows no locale data for (`tsx` of a code fence `lang`) are dropped: no table has keys of such a language.
 */
export function languagesOf(locales: Iterable<string>): Set<string> {
  const languages = new Set(["en"]);
  for (const locale of locales) {
    let canonical: string;
    try {
      if (!Intl.DateTimeFormat.supportedLocalesOf(locale).length) continue;
      canonical = new Intl.Locale(locale).language;
    } catch {
      continue;
    }
    languages.add(locale.split("-")[0]!.toLowerCase());
    languages.add(canonical);
  }
  return languages;
}

export interface LocaleTable {
  /** The export's name. */
  name: string;
  /** Source range of the object literal. */
  start: number;
  end: number;
  /** Its keys in source order, each with the source text of its value. */
  entries: readonly (readonly [key: string, text: string])[];
}

const DATA = new Set(["ObjectExpression", "ArrayExpression", "Literal", "StringLiteral", "TemplateLiteral", "Property", "ObjectProperty"]);

/** True when `node` is pure data (objects, arrays, string / number literals, templates without expressions). */
function pureData(node: Node): boolean {
  if (!DATA.has(node.type)) return false;
  if (node.type === "TemplateLiteral") return (node.expressions as Node[]).length === 0;
  if (node.type === "Property" || node.type === "ObjectProperty") {
    if (node.computed || node.kind !== "init" || node.method) return false;
    return pureData(node.value as Node);
  }
  if (node.type === "ObjectExpression") return (node.properties as Node[]).every(pureData);
  if (node.type === "ArrayExpression") return (node.elements as (Node | null)[]).every((element) => element !== null && pureData(element));
  return true;
}

const keyOf = (property: Node): string | null => {
  const key = property.key as Node;
  if (key.type === "Identifier") return key.name as string;
  if ((key.type === "Literal" || key.type === "StringLiteral") && typeof key.value === "string") return key.value;
  return null;
};

/** The marked locale tables of a module (empty when it has none, or a marked table is not pure data). */
export function localeTables(code: string, file: string): LocaleTable[] {
  if (!code.includes(LOCALE_TABLE_MARK)) return [];
  let program: { body: Node[] };
  try {
    program = parseAst(code, { lang: /\.tsx$/.test(file) ? "tsx" : /\.ts$/.test(file) ? "ts" : "js" }) as unknown as { body: Node[] };
  } catch {
    return [];
  }
  const tables: LocaleTable[] = [];
  for (const node of program.body) {
    if (node.type !== "ExportNamedDeclaration") continue;
    const declaration = node.declaration as Node | null;
    if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") continue;
    // The marker: a comment on the line(s) right before the declaration.
    const before = code.slice(code.lastIndexOf("\n", code.lastIndexOf("\n", node.start - 1) - 1) + 1, node.start);
    if (!before.includes(LOCALE_TABLE_MARK)) continue;
    for (const declarator of declaration.declarations as Node[]) {
      const id = declarator.id as Node;
      let init = declarator.init as Node | null;
      while (init && (init.type === "TSAsExpression" || init.type === "TSSatisfiesExpression" || init.type === "ParenthesizedExpression"))
        init = init.expression as Node;
      if (id.type !== "Identifier" || init?.type !== "ObjectExpression" || !pureData(init)) continue;
      const entries: [string, string][] = [];
      let ok = true;
      for (const property of init.properties as Node[]) {
        const key = keyOf(property);
        if (key === null) ok = false;
        // Pure data (checked above): its JSON, one line (chunk line numbers stay; `renderChunk` maps no columns).
        else entries.push([key, JSON.stringify(new Function(`return (${code.slice((property.value as Node).start, (property.value as Node).end)});`)())]);
      }
      if (ok && entries.some(([key]) => key === "en-US")) tables.push({ name: id.name as string, start: init.start, end: init.end, entries });
    }
  }
  return tables;
}

/** The kept entries of `table` for `languages`: every key of a kept language, in source order, and `en-US`. */
export function keptEntries(table: LocaleTable, languages: ReadonlySet<string>): LocaleTable["entries"] {
  return table.entries.filter(([key]) => key === "en-US" || languages.has(key.split("-")[0]!.toLowerCase()));
}

/** Object literal text of `entries`. */
export const entriesText = (entries: LocaleTable["entries"]): string => `{${entries.map(([key, text]) => `${JSON.stringify(key)}: ${text}`).join(", ")}}`;
