// DOM form controls (compiler ABI `_model`, `_select`, `_rcdata`; re-exported by `dom.ts`): `model:` two-way
// bindings, select values applied after their options, RCDATA (`<textarea>` / `<title>`) text. Its own
// module so only chunks whose templates bind a control carry it (`sideEffects: false`).
import { _bindingEffect, _scoped, effect, getOwner, onCleanup, runWithOwner, untrack } from "@rivetjs/reactivity";
import type { Owner, Signal } from "@rivetjs/reactivity";

const HTML = "http://www.w3.org/1999/xhtml";
const TEXT_TYPES = ["text", "search", "email", "url", "tel", "password"];
// A listener can fire while its owner is mid-disposal; writes reaching a disposed owner are dropped.
const live = (owner: Owner | null): boolean => !(owner as unknown as { disposed?: boolean } | null)?.disposed;
const selection = (s: HTMLSelectElement): string | string[] => (s.multiple ? [...s.selectedOptions].map((o) => o.value) : s.value);

/**
 * Compiler ABI: `model:value` (text input / textarea, IME composition aware) / `model:checked` (checkbox)
 * bound to a writable signal both ways.
 */
export function _model(target: HTMLInputElement | HTMLTextAreaElement, kind: "value" | "checked", state: Signal<string> | Signal<boolean>): void {
  const owner = getOwner(),
    tag = target.localName,
    type = target.type?.toLowerCase();
  if (typeof state !== "function" || typeof state.set !== "function") throw TypeError("model requires a writable signal");
  if (
    kind === "checked"
      ? tag !== "input" || type !== "checkbox"
      : kind !== "value" || !["input", "textarea"].includes(tag) || (tag === "input" && !TEXT_TYPES.includes(type!))
  )
    throw TypeError("Unsupported model; use text input/textarea value or checkbox checked");
  let composing = false,
    active = true;
  effect(() => {
    const next = state();
    if (typeof next !== (kind === "value" ? "string" : "boolean")) throw TypeError("Invalid model signal value");
    if (!composing && (target as HTMLInputElement)[kind] !== next) ((target as HTMLInputElement)[kind] as unknown) = next;
  });
  const write = () => {
    if (active && !composing && live(owner)) runWithOwner(owner, () => (state as Signal<unknown>).set((target as HTMLInputElement)[kind]));
  };
  const start = () => {
      composing = true;
    },
    end = () => {
      composing = false;
      write();
    };
  const typeName = kind === "value" ? "input" : "change";
  target.addEventListener(typeName, write);
  if (kind === "value") {
    target.addEventListener("compositionstart", start);
    target.addEventListener("compositionend", end);
  }
  onCleanup(() => {
    active = false;
    target.removeEventListener(typeName, write);
    target.removeEventListener("compositionstart", start);
    target.removeEventListener("compositionend", end);
  });
}

/**
 * Compiler ABI: `<select value>` (a value, or an array of values for `multiple`), emitted after the
 * select's children so it applies once the options exist, and again whenever options change
 * (MutationObserver). `model:value` passes its signal as both `read` and `model`: selections write it
 * back.
 */
export function _select(target: HTMLSelectElement, read: () => unknown, model?: Signal<string> | Signal<string[]>): void {
  const owner = getOwner(),
    observer = new MutationObserver(() => apply()),
    write = () => live(owner) && runWithOwner(owner, () => model!.set(selection(target) as never));
  let last: unknown;
  const apply = () => {
    if (target.multiple || Array.isArray(last)) {
      const list = (Array.isArray(last) ? last : last == null ? [] : [last]).map(String);
      if (list.length > 16) {
        const selected = new Set(list);
        for (const o of target.options) o.selected = selected.has(o.value);
      } else for (const o of target.options) o.selected = list.includes(o.value);
    } else target.value = last == null ? "" : String(last);
  };
  effect(() => {
    last = read();
    apply();
  });
  observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["value"] });
  if (model) target.addEventListener("input", write);
  onCleanup(() => {
    observer.disconnect();
    target.removeEventListener("input", write);
  });
}

/**
 * Resume ABI (select `model:value` element effect): a selection changed before the runtime booted (not the
 * server's `selected`) wins over the signal; then the select stays bound both ways (`_select`).
 */
export function _resumeSelect(target: HTMLSelectElement, model: Signal<string> | Signal<string[]>): void {
  untrack(() => {
    if ([...target.options].some((o) => o.selected !== o.defaultSelected)) model.set(selection(target) as never);
    _select(target, model, model);
  });
}

/**
 * Compiler ABI: RCDATA content (`<textarea>` / `<title>` with expression children, or textarea text the
 * parser would trim): one retained Text node per part (strings static, functions bound); a textarea's
 * `value` follows its text. Parts must be scalar.
 */
export function _rcdata(
  target: HTMLTextAreaElement | HTMLTitleElement | SVGTitleElement,
  parts: readonly (string | (() => string | number | bigint | boolean | null | undefined))[],
): void {
  if (target.localName !== "textarea" && target.localName !== "title") throw TypeError("RCDATA binding requires textarea or title");
  const textarea = target.namespaceURI === HTML && target.localName === "textarea",
    doc = target.ownerDocument,
    nodes: Text[] = [];
  target.replaceChildren();
  onCleanup(() => {
    for (const node of nodes) node.remove();
  });
  const sync = () => {
    if (textarea) {
      const value = target.textContent;
      if ((target as HTMLTextAreaElement).value !== value) (target as HTMLTextAreaElement).value = value;
    }
  };
  for (const part of parts) {
    const node = doc.createTextNode(typeof part === "string" ? part : "");
    nodes.push(node);
    target.append(node);
    if (typeof part === "function") {
      // Each read in its own scope (disposed on the next read, on a throw and on a rejected value): what a
      // rejected read built (a component's effects / cleanups) is released at once.
      const read = _scoped(() => {
        const value = part();
        if (value !== null && (typeof value === "object" || typeof value === "function" || typeof value === "symbol"))
          throw TypeError("Textarea/title children must be scalar text; structural and Promise values are unsupported");
        return value;
      });
      _bindingEffect(() => {
        const value = read();
        const next = value == null || typeof value === "boolean" ? "" : String(value);
        if (node.data !== next) node.data = next;
        sync();
      });
    } else if (typeof part !== "string") throw TypeError("Invalid RCDATA part");
    sync();
  }
}
