// Ported from react-spectrum (packages/react-aria/src/dnd/useDraggableItem.ts), Apache-2.0, © Adobe.
// Handles drag interactions for an item within a draggable collection.
// Rivet:
// - Called once in the item's body: disabled state, descriptions and the drag button label are accessors (react-aria
//   recomputes them per render). `dragProps.draggable` is an accessor (`undefined` while disabled: react-aria returns
//   no drag props then); the drag handlers do nothing while disabled.
// - `useDescription` → `descriptionId` (browser only).
import type { Key } from "../collections/types.ts";
import type { DraggableCollectionState } from "../state/draggable-collection.ts";
import type { DragFormat } from "./drag-manager.ts";
import { useDrag, dndFormatter, type DragButtonProps, type DragProps } from "./use-drag.ts";
import { clearGlobalDnDState, descriptionId, isInternalDropOperation, setDraggingKeys, useDragModality } from "./utils.ts";

export interface DraggableItemProps {
  /** The key of the draggable item within the collection. */
  key: Key;
  /**
   * Whether the item has an explicit focusable drag affordance to initiate accessible drag and drop mode. If true, the
   * dragProps will omit these event handlers, and they will be applied to dragButtonProps instead.
   */
  hasDragButton?: boolean | undefined;
  /**
   * Whether the item has a primary action (e.g. Enter key or long press) that would conflict with initiating accessible
   * drag and drop. If true, the Alt key must be held to start dragging with a keyboard, and long press is disabled until
   * selection mode is entered. This should be passed from the associated collection item hook (e.g. useOption,
   * useGridListItem, etc.).
   */
  hasAction?: boolean | (() => boolean) | undefined;
  /** Rivet: the locale of the messages (default: the nearest `I18nProvider` / environment). */
  locale?: string | undefined;
}

/** Props of the draggable item (accessor `draggable` / `aria-describedby`, DOM event handlers). */
export interface DraggableItemDragProps extends Omit<DragProps, "draggable"> {
  draggable: () => "true" | undefined;
}

export interface DraggableItemResult {
  /** Props for the draggable item. */
  dragProps: DraggableItemDragProps;
  /** Props for the explicit drag button affordance, if any (cdk `Button` props). */
  dragButtonProps: DragButtonProps;
  /** @internal Instruction text and the original ID accessor; custom hook overrides retain ownership. */
  _description?: { text: () => string | undefined; describedBy: DragButtonProps["aria-describedby"] } | undefined;
}

const MESSAGES = {
  keyboard: { selected: "dragSelectedKeyboard", notSelected: "dragDescriptionKeyboard" },
  touch: { selected: "dragSelectedLongPress", notSelected: "dragDescriptionLongPress" },
  virtual: { selected: "dragDescriptionVirtual", notSelected: "dragDescriptionVirtual" },
};

/** Handles drag interactions for an item within a draggable collection. */
export function useDraggableItem(props: DraggableItemProps, state: DraggableCollectionState): DraggableItemResult {
  const stringFormatter: DragFormat = dndFormatter(props.locale);
  const { key, hasDragButton } = props;
  const hasAction = () => (typeof props.hasAction === "function" ? props.hasAction() : !!props.hasAction);
  const isDisabled = () => !!state.isDisabled || state.selectionManager.isDisabled(key);
  const {
    dragProps: drag,
    dragButtonProps,
    _description: dragDescription,
  } = useDrag({
    getItems() {
      return state.getItems(key);
    },
    preview: state.preview,
    getAllowedDropOperations: state.getAllowedDropOperations,
    hasDragButton,
    locale: props.locale,
    onDragStart(e) {
      state.startDrag(key, e);
      // Track draggingKeys for useDroppableCollection's default onDrop handler and useDroppableCollectionState's
      // default getDropOperation
      setDraggingKeys(state.draggingKeys);
    },
    onDragMove(e) {
      state.moveDrag(e);
    },
    onDragEnd(e) {
      const { dropOperation } = e;
      const isInternal = dropOperation === "cancel" ? false : isInternalDropOperation();
      state.endDrag({ ...e, keys: state.draggingKeys, isInternal });
      clearGlobalDnDState();
    },
  });

  const numKeysForDrag = () => state.getKeysForDrag(key).size;
  const isSelected = () => numKeysForDrag() > 1 && state.selectionManager.isSelected(key);
  const modality = useDragModality();
  const usesItemDescription = !hasDragButton;
  // Override description to include selected item count.
  const description = (): string | undefined => {
    if (!usesItemDescription || state.selectionManager.selectionMode === "none") return undefined;
    let msg = MESSAGES[modality()][isSelected() ? "selected" : "notSelected"];
    if (hasAction() && modality() === "keyboard") msg += "Alt";
    return isSelected() ? stringFormatter(msg, { count: numKeysForDrag() }) : stringFormatter(msg);
  };
  const dragButtonLabel = (): string | undefined => {
    if (usesItemDescription && state.selectionManager.selectionMode !== "none") return undefined;
    if (isSelected()) return stringFormatter("dragSelectedItems", { count: numKeysForDrag() });
    const collection = state.collection;
    const itemText = collection.getTextValue?.(key) ?? collection.getItem(key)?.textValue ?? "";
    return stringFormatter("dragItem", { itemText });
  };

  const describedBy = (): string | undefined => {
    if (isDisabled()) return undefined;
    // Remove long press description if an action is present, because in that case long pressing selects the item.
    if (usesItemDescription && hasAction() && modality() === "touch") return undefined;
    const text = description();
    if (text) return descriptionId(text);
    return drag["aria-describedby"]?.();
  };
  const guard =
    <E extends Event>(fn: ((e: E) => void) | undefined) =>
    (e: E) => {
      if (!isDisabled()) fn?.(e);
    };
  const dragProps: DraggableItemDragProps = {
    draggable: () => (isDisabled() ? undefined : "true"),
    "aria-describedby": describedBy,
    onDragStart: guard(drag.onDragStart),
    onDrag: guard(drag.onDrag),
    onDragEnd: guard(drag.onDragEnd),
  };
  if (usesItemDescription) {
    dragProps.onPointerDown = guard(drag.onPointerDown);
    // Require Alt key if there is a conflicting action.
    dragProps.onKeyDownCapture = guard((e: KeyboardEvent) => {
      if (!hasAction() || e.altKey) drag.onKeyDownCapture?.(e);
    });
    dragProps.onKeyUpCapture = guard((e: KeyboardEvent) => {
      if (!hasAction() || e.altKey) drag.onKeyUpCapture?.(e);
    });
    // Remove the onClick handler from useDrag when the collection is selectable. Long pressing will be required on
    // touch devices, and NVDA/JAWS are always in forms mode within collection components.
    dragProps.onClick = guard((e: MouseEvent) => {
      if (state.selectionManager.selectionMode === "none") drag.onClick?.(e);
    });
  }
  return {
    dragProps,
    dragButtonProps: { ...dragButtonProps, isDisabled, "aria-label": dragButtonLabel },
    _description: {
      text: () => (isDisabled() ? undefined : (description() ?? dragDescription?.())),
      describedBy: dragButtonProps["aria-describedby"],
    },
  };
}
