// Catalog loading and the per-key, per-locale table handed to the compiler.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { I18nError, paramsOf, parseMessage, type Variant } from "./icu.ts";

export interface I18nConfig {
  locales: readonly string[];
  defaultLocale: string;
  /** `"{locale}"` placeholder path relative to the Vite root, or a loader. */
  catalogs: string | ((locale: string) => Record<string, unknown> | Promise<Record<string, unknown>>);
  /** Explicit fallback per locale; every chain ends at `defaultLocale`. */
  fallback?: Readonly<Record<string, string>>;
  /** Non-default locale lacking a key (default `"error"`). Missing in the default locale is always an error. */
  missing?: "error" | "warn" | "fallback";
  routing?: { prefix: "always" | "as-needed" | "never" | Readonly<Record<string, string>> };
  strategy?: readonly string[];
  cookie?: { name?: string; maxAge?: number } | false;
  timeZone?: string;
  baseUrl?: string;
}
/** Key → one variant per locale (index = position in `config.locales`). */
export type Table = Record<string, Variant[]>;
export interface BuiltTable {
  table: Table;
  warnings: string[];
  files: string[];
}

export function flatten(tree: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? prefix + "." + k : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object" && !Array.isArray(v))
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    else throw new I18nError(`${key}: catalog values must be strings or nested objects`);
  }
  return out;
}

export function fallbackChain(locale: string, config: I18nConfig): string[] {
  const chain: string[] = [];
  for (let l: string | undefined = locale; l && !chain.includes(l); l = config.fallback?.[l]) chain.push(l);
  if (!chain.includes(config.defaultLocale)) chain.push(config.defaultLocale);
  return chain;
}

export function buildTable(config: I18nConfig, raw: Record<string, Record<string, unknown>>): BuiltTable {
  const { locales, defaultLocale } = config;
  if (!locales.includes(defaultLocale)) throw new I18nError(`defaultLocale "${defaultLocale}" is not in locales`);
  const missing = config.missing ?? "error";
  const flat = Object.fromEntries(locales.map((l) => [l, flatten(raw[l] ?? {})]));
  const keys = new Set(locales.flatMap((l) => Object.keys(flat[l]!)));
  const table: Table = {};
  const warnings: string[] = [];
  for (const key of [...keys].sort()) {
    if (flat[defaultLocale]![key] === undefined)
      throw new I18nError(`${key}: missing in default locale "${defaultLocale}"`);
    // Locales falling back to the same source share one parsed variant.
    const parsed = new Map<string, Variant>();
    const variants = locales.map((locale) => {
      const found = fallbackChain(locale, config).find((l) => flat[l]?.[key] !== undefined)!;
      if (found !== locale) {
        if (missing === "error") throw new I18nError(`${key}: missing in "${locale}"`);
        if (missing === "warn") warnings.push(`${key}: missing in "${locale}", using "${found}"`);
      }
      let v = parsed.get(found);
      if (v === undefined) parsed.set(found, (v = parseMessage(flat[found]![key]!, `${found}:${key}`)));
      return v;
    });
    const names = (v: Variant) => [...paramsOf(v).keys()].sort().join(",");
    const base = names(variants[locales.indexOf(defaultLocale)]!);
    locales.forEach((locale, i) => {
      const own = names(variants[i]!);
      if (own !== base)
        throw new I18nError(`${key}: params differ between "${defaultLocale}" (${base}) and "${locale}" (${own})`);
    });
    table[key] = variants;
  }
  return { table, warnings, files: [] };
}

export async function loadCatalogs(
  config: I18nConfig,
  root: string,
): Promise<{ raw: Record<string, Record<string, unknown>>; files: string[] }> {
  const raw: Record<string, Record<string, unknown>> = {};
  const files: string[] = [];
  for (const locale of config.locales) {
    if (typeof config.catalogs === "function") raw[locale] = await config.catalogs(locale);
    else {
      const file = resolve(root, config.catalogs.replaceAll("{locale}", locale));
      files.push(file);
      raw[locale] = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    }
  }
  return { raw, files };
}
