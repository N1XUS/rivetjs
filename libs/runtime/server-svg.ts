// `_svgShapes` (server twin of `dom-svg.ts`): static SVG child shapes from `[tag, attributes]` data (lucide
// `IconNode`) as one cached, pre-escaped markup chunk per data array. Its own module: pages that never call it
// bundle none of it.
import { _compiledRecord, encodeAttribute } from "./template.ts";
import type { TemplateRecord } from "./template.ts";
import { spreadAttributes, spreadChildren } from "./server-spread.ts";

/** `[tag, attributes]` per shape (lucide `IconNode`): a static, never-mutated array (it is the cache key). */
export type SvgShapes = readonly (readonly [tag: string, attrs: Readonly<Record<string, unknown>>])[];

const TAG = /^[A-Za-z][\w-]*$/,
  NO_SLOTS: readonly never[] = [];
let cache: WeakMap<SvgShapes, TemplateRecord> | undefined;

/**
 * @internal Static SVG content for `[tag, attributes]` data (kit `Icon`'s shapes; the compiler twin import
 * resolves the DOM entry's clone version in the browser). The markup is built once per data array (identity)
 * with the encoder a `<tag {...attrs}>` spread uses — same name checks, same escaping, so the bytes equal the
 * spread lowering's — and returned as one shared trusted compiled record (no slots, no resume state). Data is
 * read once: mutating the array or its objects later is not seen; a different array is a different chunk.
 */
export function _svgShapes(shapes: SvgShapes): TemplateRecord {
  let record = (cache ??= new WeakMap()).get(shapes);
  if (record === undefined) cache.set(shapes, (record = _compiledRecord(Object.freeze([markup(shapes)]), NO_SLOTS)));
  return record;
}

function markup(shapes: SvgShapes): string {
  let out = "";
  for (const [tag, attrs] of shapes) {
    if (!TAG.test(tag)) throw TypeError("Unsafe element name");
    out += "<" + tag;
    for (const record of spreadAttributes(attrs, tag, "svg")) out += encodeAttribute(record);
    // `spreadAttributes` keeps a `children` key for its content slot: icon shapes have none.
    spreadChildren();
    out += "></" + tag + ">";
  }
  return out;
}
