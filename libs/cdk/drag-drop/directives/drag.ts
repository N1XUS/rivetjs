// Ported from Angular Components (src/cdk/drag-drop/directives/drag.ts), MIT, © Google LLC.
// Rivet: `CdkDrag` without the directive plumbing — the browser-side instance behind a `<Drag>`
// element (drag.tsx), created on demand (directives/registry.ts) from the props the element's handler
// captured. Deviations:
// - inputs are the component props (plain values or accessors / signals, read when needed); a signal
//   input that Angular re-syncs in `ngOnChanges` / its setter (`disabled`, `freeDragPosition`,
//   `rootElementSelector`, `scale`) is synced by an effect owned by the instance;
// - DI is the DOM: the drop container is the closest `<DropList>` element (woken), the parent drag the
//   closest `<Drag>` element; handles, preview and placeholder templates are found below the element
//   (`[data-rv-drag-handle]`, `<template data-rv-drag-preview|placeholder>`) instead of registering
//   through `CDK_DRAG_PARENT`;
// - `afterNextRender` work runs in the constructor (the element is in the document by then);
// - outputs are `on*` callbacks; `onMoved` subscribes to the ref only while given (the public `moved`
//   stream is the upstream lazy Observable);
// - host classes `cdk-drag-disabled` / `cdk-drag-dragging` (+ `data-disabled` / `data-dragging`) are
//   toggled by the instance (Angular: host bindings).
import { createRoot, effect, untrack, type Disposer } from "@rivetjs/reactivity";
import { stream, type Stream } from "../../scrolling/emitter.ts";
import { coerceElement, type ElementLike } from "../dom/coerce.ts";
import { coerceNumberProperty } from "../../coercion/index.ts";
import { directionValue, documentDirectionality, type Directionality } from "../../bidi/index.ts";
import type { DragDrop, DragEnd, DragEnter, DragExit, DragMove, DragRelease, DragStart } from "../drag-events.ts";
import { createDragRef, type DragConstrainPosition, type DragRef, type Point, type PreviewContainer } from "../drag-ref.ts";
import { dragDropRegistry, type DragDropRegistry } from "../drag-drop-registry.ts";
import type { DragHelperTemplate, StampedView } from "../dom/root-node.ts";
import type { DragPreviewTemplate } from "../preview-ref.ts";
import type { DropListInstance } from "./drop-list.ts";
import type { DragAxis, DragDropConfig, DragStartDelay } from "./config.ts";
import { assertElementNode } from "./assertions.ts";
import { DragHandleInstance, handleElements } from "./drag-handle.ts";
import {
  DRAG_ATTR,
  PLACEHOLDER_ATTR,
  PREVIEW_ATTR,
  closestDropListElement,
  dragOf,
  drags,
  dropListOf,
  read,
  registered,
  type MaybeAccessor,
} from "./registry.ts";

/** Inputs and outputs of a draggable (Angular `cdkDrag*` inputs / outputs, `Cdk` prefix dropped). */
export interface DragInputs<T = any> {
  /** Arbitrary data to attach to this drag instance. */
  data?: MaybeAccessor<T>;
  /** Locks the position of the dragged element along the specified axis. */
  lockAxis?: MaybeAccessor<DragAxis | null | undefined>;
  /**
   * Selector that will be used to determine the root draggable element, starting from
   * the `Drag` element and going up the DOM. Passing an alternate root element is useful
   * when trying to enable dragging on an element that you might not have access to.
   */
  rootElementSelector?: MaybeAccessor<string | undefined>;
  /**
   * Node or selector that will be used to determine the element to which the draggable's
   * position will be constrained. If a string is passed in, it'll be used as a selector that
   * will be matched starting from the element's parent and going up the DOM until a match
   * has been found.
   */
  boundaryElement?: MaybeAccessor<string | ElementLike | null | undefined>;
  /**
   * Amount of milliseconds to wait after the user has put their
   * pointer down before starting to drag the element.
   */
  dragStartDelay?: MaybeAccessor<DragStartDelay | string | undefined>;
  /**
   * Sets the position of a `Drag` that is outside of a drop container.
   * Can be used to restore the element's position for a returning user.
   */
  freeDragPosition?: MaybeAccessor<Point | undefined>;
  /** Whether starting to drag this element is disabled. */
  disabled?: MaybeAccessor<boolean | undefined>;
  /**
   * Function that can be used to customize the logic of how the position of the drag item
   * is limited while it's being dragged. Gets called with a point containing the current position
   * of the user's pointer on the page, a reference to the item being dragged and its dimensions.
   * Should return a point describing where the item should be rendered.
   */
  constrainPosition?: DragConstrainPosition;
  /** Class to be added to the preview element. */
  previewClass?: MaybeAccessor<string | string[] | undefined>;
  /**
   * Configures the place into which the preview of the item will be inserted. Can be configured
   * globally through `DragDropConfigContext`. Possible values:
   * - `global` - Preview will be inserted at the bottom of the `<body>`. The advantage is that
   * you don't have to worry about `overflow: hidden` or `z-index`, but the item won't retain
   * its inherited styles.
   * - `parent` - Preview will be inserted into the parent of the drag item. The advantage is that
   * inherited styles will be preserved, but it may be clipped by `overflow: hidden` or not be
   * visible due to `z-index`. Furthermore, the preview is going to have an effect over selectors
   * like `:nth-child` and some flexbox configurations.
   * - `ElementLike` - Preview will be inserted into a specific element.
   * Same advantages and disadvantages as `parent`.
   */
  previewContainer?: MaybeAccessor<PreviewContainer | undefined>;
  /**
   * If the parent of the dragged element has a `scale` transform, it can throw off the
   * positioning when the user starts dragging. Use this input to notify the CDK of the scale.
   */
  scale?: MaybeAccessor<number | string | undefined>;
  /** Emits when the user starts dragging the item. */
  onStarted?: (event: DragStart<T>) => void;
  /** Emits when the user has released a drag item, before any animations have started. */
  onReleased?: (event: DragRelease<T>) => void;
  /** Emits when the user stops dragging an item in the container. */
  onEnded?: (event: DragEnd<T>) => void;
  /** Emits when the user has moved the item into a new container. */
  onEntered?: (event: DragEnter<any, T>) => void;
  /** Emits when the user removes the item its container by dragging it into another container. */
  onExited?: (event: DragExit<any, T>) => void;
  /** Emits when the user drops the item inside a container. */
  onDropped?: (event: DragDrop<any, any, T>) => void;
  /**
   * Emits as the user is dragging the item. Use with caution,
   * because this event will fire for every pixel that the user has dragged.
   */
  onMoved?: (event: DragMove<T>) => void;
}

/** Options a drag instance is created with (component props + render context). */
export interface DragSetup<T = any> {
  inputs?: DragInputs<T>;
  /** `DragDropConfigContext` value where the `<Drag>` rendered. */
  config?: DragDropConfig | null;
  /** `DirectionalityContext` value where the `<Drag>` rendered (else the document's). */
  dir?: Directionality | null;
  /**
   * Rivet: the `<Drag>` element's `ref()`. The instance is destroyed once it lets go of the element: a client unmount
   * (`bindRef`'s cleanup) or, on a resumed page, the end of the server element's region (a row a `For` drops, a
   * re-created region: the revived ref resets).
   */
  element?: () => HTMLElement | undefined;
}

/** Element that can be moved inside a `DropList` container (Angular `CdkDrag`). */
export class DragInstance<T = any> {
  /** The `<Drag>` element. */
  readonly element: HTMLElement;
  /** Droppable container that the draggable is a part of. */
  dropContainer: DropListInstance | null;
  /** Reference to the underlying drag instance. */
  _dragRef: DragRef<DragInstance<T>>;

  /**
   * Emits as the user is dragging the item. Use with caution,
   * because this event will fire for every pixel that the user has dragged.
   * (Angular `cdkDragMoved` observable; the `onMoved` prop is its output binding.)
   */
  readonly moved: Stream<DragMove<T>> = stream((observer) => {
    const subscription = this._dragRef.moved.subscribe({
      next: (movedEvent) =>
        observer.next({
          source: this,
          pointerPosition: movedEvent.pointerPosition,
          event: movedEvent.event,
          delta: movedEvent.delta,
          distance: movedEvent.distance,
        }),
      complete: observer.complete,
    });
    return () => subscription.unsubscribe();
  });

  private _inputs: DragInputs<T>;
  private _config: DragDropConfig | null;
  private _dir: Directionality | null;
  private _dragDropRegistry: DragDropRegistry;
  private _destroyed = false;
  private _disposeSync: Disposer | null = null;
  private _disposeRelease: Disposer | null = null;
  private _containerBeforeStarted: { unsubscribe(): void } | null = null;
  private _movedSubscription: { unsubscribe(): void } | null = null;
  private _handles: DragHandleInstance[] = [];
  private _previewView: StampedView | null = null;
  private _placeholderView: StampedView | null = null;

  constructor(element: HTMLElement, setup: DragSetup<T> = {}) {
    this.element = element;
    this._inputs = setup.inputs ?? {};
    this._config = setup.config ?? null;
    this._dir = setup.dir ?? null;
    this._dragDropRegistry = dragDropRegistry(element.ownerDocument);
    drags.set(element, this as DragInstance);

    const config = this._config;
    this._dragRef = createDragRef(element, {
      dragStartThreshold: config && config.dragStartThreshold != null ? config.dragStartThreshold : 5,
      pointerDirectionChangeThreshold: config && config.pointerDirectionChangeThreshold != null ? config.pointerDirectionChangeThreshold : 5,
      zIndex: config?.zIndex,
    });
    this._dragRef.data = this;
    this._dragDropRegistry.registerDirectiveNode(element, this);
    // Rivet: a nested `<Drag>` not created yet takes a press inside it first (see `_beforeRootPointerDown`).
    this._dragRef._beforeRootPointerDown = (event) => {
      const path = event.composedPath();
      for (let i = 0; i < path.length && path[i] !== element; i++) {
        const node = path[i] as Element;
        if (node.nodeType !== 1 || !node.hasAttribute(DRAG_ATTR)) continue;
        if (!drags.has(node)) {
          const nested = dragOf(node);
          if (nested) {
            nested._beforePointerDown();
            nested._dragRef._pointerDownFromHost(event);
          }
        }
        return;
      }
    };

    // Note that usually the container is assigned when the drop list is picks up the item, but in
    // some cases (mainly transplanted views with OnPush, see #18341) we may end up in a situation
    // where there are no items on the first change detection pass, but the items get picked up as
    // soon as the user triggers another pass by dragging. This is a problem, because the item would
    // have to switch from standalone mode to drag mode in the middle of the dragging sequence which
    // is too late since the two modes save different kinds of information. We work around it by
    // assigning the drop container both from here and the list.
    const containerElement = closestDropListElement(element);
    const dropContainer = (this.dropContainer = containerElement ? dropListOf(containerElement) : null);
    if (dropContainer) {
      dropContainer.addItem(this);

      // The drop container reads this so we need to sync it here.
      this._containerBeforeStarted = dropContainer._dropListRef.beforeStarted.subscribe(() => {
        this._dragRef.scale = this.scale;
      });
    }

    this._syncInputs(this._dragRef);
    this._handleEvents(this._dragRef);

    // Angular `ngAfterViewInit` (`afterNextRender`).
    this._updateRootElement();
    this._syncHandles();
    this._dragRef.scale = this.scale;
    const freeDragPosition = this.freeDragPosition;
    if (freeDragPosition) {
      // The server rendered the same transform; let the ref own it (no stacking on top of it).
      this._rootTransformRendered();
      this._dragRef.setFreeDragPosition(freeDragPosition);
    }
    this._dragRef.disabled = this._ownDisabled;
    this._syncReactiveInputs();
    this._syncHostClasses();
    registered(element);
  }

  /** Arbitrary data to attach to this drag instance. */
  get data(): T {
    return read(this._inputs.data) as T;
  }

  /** Locks the position of the dragged element along the specified axis. */
  get lockAxis(): DragAxis | null {
    return read(this._inputs.lockAxis) ?? this._config?.lockAxis ?? null;
  }

  /** Selector of an alternate root element. */
  get rootElementSelector(): string | undefined {
    return read(this._inputs.rootElementSelector) ?? this._config?.rootElementSelector;
  }

  /** Element (or selector) the draggable's position is constrained to. */
  get boundaryElement(): string | ElementLike | null | undefined {
    return read(this._inputs.boundaryElement) ?? this._config?.boundaryElement;
  }

  /** Delay before dragging starts. */
  get dragStartDelay(): DragStartDelay | string {
    return read(this._inputs.dragStartDelay) ?? (this._config?.dragStartDelay || 0);
  }

  /** Position of a standalone drag item. */
  get freeDragPosition(): Point | undefined {
    return read(this._inputs.freeDragPosition);
  }

  /** Whether starting to drag this element is disabled. */
  get disabled(): boolean {
    return this._ownDisabled || !!(this.dropContainer && this.dropContainer.disabled);
  }

  private get _ownDisabled(): boolean {
    const value = read(this._inputs.disabled);
    return value ?? (this._config?.draggingDisabled == null ? false : this._config.draggingDisabled);
  }

  /** Position constraint function. */
  get constrainPosition(): DragConstrainPosition | undefined {
    return this._inputs.constrainPosition ?? this._config?.constrainPosition;
  }

  /** Class to be added to the preview element. */
  get previewClass(): string | string[] | undefined {
    return read(this._inputs.previewClass) ?? this._config?.previewClass;
  }

  /** Place into which the preview of the item will be inserted. */
  get previewContainer(): PreviewContainer | undefined {
    return read(this._inputs.previewContainer) ?? this._config?.previewContainer;
  }

  /** Scale of the drag element's parent. */
  get scale(): number {
    const value = read(this._inputs.scale);
    return value == null ? 1 : coerceNumberProperty(value, 1);
  }

  /**
   * Returns the element that is being used as a placeholder
   * while the current element is being dragged.
   */
  getPlaceholderElement(): HTMLElement {
    return this._dragRef.getPlaceholderElement();
  }

  /** Returns the root draggable element. */
  getRootElement(): HTMLElement {
    return this._dragRef.getRootElement();
  }

  /** Resets a standalone drag item to its initial position. */
  reset(): void {
    this._dragRef.reset();
  }

  /** Resets drag item to end of boundary element. */
  resetToBoundary(): void {
    this._dragRef.resetToBoundary();
  }

  /**
   * Gets the pixel coordinates of the draggable outside of a drop container.
   */
  getFreeDragPosition(): Readonly<Point> {
    return this._dragRef.getFreeDragPosition();
  }

  /**
   * Sets the current position in pixels the draggable outside of a drop container.
   * @param value New position to be set.
   */
  setFreeDragPosition(value: Point): void {
    this._dragRef.setFreeDragPosition(value);
  }

  /** Rivet: the props of a lazily created (bare) instance arrived with its own handler. */
  _setInputs(setup: DragSetup<T>): void {
    if (setup.inputs === this._inputs) return;
    this._inputs = setup.inputs ?? {};
    if (setup.config !== undefined) this._config = setup.config;
    if (setup.dir !== undefined) this._dir = setup.dir;
    this._movedSubscription?.unsubscribe();
    this._movedSubscription = null;
    this._subscribeMoved();
    this._updateRootElement();
    this._dragRef.disabled = this._ownDisabled;
    this._syncReactiveInputs();
    this._syncHostClasses();
  }

  /**
   * Rivet: destroy the instance once `element` (the `<Drag>`'s `ref()`, `DragSetup.element`) stops holding this
   * element (Angular `ngOnDestroy`). A server-rendered `<Drag>` runs no component code on a resumed page, so its lazily
   * created instance had no destroy hook: a row a resumed `For` dropped stayed in the registry (`_dragInstances`, the
   * document `touchmove` listener), its list's items and its sync effects. The resume runtime resets a revived ref when
   * the region of its server element dies; client renders reset it on unmount (`bindRef`), like `drag.tsx`'s cleanup.
   * False: destroyed (the element already left).
   */
  _releaseWith(element: (() => HTMLElement | undefined) | undefined): boolean {
    if (element && !this._disposeRelease && !this._destroyed) {
      const release = (this._disposeRelease = createRoot((dispose) => {
        let held = false;
        effect(() => {
          if (element() === this.element) held = true;
          // Never held: a ref that already let go (its region died before this handler ran, a replayed press).
          else if (held || !this.element.isConnected) untrack(() => this.destroy());
        });
        return dispose;
      }).value);
      if (this._destroyed) release();
    }
    return !this._destroyed;
  }

  /** Rivet: sync what the DOM holds (handles, container state) before the ref sees a pointer down. */
  _beforePointerDown(): void {
    this._syncHandles();
    const container = this.dropContainer;
    if (container) container._dropListRef.disabled = container.disabled;
  }

  /** Angular `ngOnDestroy`. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this.dropContainer) {
      this.dropContainer.removeItem(this);
    }

    this._dragDropRegistry.removeDirectiveNode(this.element);
    this._disposeSync?.();
    this._disposeRelease?.();
    this._containerBeforeStarted?.unsubscribe();
    this._movedSubscription?.unsubscribe();
    this._dragRef.dispose();
    if (drags.get(this.element) === (this as DragInstance)) drags.delete(this.element);
  }

  private _handlesSynced = false;

  /** Re-collects the handles below the element (Angular: `_handles` + `_stateChanges`). */
  _syncHandles(): void {
    const elements = handleElements(this.element, DRAG_ATTR);
    // The first sync always applies (upstream `startWith` on the handles query), so a self handle with
    // no handle children is registered too.
    if (!this._handlesSynced || elements.length !== this._handles.length || elements.some((element, i) => this._handles[i].element !== element)) {
      this._handlesSynced = true;
      this._handles = elements.map((element) => new DragHandleInstance(element));
      const handleElementsForRef: ElementLike[] = this._handles.map((handle) => handle.element);

      // Usually handles are only allowed to be a descendant of the drag element, but if
      // the consumer defined a different drag root, we should allow the drag element
      // itself to be a handle too.
      if (this.element.hasAttribute("data-rv-drag-self-handle") && this.rootElementSelector) {
        handleElementsForRef.push(this.element);
      }

      this._dragRef.withHandles(handleElementsForRef);
    }
    // Enabled/disable the handles in the DragRef.
    const dragRef = this._dragRef;
    this._handles.forEach((handle) => (handle.disabled ? dragRef.disableHandle(handle.element) : dragRef.enableHandle(handle.element)));
  }

  /** The handles of the drag item (Angular `_handles`). */
  get _handleInstances(): readonly DragHandleInstance[] {
    return this._handles;
  }

  /** Syncs the root element with the `DragRef`. */
  private _updateRootElement() {
    const element = this.element;
    let rootElement = element;
    const selector = this.rootElementSelector;
    if (selector) {
      rootElement = element.closest(selector) as HTMLElement;
    }

    if (rootElement) {
      assertElementNode(rootElement, "cdkDrag");
    }

    this._dragRef.withRootElement(rootElement || element);
  }

  /** Gets the boundary element, based on the `boundaryElement` value. */
  private _getBoundaryElement() {
    const boundary = this.boundaryElement;

    if (!boundary) {
      return null;
    }

    if (typeof boundary === "string") {
      return this.element.closest<HTMLElement>(boundary);
    }

    return coerceElement(boundary);
  }

  /** The preview / placeholder `<template>` of this drag item (the last one wins, like Angular). */
  private _template(attribute: string): HTMLTemplateElement | null {
    let found: HTMLTemplateElement | null = null;
    this.element.querySelectorAll<HTMLTemplateElement>(`template[${attribute}]`).forEach((template) => {
      if (template.closest(`[${DRAG_ATTR}]`) === this.element) found = template;
    });
    return found;
  }

  /** Syncs the inputs of the Drag with the options of the underlying DragRef. */
  private _syncInputs(ref: DragRef<DragInstance<T>>) {
    ref.beforeStarted.subscribe(() => {
      if (!ref.isDragging()) {
        const dir = this._dir ?? documentDirectionality(this.element.ownerDocument);
        const dragStartDelay = this.dragStartDelay;
        const placeholderTemplate = this._template(PLACEHOLDER_ATTR);
        const previewTemplate = this._template(PREVIEW_ATTR);
        const placeholder: DragHelperTemplate | null = placeholderTemplate
          ? { template: () => (this._placeholderView = moveView(placeholderTemplate, this._placeholderView)), context: this.data }
          : null;
        const preview: DragPreviewTemplate | null = previewTemplate
          ? {
              template: () => (this._previewView = moveView(previewTemplate, this._previewView)),
              context: this.data,
              matchSize: previewTemplate.hasAttribute("data-match-size"),
            }
          : null;

        ref.disabled = this.disabled;
        ref.lockAxis = this.lockAxis;
        ref.scale = this.scale;
        ref.dragStartDelay = typeof dragStartDelay === "object" && dragStartDelay ? dragStartDelay : coerceNumberProperty(dragStartDelay);
        ref.constrainPosition = this.constrainPosition;
        ref.previewClass = this.previewClass!;
        ref
          .withBoundaryElement(this._getBoundaryElement())
          .withPlaceholderTemplate(placeholder)
          .withPreviewTemplate(preview)
          .withPreviewContainer(this.previewContainer || "global");

        if (dir) {
          ref.withDirection(directionValue(dir));
        }
      }
    });

    // This only needs to be resolved once.
    let parentResolved = false;
    ref.beforeStarted.subscribe(() => {
      if (parentResolved) return;
      parentResolved = true;
      // Angular resolves the parent through DI first; here the DOM walk is the only source. Parents
      // that were not created yet are woken (they rendered as `<Drag>` elements).
      let parent = this.element.parentElement;
      while (parent) {
        const parentDrag = this._dragDropRegistry.getDragDirectiveForNode<DragInstance>(parent) ?? (parent.hasAttribute(DRAG_ATTR) ? dragOf(parent) : null);
        if (parentDrag) {
          ref.withParent(parentDrag._dragRef);
          break;
        }
        parent = parent.parentElement;
      }
    });
  }

  /** Handles the events from the underlying `DragRef`. */
  private _handleEvents(ref: DragRef<DragInstance<T>>) {
    ref.started.subscribe((startEvent) => {
      this._syncHostClasses();
      this.dropContainer?._syncHostClasses();
      this._inputs.onStarted?.({ source: this, event: startEvent.event });
    });

    ref.released.subscribe((releaseEvent) => {
      this._inputs.onReleased?.({ source: this, event: releaseEvent.event });
    });

    ref.ended.subscribe((endEvent) => {
      this._syncHostClasses();
      this._inputs.onEnded?.({
        source: this,
        distance: endEvent.distance,
        dropPoint: endEvent.dropPoint,
        event: endEvent.event,
      });
    });

    ref.entered.subscribe((enterEvent) => {
      this._inputs.onEntered?.({
        container: enterEvent.container.data,
        item: this,
        currentIndex: enterEvent.currentIndex,
      });
    });

    ref.exited.subscribe((exitEvent) => {
      this._inputs.onExited?.({
        container: exitEvent.container.data,
        item: this,
      });
    });

    ref.dropped.subscribe((dropEvent) => {
      this._syncHostClasses();
      this._inputs.onDropped?.({
        previousIndex: dropEvent.previousIndex,
        currentIndex: dropEvent.currentIndex,
        previousContainer: dropEvent.previousContainer.data,
        container: dropEvent.container.data,
        isPointerOverContainer: dropEvent.isPointerOverContainer,
        item: this,
        distance: dropEvent.distance,
        dropPoint: dropEvent.dropPoint,
        event: dropEvent.event,
      });
    });

    this._subscribeMoved();
  }

  /** `cdkDragMoved` (only observed while there is a listener, like Angular's lazy Observable). */
  private _subscribeMoved() {
    if (!this._inputs.onMoved || this._movedSubscription) return;
    this._movedSubscription = this._dragRef.moved.subscribe((movedEvent) =>
      this._inputs.onMoved?.({
        source: this,
        pointerPosition: movedEvent.pointerPosition,
        event: movedEvent.event,
        delta: movedEvent.delta,
        distance: movedEvent.distance,
      }),
    );
  }

  /** Rivet: signal inputs Angular re-syncs on change (`ngOnChanges`, the `disabled` setter). */
  private _syncReactiveInputs() {
    this._disposeSync?.();
    const inputs = this._inputs;
    const accessors = [inputs.disabled, inputs.freeDragPosition, inputs.rootElementSelector, inputs.scale];
    if (!accessors.some((value) => typeof value === "function") && !this.dropContainer) return;
    this._disposeSync = createRoot((dispose) => {
      let first = true;
      if (typeof inputs.disabled === "function" || this.dropContainer)
        effect(() => {
          const own = this._ownDisabled;
          const all = this.disabled;
          untrack(() => {
            this._dragRef.disabled = own;
            this._toggleClass("cdk-drag-disabled", "data-disabled", all);
          });
        });
      if (typeof inputs.rootElementSelector === "function")
        effect(() => {
          read(inputs.rootElementSelector);
          if (!first) untrack(() => this._updateRootElement());
        });
      if (typeof inputs.scale === "function" || typeof inputs.freeDragPosition === "function")
        effect(() => {
          // Scale affects the free drag position so we need to sync it up here.
          const scale = this.scale;
          const position = this.freeDragPosition;
          untrack(() => {
            this._dragRef.scale = scale;
            if (!first && position) this._dragRef.setFreeDragPosition(position);
          });
        });
      first = false;
      return dispose;
    }).value;
  }

  /** The server-rendered `transform` of `freeDragPosition` is handed over to the ref. */
  private _rootTransformRendered() {
    const root = this._dragRef.getRootElement();
    if (root.hasAttribute("data-rv-free-position")) {
      root.style.removeProperty("transform");
      root.removeAttribute("data-rv-free-position");
    }
  }

  /** Host classes (Angular host bindings). */
  _syncHostClasses(): void {
    this._toggleClass("cdk-drag-disabled", "data-disabled", this.disabled);
    this._toggleClass("cdk-drag-dragging", "data-dragging", this._dragRef.isDragging());
  }

  private _toggleClass(name: string, attribute: string, on: boolean) {
    this.element.classList.toggle(name, on);
    if (on) this.element.setAttribute(attribute, "true");
    else this.element.removeAttribute(attribute);
  }
}

/**
 * A view of a `<template>`'s content (Angular: an embedded view): its nodes move out for the drag and
 * back on `destroy()`, keeping their bindings live; the root elements' `class` / `style` / `popover` /
 * `dir` changes made while dragging are undone (Angular creates a fresh view each time).
 */
function moveView(template: HTMLTemplateElement, previous: StampedView | null): StampedView {
  previous?.destroy();
  const rootNodes: Node[] = [];
  template.content.childNodes.forEach((node) => {
    // Skip whitespace and framework comment markers.
    if (node.nodeType === 3 && !node.textContent!.trim()) return;
    if (node.nodeType === 8) return;
    rootNodes.push(node);
  });
  const saved = rootNodes.map((node) =>
    node.nodeType === 1 ? (["class", "style", "popover", "dir"] as const).map((name) => (node as Element).getAttribute(name)) : null,
  );
  const document = template.ownerDocument;
  rootNodes.forEach((node) => document.adoptNode(node));
  let destroyed = false;
  return {
    rootNodes,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      rootNodes.forEach((node, i) => {
        const attributes = saved[i];
        if (attributes)
          (["class", "style", "popover", "dir"] as const).forEach((name, j) => {
            const value = attributes[j];
            if (value === null) (node as Element).removeAttribute(name);
            else (node as Element).setAttribute(name, value);
          });
        template.content.appendChild(node);
      });
    },
  };
}
