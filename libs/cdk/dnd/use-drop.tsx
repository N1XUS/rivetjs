// Ported from react-spectrum (packages/react-aria/src/dnd/useDrop.ts), Apache-2.0, © Adobe.
// Handles drop interactions for an element: native HTML5 drag events plus registration as a keyboard / screen reader
// drop target (`./drag-manager.ts`).
// Rivet:
// - Called once in a component body: `isDropTarget` is an accessor; `dropProps` handlers take the DOM event; options are
//   read at event time (react-aria `useEffectEvent`).
// - The drop target registers from a client effect (`when: "interaction"`: a resumed page registers when the component
//   first runs in the browser, never at load; react-aria: a layout effect after hydration). Until then a keyboard drag
//   session started elsewhere on the page does not offer this target.
// - Rivet addition (as `../drop-zone/dnd.ts`): a `dragover` with no recorded `dragenter` enters first (the enter loaded
//   the component's code on a resumed page).
// - `../drop-zone/dnd.ts` keeps DropZone's handler-function variant (same algorithm, no keyboard registration yet).
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { isIPad, isMac } from "../platform/index.ts";
import { getEventTarget, nodeContains } from "../utils/dom-core.ts";
import * as DragManager from "./drag-manager.ts";
import type { DragFormat } from "./drag-manager.ts";
import { DROP_EFFECT_TO_DROP_OPERATION, DROP_OPERATION, DROP_OPERATION_ALLOWED, DROP_OPERATION_TO_DROP_EFFECT, type DropEffect } from "./constants.ts";
import type {
  DragTypes as IDragTypes,
  DropActivateEvent,
  DropEnterEvent,
  DropEvent,
  DropExitEvent,
  DropMoveEvent,
  DropOperation,
  ElementRef,
} from "./types.ts";
import { DragTypes, globalAllowedDropOperations, globalDndState, readFromDataTransfer, setGlobalDnDState, setGlobalDropEffect } from "./utils.ts";
import { useVirtualDrop } from "./use-virtual-drop.ts";

export interface DropOptions {
  /** A ref for the droppable element. */
  ref: ElementRef;
  /** A function returning the drop operation to be performed when items matching the given types are dropped on the drop target. */
  getDropOperation?: ((types: IDragTypes, allowedOperations: DropOperation[]) => DropOperation) | undefined;
  /** A function that returns the drop operation for a specific point within the target. */
  getDropOperationForPoint?: ((types: IDragTypes, allowedOperations: DropOperation[], x: number, y: number) => DropOperation) | undefined;
  /** Handler that is called when a valid drag enters the drop target. */
  onDropEnter?: ((e: DropEnterEvent) => void) | undefined;
  /** Handler that is called when a valid drag is moved within the drop target. */
  onDropMove?: ((e: DropMoveEvent) => void) | undefined;
  /** Handler that is called after a valid drag is held over the drop target for a period of time. This typically opens the item so that the user can drop within it. */
  onDropActivate?: ((e: DropActivateEvent) => void) | undefined;
  /** Handler that is called when a valid drag exits the drop target. */
  onDropExit?: ((e: DropExitEvent) => void) | undefined;
  /** Handler that is called when a valid drag is dropped on the drop target. */
  onDrop?: ((e: DropEvent) => void) | undefined;
  /** Whether the item has an explicit focusable drop affordance to initiate accessible drag and drop mode. If true, the dropProps will omit these event handlers, and they will be applied to dropButtonProps instead. */
  hasDropButton?: boolean | undefined;
  /** Whether the drop target is disabled. If true, the drop target will not accept any drops. */
  isDisabled?: boolean | undefined;
}

export interface DropProps {
  "aria-describedby"?: (() => string | undefined) | undefined;
  onClick?: (() => void) | undefined;
  onDragEnter?: ((e: DragEvent) => void) | undefined;
  onDragOver?: ((e: DragEvent) => void) | undefined;
  onDragLeave?: ((e: DragEvent) => void) | undefined;
  onDrop?: ((e: DragEvent) => void) | undefined;
}

export interface DropResult {
  /** Props for the droppable element. */
  dropProps: DropProps;
  /** Whether the drop target is currently focused or hovered. */
  isDropTarget: () => boolean;
  /** Props for the explicit drop button affordance, if any. */
  dropButtonProps?: Record<string, unknown> | undefined;
}

const DROP_ACTIVATE_TIMEOUT = 800;

/**
 * Handles drop interactions for an element, with support for traditional mouse and touch based drag and drop, in
 * addition to full parity for keyboard and screen reader users.
 */
export function useDrop(options: DropOptions, stringFormatter: DragFormat): DropResult {
  const { hasDropButton, isDisabled } = options;
  const isDropTarget = signal(false);
  const setDropTarget = (value: boolean) => isDropTarget.set(value);
  const state = {
    x: 0,
    y: 0,
    dragOverElements: new Set<Element>(),
    dropEffect: "none" as DropEffect,
    allowedOperations: DROP_OPERATION.all as number,
    dropActivateTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  };

  const fireDropEnter = (e: DragEvent) => {
    setDropTarget(true);
    if (typeof options.onDropEnter === "function") {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      options.onDropEnter({ type: "dropenter", x: e.clientX - rect.x, y: e.clientY - rect.y });
    }
  };

  const fireDropExit = (e: DragEvent) => {
    setDropTarget(false);
    if (typeof options.onDropExit === "function") {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      options.onDropExit({ type: "dropexit", x: e.clientX - rect.x, y: e.clientY - rect.y });
    }
  };

  const onDragOver = (e: DragEvent) => {
    // Rivet: the enter was missed (it loaded this component's code on a resumed page): enter now.
    if (state.dragOverElements.size === 0) return onDragEnter(e);
    e.preventDefault();
    e.stopPropagation();
    const dataTransfer = e.dataTransfer!;
    const allowedOperations = getAllowedOperations(e);
    if (e.clientX === state.x && e.clientY === state.y && allowedOperations === state.allowedOperations) {
      dataTransfer.dropEffect = state.dropEffect;
      return;
    }
    state.x = e.clientX;
    state.y = e.clientY;
    const prevDropEffect = state.dropEffect;
    // Update drop effect if allowed drop operations changed (e.g. user pressed modifier key).
    if (allowedOperations !== state.allowedOperations) {
      const allowedOps = allowedOperationsToArray(allowedOperations);
      let dropOperation = allowedOps[0]!;
      if (typeof options.getDropOperation === "function") {
        const types = new DragTypes(dataTransfer);
        dropOperation = getDropOperation(allowedOperations, options.getDropOperation(types, allowedOps));
      }
      state.dropEffect = DROP_OPERATION_TO_DROP_EFFECT[dropOperation] || "none";
    }
    if (typeof options.getDropOperationForPoint === "function") {
      const types = new DragTypes(dataTransfer);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const dropOperation = getDropOperation(
        allowedOperations,
        options.getDropOperationForPoint(types, allowedOperationsToArray(allowedOperations), state.x - rect.x, state.y - rect.y),
      );
      state.dropEffect = DROP_OPERATION_TO_DROP_EFFECT[dropOperation] || "none";
    }
    state.allowedOperations = allowedOperations;
    dataTransfer.dropEffect = state.dropEffect;
    // If the drop operation changes, update state and fire events appropriately.
    if (state.dropEffect === "none" && prevDropEffect !== "none") fireDropExit(e);
    else if (state.dropEffect !== "none" && prevDropEffect === "none") fireDropEnter(e);
    if (typeof options.onDropMove === "function" && state.dropEffect !== "none") {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      options.onDropMove({ type: "dropmove", x: state.x - rect.x, y: state.y - rect.y });
    }
    clearTimeout(state.dropActivateTimer);
    if (options.onDropActivate && typeof options.onDropActivate === "function" && state.dropEffect !== "none") {
      const onDropActivateOptions = options.onDropActivate;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      state.dropActivateTimer = setTimeout(() => {
        onDropActivateOptions({ type: "dropactivate", x: state.x - rect.x, y: state.y - rect.y });
      }, DROP_ACTIVATE_TIMEOUT);
    }
  };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = getEventTarget<Element>(e);
    if (target) state.dragOverElements.add(target);
    if (state.dragOverElements.size > 1) return;
    const dataTransfer = e.dataTransfer!;
    const allowedOperationsBits = getAllowedOperations(e);
    const allowedOperations = allowedOperationsToArray(allowedOperationsBits);
    let dropOperation: DropOperation = allowedOperations[0] ?? "cancel";
    if (typeof options.getDropOperation === "function") {
      const types = new DragTypes(dataTransfer);
      dropOperation = getDropOperation(allowedOperationsBits, options.getDropOperation(types, allowedOperations));
    }
    if (typeof options.getDropOperationForPoint === "function") {
      const types = new DragTypes(dataTransfer);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      dropOperation = getDropOperation(
        allowedOperationsBits,
        options.getDropOperationForPoint(types, allowedOperations, e.clientX - rect.x, e.clientY - rect.y),
      );
    }
    state.x = e.clientX;
    state.y = e.clientY;
    state.allowedOperations = allowedOperationsBits;
    state.dropEffect = DROP_OPERATION_TO_DROP_EFFECT[dropOperation] || "none";
    dataTransfer.dropEffect = state.dropEffect;
    if (dropOperation !== "cancel") fireDropEnter(e);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // We would use e.relatedTarget to detect if the drag is still inside the drop target, but it is always null in
    // WebKit. https://bugs.webkit.org/show_bug.cgi?id=66547. Instead, we track all of the targets of dragenter events in
    // a set, and remove them in dragleave. When the set becomes empty, we've left the drop target completely. We must
    // also remove any elements that are no longer in the DOM, because dragleave events will never be fired for these.
    // This can happen, for example, with drop indicators between items, which disappear when the drop target changes.
    const target = getEventTarget<Element>(e);
    if (target) state.dragOverElements.delete(target);
    // Only remove stale elements when leaving the drop target itself. Avoids issues with portal children bubbling
    // dragleave events through the component tree.
    if (target === e.currentTarget)
      for (const element of state.dragOverElements) if (!nodeContains(e.currentTarget as Node, element)) state.dragOverElements.delete(element);
    if (state.dragOverElements.size > 0) return;
    if (state.dropEffect !== "none") fireDropExit(e);
    clearTimeout(state.dropActivateTimer);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Track drop effect in global state for Chrome Android. https://bugs.chromium.org/p/chromium/issues/detail?id=1353951
    // Android onDragEnd always returns "none" as its drop effect.
    setGlobalDropEffect(state.dropEffect);
    if (typeof options.onDrop === "function") {
      const dropOperation = DROP_EFFECT_TO_DROP_OPERATION[state.dropEffect];
      const items = readFromDataTransfer(e.dataTransfer);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      options.onDrop({ type: "drop", x: e.clientX - rect.x, y: e.clientY - rect.y, items, dropOperation });
    }
    const dndStateSnapshot = { ...globalDndState };
    state.dragOverElements.clear();
    fireDropExit(e);
    clearTimeout(state.dropActivateTimer);
    // If there wasn't a collection being tracked as a dragged collection, then we are in a case where a non RSP drag is
    // dropped on a RSP collection and thus we don't need to preserve the global drop effect
    if (dndStateSnapshot.draggingCollectionRef == null) setGlobalDropEffect(undefined);
    // Otherwise we need to preserve the global dnd state for onDragEnd's isInternal check. At the moment fireDropExit may
    // clear dropCollectionRef (i.e. useDroppableCollection's provided onDropExit, required to clear dropCollectionRef
    // when exiting a valid drop target)
    else setGlobalDnDState(dndStateSnapshot);
  };

  const { ref } = options;
  if (!isDisabled)
    clientEffect(
      () => {
        const element = ref.current;
        if (!element) return;
        return DragManager.registerDropTarget({
          element,
          getDropOperation: (types, allowedOperations) =>
            options.getDropOperation ? options.getDropOperation(types, allowedOperations) : allowedOperations[0]!,
          onDropEnter(e) {
            setDropTarget(true);
            options.onDropEnter?.(e);
          },
          onDropExit(e) {
            setDropTarget(false);
            options.onDropExit?.(e);
          },
          onDrop: (e) => options.onDrop?.(e),
          onDropActivate: (e) => options.onDropActivate?.(e),
        });
      },
      { when: "interaction" },
    );

  const { dropProps } = useVirtualDrop(stringFormatter);
  if (isDisabled) return { dropProps: {}, dropButtonProps: { isDisabled: true }, isDropTarget: () => false };
  return {
    dropProps: { ...(!hasDropButton && dropProps), onDragEnter, onDragOver, onDragLeave, onDrop },
    dropButtonProps: { ...(hasDropButton && dropProps) },
    isDropTarget: () => isDropTarget(),
  };
}

function getAllowedOperations(e: DragEvent): number {
  let allowedOperations = DROP_OPERATION_ALLOWED[e.dataTransfer!.effectAllowed] ?? DROP_OPERATION.all;
  // WebKit always sets effectAllowed to "copyMove" on macOS, and "all" on iOS, regardless of what was set during the
  // dragstart event: https://bugs.webkit.org/show_bug.cgi?id=178058
  //
  // Android Chrome also sets effectAllowed to "copyMove" in all cases: https://bugs.chromium.org/p/chromium/issues/detail?id=1359182
  //
  // If the drag started within the page, we can use a global variable to get the real allowed operations. This needs to
  // be intersected with the actual effectAllowed, which may have been filtered based on modifier keys. Unfortunately,
  // this means that link operations do not work at all in Safari.
  if (globalAllowedDropOperations) allowedOperations &= globalAllowedDropOperations;
  // Chrome and Safari on macOS will automatically filter effectAllowed when pressing modifier keys, allowing the user to
  // switch between move, link, and copy operations. Firefox on macOS and all Windows browsers do not do this, so do it
  // ourselves instead. The exact keys are platform dependent.
  // https://ux.stackexchange.com/questions/83748/what-are-the-most-common-modifier-keys-for-dragging-objects-with-a-mouse
  //
  // Note that none of these modifiers are ever set in WebKit due to a bug: https://bugs.webkit.org/show_bug.cgi?id=77465
  // However, Safari does update effectAllowed correctly, so we can just rely on that.
  let allowedModifiers: number = DROP_OPERATION.none;
  if (isMac()) {
    if (e.altKey) allowedModifiers |= DROP_OPERATION.copy;
    // Chrome and Safari both use the Control key for link, even though Finder uses Command + Option. iPadOS doesn't
    // support link operations and will not fire the drop event at all if dropEffect is set to link.
    // https://bugs.webkit.org/show_bug.cgi?id=244701
    if (e.ctrlKey && !isIPad()) allowedModifiers |= DROP_OPERATION.link;
    if (e.metaKey) allowedModifiers |= DROP_OPERATION.move;
  } else {
    if (e.altKey) allowedModifiers |= DROP_OPERATION.link;
    if (e.shiftKey) allowedModifiers |= DROP_OPERATION.move;
    if (e.ctrlKey) allowedModifiers |= DROP_OPERATION.copy;
  }
  if (allowedModifiers) return allowedOperations & allowedModifiers;
  return allowedOperations;
}

function allowedOperationsToArray(allowedOperationsBits: number): DropOperation[] {
  const allowedOperations: DropOperation[] = [];
  if (allowedOperationsBits & DROP_OPERATION.move) allowedOperations.push("move");
  if (allowedOperationsBits & DROP_OPERATION.copy) allowedOperations.push("copy");
  if (allowedOperationsBits & DROP_OPERATION.link) allowedOperations.push("link");
  return allowedOperations;
}

function getDropOperation(allowedOperations: number, operation: DropOperation): DropOperation {
  const op = DROP_OPERATION[operation];
  return allowedOperations & op ? operation : "cancel";
}
