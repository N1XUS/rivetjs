// Ported from Angular Components (src/cdk/drag-drop/drag-drop-registry.ts), MIT, © Google LLC.
// Rivet: no DI / NgZone / Renderer2 — `dragDropRegistry(document?)` returns the lazily created per-document
// instance (nothing at import time); Subjects are `Emitter`s; the reset styles (resets.scss) are injected
// as one <style> on the first drag (Angular: `_CdkPrivateStyleLoader`); the directive-node map stores
// any value (the Rivet `CdkDrag` handle).
// Deviation (2026-10-08, kanban preview lost its padding): the resets `<style>` goes FIRST in `<head>`, so
// `@layer cdk-resets` is the first declared layer = the lowest-priority one. Appended (upstream), it comes
// after an app's own layers (Tailwind v4 `@layer theme, base, components, utilities`) and outranks them:
// the preview clone's `p-*` / `bg-*` / `border` utilities lost to `padding: 0` / `background: none`.
// The resets are meant as defaults any app style overrides (unlayered CSS beats them either way).
// Deviation (2026-10-09, kanban preview font sizes): the preview's inherited text properties read the
// custom properties a global preview carries from the dragged element's parent (dom/inherited-text.ts),
// falling back to `inherit` (upstream: `color: inherit`, the rest inherited from `<body>`).
import { INHERITED_TEXT_RESETS } from "./dom/inherited-text.ts";
import { Emitter, stream, type Stream } from "../scrolling/emitter.ts";
import type { DropListRef } from "./drop-list-ref.ts";
import type { DragRef } from "./drag-ref.ts";

/** Event options that can be used to bind a capturing event. */
const capturingEventOptions = { capture: true };

/** Event options that can be used to bind an active, capturing event. */
const activeCapturingEventOptions = { passive: false, capture: true };

/** resets.scss */
const RESETS = `@layer cdk-resets{.cdk-drag-preview{background:none;border:none;padding:0;overflow:visible;inset:auto;${INHERITED_TEXT_RESETS}}}
.cdk-drag-placeholder *,.cdk-drag-preview *{pointer-events:none!important}`;

function loadResets(doc: Document): void {
  if (doc.querySelector("style[data-cdk-drag-resets]")) return;
  const style = doc.createElement("style");
  style.setAttribute("data-cdk-drag-resets", "");
  style.textContent = RESETS;
  const parent = doc.head || doc.documentElement;
  parent.insertBefore(style, parent.firstChild);
}

function listen(target: EventTarget, name: string, handler: (event: any) => void, options: AddEventListenerOptions): () => void {
  target.addEventListener(name, handler, options);
  return () => target.removeEventListener(name, handler, options);
}

/**
 * Service that keeps track of all the drag item and drop container
 * instances, and manages global event listeners on the `document`.
 * @docs-private
 */
export class DragDropRegistry {
  private _document: Document;
  private _cleanupDocumentTouchmove: (() => void) | undefined;
  private _scroll = new Emitter<Event>();

  /** Registered drop container instances. */
  private _dropInstances = new Set<DropListRef>();

  /** Registered drag item instances. */
  private _dragInstances = new Set<DragRef>();

  /** Drag item instances that are currently being dragged. */
  private _activeDragInstances: DragRef[] = [];

  /** Keeps track of the event listeners that we've bound to the `document`. */
  private _globalListeners: (() => void)[] | undefined;

  /** Predicate function to check if an item is being dragged. */
  private _draggingPredicate = (item: DragRef) => item.isDragging();

  /** Map tracking DOM nodes and their corresponding drag directives. */
  private _domNodesToDirectives: WeakMap<Node, unknown> | null = null;

  /** Emits the `touchmove` or `mousemove` events that are dispatched while the user is dragging a drag item instance. */
  readonly pointerMove = new Emitter<TouchEvent | MouseEvent>();

  /** Emits the `touchend` or `mouseup` events that are dispatched while the user is dragging a drag item instance. */
  readonly pointerUp = new Emitter<TouchEvent | MouseEvent>();

  constructor(doc?: Document) {
    this._document = doc ?? document;
  }

  /** Adds a drop container to the registry. */
  registerDropContainer(drop: DropListRef) {
    if (!this._dropInstances.has(drop)) {
      this._dropInstances.add(drop);
    }
  }

  /** Adds a drag item instance to the registry. */
  registerDragItem(drag: DragRef) {
    this._dragInstances.add(drag);

    // The `touchmove` event gets bound once, ahead of time, because WebKit
    // won't preventDefault on a dynamically-added `touchmove` listener.
    // See https://bugs.webkit.org/show_bug.cgi?id=184250.
    if (this._dragInstances.size === 1) {
      // The event handler has to be explicitly active, because newer browsers make it passive by default.
      this._cleanupDocumentTouchmove?.();
      this._cleanupDocumentTouchmove = listen(this._document, "touchmove", this._persistentTouchmoveListener, activeCapturingEventOptions);
    }
  }

  /** Removes a drop container from the registry. */
  removeDropContainer(drop: DropListRef) {
    this._dropInstances.delete(drop);
  }

  /** Removes a drag item instance from the registry. */
  removeDragItem(drag: DragRef) {
    this._dragInstances.delete(drag);
    this.stopDragging(drag);

    if (this._dragInstances.size === 0) {
      this._cleanupDocumentTouchmove?.();
    }
  }

  /**
   * Starts the dragging sequence for a drag instance.
   * @param drag Drag instance which is being dragged.
   * @param event Event that initiated the dragging.
   */
  startDragging(drag: DragRef, event: TouchEvent | MouseEvent) {
    // Do not process the same drag twice to avoid memory leaks and redundant listeners
    if (this._activeDragInstances.indexOf(drag) > -1) {
      return;
    }

    loadResets(this._document);
    this._activeDragInstances = [...this._activeDragInstances, drag];

    if (this._activeDragInstances.length === 1) {
      // We explicitly bind __active__ listeners here, because newer browsers will default to
      // passive ones for `mousemove` and `touchmove`. The events need to be active, because we
      // use `preventDefault` to prevent the page from scrolling while the user is dragging.
      const isTouchEvent = event.type.startsWith("touch");
      const endEventHandler = (e: Event) => this.pointerUp.next(e as TouchEvent | MouseEvent);

      const toBind: [name: string, handler: (event: Event) => void, options: AddEventListenerOptions][] = [
        // Use capturing so that we pick up scroll changes in any scrollable nodes that aren't
        // the document. See https://github.com/angular/components/issues/17144.
        ["scroll", (e: Event) => this._scroll.next(e), capturingEventOptions],

        // Preventing the default action on `mousemove` isn't enough to disable text selection
        // on Safari so we need to prevent the selection event as well.
        ["selectstart", this._preventDefaultWhileDragging, activeCapturingEventOptions],
      ];

      if (isTouchEvent) {
        toBind.push(["touchend", endEventHandler, capturingEventOptions], ["touchcancel", endEventHandler, capturingEventOptions]);
      } else {
        toBind.push(["mouseup", endEventHandler, capturingEventOptions]);
      }

      // We don't have to bind a move event for touch drag sequences, because
      // we already have a persistent global one bound from `registerDragItem`.
      if (!isTouchEvent) {
        toBind.push(["mousemove", (e: Event) => this.pointerMove.next(e as MouseEvent), activeCapturingEventOptions]);
      }

      this._globalListeners = toBind.map(([name, handler, options]) => listen(this._document, name, handler, options));
    }
  }

  /** Stops dragging a drag item instance. */
  stopDragging(drag: DragRef) {
    const index = this._activeDragInstances.indexOf(drag);
    if (index > -1) {
      this._activeDragInstances.splice(index, 1);
      this._activeDragInstances = [...this._activeDragInstances];
    }

    if (this._activeDragInstances.length === 0) {
      this._clearGlobalListeners();
    }
  }

  /** Gets whether a drag item instance is currently being dragged. */
  isDragging(drag: DragRef) {
    return this._activeDragInstances.indexOf(drag) > -1;
  }

  /**
   * Gets a stream that will emit when any element on the page is scrolled while an item is being dragged.
   * @param shadowRoot Optional shadow root that the current dragging sequence started from.
   */
  scrolled(shadowRoot?: DocumentOrShadowRoot | null): Stream<Event> {
    if (!shadowRoot || shadowRoot === (this._document as DocumentOrShadowRoot)) return this._scroll;
    return stream<Event>((observer) => {
      const sub = this._scroll.subscribe(observer.next);
      const cleanup = listen(
        shadowRoot as ShadowRoot,
        "scroll",
        (event: Event) => {
          if (this._activeDragInstances.length) observer.next(event);
        },
        capturingEventOptions,
      );
      return () => {
        sub.unsubscribe();
        cleanup();
      };
    });
  }

  /** Tracks the DOM node which has a draggable directive. */
  registerDirectiveNode(node: Node, dragRef: unknown): void {
    this._domNodesToDirectives ??= new WeakMap();
    this._domNodesToDirectives.set(node, dragRef);
  }

  /** Stops tracking a draggable directive node. */
  removeDirectiveNode(node: Node): void {
    this._domNodesToDirectives?.delete(node);
  }

  /** Gets the drag directive corresponding to a specific DOM node, if any. */
  getDragDirectiveForNode<T = unknown>(node: Node): T | null {
    return (this._domNodesToDirectives?.get(node) as T) || null;
  }

  /** Angular `ngOnDestroy`. */
  destroy() {
    this._dragInstances.forEach((instance) => this.removeDragItem(instance));
    this._dropInstances.forEach((instance) => this.removeDropContainer(instance));
    this._domNodesToDirectives = null;
    this._clearGlobalListeners();
    this.pointerMove.complete();
    this.pointerUp.complete();
    if (registries?.get(this._document) === this) registries.delete(this._document);
  }

  /** Event listener that will prevent the default browser action while the user is dragging. */
  private _preventDefaultWhileDragging = (event: Event) => {
    if (this._activeDragInstances.length > 0) {
      event.preventDefault();
    }
  };

  /** Event listener for `touchmove` that is bound even if no dragging is happening. */
  private _persistentTouchmoveListener = (event: TouchEvent) => {
    if (this._activeDragInstances.length > 0) {
      // Note that we only want to prevent the default action after dragging has actually started.
      // Usually this is the same time at which the item is added to the `_activeDragInstances`,
      // but it could be pushed back if the user has set up a drag delay or threshold.
      if (this._activeDragInstances.some(this._draggingPredicate)) {
        event.preventDefault();
      }

      this.pointerMove.next(event);
    }
  };

  /** Clears out the global event listeners from the `document`. */
  private _clearGlobalListeners() {
    this._globalListeners?.forEach((cleanup) => cleanup());
    this._globalListeners = undefined;
  }
}

let registries: WeakMap<Document, DragDropRegistry> | undefined;

/** The per-document registry, created on first use (Angular: root-provided service). */
export function dragDropRegistry(doc: Document = document): DragDropRegistry {
  registries ??= new WeakMap();
  let registry = registries.get(doc);
  if (!registry) registries.set(doc, (registry = new DragDropRegistry(doc)));
  return registry;
}
