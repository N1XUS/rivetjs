// Server-driven errors: the app unwraps whatever its backend returns into `{ path, key | message }`
// entries; forms maps paths to fields (unknown paths → form-level). Use in actions
// (`invalid(mapIssues(...))`) or the browser (`setIssues(form, issueRecord(mapIssues(...)))`).
import { canonicalName, joinPath, matchesPattern } from "./path.ts";
import type { Issue } from "./types.ts";

/** An issue addressed by path (`""` = the whole form). */
export interface MappedIssue extends Issue {
  readonly path: string;
}
/** One unwrapped backend error: a dotted path (use `fromPointer` / `fromBracketPath`) and a key or message. */
export interface BackendIssue {
  readonly path?: string | readonly (string | number)[] | null;
  readonly key?: string;
  readonly message?: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

/**
 * Map a backend error to issues. `known`: field paths or patterns (`items.$.sku`) the form renders;
 * paths outside it (and missing or unparsable paths) become form-level issues (`path: ""`).
 */
export function mapIssues<E>(error: E, unwrap: (error: E) => readonly BackendIssue[] | null | undefined, options: { known?: readonly string[] } = {}): MappedIssue[] {
  const out: MappedIssue[] = [];
  for (const entry of unwrap(error) ?? []) {
    const key = entry.key ?? entry.message ?? "errors.unknown";
    let path = entry.path == null ? "" : normalize(typeof entry.path === "string" ? entry.path : joinPath(entry.path));
    if (path && options.known && !options.known.some((pattern) => matchesPattern(pattern, path))) path = "";
    out.push({ path, key, ...(entry.message !== undefined ? { message: entry.message } : {}), ...(entry.params ? { params: entry.params } : {}) });
  }
  return out;
}
/** Dotted path (`a.b.0`, `a[b][0]`) or `""` when invalid (prototype keys included). */
const normalize = (path: string): string => canonicalName(path) ?? "";

/** JSON Pointer (RFC 6901: `/items/0/sku`, `~1` = `/`, `~0` = `~`) → `items.0.sku`. */
export function fromPointer(pointer: string): string {
  if (pointer === "" || pointer === "/") return "";
  const body = pointer.startsWith("#") ? decodeURIComponent(pointer.slice(1)) : pointer;
  if (!body.startsWith("/")) return "";
  return body
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
    .join(".");
}
/** Bracket path (`items[0].sku`, `user["name"]`) → `items.0.sku`; `""` when unparsable. */
export function fromBracketPath(path: string): string {
  const normalized = path.replace(/\[(["'])(.*?)\1\]/g, ".$2");
  return normalize(normalized);
}

/** Issues by path for `setIssues` (`""` = form-level). */
export function issueRecord(issues: readonly MappedIssue[]): Record<string, Issue[]> {
  const out: Record<string, Issue[]> = Object.create(null);
  for (const { path, ...issue } of issues) (out[path] ??= []).push(issue);
  return out;
}
