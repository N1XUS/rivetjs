import type { AttributeSlot, ServerTemplate, ServerValue } from "./server.ts";
import { DEV } from "#dev";
import { INVALID_URL, unsafeUrl } from "./url.ts";
import { escapeAttribute, escapeText } from "./escape.ts";
// HTML escaping lives in escape.ts (`@rivetjs/runtime/escape`, shared with the router); re-exported for server.ts.
export { escapeAttribute, escapeText };

/**
 * Native attribute namespace of an attribute slot. `media`: HTML, on a media source attribute
 * (`img`/`source` `src`/`srcset`, `video` `src`/`poster`, `audio` `src`) whose URL may be a
 * `data:` image, video or audio (the compiler emits it; the attribute itself carries no tag).
 */
export type AttributeNamespace = "html" | "svg" | "mathml" | "media";
/** Any value, spelled as a union so `value = String(value)` narrows it to string. */
export type Coercible = string | number | bigint | boolean | symbol | object | null | undefined;
/** Private brands prevent plain user objects from becoming trusted HTML. Registered (`Symbol.for`)
 * so duplicate runtime module instances (dev cache-busters) accept each other's values. */
export const TEMPLATE: unique symbol = Symbol.for("rivet.template");
export const ATTRIBUTE: unique symbol = Symbol.for("rivet.attribute");
export const COMPILED: unique symbol = Symbol.for("rivet.compiled");
/** Compiler-private list of rows sharing one plan; its captures live in one flat tape. */
export const LIST: unique symbol = Symbol.for("rivet.list");
/** Runtime-private: the attribute record array a server spread returns (`server-spread.ts`) (never thenable, never mutated once
 * formed); the renderer admits its records' values without an identity / thenable probe of the array. */
export const SPREAD: unique symbol = Symbol.for("rivet.spread");
/**
 * Runtime-private resume marker fragments (server-resume `<!--rN-->` / `<!--rN[-->`): a compiled record over them
 * holds the marker id in slot 0, and the writer leaves it out when it continues the stride of the two marks
 * written before it (the browser reads it from document order). The brand on the frozen fragment array is the
 * mode: MARK_CHAIN (may be left out), MARK_KEEP (always written), MARK_RESET (writes nothing; the next two marks
 * are written: what follows content the browser never sees as comments).
 */
export const MARK: unique symbol = Symbol.for("rivet.mark");
export const MARK_CHAIN = 1,
  MARK_KEEP = 2,
  MARK_RESET = 3;
export function _markFragments(fragments: string[], mode: number): readonly string[] {
  Object.defineProperty(fragments, MARK, { value: mode });
  return Object.freeze(fragments);
}
/** A template region record (`compiledTemplate` adds the COMPILED brand). */
export interface TemplateRecord extends ServerTemplate {
  readonly [TEMPLATE]: true;
  readonly [COMPILED]?: true;
}
/** A native attribute slot record. */
export interface AttributeRecord extends AttributeSlot {
  readonly [ATTRIBUTE]: true;
  readonly namespace: AttributeNamespace;
}
export const booleanAttributes = new Set(
  // = libs/compiler/rust/src/html.rs `BOOLEAN_ATTRIBUTES` and dom.ts `_booleans` (C4).
  "allowfullscreen alpha async autofocus autoplay checked controls default defer disabled disablepictureinpicture disableremoteplayback formnovalidate hidden inert ismap itemscope loop multiple muted nomodule novalidate open playsinline readonly required reversed selected shadowrootclonable shadowrootdelegatesfocus shadowrootserializable".split(
    " ",
  ),
);
// Records are class instances, not object literals with computed (symbol) keys: V8 holds a literal's
// transition maps weakly, so once every record of a shape is dead (a full GC between renders) the maps
// are cleared, the optimized record makers deopt and their keyed-define sites stay megamorphic for the
// process (server deep-500 0.10 → 0.25 ms after two full GCs). Class instance maps are still held only by
// live instances, so the first record of each class also makes a blank pinned one (module `let`, set in
// the factory: no load-time side effect, so an unused class still tree-shakes): no deopt after a full GC
// between renders at all. Brands stay own enumerable properties (`{ ...record }` keeps them), set in one order.
const NO_SLOTS: readonly ServerValue[] = [];
let templatePin: Template | null = null,
  compiledPin: Compiled | null = null,
  attributePin: Attribute | null = null;
class Template {
  declare [TEMPLATE]: true;
  declare fragments: readonly string[];
  declare slots: readonly ServerValue[];
  constructor(fragments: readonly string[], slots: readonly ServerValue[]) {
    this[TEMPLATE] = true;
    this.fragments = fragments;
    this.slots = slots;
  }
}
class Compiled {
  declare [TEMPLATE]: true;
  declare [COMPILED]: true;
  declare fragments: readonly string[];
  declare slots: readonly ServerValue[];
  constructor(fragments: readonly string[], slots: readonly ServerValue[]) {
    this[TEMPLATE] = true;
    this[COMPILED] = true;
    this.fragments = fragments;
    this.slots = slots;
  }
}
class Attribute {
  declare [ATTRIBUTE]: true;
  declare name: string;
  declare value: unknown;
  declare namespace: AttributeNamespace;
  constructor(name: string, value: unknown, namespace: AttributeNamespace) {
    this[ATTRIBUTE] = true;
    this.name = name;
    this.value = value;
    this.namespace = namespace;
  }
}
/** Runtime-private compiled record (no checks): fragments frozen, one more than slots. */
export function _compiledRecord(fragments: readonly string[], slots: readonly ServerValue[]): TemplateRecord {
  compiledPin ??= new Compiled([""], NO_SLOTS);
  return new Compiled(fragments, slots);
}
/** Runtime-private attribute record for an already validated output `name`. */
export function _attributeRecord(name: string, value: unknown, namespace: AttributeNamespace): AttributeRecord {
  attributePin ??= new Attribute("", null, "html");
  return new Attribute(name, value, namespace);
}
/** Create an ordered fragment/slot region. Fragments must be compiler-trusted HTML. */
export function template(fragments: readonly string[], slots: readonly ServerValue[] = []): TemplateRecord {
  if (fragments.length !== slots.length + 1) throw new TypeError("Template requires one more fragment than slots");
  templatePin ??= new Template([""], NO_SLOTS);
  return new Template(fragments, slots);
}
/**
 * Create a compiler-owned region whose adjacent scalar output may be batched. Fragments are
 * frozen (the compiler hoists them pre-frozen); the record and slots are not frozen per call
 * for speed, and mutating them is unsupported.
 */
export function compiledTemplate(fragments: readonly string[], slots: readonly ServerValue[] = []): TemplateRecord {
  if (fragments.length !== slots.length + 1) throw new TypeError("Template requires one more fragment than slots");
  if (!Object.isFrozen(fragments)) Object.freeze(fragments);
  compiledPin ??= new Compiled([""], NO_SLOTS);
  return new Compiled(fragments, slots);
}
const UNSAFE_ATTRIBUTE_NAMES = new Set(["dangerouslysetinnerhtml", "innerhtml", "srcdoc", "style"]);
// Validated string names map to their output spelling: HTML names lowercase, as the HTML parser
// stores them (React-style `encType` / `readOnly` / `tabIndex` → `enctype` / `readonly` / `tabindex`;
// the compiler writes literal attributes the same way, `html.rs` `encode_attribute`), SVG / MathML
// names keep their case (`viewBox`). One cache per case rule; compiled attribute names are source
// literals, so the caches are small; the bound keeps dynamic names from growing them without limit.
const attributeNames = new Map<string, string>(),
  foreignNames = new Map<string, string>();
function attributeName(name: string): string {
  if (typeof name === "string") {
    const known = attributeNames.get(name);
    if (known !== undefined) return known;
  }
  let output = validName(name).toLowerCase();
  // React's uncontrolled defaults are the content attributes (`defaultValue` → `value`, `defaultChecked`
  // → `checked`; literal twin: html.rs `encode_attribute`). A textarea's default is its content (the
  // compiler lowers `<textarea defaultValue>` as content on the server).
  if (output === "defaultvalue" || output === "defaultchecked") output = output.slice(7);
  if (typeof name === "string" && attributeNames.size < 1024) attributeNames.set(name, output);
  return output;
}
function validName(name: string): string {
  if (!/^[A-Za-z_][\w:.-]*$/.test(name) || /^on/i.test(name) || UNSAFE_ATTRIBUTE_NAMES.has(name.toLowerCase())) throw new TypeError("Unsafe attribute name");
  return name === "className" ? "class" : name === "htmlFor" ? "for" : name;
}
/** An attribute's output name in a namespace other than `html` (validated; see `attribute`). */
function namespacedName(name: string, namespace: AttributeNamespace): string {
  if (namespace === "html" || namespace === "media") return attributeName(name);
  const known = typeof name === "string" ? foreignNames.get(name) : undefined;
  if (known !== undefined) return known;
  const output = validName(name);
  if (typeof name === "string" && foreignNames.size < 1024) foreignNames.set(name, output);
  return output;
}
/**
 * Create a native attribute slot; value evaluation remains at the author position. A null / undefined
 * value renders nothing, so it allocates no record: the slot is `null` (an omitted child, the same
 * markup) — after the name check, so an unsafe name still throws.
 */
export function attribute(name: string, value: unknown, namespace: AttributeNamespace = "html"): AttributeRecord | null {
  // A validated HTML name is one cache read (compiled attribute names are source literals).
  const known = namespace === "html" ? attributeNames.get(name) : undefined;
  const output = known ?? (namespace === "html" ? attributeName(name) : namespacedName(name, namespace));
  if (value == null) return null;
  attributePin ??= new Attribute("", null, "html");
  return new Attribute(output, value, namespace);
}
/** Runtime-private: the validated output name `attribute(name, …, namespace)` writes (throws for unsafe names). */
export function _attributeName(name: string, namespace: AttributeNamespace = "html"): string {
  return (namespace === "html" ? attributeNames.get(name) : undefined) ?? (namespace === "html" ? attributeName(name) : namespacedName(name, namespace));
}
/** Encode an attribute slot, omitting null and false boolean attributes; unsafe URLs become INVALID_URL. */
export function encodeAttribute({ name, value, namespace = "html" }: AttributeSlot): string {
  return encodeAttributeValue(name, value as Coercible, namespace);
}
/** Positional form of encodeAttribute for compiler plans; allocates no slot record. */
export function encodeAttributeValue(name: string, value: Coercible, namespace: AttributeNamespace = "html"): string {
  if (value == null) return "";
  const lower = name.toLowerCase();
  if (namespace === "html" && booleanAttributes.has(lower)) {
    // `hidden` is enumerated (`until-found`): a non-empty string is its keyword, written verbatim.
    if (lower === "hidden" && typeof value === "string" && value !== "") return ` ${name}="${escapeAttribute(value)}"`;
    return value ? ` ${name}` : "";
  }
  // `popover` is enumerated: `true` is the empty keyword (= `auto`, light dismiss; `"true"` would be an
  // invalid value = `manual`), `false` omits it (C4). Strings are keywords, written verbatim.
  if (namespace === "html" && lower === "popover" && typeof value === "boolean") return value ? ` ${name}` : "";
  value = String(value);
  const scheme = unsafeUrl(lower, value, namespace === "media");
  if (scheme) {
    if (DEV) DEV.unsafeUrl(name, scheme);
    value = INVALID_URL;
  }
  return ` ${name}="${escapeAttribute(value)}"`;
}
