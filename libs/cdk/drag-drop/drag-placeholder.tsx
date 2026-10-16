// Ported from Angular Components (src/cdk/drag-drop/directives/drag-placeholder.ts), MIT, © Google LLC.
// Rivet: `ng-template[cdkDragPlaceholder]` is a `<template data-rv-drag-placeholder>` holding the content
// inside the `<Drag>`; its nodes move into the list while dragging and back afterwards (Angular: an
// embedded view). `data` (template context) is accepted for parity.
import { effect, onCleanup } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { mountTemplateContent } from "./dom/mount-content.ts";
import type { Content } from "@rivetjs/runtime/jsx-runtime";

export interface DragPlaceholderProps<T = any> {
  /** Context data to be added to the placeholder template instance. */
  data?: T;
  children?: Content;
}

/** Element that will be used as a template for the placeholder of a `Drag` when it is being dragged (Angular `cdkDragPlaceholder`). */
export function DragPlaceholder<T = any>(props: DragPlaceholderProps<T>) {
  const children = props.children;
  // The server `ref()` is a cell with an `id` (records the element); the DOM one a signal. `getOwner()`
  // is set on the server as well, so the ref shape is what tells the render target apart.
  if (!("id" in (ref() as object))) {
    // Client render: a `<template>` cannot hold dynamic children in a DOM template, so the content is
    // mounted into the fragment of a static one once it exists.
    const template = ref<HTMLTemplateElement>();
    effect(() => {
      const element = template();
      if (element) onCleanup(mountTemplateContent(element, children));
    });
    return <template ref={template} data-rv-drag-placeholder="" />;
  }
  return <template data-rv-drag-placeholder="">{children}</template>;
}
