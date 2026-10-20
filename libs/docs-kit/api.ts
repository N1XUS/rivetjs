// Lookup helpers over the generated API model (tools/api.ts → <app>/src/generated/api.json).
// Used only while rendering (server/prerender); API pages have no browser code.
import model from "virtual:docs/api";
import type { ApiModel, ApiSymbol } from "./tools/api.ts";
export { RUNS_ON } from "./api-labels.ts";

export const api = model as unknown as ApiModel;
export type ApiEntry = ApiModel["entries"][number];

const symbolsByKey = new Map(api.symbols.map((s) => [s.key, s]));
/** URL path without `/api/` and slashes: `rivetjs/reactivity` or `rivetjs/reactivity/signal`. */
const slug = (href: string) => href.replace(/^\/api\//, "").replace(/\/$/, "");
const entriesBySlug = new Map(api.entries.map((e) => [slug(e.href), e]));
const symbolsBySlug = new Map(api.symbols.map((s) => [slug(s.href), s]));

export const symbolByKey = (key: string): ApiSymbol | undefined => symbolsByKey.get(key);
export const findApiPage = (path: string): { entry: ApiEntry } | { symbol: ApiSymbol } | undefined => {
  const entry = entriesBySlug.get(path);
  if (entry) return { entry };
  const symbol = symbolsBySlug.get(path);
  return symbol ? { symbol } : undefined;
};
export const apiPaths = (): string[] => [...entriesBySlug.keys(), ...symbolsBySlug.keys()];
/** The entry's symbols, once each (merged declarations share a name), linked by their own `href` (`tools/api.ts` `assignHrefs`). */
export const symbolsOf = (entry: ApiEntry): ApiSymbol[] =>
  [...new Set(entry.symbols)].map((name) => symbolsByKey.get(`${entry.entry}#${name}`)!).filter(Boolean);
export const entryOf = (symbol: ApiSymbol): ApiEntry => api.entries.find((e) => e.entry === symbol.entry)!;

export const packageOf = (entry: string) => entry.split("/").slice(0, 2).join("/");
