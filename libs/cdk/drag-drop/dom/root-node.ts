// Ported from Angular Components (src/cdk/drag-drop/dom/root-node.ts), MIT, © Google LLC.
// Rivet: there are no embedded views. A helper "template" is either a factory returning a stamped view
// (the `<DragPreview>` / `<DragPlaceholder>` components: their `<template>` content is moved out for the
// drag and back afterwards, so its bindings stay live — Angular's embedded view), or a host element
// whose current content is cloned (imperative use: `withPreviewTemplate({ template: element })`).
// `view.destroy()` stands in for `EmbeddedViewRef.destroy()`.
import { deepCloneNode } from "./clone-node.ts";

/** A stamped-out view of a helper template (Angular: `EmbeddedViewRef`). */
export interface StampedView {
  rootNodes: Node[];
  destroy(): void;
}

/** Creates a view (Angular: `viewContainer.createEmbeddedView(templateRef, context)`). */
export type DragTemplateFactory = () => StampedView;

/** Template that can be used to create a drag helper element (e.g. a preview or a placeholder). */
export interface DragHelperTemplate<T = any> {
  /** View factory, or a host element whose children are cloned (Angular: `TemplateRef`). */
  template: DragTemplateFactory | HTMLElement | null;
  /** Data of the drag item (Angular: template context). */
  context?: T;
}

/** Stamps out a helper template (Angular: `createEmbeddedView`). */
export function stampTemplate(template: DragTemplateFactory | HTMLElement): StampedView {
  if (typeof template === "function") return template();
  const source: ParentNode = template instanceof HTMLTemplateElement ? template.content : template;
  const rootNodes: Node[] = [];
  source.childNodes.forEach((node) => {
    // Skip whitespace and framework comment markers.
    if (node.nodeType === 3 && !node.textContent!.trim()) return;
    if (node.nodeType === 8) return;
    rootNodes.push(node.nodeType === 1 ? deepCloneNode(node as HTMLElement) : node.cloneNode(true));
  });
  return {
    rootNodes,
    destroy() {
      rootNodes.forEach((node) => (node as ChildNode).remove?.());
    },
  };
}

/**
 * Gets the root HTML element of an embedded view.
 * If the root is not an HTML element it gets wrapped in one.
 */
export function getRootNode(viewRef: StampedView, _document: Document): HTMLElement {
  const rootNodes: Node[] = viewRef.rootNodes;

  if (rootNodes.length === 1 && rootNodes[0].nodeType === _document.ELEMENT_NODE) {
    return rootNodes[0] as HTMLElement;
  }

  const wrapper = _document.createElement("div");
  rootNodes.forEach((node) => wrapper.appendChild(node));
  return wrapper;
}
