// Ported from react-spectrum (packages/react-aria/src/dnd/useDropIndicator.ts), Apache-2.0, © Adobe.
// Handles drop interactions for a target within a droppable collection (a drop indicator between / on items).
// Rivet: attribute values, `isDropTarget` and `isHidden` are accessors; `ref` is a ref accessor (see
// `./use-droppable-item.ts`).
import type { Key } from "../collections/types.ts";
import type { DroppableCollectionState } from "../state/droppable-collection.ts";
import { useId } from "../utils/id.ts";
import * as DragManager from "./drag-manager.ts";
import type { DragFormat } from "./drag-manager.ts";
import { dndFormatter } from "./use-drag.ts";
import type { DropTarget, ElementRef } from "./types.ts";
import { getDroppableCollectionId } from "./utils.ts";
import { useDroppableItem } from "./use-droppable-item.tsx";

export interface DropIndicatorProps {
  /** The drop target that the drop indicator represents. */
  target: DropTarget;
  /** The ref to the activate button. */
  activateButtonRef?: ElementRef<HTMLElement> | undefined;
}

export interface DropIndicatorAria {
  /** Props for the drop indicator element (accessor attribute values). */
  dropIndicatorProps: {
    id: string;
    "aria-roledescription": string;
    "aria-label": () => string;
    "aria-labelledby": string | undefined;
    "aria-hidden": () => "true" | undefined;
    "aria-describedby": () => string | undefined;
    tabIndex: number;
    onClick: () => void;
  };
  /** Whether the drop indicator is currently the active drop target. */
  isDropTarget: () => boolean;
  /**
   * Whether the drop indicator is hidden, both visually and from assistive technology. Use this to determine whether
   * to omit the element from the DOM entirely.
   */
  isHidden: () => boolean;
}

/** Handles drop interactions for a target within a droppable collection. */
export function useDropIndicator(
  props: DropIndicatorProps,
  state: DroppableCollectionState,
  ref: () => HTMLElement | null | undefined,
  stringFormatter: DragFormat = dndFormatter(),
): DropIndicatorAria {
  const { target } = props;
  const dragSession = DragManager.useDragSession();
  const { dropProps } = useDroppableItem(props, state, ref, stringFormatter);
  const id = useId();
  const getText = (key: Key | null | undefined) => {
    if (key == null) return "";
    const collection = state.collection;
    return collection.getTextValue?.(key) ?? collection.getItem(key)?.textValue ?? "";
  };
  let labelledBy: string | undefined;
  if (target.type === "root") labelledBy = `${id} ${getDroppableCollectionId(state)}`;
  const label = (): string => {
    if (target.type === "root") return stringFormatter("dropOnRoot");
    if (target.dropPosition === "on") return stringFormatter("dropOnItem", { itemText: getText(target.key) });
    const collection = state.collection;
    let before: Key | null | undefined;
    let after: Key | null | undefined;
    if (target.dropPosition === "before") {
      const prevKey = collection.getItem(target.key)?.prevKey;
      const prevNode = prevKey != null ? collection.getItem(prevKey) : null;
      before = prevNode?.type === "item" ? prevNode.key : null;
    } else before = target.key;
    if (target.dropPosition === "after") {
      const nextKey = collection.getItem(target.key)?.nextKey;
      const nextNode = nextKey != null ? collection.getItem(nextKey) : null;
      after = nextNode?.type === "item" ? nextNode.key : null;
    } else after = target.key;
    if (before != null && after != null) return stringFormatter("insertBetween", { beforeItemText: getText(before), afterItemText: getText(after) });
    if (before != null) return stringFormatter("insertAfter", { itemText: getText(before) });
    if (after != null) return stringFormatter("insertBefore", { itemText: getText(after) });
    return "";
  };
  const isDropTarget = () => state.isDropTarget(target);
  const ariaHidden = (): "true" | undefined => (!dragSession() ? "true" : dropProps["aria-hidden"]());
  return {
    dropIndicatorProps: {
      ...dropProps,
      id,
      "aria-roledescription": stringFormatter("dropIndicator"),
      "aria-label": label,
      "aria-labelledby": labelledBy,
      "aria-hidden": ariaHidden,
      tabIndex: -1,
    },
    isDropTarget,
    // If aria-hidden, we are either not in a drag session or the drop target is invalid. In that case, there's no need
    // to render anything at all unless we need to show the indicator visually. This can happen when dragging using the
    // native DnD API as opposed to keyboard dragging.
    isHidden: () => !isDropTarget() && !!ariaHidden(),
  };
}
