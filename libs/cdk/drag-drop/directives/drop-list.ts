// Ported from Angular Components (src/cdk/drag-drop/directives/drop-list.ts), MIT, © Google LLC.
// Rivet: `CdkDropList` without the directive plumbing — the browser-side instance behind a
// `<DropList>` element (drop-list.tsx), created on demand from the props its handler captured
// (directives/registry.ts). Deviations:
// - the static `_dropLists` registry is the document: `connectedTo` ids resolve through
//   `getElementById` + wake (`DropListInstance._dropLists` keeps the instances created so far);
// - items register themselves when they are created (Angular: on construction); on its own creation
//   the list creates the instances of the `<Drag>` elements it holds, so `getSortedItems()` is complete
//   before the first drag; the group (`<DropListGroup>`) is the closest group element (DOM);
// - inputs are props (plain values or accessors / signals) read in `beforeStarted`, like Angular reads
//   its inputs there; `disabled` is also synced right before an item's pointer down and by an effect;
// - host classes `cdk-drop-list-disabled` / `-dragging` / `-receiving` (+ `data-*`) are toggled by the
//   instance where Angular calls `markForCheck`.
import { createRoot, effect, untrack, type Disposer } from "@rivetjs/reactivity";
import { coerceArray, coerceNumberProperty, type NumberInput } from "../../coercion/index.ts";
import { directionValue, documentDirectionality, type Directionality } from "../../bidi/index.ts";
import { scrollDispatcher } from "../../scrolling/scroll-dispatcher.ts";
import type { DragDrop, DragEnter, DragExit, DragSortEvent } from "../drag-events.ts";
import { createDropListRef, type DropListOrientation, type DropListRef } from "../drop-list-ref.ts";
import type { DragRef } from "../drag-ref.ts";
import type { DragAxis, DragDropConfig } from "./config.ts";
import { assertElementNode } from "./assertions.ts";
import { DragInstance } from "./drag.ts";
import { groupElementOf, groupOf, type DropListGroupInstance } from "./drop-list-group.ts";
import { DRAG_ATTR, closestDropListElement, drags, dropListOf, dropLists, read, registered, wake, type MaybeAccessor } from "./registry.ts";

/** Inputs and outputs of a drop list (Angular `cdkDropList*` inputs / outputs, `Cdk` prefix dropped). */
export interface DropListInputs<T = any> {
  /**
   * Other draggable containers that this container is connected to and into which the
   * container's items can be transferred. Can either be references to other drop containers,
   * or their unique IDs.
   */
  connectedTo?: MaybeAccessor<(DropListInstance | string)[] | DropListInstance | string | undefined>;
  /** Arbitrary data to attach to this container. */
  data?: MaybeAccessor<T>;
  /** Direction in which the list is oriented. */
  orientation?: MaybeAccessor<DropListOrientation | undefined>;
  /** Locks the position of the draggable elements inside the container along the specified axis. */
  lockAxis?: MaybeAccessor<DragAxis | null | undefined>;
  /** Whether starting a dragging sequence from this container is disabled. */
  disabled?: MaybeAccessor<boolean | undefined>;
  /** Whether sorting within this drop list is disabled. */
  sortingDisabled?: MaybeAccessor<boolean | undefined>;
  /**
   * Function that is used to determine whether an item
   * is allowed to be moved into a drop container.
   */
  enterPredicate?: (drag: DragInstance, drop: DropListInstance) => boolean;
  /** Functions that is used to determine whether an item can be sorted into a particular index. */
  sortPredicate?: (index: number, drag: DragInstance, drop: DropListInstance) => boolean;
  /** Whether to auto-scroll the view when the user moves their pointer close to the edges. */
  autoScrollDisabled?: MaybeAccessor<boolean | undefined>;
  /** Number of pixels to scroll for each frame when auto-scrolling an element. */
  autoScrollStep?: MaybeAccessor<NumberInput>;
  /**
   * Selector that will be used to resolve an alternate element container for the drop list.
   * Passing an alternate container is useful for the cases where one might not have control
   * over the parent node of the draggable items within the list (e.g. due to content projection).
   * This allows for usages like:
   *
   * ```
   * <DropList elementContainerSelector=".inner">
   *   <div class="inner">
   *     <Drag/>
   *   </div>
   * </DropList>
   * ```
   */
  elementContainerSelector?: MaybeAccessor<string | null | undefined>;
  /**
   * By default when an item leaves its initial container, its placeholder will be transferred
   * to the new container. If that's not desirable for your use case, you can enable this option
   * which will clone the placeholder and leave it inside the original container. If the item is
   * returned to the initial container, the anchor element will be removed automatically.
   *
   * The cloned placeholder can be styled by targeting the `cdk-drag-anchor` class.
   *
   * This option is useful in combination with `cdkDropListSortingDisabled` to implement copying
   * behavior in a drop list.
   */
  hasAnchor?: MaybeAccessor<boolean | undefined>;
  /** Emits when the user drops an item inside the container. */
  onDropped?: (event: DragDrop<T, any>) => void;
  /** Emits when the user has moved a new drag item into this container. */
  onEntered?: (event: DragEnter<T>) => void;
  /** Emits when the user removes an item from the container by dragging it into another container. */
  onExited?: (event: DragExit<T>) => void;
  /** Emits as the user is swapping items while actively dragging. */
  onSorted?: (event: DragSortEvent<T>) => void;
}

/** Options a drop list instance is created with (component props + render context). */
export interface DropListSetup<T = any> {
  inputs?: DropListInputs<T>;
  /** `DragDropConfigContext` value where the `<DropList>` rendered. */
  config?: DragDropConfig | null;
  /** `DirectionalityContext` value where the `<DropList>` rendered (else the document's). */
  dir?: Directionality | null;
}

/** Container that wraps a set of draggable items (Angular `CdkDropList`). */
export class DropListInstance<T = any> {
  /** The `<DropList>` element. */
  readonly element: HTMLElement;

  /** Keeps track of the drop lists that are currently on the page. */
  static _dropLists: DropListInstance[] = [];

  /** Reference to the underlying drop list instance. */
  _dropListRef: DropListRef<DropListInstance<T>>;

  private _inputs: DropListInputs<T>;
  private _config: DragDropConfig | null;
  private _dir: Directionality | null;
  private _group: DropListGroupInstance<DropListInstance> | null;
  private _latestSortedRefs: DragRef[] | undefined;
  private _scrollableParentsResolved = false;
  private _unsortedItems = new Set<DragInstance>();
  private _destroyed = false;
  private _disposeSync: Disposer | null = null;
  /** Rivet: inputs assigned on the instance (Angular input fields), kept across `_setInputs`. */
  private _assigned: {
    sortingDisabled?: boolean;
    enterPredicate?: (drag: DragInstance, drop: DropListInstance) => boolean;
    sortPredicate?: (index: number, drag: DragInstance, drop: DropListInstance) => boolean;
    autoScrollDisabled?: boolean;
    autoScrollStep?: NumberInput;
  } = {};

  constructor(element: HTMLElement, setup: DropListSetup<T> = {}) {
    this.element = element;
    this._inputs = setup.inputs ?? {};
    this._config = setup.config ?? null;
    this._dir = setup.dir ?? null;
    const groupElement = groupElementOf(element);
    this._group = groupElement ? (groupOf(groupElement) as DropListGroupInstance<DropListInstance>) : null;

    assertElementNode(element, "cdkDropList");

    dropLists.set(element, this as DropListInstance);
    this._dropListRef = createDropListRef(element);
    this._dropListRef.data = this;

    this._dropListRef.enterPredicate = (drag: DragRef<DragInstance>, drop: DropListRef<DropListInstance>) => {
      return this.enterPredicate(drag.data, drop.data);
    };

    this._dropListRef.sortPredicate = (index: number, drag: DragRef<DragInstance>, drop: DropListRef<DropListInstance>) => {
      return this.sortPredicate(index, drag.data, drop.data);
    };

    this._setupInputSyncSubscription(this._dropListRef);
    this._handleEvents(this._dropListRef);
    DropListInstance._dropLists.push(this as DropListInstance);

    if (this._group) {
      this._group._items.add(this as DropListInstance);
    }

    this._dropListRef.disabled = this.disabled;
    this._syncReactiveInputs();
    this._syncHostClasses();
    registered(element);

    this._collectItems();
  }

  /**
   * Rivet: the items rendered inside the list (Angular creates them with the view, `addItem` /
   * `removeItem` on construction / destruction). Items without an instance get a bare one (their
   * props arrive with their own handler), an awake item created before its list is attached, and
   * items whose element left the list without being destroyed (a server-rendered row replaced on a
   * resumed page) are dropped. Runs on creation and before each drag sequence.
   */
  private _collectItems() {
    const element = this.element;
    element.querySelectorAll(`[${DRAG_ATTR}]`).forEach((item) => {
      if (closestDropListElement(item) !== element) return;
      // Skip the engine's clones of a dragged item (placeholder / preview / anchor carry its attributes).
      if (item.closest(".cdk-drag-placeholder, .cdk-drag-preview, .cdk-drag-anchor")) return;
      let existing = drags.get(item);
      // Wake the item first so its own handler creates it with its props (Angular creates every
      // `CdkDrag` with its inputs); a bare instance only while its chunk is still loading.
      if (!existing) {
        wake(item);
        existing = drags.get(item);
      }
      if (!existing) new DragInstance(item as HTMLElement, { config: this._config, dir: this._dir });
      else if (!existing.dropContainer) {
        existing.dropContainer = this as DropListInstance;
        this.addItem(existing);
      }
    });
    this._unsortedItems.forEach((item) => {
      if (!item.element.isConnected) item.destroy();
    });
  }

  /** Other draggable containers that this container is connected to. */
  get connectedTo(): (DropListInstance | string)[] | DropListInstance | string {
    return read(this._inputs.connectedTo) ?? [];
  }

  /** Arbitrary data to attach to this container. */
  get data(): T {
    return read(this._inputs.data) as T;
  }

  /** Direction in which the list is oriented. */
  get orientation(): DropListOrientation {
    return read(this._inputs.orientation) ?? (this._config?.listOrientation || "vertical");
  }

  /** Unique ID for the drop zone (rendered as the element's `id`). */
  get id(): string {
    return this.element.id;
  }

  /** Locks the position of the draggable elements inside the container along the specified axis. */
  get lockAxis(): DragAxis | null {
    return read(this._inputs.lockAxis) ?? this._config?.lockAxis ?? null;
  }

  /** Whether starting a dragging sequence from this container is disabled. */
  get disabled(): boolean {
    return this._ownDisabled || (!!this._group && this._group.disabled);
  }

  private get _ownDisabled(): boolean {
    return read(this._inputs.disabled) ?? (this._config?.draggingDisabled == null ? false : this._config.draggingDisabled);
  }

  /** Whether sorting within this drop list is disabled. */
  get sortingDisabled(): boolean {
    if (this._assigned.sortingDisabled !== undefined) return this._assigned.sortingDisabled;
    return read(this._inputs.sortingDisabled) ?? (this._config?.sortingDisabled == null ? false : this._config.sortingDisabled);
  }
  /** Rivet: Angular inputs are writable fields (`dropList.sortingDisabled = true`); an assignment wins over the prop. */
  set sortingDisabled(value: boolean) {
    this._assigned.sortingDisabled = value;
  }

  /** Whether an item is allowed to be moved into the container. */
  get enterPredicate(): (drag: DragInstance, drop: DropListInstance) => boolean {
    return this._assigned.enterPredicate ?? this._inputs.enterPredicate ?? (() => true);
  }
  set enterPredicate(value: (drag: DragInstance, drop: DropListInstance) => boolean) {
    this._assigned.enterPredicate = value;
  }

  /** Whether an item can be sorted into a particular index. */
  get sortPredicate(): (index: number, drag: DragInstance, drop: DropListInstance) => boolean {
    return this._assigned.sortPredicate ?? this._inputs.sortPredicate ?? (() => true);
  }
  set sortPredicate(value: (index: number, drag: DragInstance, drop: DropListInstance) => boolean) {
    this._assigned.sortPredicate = value;
  }

  /** Whether to auto-scroll the view when the user moves their pointer close to the edges. */
  get autoScrollDisabled(): boolean {
    if (this._assigned.autoScrollDisabled !== undefined) return this._assigned.autoScrollDisabled;
    return read(this._inputs.autoScrollDisabled) ?? (this._config?.listAutoScrollDisabled == null ? false : this._config.listAutoScrollDisabled);
  }
  set autoScrollDisabled(value: boolean) {
    this._assigned.autoScrollDisabled = value;
  }

  /** Number of pixels to scroll for each frame when auto-scrolling an element. */
  get autoScrollStep(): NumberInput {
    if (this._assigned.autoScrollStep !== undefined) return this._assigned.autoScrollStep;
    return read(this._inputs.autoScrollStep);
  }
  set autoScrollStep(value: NumberInput) {
    this._assigned.autoScrollStep = value;
  }

  /** Selector of an alternate element container. */
  get elementContainerSelector(): string | null {
    return read(this._inputs.elementContainerSelector) ?? null;
  }

  /** Whether the placeholder is cloned into an anchor in the original container. */
  get hasAnchor(): boolean {
    return read(this._inputs.hasAnchor) ?? false;
  }

  /** Registers an items with the drop list. */
  addItem(item: DragInstance): void {
    this._unsortedItems.add(item);
    item._dragRef._withDropContainer(this._dropListRef);

    // Only sync the items while dragging since this method is
    // called when items are being initialized one-by-one.
    if (this._dropListRef.isDragging()) {
      this._syncItemsWithRef(this.getSortedItems().map((item) => item._dragRef));
    }
  }

  /** Removes an item from the drop list. */
  removeItem(item: DragInstance): void {
    this._unsortedItems.delete(item);

    // This method might be called on destroy so we always want to sync with the ref.
    // Note that we reuse the last set of synced items, rather than re-sorting the whole
    // list, because it can slow down re-renders of large lists (see #30737).
    if (this._latestSortedRefs) {
      const index = this._latestSortedRefs.indexOf(item._dragRef);

      if (index > -1) {
        this._latestSortedRefs.splice(index, 1);
        this._syncItemsWithRef(this._latestSortedRefs);
        // Rivet: removing the dragged item aborts the sequence (`DropListRef.withItems`); Angular's
        // host bindings pick that up on the next change detection.
        if (!this._destroyed) this._syncHostClasses();
      }
    }
  }

  /** Gets the registered items in the list, sorted by their position in the DOM. */
  getSortedItems(): DragInstance[] {
    return Array.from(this._unsortedItems).sort((a: DragInstance, b: DragInstance) => {
      const documentPosition = a._dragRef.getVisibleElement().compareDocumentPosition(b._dragRef.getVisibleElement());

      // `compareDocumentPosition` returns a bitmask so we have to use a bitwise operator.
      // https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition
      // tslint:disable-next-line:no-bitwise
      return documentPosition & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  /** Rivet: the props of a lazily created (bare) instance arrived with its own handler. */
  _setInputs(setup: DropListSetup<T>): void {
    if (setup.inputs === this._inputs) return;
    this._inputs = setup.inputs ?? {};
    if (setup.config !== undefined) this._config = setup.config;
    if (setup.dir !== undefined) this._dir = setup.dir;
    this._dropListRef.disabled = this.disabled;
    this._syncReactiveInputs();
    this._syncHostClasses();
  }

  /** Angular `ngOnDestroy`. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    const index = DropListInstance._dropLists.indexOf(this as DropListInstance);

    if (index > -1) {
      DropListInstance._dropLists.splice(index, 1);
    }

    if (this._group) {
      this._group._items.delete(this as DropListInstance);
    }

    this._latestSortedRefs = undefined;
    this._unsortedItems.clear();
    this._disposeSync?.();
    this._dropListRef.dispose();
    if (dropLists.get(this.element) === (this as DropListInstance)) dropLists.delete(this.element);
  }

  /** Syncs the inputs of the DropList with the options of the underlying DropListRef. */
  private _setupInputSyncSubscription(ref: DropListRef<DropListInstance>) {
    ref.beforeStarted.subscribe(() => {
      const doc = this.element.ownerDocument;
      const siblings = coerceArray(this.connectedTo).map((drop) => {
        if (typeof drop === "string") {
          // Rivet: Angular looks the id up in its static list; the element of another `<DropList>`
          // is woken here when it was not created yet.
          const element = doc.getElementById(drop);
          const correspondingDropList =
            DropListInstance._dropLists.find((list) => list.id === drop) ?? (element && element !== this.element ? dropListOf(element) : null);

          if (!correspondingDropList) {
            console.warn(`CdkDropList could not find connected drop list with id "${drop}"`);
          }

          return correspondingDropList!;
        }

        return drop;
      });

      if (this._group) {
        this._group._wakeAll();
        this._group._items.forEach((drop) => {
          if (siblings.indexOf(drop) === -1) {
            siblings.push(drop);
          }
        });
      }

      // Note that we resolve the scrollable parents here so that we delay the resolution
      // as long as possible, ensuring that the element is in its final place in the DOM.
      if (!this._scrollableParentsResolved) {
        const scrollableParents = scrollDispatcher(doc)
          .getAncestorScrollContainers(this.element)
          .map((scrollable) => scrollable.getElementRef().nativeElement);
        this._dropListRef.withScrollableParents(scrollableParents);

        // Only do this once since it involves traversing the DOM and the parents
        // shouldn't be able to change without the drop list being destroyed.
        this._scrollableParentsResolved = true;
      }

      const elementContainerSelector = this.elementContainerSelector;
      if (elementContainerSelector) {
        const container = this.element.querySelector(elementContainerSelector);

        if (!container) {
          throw new Error(`CdkDropList could not find an element container matching the selector "${elementContainerSelector}"`);
        }

        ref.withElementContainer(container as HTMLElement);
      }

      const dir = this._dir ?? documentDirectionality(doc);
      ref.withDirection(directionValue(dir));
      ref.disabled = this.disabled;
      ref.lockAxis = this.lockAxis;
      ref.sortingDisabled = this.sortingDisabled;
      ref.autoScrollDisabled = this.autoScrollDisabled;
      ref.autoScrollStep = coerceNumberProperty(this.autoScrollStep, 2);
      ref.hasAnchor = this.hasAnchor;
      ref
        .connectedTo(siblings.filter((drop) => drop && drop !== (this as DropListInstance)).map((list) => list._dropListRef))
        .withOrientation(this.orientation);
    });
  }

  /** Handles events from the underlying DropListRef. */
  private _handleEvents(ref: DropListRef<DropListInstance>) {
    ref.beforeStarted.subscribe(() => {
      this._collectItems();
      this._syncItemsWithRef(this.getSortedItems().map((item) => item._dragRef));
      this._syncHostClasses();
      // Rivet: the ref flips `isDragging()` right after `beforeStarted` (Angular's host binding
      // re-evaluates on the next change detection); nothing else re-syncs the source list.
      this._toggleClass("cdk-drop-list-dragging", "data-dragging", true);
    });

    ref.entered.subscribe((event) => {
      this._syncHostClasses();
      this._inputs.onEntered?.({
        container: this,
        item: event.item.data,
        currentIndex: event.currentIndex,
      });
    });

    ref.exited.subscribe((event) => {
      this._syncHostClasses();
      this._inputs.onExited?.({
        container: this,
        item: event.item.data,
      });
    });

    ref.sorted.subscribe((event) => {
      this._inputs.onSorted?.({
        previousIndex: event.previousIndex,
        currentIndex: event.currentIndex,
        container: this,
        item: event.item.data,
      });
    });

    ref.dropped.subscribe((dropEvent) => {
      this._syncHostClasses();
      this._inputs.onDropped?.({
        previousIndex: dropEvent.previousIndex,
        currentIndex: dropEvent.currentIndex,
        previousContainer: dropEvent.previousContainer.data,
        container: dropEvent.container.data,
        item: dropEvent.item.data,
        isPointerOverContainer: dropEvent.isPointerOverContainer,
        distance: dropEvent.distance,
        dropPoint: dropEvent.dropPoint,
        event: dropEvent.event,
      });
    });

    ref.receivingStarted.subscribe(() => this._syncHostClasses());
    ref.receivingStopped.subscribe(() => this._syncHostClasses());
  }

  /** Syncs up the registered drag items with underlying drop list ref. */
  private _syncItemsWithRef(items: DragRef[]) {
    this._latestSortedRefs = items;
    this._dropListRef.withItems(items);
  }

  /** Rivet: a signal `disabled` input is synced as it changes (Angular: its setter). */
  private _syncReactiveInputs() {
    this._disposeSync?.();
    this._disposeSync = null;
    if (typeof this._inputs.disabled !== "function") return;
    this._disposeSync = createRoot((dispose) => {
      effect(() => {
        const disabled = this.disabled;
        untrack(() => {
          this._dropListRef.disabled = disabled;
          this._toggleClass("cdk-drop-list-disabled", "data-disabled", disabled);
          // Items read the container's state in their host bindings.
          this._unsortedItems.forEach((item) => item._syncHostClasses());
        });
      });
      return dispose;
    }).value;
  }

  /** Host classes (Angular host bindings). */
  _syncHostClasses(): void {
    this._toggleClass("cdk-drop-list-disabled", "data-disabled", this.disabled);
    this._toggleClass("cdk-drop-list-dragging", "data-dragging", this._dropListRef.isDragging());
    this._toggleClass("cdk-drop-list-receiving", "data-receiving", this._dropListRef.isReceiving());
  }

  private _toggleClass(name: string, attribute: string, on: boolean) {
    this.element.classList.toggle(name, on);
    if (on) this.element.setAttribute(attribute, "true");
    else this.element.removeAttribute(attribute);
  }
}
