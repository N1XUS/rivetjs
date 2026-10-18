// libs/runtime/dom-v2.ts — event delegation. The handler lives on the node as `el["$$click"]`;
// one listener per type per document walks composedPath(). Note the currentTarget line.
function dispatch(event: Event): void {
  const key = "$$" + event.type,
    path = event.composedPath ? event.composedPath() : null;
  let node = (path ? path[0] : event.target) as (Node & Handlers) | null | undefined,
    i = 0,
    emulated = false;
  while (node) {
    const handler = node[key];
    if (handler) {
      const target = node;
      // currentTarget follows the handler's node, as with a direct listener. A data property: an
      // accessor closure would be pinned by V8's map descriptors and retain the event path.
      Object.defineProperty(event, "currentTarget", { configurable: true, value: target });
      emulated = true;
      // Under the owner that bound it (context lookups); skipped once that owner is disposed.
      _dispatch((target as unknown as { $$o: Owner | null }).$$o, handler, target, event);
      if (event.cancelBubble) {
        event.stopImmediatePropagation();
        break;
      }
    }
    node = (path ? path[++i] : node.parentNode || (node as unknown as ShadowRoot).host || null) as (Node & Handlers) | null | undefined;
  }
  // Later document / window listeners see the real currentTarget (the document) again.
  if (emulated) delete (event as unknown as { currentTarget?: unknown }).currentTarget;
}

/** Compiler ABI: a delegated bubbling event handler (`type` is a bubbling event). */
export function _on(el: Element, type: string, handler: ((event: Event) => unknown) | null | undefined): void {
  (el as unknown as Handlers)["$$" + type] = checked(handler);
  (el as unknown as { $$o: Owner | null }).$$o = getOwner();
  const doc = host.doc();
  if (doc === lastDoc && type === lastType) return;
  let types = delegated.get(doc);
  if (!types) delegated.set(doc, (types = new Set()));
  if (!types.has(type)) {
    types.add(type);
    doc.addEventListener(type, dispatch);
  }
  lastDoc = doc;
  lastType = type;
}
