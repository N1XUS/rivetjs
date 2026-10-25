// Server spread attributes (`{...x}` on a native element). Own module: pages without spreads bundle
// none of it (not even a renamed identifier).
import { _attributeName, _attributeRecord, SPREAD } from "./template.ts";
import type { AttributeNamespace, AttributeRecord } from "./template.ts";
import { MEDIA_URLS } from "./url.ts";
import { _trigger } from "./server-trigger.ts";
import { _style, _styleAttr } from "./style.ts";

/**
 * Compiler ABI: attributes of a native element with `{...x}` from its merged object (spreads and plain
 * attributes in source order, later keys win). Same rules as `attribute`; `on[A-Z]` functions (and
 * null) are listeners, omitted on the server; other functions are accessors, read once; `ref` is not
 * an attribute; `children` is kept for `spreadChildren` (the content when the element has no JSX
 * children). `className`/`class` (`htmlFor`/`for`) keep the later one, at the earlier one's position. A
 * null / undefined value renders nothing: no record (after the name check); it still clears an earlier key of
 * the same output name (`className: "a", class: undefined`) and holds the position for a later one.
 * `names` (resume recorder): receives the rendered attribute names in output order (absent ones left out) — the
 * resumed binding's rendered-names list.
 */
export function spreadAttributes(value: object | null | undefined, tag: string, namespace?: "svg" | "mathml", names?: string[]): AttributeRecord[] {
  const records: AttributeRecord[] = [],
    at = new Map<string, number>();
  // Runtime-made: the renderer admits the records' values without probing the array (`server.ts` `admit`).
  (records as unknown as { [SPREAD]: true })[SPREAD] = true;
  let children: unknown,
    text: unknown,
    defaultText: unknown,
    holes = false;
  for (const key in value) {
    let item = (value as Record<string, unknown>)[key];
    if (key === "children") {
      children = item;
      continue;
    }
    // `<textarea>`: `value` / `defaultValue` are its content (RCDATA), not attributes.
    if (tag === "textarea" && (key === "value" || key === "defaultValue")) {
      if (typeof item === "function") item = item();
      if (key === "value") text = item;
      else defaultText = item;
      continue;
    }
    // React: a controlled `value` / `checked` wins over the uncontrolled default (both write that attribute).
    if ((key === "defaultValue" && "value" in value!) || (key === "defaultChecked" && "checked" in value!)) continue;
    // A spread ref (cdk parts): it may attach listeners imperatively at adopt — the unit listens to any event (D5, `*`).
    if (key === "ref") {
      if (item != null) _trigger.ev?.("");
      continue;
    }
    // `on[A-Z]` (char codes: a regex test per key was a top self-time line of cdk part SSR).
    const third = key.charCodeAt(2);
    if (key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && third >= 65 && third <= 90 && (item == null || typeof item === "function")) {
      // A listener: its type joins the derived loader's delegated types (a cold `pointerenter` / `scroll` wakes the page).
      if (item != null) _trigger.ev?.(key);
      continue;
    }
    // Absent: validate the name (unsafe names throw), then a placeholder (the name), dropped below: it clears an earlier
    // same-name key and keeps the position for a later alias (`class` after an absent `className`). cdk parts pass ~30
    // keys, most undefined: each was a record admitted, visited and encoded as "" (TRANSFORM-AUDIT X1).
    if (item == null && key !== "style") {
      const name = _attributeName(key, namespace),
        index = at.get(name);
      if (index === undefined) at.set(name, records.push(name as never) - 1);
      else records[index] = name as never;
      holes = true;
      continue;
    }
    // `style`: a style object, encoded like an explicit `style={obj}` (strings throw).
    if (key === "style") {
      const index = at.get("style"),
        record = _styleAttr("style", _style(typeof item === "function" ? item() : item));
      if (index === undefined) at.set("style", records.push(record) - 1);
      else records[index] = record;
      continue;
    }
    // Validates the name (unsafe names and `on*` strings throw) before an accessor runs.
    const record = _attributeRecord(_attributeName(key, namespace), null, "html") as { -readonly [K in keyof AttributeRecord]: AttributeRecord[K] };
    if (typeof item === "function") item = item();
    record.value = item;
    // Media URL names are `src` / `srcset` / `poster` (3–6 chars, first letter s / p in any case): no string concat +
    // lowercase + regex for other names (`class`, `title`, `href`, `role`, `type`, `value` are 3–6 chars too).
    const length = record.name.length,
      first = record.name.charCodeAt(0) | 32;
    record.namespace =
      namespace ??
      (((first === 115 || first === 112) && length >= 3 && length <= 6 && MEDIA_URLS.test(tag + " " + record.name.toLowerCase())
        ? "media"
        : "html") as AttributeNamespace);
    const index = at.get(record.name);
    if (index === undefined) at.set(record.name, records.push(record) - 1);
    else records[index] = record;
  }
  // Absent names (placeholders) stay out: the resumed first run treats an unlisted key like a client render does (writes a
  // value, removes only an attribute the element carries), the same result as removing a listed absent name.
  if (names) for (const record of records) if (typeof record !== "string") names.push(record.name);
  if (holes) {
    let length = 0;
    for (let i = 0; i < records.length; i++) if (typeof records[i] !== "string") records[length++] = records[i]!;
    records.length = length;
  }
  // Last: an accessor above may render another spread element.
  content = text !== undefined ? text : defaultText !== undefined ? defaultText : children;
  return records;
}
let content: unknown;
/**
 * Compiler ABI: the content of a spread element without JSX children — the `children` of the object
 * the preceding `spreadAttributes` call (same element, evaluated just before) read.
 */
export function spreadChildren(): unknown {
  const value = content;
  content = undefined;
  return value;
}
