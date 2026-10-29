// Ported from react-spectrum (packages/react-aria/src/dnd/useDroppableItem.ts), Apache-2.0, © Adobe.
// Handles drop interactions for an item within a collection component (a keyboard / screen reader drop item of the
// drag session).
// Rivet: `ref` is a ref accessor (a Rivet `ref()` signal or a function returning the element): registration follows
// the element; `isDropTarget` / `dropProps["aria-hidden"]` are accessors.
import { untrack } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { DroppableCollectionState } from "../state/droppable-collection.ts";
import * as DragManager from "./drag-manager.ts";
import type { DragFormat } from "./drag-manager.ts";
import { dndFormatter } from "./use-drag.ts";
import type { DropTarget, ElementRef } from "./types.ts";
import { getDroppableCollectionRef, getTypes, globalDndState, isInternalDropOperation } from "./utils.ts";
import { useVirtualDrop } from "./use-virtual-drop.ts";

export interface DroppableItemOptions {
  /** The drop target represented by the item. */
  target: DropTarget;
  /** The ref to the activate button. */
  activateButtonRef?: ElementRef<HTMLElement> | undefined;
}

export interface DroppableItemResult {
  /** Props for the droppable element. */
  dropProps: {
    "aria-describedby": () => string | undefined;
    onClick: () => void;
    "aria-hidden": () => "true" | undefined;
  };
  /** Whether the item is currently the active drop target. */
  isDropTarget: () => boolean;
}

/** Handles drop interactions for an item within a collection component. */
export function useDroppableItem(
  options: DroppableItemOptions,
  state: DroppableCollectionState,
  ref: () => HTMLElement | null | undefined,
  stringFormatter: DragFormat = dndFormatter(),
): DroppableItemResult {
  const { dropProps } = useVirtualDrop(stringFormatter);
  const droppableCollectionRef = () => getDroppableCollectionRef(state);
  clientEffect(
    () => {
      const element = ref();
      if (!element) return;
      return untrack(() =>
        DragManager.registerDropItem({
          element,
          target: options.target,
          getDropOperation(types, allowedOperations) {
            const { draggingKeys } = globalDndState;
            const isInternal = isInternalDropOperation(droppableCollectionRef());
            return state.getDropOperation({ target: options.target, types, allowedOperations, isInternal, draggingKeys });
          },
          activateButtonRef: options.activateButtonRef,
        }),
      );
    },
    { when: "interaction" },
  );

  const dragSession = DragManager.useDragSession();
  const isValidDropTarget = () => {
    const session = dragSession();
    if (!session) return false;
    return untrack(() => {
      const { draggingKeys } = globalDndState;
      const isInternal = isInternalDropOperation(droppableCollectionRef());
      return (
        state.getDropOperation({
          target: options.target,
          types: getTypes(session.dragTarget.items),
          allowedOperations: session.dragTarget.allowedDropOperations,
          isInternal,
          draggingKeys,
        }) !== "cancel"
      );
    });
  };
  const isDropTarget = () => state.isDropTarget(options.target);
  // While a drag session targets this item, it holds focus (screen readers announce it). Deferred to a microtask
  // (react-aria: a passive effect, after the event): the DragManager focuses the collection right after it sets the
  // target, the item takes focus after that.
  clientEffect(
    () => {
      const element = ref();
      if (dragSession() && isDropTarget() && element)
        queueMicrotask(() => {
          if (untrack(() => dragSession() && isDropTarget()) && element.isConnected) element.focus();
        });
    },
    { when: "interaction" },
  );
  return {
    dropProps: { ...dropProps, "aria-hidden": () => (!dragSession() || isValidDropTarget() ? undefined : "true") },
    isDropTarget,
  };
}
