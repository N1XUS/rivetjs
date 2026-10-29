// Ported from react-spectrum (packages/react-aria/src/dnd/DragManager.ts), Apache-2.0, © Adobe.
// The keyboard / screen reader drag session: a module-level session that cycles focus between the registered drop
// targets (Tab / Shift+Tab), hides everything else (`ariaHideOutside`, inert) and drops on Enter / a virtual click.
// Rivet:
// - The session is a module signal (`useDragSession()` returns its accessor); React re-rendered `useDragSession`
//   subscribers through a callback set.
// - `stringFormatter` is a `format(key)` function (the `./intl.ts` table formatted for the drag source's locale).
// - Drop targets / items register from client effects of the components that render them; their `activateButtonRef`
//   is an `ElementRef`.
import { signal } from "@rivetjs/reactivity";
import { announce } from "../announcer/live-announcer.ts";
import { ariaHideOutside } from "../overlay/aria-hide-outside.ts";
import { isVirtualClick, isVirtualPointerEvent } from "../platform/index.ts";
import { getActiveElement, getEventTarget, nodeContains } from "../utils/dom-core.ts";
import { getDragModality, getTypes } from "./utils.ts";
import type {
  DragEndEvent,
  DragItem,
  DropActivateEvent,
  DropEnterEvent,
  DropEvent,
  DropExitEvent,
  DropItem,
  DropOperation,
  DropTarget as DroppableCollectionTarget,
  ElementRef,
} from "./types.ts";

type FocusableElement = HTMLElement;

const dropTargets = new Map<Element, DropTarget>();
const dropItems = new Map<Element, DroppableItem>();
let dragSession: DragSession | null = null;
// Rivet: `useDragSession` subscribers (React state per hook upstream).
const session = signal<DragSession | null>(null);

export interface DropTarget {
  element: FocusableElement;
  preventFocusOnDrop?: boolean | undefined;
  getDropOperation?: ((types: Set<string>, allowedOperations: DropOperation[]) => DropOperation) | undefined;
  onDropEnter?: ((e: DropEnterEvent, dragTarget: DragTarget) => void) | undefined;
  onDropExit?: ((e: DropExitEvent) => void) | undefined;
  onDropTargetEnter?: ((target: DroppableCollectionTarget | null) => void) | undefined;
  onDropActivate?: ((e: DropActivateEvent, target: DroppableCollectionTarget | null) => void) | undefined;
  onDrop?: ((e: DropEvent, target: DroppableCollectionTarget | null) => void) | undefined;
  onKeyDown?: ((e: KeyboardEvent, dragTarget: DragTarget) => void) | undefined;
  activateButtonRef?: ElementRef<FocusableElement> | undefined;
}

export function registerDropTarget(target: DropTarget): () => void {
  dropTargets.set(target.element, target);
  dragSession?.updateValidDropTargets();
  // A cold page: the drag button's unit started the session before the collection's unit registered its target.
  // (An effect re-run unregisters and registers again: the target the first registration got is reset in between.)
  if (dragSession?.keyboard && !dragSession.currentDropTarget && dragSession.validDropTargets.length) dragSession.next();
  return (): void => {
    dropTargets.delete(target.element);
    dragSession?.updateValidDropTargets();
  };
}

export interface DroppableItem {
  element: FocusableElement;
  target: DroppableCollectionTarget;
  getDropOperation?: ((types: Set<string>, allowedOperations: DropOperation[]) => DropOperation) | undefined;
  activateButtonRef?: ElementRef<FocusableElement> | undefined;
}

export function registerDropItem(item: DroppableItem): () => void {
  dropItems.set(item.element, item);
  return (): void => {
    dropItems.delete(item.element);
  };
}

export interface DragTarget {
  element: FocusableElement;
  items: DragItem[];
  allowedDropOperations: DropOperation[];
  /** The press that started the drag was a keyboard one. The interaction modality can already read "virtual": the native
   * click an Enter keydown fires on a cold drag button (the key's release restores "keyboard" only afterwards). */
  keyboard?: boolean | undefined;
  onDragEnd?: ((e: DragEndEvent) => void) | undefined;
}

/** The drag session's messages (react-aria `LocalizedStringFormatter.format`). */
export type DragFormat = (key: string, args?: Record<string, unknown>) => string;

export function beginDragging(target: DragTarget, stringFormatter: DragFormat): void {
  if (dragSession) throw new Error("Cannot begin dragging while already dragging");
  dragSession = new DragSession(target, stringFormatter);
  requestAnimationFrame(() => {
    if (dragSession) {
      dragSession.setup();
      if (dragSession.dragTarget.keyboard || getDragModality() === "keyboard") {
        dragSession.keyboard = true;
        dragSession.next();
      }
    }
  });
  session.set(dragSession);
}

/** The current drag session (an accessor: bindings reading it update when a session starts / ends). */
export function useDragSession(): () => DragSession | null {
  return session;
}

/** @private */
export function isVirtualDragging(): boolean {
  return !!session();
}

function endDragging() {
  dragSession = null;
  session.set(null);
}

export function isValidDropTarget(element: Element): boolean {
  for (const target of dropTargets.keys()) if (nodeContains(target, element)) return true;
  return false;
}

const CANCELED_EVENTS = [
  "pointerdown",
  "pointermove",
  "pointerenter",
  "pointerleave",
  "pointerover",
  "pointerout",
  "pointerup",
  "mousedown",
  "mousemove",
  "mouseenter",
  "mouseleave",
  "mouseover",
  "mouseout",
  "mouseup",
  "touchstart",
  "touchmove",
  "touchend",
  "focusin",
  "focusout",
];

const CLICK_EVENTS = ["pointerup", "mouseup", "touchend"];

const MESSAGES = {
  keyboard: "dragStartedKeyboard",
  touch: "dragStartedTouch",
  virtual: "dragStartedVirtual",
};

export class DragSession {
  dragTarget: DragTarget;
  validDropTargets: DropTarget[] = [];
  currentDropTarget: DropTarget | null = null;
  currentDropItem: DroppableItem | null = null;
  dropOperation: DropOperation | null = null;
  private mutationObserver: MutationObserver | null = null;
  private restoreAriaHidden: (() => void) | null = null;
  private stringFormatter: DragFormat;
  private isVirtualClick: boolean = false;
  private initialFocused: boolean;
  // An Enter keydown this session saw. The Enter that started the session on a native drag button (its click, fired by
  // the keydown, ends the press) is released after `setup`: that stray keyup must not drop.
  private enterDown = false;
  /** Set up as a keyboard session (`registerDropTarget` moves to the first target that registers after it found none). */
  keyboard = false;

  constructor(target: DragTarget, stringFormatter: DragFormat) {
    this.dragTarget = target;
    this.stringFormatter = stringFormatter;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onFocus = this.onFocus.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.cancelEvent = this.cancelEvent.bind(this);
    this.initialFocused = false;
  }

  setup(): void {
    document.addEventListener("keydown", this.onKeyDown, true);
    document.addEventListener("keyup", this.onKeyUp, true);
    window.addEventListener("focus", this.onFocus, true);
    window.addEventListener("blur", this.onBlur, true);
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("pointerdown", this.onPointerDown, true);
    for (const event of CANCELED_EVENTS) document.addEventListener(event, this.cancelEvent, true);
    this.mutationObserver = new MutationObserver(() => this.updateValidDropTargets());
    this.updateValidDropTargets();
    announce(this.stringFormatter(MESSAGES[getDragModality()]));
  }

  teardown(): void {
    document.removeEventListener("keydown", this.onKeyDown, true);
    document.removeEventListener("keyup", this.onKeyUp, true);
    window.removeEventListener("focus", this.onFocus, true);
    window.removeEventListener("blur", this.onBlur, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("pointerdown", this.onPointerDown, true);
    for (const event of CANCELED_EVENTS) document.removeEventListener(event, this.cancelEvent, true);
    this.mutationObserver?.disconnect();
    this.restoreAriaHidden?.();
  }

  onKeyDown(e: KeyboardEvent): void {
    this.cancelEvent(e);
    if (e.key === "Escape") {
      this.cancel();
      return;
    }
    if (e.key === "Enter") this.enterDown = true;
    if (e.key === "Tab" && !(e.metaKey || e.altKey || e.ctrlKey)) {
      if (e.shiftKey) this.previous();
      else this.next();
    }
    if (typeof this.currentDropTarget?.onKeyDown === "function") this.currentDropTarget.onKeyDown(e, this.dragTarget);
  }

  onKeyUp(e: KeyboardEvent): void {
    this.cancelEvent(e);
    if (e.key === "Enter") {
      if (!this.enterDown) return;
      this.enterDown = false;
      if (e.altKey || nodeContains(this.getCurrentActivateButton(), getEventTarget(e) as Node)) this.activate(this.currentDropTarget, this.currentDropItem);
      else this.drop();
    }
  }

  getCurrentActivateButton(): FocusableElement | null {
    return this.currentDropItem?.activateButtonRef?.current ?? this.currentDropTarget?.activateButtonRef?.current ?? null;
  }

  onFocus(e: FocusEvent): void {
    const activateButton = this.getCurrentActivateButton();
    const eventTarget = getEventTarget(e);
    if (eventTarget === activateButton) {
      // TODO (upstream): canceling this breaks the focus ring. Revisit when we support tabbing.
      this.cancelEvent(e);
      return;
    }
    // Prevent focus events, except to the original drag target.
    if (eventTarget !== this.dragTarget.element) this.cancelEvent(e);
    // Ignore focus events on the window/document (JSDOM). Will be handled in onBlur, below.
    if (!(eventTarget instanceof HTMLElement) || eventTarget === this.dragTarget.element) return;
    const dropTarget =
      this.validDropTargets.find((target) => target.element === eventTarget) ||
      this.validDropTargets.find((target) => nodeContains(target.element, eventTarget));
    if (!dropTarget) {
      if (this.currentDropTarget) this.currentDropTarget.element.focus();
      else this.dragTarget.element.focus();
      return;
    }
    const item = dropItems.get(eventTarget);
    if (dropTarget) this.setCurrentDropTarget(dropTarget, item);
  }

  onBlur(e: FocusEvent): void {
    const activateButton = this.getCurrentActivateButton();
    // Guard activateButton non-null so this doesn't trip on the case where there's no activate button and the focused
    // element loses focus to nothing (browsers and jsdom 26+ both set relatedTarget to null in that case).
    if (activateButton && e.relatedTarget === activateButton) {
      this.cancelEvent(e);
      return;
    }
    if (getEventTarget(e) !== this.dragTarget.element) this.cancelEvent(e);
    // If nothing is gaining focus, or e.relatedTarget is the window/document (JSDOM), restore focus back to the current
    // drop target if any, or the original drag target.
    if (!e.relatedTarget || !(e.relatedTarget instanceof HTMLElement)) {
      if (this.currentDropTarget) this.currentDropTarget.element.focus();
      else this.dragTarget.element.focus();
    }
  }

  onClick(e: MouseEvent): void {
    this.cancelEvent(e);
    if (isVirtualClick(e) || this.isVirtualClick) {
      const dropElements = dropItems.values();
      const eventTarget = getEventTarget(e) as HTMLElement;
      const item = [...dropElements].find((item) => item.element === eventTarget || nodeContains(item.activateButtonRef?.current, eventTarget));
      const dropTarget = this.validDropTargets.find((target) => nodeContains(target.element, eventTarget));
      const activateButton = item?.activateButtonRef?.current ?? dropTarget?.activateButtonRef?.current;
      if (nodeContains(activateButton, eventTarget) && dropTarget) {
        this.activate(dropTarget, item);
        return;
      }
      if (getEventTarget(e) === this.dragTarget.element) {
        this.cancel();
        return;
      }
      if (dropTarget) {
        this.setCurrentDropTarget(dropTarget, item);
        this.drop(item);
      }
    }
  }

  onPointerDown(e: PointerEvent): void {
    // Android Talkback double tap has e.detail = 1 for onClick. Detect the virtual click in onPointerDown before onClick
    // fires so we can properly perform cancel and drop operations.
    this.cancelEvent(e);
    this.isVirtualClick = isVirtualPointerEvent(e);
  }

  cancelEvent(e: Event): void {
    // Allow focusin and focusout on the drag target so focus ring works properly.
    const eventTarget = getEventTarget(e);
    if ((e.type === "focusin" || e.type === "focusout") && (eventTarget === this.dragTarget?.element || eventTarget === this.getCurrentActivateButton()))
      return;
    // Allow default for events that might cancel a click event
    if (!CLICK_EVENTS.includes(e.type)) e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  updateValidDropTargets(): void {
    if (!this.mutationObserver) return;
    this.mutationObserver.disconnect();
    if (this.restoreAriaHidden) this.restoreAriaHidden();
    this.validDropTargets = findValidDropTargets(this.dragTarget);
    // Shuffle drop target order based on starting drag target.
    if (this.validDropTargets.length > 0) {
      const nearestIndex = this.findNearestDropTarget();
      this.validDropTargets = [...this.validDropTargets.slice(nearestIndex), ...this.validDropTargets.slice(0, nearestIndex)];
    }
    if (this.currentDropTarget && !this.validDropTargets.includes(this.currentDropTarget)) this.setCurrentDropTarget(this.validDropTargets[0] ?? null);
    // Find valid drop items within collections
    const types = getTypes(this.dragTarget.items);
    const validDropItems = [...dropItems.values()].filter((item) => {
      if (typeof item.getDropOperation === "function") return item.getDropOperation(types, this.dragTarget.allowedDropOperations) !== "cancel";
      return true;
    });
    // Filter out drop targets that contain valid items. We don't want to stop hiding elements other than the drop items
    // that exist inside the collection.
    const visibleDropTargets = this.validDropTargets.filter((target) => !validDropItems.some((item) => nodeContains(target.element, item.element)));
    this.restoreAriaHidden = ariaHideOutside(
      [
        this.dragTarget.element,
        ...validDropItems.flatMap((item) => (item.activateButtonRef?.current ? [item.element, item.activateButtonRef.current] : [item.element])),
        ...visibleDropTargets.flatMap((target) => (target.activateButtonRef?.current ? [target.element, target.activateButtonRef.current] : [target.element])),
      ],
      { shouldUseInert: true },
    );
    this.mutationObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["aria-hidden", "inert"] });
  }

  next(): void {
    // TODO (upstream): Allow tabbing to the activate button. Revisit once we fix the focus ring. For now, the activate
    // button is reachable by screen readers and ArrowLeft/ArrowRight is usable specifically by Tree.
    if (!this.currentDropTarget) {
      this.setCurrentDropTarget(this.validDropTargets[0] ?? null);
      return;
    }
    const index = this.validDropTargets.indexOf(this.currentDropTarget);
    if (index < 0) {
      this.setCurrentDropTarget(this.validDropTargets[0] ?? null);
      return;
    }
    // If we've reached the end of the valid drop targets, cycle back to the original drag target. This lets the user
    // cancel the drag in case they don't have an Escape key (e.g. iPad keyboard case).
    if (index === this.validDropTargets.length - 1) {
      if (!this.dragTarget.element.closest('[aria-hidden="true"], [inert]')) {
        this.setCurrentDropTarget(null);
        this.dragTarget.element.focus();
      } else this.setCurrentDropTarget(this.validDropTargets[0] ?? null);
    } else this.setCurrentDropTarget(this.validDropTargets[index + 1] ?? null);
  }

  previous(): void {
    if (!this.currentDropTarget) {
      this.setCurrentDropTarget(this.validDropTargets[this.validDropTargets.length - 1] ?? null);
      return;
    }
    const index = this.validDropTargets.indexOf(this.currentDropTarget);
    if (index < 0) {
      this.setCurrentDropTarget(this.validDropTargets[this.validDropTargets.length - 1] ?? null);
      return;
    }
    // If we've reached the start of the valid drop targets, cycle back to the original drag target. This lets the user
    // cancel the drag in case they don't have an Escape key (e.g. iPad keyboard case).
    if (index === 0) {
      if (!this.dragTarget.element.closest('[aria-hidden="true"], [inert]')) {
        this.setCurrentDropTarget(null);
        this.dragTarget.element.focus();
      } else this.setCurrentDropTarget(this.validDropTargets[this.validDropTargets.length - 1] ?? null);
    } else this.setCurrentDropTarget(this.validDropTargets[index - 1] ?? null);
  }

  findNearestDropTarget(): number {
    const dragTargetRect = this.dragTarget.element.getBoundingClientRect();
    let minDistance = Infinity;
    let nearest = -1;
    let ancestor = -1;
    for (let i = 0; i < this.validDropTargets.length; i++) {
      const dropTarget = this.validDropTargets[i]!;
      if (ancestor < 0 && nodeContains(dropTarget.element, this.dragTarget.element)) ancestor = i;
      const rect = dropTarget.element.getBoundingClientRect();
      const dx = rect.left - dragTargetRect.left;
      const dy = rect.top - dragTargetRect.top;
      const dist = dx * dx + dy * dy;
      if (dist < minDistance) {
        minDistance = dist;
        nearest = i;
      }
    }
    return ancestor >= 0 ? ancestor : nearest;
  }

  setCurrentDropTarget(dropTarget: DropTarget | null, item?: DroppableItem): void {
    if (dropTarget !== this.currentDropTarget) {
      if (this.currentDropTarget && typeof this.currentDropTarget.onDropExit === "function") {
        const rect = this.currentDropTarget.element.getBoundingClientRect();
        this.currentDropTarget.onDropExit({ type: "dropexit", x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
      this.currentDropTarget = dropTarget;
      if (dropTarget) {
        if (typeof dropTarget.onDropEnter === "function") {
          const rect = dropTarget.element.getBoundingClientRect();
          dropTarget.onDropEnter({ type: "dropenter", x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, this.dragTarget);
        }
        if (!item) dropTarget?.element.focus();
      }
    }
    if (item != null && item !== this.currentDropItem) {
      if (this.currentDropTarget && typeof this.currentDropTarget.onDropTargetEnter === "function") this.currentDropTarget.onDropTargetEnter(item.target);
      item.element.focus();
      this.currentDropItem = item;
      // Announce first drop target after drag start announcement finishes. Otherwise, it will never get announced
      // because drag start announcement is assertive.
      if (!this.initialFocused) {
        const label = item?.element.getAttribute("aria-label");
        if (label) announce(label, "polite");
        this.initialFocused = true;
      }
    }
  }

  end(): void {
    this.teardown();
    endDragging();
    if (typeof this.dragTarget.onDragEnd === "function") {
      const target = this.currentDropTarget && this.dropOperation !== "cancel" ? this.currentDropTarget : this.dragTarget;
      const rect = target.element.getBoundingClientRect();
      this.dragTarget.onDragEnd({ type: "dragend", x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, dropOperation: this.dropOperation || "cancel" });
    }
    if (this.currentDropTarget && !this.currentDropTarget.preventFocusOnDrop) {
      // Re-trigger focus event on active element, since it will not have received it during dragging (see cancelEvent).
      // This corrects state such as whether focus ring should appear. useDroppableCollection handles this itself, so
      // this is only for standalone drop zones.
      getActiveElement()?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    }
    this.setCurrentDropTarget(null);
  }

  cancel(): void {
    this.setCurrentDropTarget(null);
    this.end();
    if (!this.dragTarget.element.closest('[aria-hidden="true"], [inert]')) this.dragTarget.element.focus();
    // Re-trigger focus event on active element, since it will not have received it during dragging (see cancelEvent).
    getActiveElement()?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    announce(this.stringFormatter("dropCanceled"));
  }

  drop(item?: DroppableItem): void {
    if (!this.currentDropTarget) {
      this.cancel();
      return;
    }
    if (typeof item?.getDropOperation === "function") {
      const types = getTypes(this.dragTarget.items);
      this.dropOperation = item.getDropOperation(types, this.dragTarget.allowedDropOperations);
    } else if (typeof this.currentDropTarget.getDropOperation === "function") {
      const types = getTypes(this.dragTarget.items);
      this.dropOperation = this.currentDropTarget.getDropOperation(types, this.dragTarget.allowedDropOperations);
    } else {
      // TODO (upstream): show menu ??
      this.dropOperation = this.dragTarget.allowedDropOperations[0] ?? null;
    }
    if (typeof this.currentDropTarget.onDrop === "function") {
      const items: DropItem[] = this.dragTarget.items.map((item) => ({
        kind: "text",
        types: new Set(Object.keys(item)),
        getText: (type: string) => Promise.resolve(item[type]!),
      }));
      const rect = this.currentDropTarget.element.getBoundingClientRect();
      this.currentDropTarget.onDrop(
        { type: "drop", x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, items, dropOperation: this.dropOperation! },
        item?.target ?? null,
      );
    }
    this.end();
    announce(this.stringFormatter("dropComplete"));
  }

  activate(dropTarget: DropTarget | null, dropItem: DroppableItem | null | undefined): void {
    if (dropTarget && typeof dropTarget.onDropActivate === "function") {
      const target = dropItem?.target ?? null;
      const rect = dropTarget.element.getBoundingClientRect();
      dropTarget.onDropActivate({ type: "dropactivate", x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, target);
    }
  }
}

function findValidDropTargets(options: DragTarget) {
  const types = getTypes(options.items);
  return [...dropTargets.values()].filter((target) => {
    if (target.element.closest('[aria-hidden="true"], [inert]')) return false;
    if (typeof target.getDropOperation === "function") return target.getDropOperation(types, options.allowedDropOperations) !== "cancel";
    return true;
  });
}
