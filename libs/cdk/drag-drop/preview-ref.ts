// Ported from Angular Components (src/cdk/drag-drop/preview-ref.ts), MIT, © Google LLC.
// Rivet: the custom preview template is a view factory (`<DragPreview>`: its `<template>` content moves out
// for the drag) or a host element whose content is cloned (dom/root-node.ts); no Renderer2.
// Rivet: `attach(parent, inheritFrom)` carries the source parent's inherited text styles onto a global
// preview (dom/inherited-text.ts).
import type { Direction } from "../bidi/index.ts";
import { extendStyles, getTransform, matchElementSize, toggleNativeDragInteractions } from "./dom/styling.ts";
import { deepCloneNode } from "./dom/clone-node.ts";
import { getRootNode, stampTemplate, type DragTemplateFactory, type StampedView } from "./dom/root-node.ts";
import { getTransformTransitionDurationInMs } from "./dom/transition-duration.ts";
import { carryInheritedText } from "./dom/inherited-text.ts";

/** Template that can be used to create a drag preview element. */
export interface DragPreviewTemplate<T = any> {
  matchSize?: boolean;
  /** View factory, or a host element whose content is cloned (Angular: `TemplateRef`). */
  template: DragTemplateFactory | HTMLElement | null;
  context?: T;
}

/** Inline styles to be set as `!important` while dragging. */
const importantProperties = new Set([
  // Needs to be important, because some `mat-table` sets `position: sticky !important`. See #22781.
  "position",
]);

export class PreviewRef {
  /** Reference to the view of the preview element. */
  private _previewEmbeddedView: StampedView | null = null;

  /** Reference to the preview element. */
  private _preview!: HTMLElement;

  get element(): HTMLElement {
    return this._preview;
  }

  private _document: Document;
  private _rootElement: HTMLElement;
  private _direction: Direction;
  private _initialDomRect: DOMRect;
  private _previewTemplate: DragPreviewTemplate | null;
  private _previewClass: string | string[] | null;
  private _pickupPositionOnPage: { x: number; y: number };
  private _initialTransform: string | null;
  private _zIndex: number;

  constructor(
    _document: Document,
    _rootElement: HTMLElement,
    _direction: Direction,
    _initialDomRect: DOMRect,
    _previewTemplate: DragPreviewTemplate | null,
    _previewClass: string | string[] | null,
    _pickupPositionOnPage: { x: number; y: number },
    _initialTransform: string | null,
    _zIndex: number,
  ) {
    this._document = _document;
    this._rootElement = _rootElement;
    this._direction = _direction;
    this._initialDomRect = _initialDomRect;
    this._previewTemplate = _previewTemplate;
    this._previewClass = _previewClass;
    this._pickupPositionOnPage = _pickupPositionOnPage;
    this._initialTransform = _initialTransform;
    this._zIndex = _zIndex;
  }

  /** `inheritFrom` (Rivet): the element whose inherited text styles the preview keeps (global previews). */
  attach(parent: HTMLElement, inheritFrom?: Element | null): void {
    this._preview = this._createPreview();
    if (inheritFrom) carryInheritedText(this._preview, inheritFrom);
    parent.appendChild(this._preview);

    // The null check is necessary for browsers that don't support the popover API.
    // Note that we use a string access for compatibility with Closure.
    if (supportsPopover(this._preview)) {
      this._preview["showPopover"]();
    }
  }

  destroy(): void {
    this._preview.remove();
    this._previewEmbeddedView?.destroy();
    this._preview = this._previewEmbeddedView = null!;
  }

  setTransform(value: string): void {
    this._preview.style.transform = value;
  }

  getBoundingClientRect(): DOMRect {
    return this._preview.getBoundingClientRect();
  }

  addClass(className: string): void {
    this._preview.classList.add(className);
  }

  getTransitionDuration(): number {
    return getTransformTransitionDurationInMs(this._preview);
  }

  addEventListener(name: string, handler: (event: any) => void): () => void {
    const preview = this._preview;
    preview.addEventListener(name, handler);
    return () => preview.removeEventListener(name, handler);
  }

  private _createPreview(): HTMLElement {
    const previewConfig = this._previewTemplate;
    const previewClass = this._previewClass;
    const previewTemplate = previewConfig ? previewConfig.template : null;
    let preview: HTMLElement;

    if (previewTemplate && previewConfig) {
      // Measure the element before we've inserted the preview
      // since the insertion could throw off the measurement.
      const rootRect = previewConfig.matchSize ? this._initialDomRect : null;
      const viewRef = stampTemplate(previewTemplate);
      preview = getRootNode(viewRef, this._document);
      this._previewEmbeddedView = viewRef;
      if (previewConfig.matchSize) {
        matchElementSize(preview, rootRect!);
      } else {
        preview.style.transform = getTransform(this._pickupPositionOnPage.x, this._pickupPositionOnPage.y);
      }
    } else {
      preview = deepCloneNode(this._rootElement);
      matchElementSize(preview, this._initialDomRect!);

      if (this._initialTransform) {
        preview.style.transform = this._initialTransform;
      }
    }

    extendStyles(
      preview.style,
      {
        // It's important that we disable the pointer events on the preview, because
        // it can throw off the `document.elementFromPoint` calls in the `CdkDropList`.
        "pointer-events": "none",
        // If the preview has a margin, it can throw off our positioning so we reset it. The reset
        // value for `margin-right` needs to be `auto` when opened as a popover, because our
        // positioning is always top/left based, but native popover seems to position itself
        // to the top/right if `<html>` or `<body>` have `dir="rtl"` (see #29604). Setting it
        // to `auto` pushed it to the top/left corner in RTL and is a noop in LTR.
        margin: supportsPopover(preview) ? "0 auto 0 0" : "0",
        position: "fixed",
        top: "0",
        left: "0",
        "z-index": this._zIndex + "",
      },
      importantProperties,
    );

    toggleNativeDragInteractions(preview, false);
    preview.classList.add("cdk-drag-preview");
    preview.setAttribute("popover", "manual");
    preview.setAttribute("dir", this._direction);

    if (previewClass) {
      if (Array.isArray(previewClass)) {
        previewClass.forEach((className) => preview.classList.add(className));
      } else {
        preview.classList.add(previewClass);
      }
    }

    return preview;
  }
}

/** Checks whether a specific element supports the popover API. */
function supportsPopover(element: HTMLElement): boolean {
  return "showPopover" in element;
}
