// No-JS field-array intents: `<button name="_intent" value="insert:items">` submits the form; the
// action applies the operation to the echoed values and re-renders instead of running the handler.
import { isIndex } from "../path.ts";

export type Raw = Record<string, string | string[]>;
export interface ArrayIntent {
  readonly op: "insert" | "remove" | "move" | "swap";
  readonly path: string;
  readonly a?: number;
  readonly b?: number;
}

/**
 * Parse `insert:items`, `insert:items:2`, `remove:items:1` (or `remove:items.1`), `move:items:0:2`,
 * `swap:items:0:2`. Null for anything else.
 */
export function parseIntent(intent: string): ArrayIntent | null {
  const match = /^(insert|remove|move|swap):(.+)$/.exec(intent);
  if (!match) return null;
  const op = match[1] as ArrayIntent["op"];
  let parts = match[2]!.split(":");
  // `remove:items.1`: the index as the path's last segment.
  if (op === "remove" && parts.length === 1) {
    const at = parts[0]!.lastIndexOf(".");
    if (at > 0 && isIndex(parts[0]!.slice(at + 1))) parts = [parts[0]!.slice(0, at), parts[0]!.slice(at + 1)];
  }
  const [path, ...numbers] = parts;
  if (!path || !/^[\w.-]+$/.test(path) || numbers.some((n) => !isIndex(n))) return null;
  const [a, b] = numbers.map(Number);
  if (op === "remove" && a === undefined) return null;
  if ((op === "move" || op === "swap") && (a === undefined || b === undefined)) return null;
  return { op, path, ...(a !== undefined ? { a } : {}), ...(b !== undefined ? { b } : {}) };
}

/** Row count of an array path in raw values (max submitted index + 1). */
export function rowCount(raw: Raw, path: string): number {
  let count = 0;
  const prefix = path + ".";
  for (const name in raw) {
    if (!name.startsWith(prefix)) continue;
    const index = name.slice(prefix.length).split(".")[0]!;
    if (isIndex(index)) count = Math.max(count, Number(index) + 1);
  }
  return count;
}

/** Apply an intent: raw values with rows re-indexed, and the new row count. */
export function applyIntent(raw: Raw, intent: ArrayIntent, maxRows = 1000): { values: Raw; rows: number } {
  const count = rowCount(raw, intent.path);
  const prefix = intent.path + ".";
  // Rows: index → { rest-of-name → value }.
  const rows: Raw[] = Array.from({ length: count }, () => ({}));
  const values: Raw = {};
  for (const name in raw) {
    if (!name.startsWith(prefix)) {
      values[name] = raw[name]!;
      continue;
    }
    const rest = name.slice(prefix.length);
    const dot = rest.indexOf(".");
    const index = dot < 0 ? rest : rest.slice(0, dot);
    if (!isIndex(index)) {
      values[name] = raw[name]!;
      continue;
    }
    rows[Number(index)]![dot < 0 ? "" : rest.slice(dot + 1)] = raw[name]!;
  }
  const { op, a, b } = intent;
  if (op === "insert") {
    if (rows.length < maxRows) rows.splice(Math.min(a ?? rows.length, rows.length), 0, {});
  } else if (op === "remove") {
    if (a! < rows.length) rows.splice(a!, 1);
  } else if (a! < rows.length && b! < rows.length) {
    if (op === "move") rows.splice(b!, 0, rows.splice(a!, 1)[0]!);
    else [rows[a!], rows[b!]] = [rows[b!]!, rows[a!]!];
  }
  rows.forEach((row, index) => {
    for (const rest in row) values[prefix + index + (rest ? "." + rest : "")] = row[rest]!;
  });
  return { values, rows: rows.length };
}
