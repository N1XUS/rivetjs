// Issues: locale-agnostic `{ key, params?, message? }` records. Standard Schema issues map to dotted
// field paths (`items.0.qty`); issues without a path are form-level.
import type { StandardSchemaV1 } from "./standard-schema.ts";
import type { Issue, IssueLike } from "./types.ts";

/** Issues split by field (dotted path) and form level. */
export interface IssueMap {
  readonly fields: Record<string, Issue[]>;
  readonly form: Issue[];
}

/** Normalize an issue: a string becomes `{ key }`. */
export const toIssue = (value: IssueLike): Issue => (typeof value === "string" ? { key: value } : value);
/** Normalize one issue, a list or `undefined` to a list of issues. */
export const toIssues = (value: IssueLike | readonly IssueLike[] | undefined): Issue[] =>
  value === undefined ? [] : Array.isArray(value) ? (value as readonly IssueLike[]).map(toIssue) : [toIssue(value as IssueLike)];

/** Dotted path of a Standard Schema issue path (`[ "items", 0, { key: "qty" } ]` → `items.0.qty`). */
export function issuePath(path: StandardSchemaV1.Issue["path"]): string {
  if (!path || !path.length) return "";
  return path.map((segment) => String(typeof segment === "object" && segment !== null ? (segment as StandardSchemaV1.PathSegment).key : segment)).join(".");
}

/** Group Standard Schema issues by field path; root issues are form-level. Order is preserved. */
export function mapSchemaIssues(issues: readonly StandardSchemaV1.Issue[] | undefined): IssueMap {
  const fields: Record<string, Issue[]> = {};
  const form: Issue[] = [];
  for (const issue of issues ?? []) {
    const path = issuePath(issue.path);
    const item: Issue = { key: issue.message };
    if (!path) form.push(item);
    else (fields[path] ??= []).push(item);
  }
  return { fields, form };
}

/** Same issues (by key, message and params), in order. */
export function sameIssues(a: readonly Issue[] | undefined, b: readonly Issue[] | undefined): boolean {
  if (a === b) return true;
  if (!a?.length || !b?.length) return !a?.length && !b?.length;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    if (x.key !== y.key || x.message !== y.message || JSON.stringify(x.params) !== JSON.stringify(y.params)) return false;
  }
  return true;
}

/** Render an issue: `format(issue)` when given (i18n lookup), else its message or key. */
export const formatIssue = (issue: Issue, format?: (issue: Issue) => string): string => (format ? format(issue) : (issue.message ?? issue.key));
