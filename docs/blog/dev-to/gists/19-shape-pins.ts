// libs/reactivity/index.ts — "shape pins". The weirdest 5 lines in the codebase.
// V8 keeps a class instance's final map alive only through live instances (the constructor's field
// transitions are weak): after a full GC with no owner / effect alive (an unmount, an idle server) the maps
// are cleared and every function that embedded them deopts (context suite DOM themed-500 after GC: mount
// 1.26 → 1.05 ms, dispose 0.095 → 0.02). One parentless instance per class, made with the first real one,
// keeps them (`computed` pins its own class).
let pins: Owner[] | null = null,
  computedPin: Owner | null = null;
function adopt<N extends Owner>(parent: Owner | null, node: N): N {
  if (pins === null) pins = [new Owner(null), new Node(EFFECT, null, Object)];
  if (parent === null) return node;
  if (parent.disposed) throw new Error('Cannot create a child of a disposed owner');
  const first = parent.first;
  if (first !== null) { first.prev = node; node.next = first; }
  parent.first = node;
  return node;
}

// libs/runtime/dom-v2.ts — and the number-string cache.
/** Compiler ABI: a sole-child static value: scalars written once, an accessor binds, nodes/arrays insert. */
export function _textValue(el: Element, value: unknown): void {
  if (typeof value === "function") _bindingEffect(() => { /* … */ });
  else if (value !== null && typeof value === "object") _insert(el, value);
  // Numbers go to the DOM as-is: `String(n)` would fill V8's number-string cache (0 is coerced: some DOMs drop a falsy value).
  else el.textContent = typeof value === "number" && value ? (value as unknown as string) : coerce(value);
}

// And the empty class. A fresh row has none, so no write (and no style invalidation) happens for it.
// Keeping `class=""` cost krausest 01 / 07 / 08 +2–3%.
function className(el: Element, value: unknown): void {
  if (value == null || value === false || value === "") el.removeAttribute("class");
  else el.className = value as string;
}
