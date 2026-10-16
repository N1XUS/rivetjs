// Rivet: client-side mount of `<DragPreview>` / `<DragPlaceholder>` content into their `<template>`'s
// fragment (a `.ts` module so the component's server build keeps no `mount` import).
import { mount, type DOMValue } from "@rivetjs/runtime/dom";

/** Mounts `content` into `template.content`; returns the disposer. */
export function mountTemplateContent(template: HTMLTemplateElement, content: unknown): () => void {
  return mount(() => content as DOMValue, template.content);
}
