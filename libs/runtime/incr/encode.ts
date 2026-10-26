// Row HTML of a proven incremental list row (lane INCR2): the string the renderer writes for a compiled record whose slots
// are scalars, attribute records holding a scalar, and nested compiled records of such (a proven row: native elements, text
// and attribute holes over its item's fields). Same rules as `server.ts` `recordString` (text: `escapeText`, numbers as
// `String`, null / undefined / booleans nothing; attributes: `encodeAttributeValue`, the generic rule the renderer's raw
// paths reproduce). Anything else (a thenable, a function, an array, a translated record, a user template): null — the row
// renders through the renderer this request and is not stored.
import { ATTRIBUTE, COMPILED, escapeText, encodeAttributeValue } from "../template.ts";
import type { AttributeRecord, Coercible, TemplateRecord } from "../template.ts";

const VARIANTS = Symbol.for("rivet.variants");
type Branded = { readonly [COMPILED]?: unknown; readonly [ATTRIBUTE]?: unknown; readonly [VARIANTS]?: unknown };

/** The HTML of `record` (a compiled record), or null when a slot is not one this encoder writes. */
export function recordHtml(record: unknown, depth = 0): string | null {
  if (record === null || typeof record !== "object" || !(record as Branded)[COMPILED] || (record as Branded)[VARIANTS] !== undefined || depth > 16) return null;
  const { fragments, slots } = record as TemplateRecord;
  let out = fragments[0]!;
  for (let k = 0; k < slots.length; k++) {
    const child = slots[k] as unknown;
    const kind = typeof child;
    if (kind === "string") out += escapeText(child as string);
    else if (kind === "number") out += child as number;
    else if (child != null && kind !== "boolean") {
      if (kind !== "object") return null;
      if ((child as Branded)[ATTRIBUTE]) {
        const value = (child as AttributeRecord).value;
        if (value !== null && (typeof value === "object" || typeof value === "function")) return null;
        out += encodeAttributeValue((child as AttributeRecord).name, value as Coercible, (child as AttributeRecord).namespace);
      } else {
        const inner = recordHtml(child, depth + 1);
        if (inner === null) return null;
        out += inner;
      }
    }
    out += fragments[k + 1]!;
  }
  return out;
}
