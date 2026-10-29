// Ported from react-spectrum (packages/react-aria/src/dnd/useDraggableCollection.ts), Apache-2.0, © Adobe.
// Handles drag interactions for a collection component.
// Rivet: react-aria updates the global dragging collection ref during render whenever keys of this collection are
// dragged; here an effect over the state's dragging keys does (browser only: drags never start on the server).
import { untrack } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { DraggableCollectionState } from "../state/draggable-collection.ts";
import type { ElementRef } from "./types.ts";
import { globalDndState, setDraggingCollectionRef } from "./utils.ts";

export interface DraggableCollectionOptions {}

/**
 * Handles drag interactions for a collection component, with support for traditional mouse and touch based drag and
 * drop, in addition to full parity for keyboard and screen reader users.
 */
export function useDraggableCollection(_props: DraggableCollectionOptions, state: DraggableCollectionState, ref: ElementRef): void {
  // Update global DnD state if this keys within this collection are dragged
  clientEffect(
    () => {
      if (state.draggingKeys.size === 0) return;
      untrack(() => {
        const { draggingCollectionRef } = globalDndState;
        if (draggingCollectionRef?.current !== ref.current) setDraggingCollectionRef(ref);
      });
    },
    { when: "interaction" },
  );
}
