// `_svgShapes` (DOM twin of `server-svg.ts`): static SVG child shapes from `[tag, attributes]` data (lucide
// `IconNode`), built once per data array and document, cloned per call. Its own module: pages that never call it
// bundle none of it.
import { _adoption, _attrWrite } from "./dom-v2.ts";
import { LAZY_ROWS } from "./lazy-rows.ts";
import { _constructionDoc, _parseHTML } from "./dom.ts";
import type { CompiledElement } from "./jsx-runtime.ts";

/** `[tag, attributes]` per shape (lucide `IconNode`): a static, never-mutated array (it is the cache key). */
export type SvgShapes = readonly (readonly [tag: string, attrs: Readonly<Record<string, unknown>>])[];

const SVG = "http://www.w3.org/2000/svg";
// Same name rules as a `{...attrs}` spread (`dom-v2-spread.ts` SAFE_NAME / UNSAFE_NAME): no `on*`, no compiler
// markers, no raw-HTML / style sinks. Tags: plain element names only.
const SAFE_NAME = /^(?!on)(?!data-rivet-s\d)[A-Za-z_][\w:.-]*$/i,
  UNSAFE_NAME = /^(innerhtml|dangerouslysetinnerhtml|srcdoc|style)$/,
  TAG = /^[A-Za-z][\w-]*$/;
interface Built {
  doc: Document;
  node: Node;
}
let cache: WeakMap<SvgShapes, Built> | undefined;

/**
 * @internal Static SVG content for `[tag, attributes]` data (kit `Icon`'s shapes; the compiler twin import
 * resolves the server entry's string-chunk version on the server target). The elements are created once per
 * data array (identity) and construction document in the inert template document, with the attribute writer
 * a `{...attrs}` spread uses (same names, same values), then cloned per call: one element, or a fragment of
 * several. Data is read once: mutating the array or its objects later is not seen (lucide data is frozen by
 * convention); a different array is a different template.
 */
export function _svgShapes(shapes: SvgShapes): CompiledElement {
  const doc = _constructionDoc();
  let built = (cache ??= new WeakMap()).get(shapes);
  if (built === undefined || built.doc !== doc) cache.set(shapes, (built = { doc, node: build(doc, shapes) }));
  const clone = built.node.cloneNode(true);
  // Adopt run (lazy rows, `dom-adopt.ts` `_adoptRow`): like a `_tpl` clone, the probe records each shape and the adopt
  // run gets the server's back, so a materialised row keeps the server's `<path>` nodes (LAZY-FLIP 2026-10-21). Several
  // shapes go as an array of elements (a fragment has no server twin to map to).
  if (LAZY_ROWS && _adoption.node) {
    const hook = _adoption.node;
    return (clone.nodeType === 11 ? Array.from(clone.childNodes, (n) => hook(n, 0)) : hook(clone, 0)) as unknown as CompiledElement;
  }
  // A Node: typed as a JSX child (the twin returns a server record).
  return clone as unknown as CompiledElement;
}

function build(doc: Document, shapes: SvgShapes): Node {
  const inert = _parseHTML(doc, ""),
    owner = inert.ownerDocument;
  for (const [tag, attrs] of shapes) {
    if (!TAG.test(tag)) throw TypeError("Unsafe element name");
    const el = owner.createElementNS(SVG, tag);
    for (const name in attrs) {
      let value = attrs[name];
      if (name === "children" || name === "ref") continue;
      if (!SAFE_NAME.test(name) || UNSAFE_NAME.test(name.toLowerCase())) throw TypeError("Unsafe attribute name");
      if (typeof value === "function") value = (value as () => unknown)();
      _attrWrite(el, name, value);
    }
    inert.appendChild(el);
  }
  return inert.childNodes.length === 1 ? inert.firstChild! : inert;
}
