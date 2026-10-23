// Ported from Angular Components (src/cdk/drag-drop/directives/drag-preview.ts), MIT, © Google LLC.
// Rivet: `ng-template[cdkDragPreview]` is a `<template data-rv-drag-preview>` holding the content (inert:
// no layout, no requests, no handlers) inside the `<Drag>`; when a drag starts its nodes move into the
// preview and back afterwards, so client-rendered content keeps its bindings (Angular: an embedded
// view). `data` (template context) is accepted for parity; the content closes over its data already.
// Merged name (spec): the React Aria `DragPreview` (native drag image, `(items) => content`) joins this
// module in a later phase.
import { effect, onCleanup } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { mountTemplateContent } from "./dom/mount-content.ts";
import type { Content } from "@rivetjs/runtime/jsx-runtime";

export interface DragPreviewProps<T = any> {
  /** Context data to be added to the preview template instance. */
  data?: T;
  /** Whether the preview should preserve the same size as the item that is being dragged. */
  matchSize?: boolean;
  children?: Content;
}

/** Element that will be used as a template for the preview of a `Drag` when it is being dragged (Angular `cdkDragPreview`). */
export function DragPreview<T = any>(props: DragPreviewProps<T>) {
  const matchSize = props.matchSize ? "" : undefined;
  const children = props.children;
  // Server: the content renders inside the `<template>` (inert); browser (client render or a resumed page's adopt run):
  // mounted into the template's fragment (`globalThis.document`: bare browser globals are rejected in a server-rendered
  // `.tsx` module, RV2001; the ref shape told the targets apart on the serialized model, M6-CUT).
  if ((globalThis as { document?: unknown }).document !== undefined) {
    // Client render: a `<template>` cannot hold dynamic children in a DOM template, so the content is
    // mounted into the fragment of a static one once it exists.
    const template = ref<HTMLTemplateElement>();
    effect(() => {
      const element = template();
      if (element) onCleanup(mountTemplateContent(element, children));
    });
    return <template ref={template} data-rv-drag-preview="" data-match-size={matchSize} />;
  }
  return (
    <template data-rv-drag-preview="" data-match-size={matchSize}>
      {children}
    </template>
  );
}
