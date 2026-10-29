// Ported from react-spectrum (packages/react-aria/src/dnd/useDroppableCollection.ts), Apache-2.0, © Adobe.
// Handles drop interactions for a collection component: native drag events over the collection (drop target from the
// pointer via a `DropTargetDelegate`), plus a keyboard / screen reader drop target (`./drag-manager.ts`) navigated
// with the arrow / Home / End / Page keys.
// Rivet:
// - Called once in a component body; `props` / `state` are read at event time (react-aria keeps them in a ref).
// - The keyboard drop target registers from a client effect (`when: "interaction"`, see `./use-drop.ts`).
// - "Collection changed after a drop" (react-aria: a layout effect every render) is a client effect over
//   `state.collection`.
// - `id`: the collection element's id (react-aria `useId()`); pass the host's id (a Tree / GridList shares its row id
//   prefix with it). `collectionProps["aria-describedby"]` is `undefined` (react-aria `null`: removes the description).
import { onCleanup, getOwner, untrack } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { Key, KeyboardDelegate } from "../collections/types.ts";
import { useLocale } from "../i18n/index.ts";
import { setInteractionModality } from "../interactions/focus-visible.tsx";
import { getItemElement } from "../collections/dom.ts";
import { focusSafely } from "../selection/dom-utils.ts";
import type { DroppableCollectionState } from "../state/droppable-collection.ts";
import * as DragManager from "./drag-manager.ts";
import type { DragFormat } from "./drag-manager.ts";
import { dndFormatter } from "./use-drag.ts";
import { navigate } from "./drop-target-keyboard-navigation.ts";
import type {
  DragTypes as IDragTypes,
  DropEvent,
  DropOperation,
  DroppableCollectionDropEvent,
  DroppableCollectionProps,
  DropPosition,
  DropTarget,
  DropTargetDelegate,
  ElementRef,
  Node,
} from "./types.ts";
import type { Collection } from "../collections/types.ts";
import { useAutoScroll } from "./use-auto-scroll.ts";
import { useDrop, type DropProps } from "./use-drop.tsx";
import {
  clearGlobalDnDState,
  DIRECTORY_DRAG_TYPE,
  droppableCollectionMap,
  getTypes,
  globalDndState,
  isInternalDropOperation,
  setDropCollectionRef,
} from "./utils.ts";

export interface DroppableCollectionOptions extends DroppableCollectionProps {
  /** A delegate object that implements behavior for keyboard focus movement. */
  keyboardDelegate: KeyboardDelegate;
  /** A delegate object that provides drop targets for pointer coordinates within the collection. */
  dropTargetDelegate: DropTargetDelegate;
  /** A custom keyboard event handler for drop targets. */
  onKeyDown?: ((e: KeyboardEvent) => void) | undefined;
  /** Rivet: the id of the collection element (react-aria `useId()`). */
  id: string;
}

export interface DroppableCollectionResult {
  /** Props for the collection element. */
  collectionProps: DropProps & { id: string };
}

interface DroppingState {
  collection: Collection<Node<unknown>>;
  focusedKey: Key | null;
  selectedKeys: Set<Key>;
  target: DropTarget;
  draggingKeys: Set<Key | null | undefined>;
  isInternal: boolean;
  timeout: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Handles drop interactions for a collection component, with support for traditional mouse and touch based drag and
 * drop, in addition to full parity for keyboard and screen reader users.
 */
export function useDroppableCollection(
  props: DroppableCollectionOptions,
  state: DroppableCollectionState,
  ref: ElementRef,
  stringFormatter: DragFormat = dndFormatter(),
): DroppableCollectionResult {
  const localState: { nextTarget: DropTarget | null; dropOperation: DropOperation | null } = { nextTarget: null, dropOperation: null };

  const defaultOnDrop = async (e: DroppableCollectionDropEvent) => {
    const { onInsert, onRootDrop, onItemDrop, onReorder, onMove, acceptedDragTypes = "all", shouldAcceptItemDrop } = props;
    const { draggingKeys } = globalDndState;
    const isInternal = isInternalDropOperation(ref);
    const { target, dropOperation, items } = e;
    let filteredItems = items;
    if (acceptedDragTypes !== "all" || shouldAcceptItemDrop) {
      filteredItems = items.filter((item) => {
        let itemTypes: Set<string | symbol>;
        if (item.kind === "directory") itemTypes = new Set([DIRECTORY_DRAG_TYPE]);
        else itemTypes = item.kind === "file" ? new Set([item.type]) : (item.types as Set<string | symbol>);
        if (acceptedDragTypes === "all" || acceptedDragTypes.some((type) => itemTypes.has(type))) {
          // If we are performing a on item drop, check if the item in question accepts the dropped item since the item
          // may have heavier restrictions than the droppable collection itself
          if (target.type === "item" && target.dropPosition === "on" && shouldAcceptItemDrop)
            return shouldAcceptItemDrop(target, itemTypes as unknown as IDragTypes);
          return true;
        }
        return false;
      });
    }
    if (filteredItems.length > 0) {
      if (target.type === "root" && onRootDrop) await onRootDrop({ items: filteredItems, dropOperation });
      if (target.type === "item") {
        if (target.dropPosition === "on" && onItemDrop) await onItemDrop({ items: filteredItems, dropOperation, isInternal, target });
        if (onMove && isInternal) await onMove({ keys: draggingKeys, dropOperation, target });
        if (target.dropPosition !== "on") {
          if (!isInternal && onInsert) await onInsert({ items: filteredItems, dropOperation, target });
          if (isInternal && onReorder) await onReorder({ keys: draggingKeys, dropOperation, target });
        }
      }
    }
  };

  const autoScroll = useAutoScroll(ref);
  const { dropProps } = useDrop(
    {
      ref,
      onDropEnter() {
        if (localState.nextTarget != null) state.setTarget(localState.nextTarget);
      },
      onDropMove(e) {
        if (localState.nextTarget != null) state.setTarget(localState.nextTarget);
        autoScroll.move(e.x, e.y);
      },
      getDropOperationForPoint(types, allowedOperations, x, y) {
        const { draggingKeys, dropCollectionRef } = globalDndState;
        const isInternal = isInternalDropOperation(ref);
        const isValidDropTarget = (target: DropTarget) => state.getDropOperation({ target, types, allowedOperations, isInternal, draggingKeys }) !== "cancel";
        let target = props.dropTargetDelegate.getDropTargetFromPoint(x, y, isValidDropTarget);
        if (!target) {
          localState.dropOperation = "cancel";
          localState.nextTarget = null;
          return "cancel";
        }
        localState.dropOperation = state.getDropOperation({ target, types, allowedOperations, isInternal, draggingKeys });
        // If the target doesn't accept the drop, see if the root accepts it instead.
        if (localState.dropOperation === "cancel") {
          const rootTarget: DropTarget = { type: "root" };
          const dropOperation = state.getDropOperation({ target: rootTarget, types, allowedOperations, isInternal, draggingKeys });
          if (dropOperation !== "cancel") {
            target = rootTarget;
            localState.dropOperation = dropOperation;
          }
        }
        // Only set dropCollectionRef if there is a valid drop target since we cleanup dropCollectionRef in onDropExit
        // which only runs when leaving a valid drop target or if the dropEffect become none (mouse dnd only).
        if (target && localState.dropOperation !== "cancel" && ref?.current !== dropCollectionRef?.current) setDropCollectionRef(ref);
        localState.nextTarget = localState.dropOperation === "cancel" ? null : target;
        return localState.dropOperation;
      },
      onDropExit() {
        setDropCollectionRef(undefined);
        state.setTarget(null);
        autoScroll.stop();
      },
      onDropActivate(e) {
        const target = untrack(() => state.target);
        if (target?.type === "item" && typeof props.onDropActivate === "function") props.onDropActivate({ type: "dropactivate", x: e.x, y: e.y, target });
      },
      onDrop(e) {
        setDropCollectionRef(ref);
        const target = untrack(() => state.target);
        if (target) onDrop(e, target);
        // If there wasn't a collection being tracked as a dragged collection, then we are in a case where a non RSP
        // drag is dropped on a RSP collection and thus we don't need to preserve the global DnD state for onDragEnd
        const { draggingCollectionRef } = globalDndState;
        if (draggingCollectionRef == null) clearGlobalDnDState();
      },
    },
    stringFormatter,
  );

  let droppingState: DroppingState | null = null;
  const updateFocusAfterDrop = () => {
    if (!droppingState) return;
    const { target, collection: prevCollection, selectedKeys: prevSelectedKeys, focusedKey: prevFocusedKey, isInternal, draggingKeys } = droppingState;
    const collection = state.collection;
    const selectionManager = state.selectionManager;
    // If an insert occurs during a drop, we want to immediately select these items to give feedback to the user that a
    // drop occurred. Only do this if the selection didn't change since the drop started so we don't override if the
    // user or application did something.
    if (collection.size > prevCollection.size && selectionManager.isSelectionEqual(prevSelectedKeys)) {
      const newKeys = new Set<Key>();
      let key = collection.getFirstKey();
      while (key != null) {
        const item = collection.getItem(key);
        if (item?.type === "item" && !prevCollection.getItem(item.key)) newKeys.add(item.key);
        if (item?.hasChildNodes && collection.getItem(item.lastChildKey!)?.type === "item") key = item.firstChildKey!;
        else key = collection.getKeyAfter(key);
      }
      selectionManager.setSelectedKeys(newKeys);
      // If the focused item didn't change since the drop occurred, also focus the first inserted item. If selection is
      // disabled, then also show the focus ring so there is some indication that items were added.
      if (selectionManager.focusedKey === prevFocusedKey) {
        let first: Key | null | undefined = newKeys.keys().next().value;
        if (first != null) {
          const item = collection.getItem(first);
          const dropTarget = droppingState.target;
          const expandedKeys = (collection as unknown as { expandedKeys?: Set<Key | null | undefined> }).expandedKeys;
          const isParentRowExpanded = expandedKeys ? expandedKeys.has(item?.parentKey) : false;
          // If this is a cell, focus the parent row.
          if (item && (item?.type === "cell" || (dropTarget.type === "item" && dropTarget.dropPosition === "on" && !isParentRowExpanded)))
            first = item.parentKey;
          if (first != null) selectionManager.setFocusedKey(first);
          if (selectionManager.selectionMode === "none") setInteractionModality("keyboard");
        }
      }
    } else if (
      prevFocusedKey != null &&
      selectionManager.focusedKey === prevFocusedKey &&
      isInternal &&
      target.type === "item" &&
      target.dropPosition !== "on" &&
      draggingKeys.has(collection.getItem(prevFocusedKey)?.parentKey)
    ) {
      // Focus row instead of cell when reordering.
      selectionManager.setFocusedKey(collection.getItem(prevFocusedKey)?.parentKey ?? null);
      setInteractionModality("keyboard");
    } else if (
      selectionManager.focusedKey === prevFocusedKey &&
      target.type === "item" &&
      target.dropPosition === "on" &&
      collection.getItem(target.key) != null
    ) {
      // If focus didn't move already (e.g. due to an insert), and the user dropped on an item, focus that item and show
      // the focus ring to give the user feedback that the drop occurred. Also show the focus ring if the focused key is
      // not selected, e.g. in case of a reorder.
      selectionManager.setFocusedKey(target.key);
      setInteractionModality("keyboard");
    } else if (selectionManager.focusedKey != null && !selectionManager.isSelected(selectionManager.focusedKey)) {
      setInteractionModality("keyboard");
    }
    selectionManager.setFocused(true);
    // react-aria: the focused item's `useSelectableItem` effect moves DOM focus after the render. Rivet's selectable
    // items sync focus from their own handlers only (`syncFocus`): focus the item once the update rendered.
    queueMicrotask(() => {
      const focusedKey = untrack(() => selectionManager.focusedKey);
      const element = focusedKey != null ? getItemElement(ref.current, focusedKey) : null;
      if (element && untrack(() => selectionManager.isFocused) && element.ownerDocument.activeElement !== element) focusSafely(element);
    });
  };

  const onDrop = (e: DropEvent, target: DropTarget) => {
    untrack(() => {
      // Save some state of the collection/selection before the drop occurs so we can compare later.
      const selectionManager = state.selectionManager;
      const dropping: DroppingState = {
        timeout: undefined,
        focusedKey: selectionManager.focusedKey,
        collection: state.collection,
        selectedKeys: selectionManager.selectedKeys,
        draggingKeys: globalDndState.draggingKeys,
        isInternal: isInternalDropOperation(ref),
        target,
      };
      droppingState = dropping;
      const onDropFn = props.onDrop || defaultOnDrop;
      void onDropFn({ type: "drop", x: e.x, y: e.y, target, items: e.items, dropOperation: e.dropOperation });
      // Wait for a short time period after the onDrop is called to allow the data to be read asynchronously and for
      // the collection to update. If the collection didn't already change during this time (handled below), update
      // the focused key here.
      dropping.timeout = setTimeout(() => {
        if (droppingState !== dropping) return;
        untrack(updateFocusAfterDrop);
        droppingState = null;
      }, 50);
    });
  };

  if (typeof document !== "undefined" && getOwner())
    onCleanup(() => {
      if (droppingState) clearTimeout(droppingState.timeout);
    });

  // If the collection changed after a drop, update the focused key.
  clientEffect(
    () => {
      const collection = state.collection;
      // The drop state stays until its timeout (react-aria): a later collection change updates the focus again.
      if (droppingState && collection !== droppingState.collection) untrack(updateFocusAfterDrop);
    },
    { when: "interaction" },
  );

  const locale = useLocale();
  clientEffect(
    () => {
      const element = ref.current;
      if (!element) return;
      const direction = locale.direction;
      const getNextTarget = (target: DropTarget | null | undefined, wrap = true, key: "left" | "right" | "up" | "down" = "down") =>
        navigate(props.keyboardDelegate, state.collection, target, key, direction === "rtl", wrap);
      const getPreviousTarget = (target: DropTarget | null | undefined, wrap = true) => getNextTarget(target, wrap, "up");
      const nextValidTarget = (
        target: DropTarget | null | undefined,
        types: Set<string>,
        allowedDropOperations: DropOperation[],
        getNextTarget: (target: DropTarget | null | undefined, wrap: boolean) => DropTarget | null,
        wrap = true,
      ): DropTarget | null => {
        let seenRoot = 0;
        let operation: DropOperation;
        const { draggingKeys } = globalDndState;
        const isInternal = isInternalDropOperation(ref);
        do {
          const nextTarget = getNextTarget(target, wrap);
          if (!nextTarget) return null;
          target = nextTarget;
          operation = state.getDropOperation({
            target: nextTarget,
            types: types as IDragTypes,
            allowedOperations: allowedDropOperations,
            isInternal,
            draggingKeys,
          });
          if (target.type === "root") seenRoot++;
        } while (operation === "cancel" && !state.isDropTarget(target) && seenRoot < 2);
        if (operation === "cancel") return null;
        return target;
      };
      const opFor = (target: DropTarget, types: Set<string>, allowedOperations: DropOperation[]) => {
        const { draggingKeys } = globalDndState;
        const isInternal = isInternalDropOperation(ref);
        return state.getDropOperation({ target, types: types as IDragTypes, allowedOperations, isInternal, draggingKeys });
      };
      return untrack(() =>
        DragManager.registerDropTarget({
          element,
          preventFocusOnDrop: true,
          getDropOperation(types, allowedOperations) {
            const target = untrack(() => state.target);
            if (target) return opFor(target, types, allowedOperations);
            // Check if any of the targets accept the drop.
            const next = nextValidTarget(null, types, allowedOperations, getNextTarget);
            return next ? "move" : "cancel";
          },
          onDropEnter(_e, drag) {
            untrack(() => {
              const types = getTypes(drag.items);
              const selectionManager = state.selectionManager;
              let target: DropTarget | null = null;
              // Update the drop collection ref tracker for useDroppableItem's getDropOperation isInternal check
              setDropCollectionRef(ref);
              // When entering the droppable collection for the first time, the default drop target is after the
              // focused key.
              let key: Key | null | undefined = selectionManager.focusedKey;
              let dropPosition: DropPosition = "after";
              // If the focused key is a cell, get the parent item instead.
              // For now, we assume that individual cells cannot be dropped on.
              const item = key != null ? state.collection.getItem(key) : null;
              if (item?.type === "cell") key = item.parentKey;
              // If the focused item is also selected, the default drop target is after the last selected item. But if
              // the focused key is the first selected item, then default to before the first selected item. This is
              // to make reordering lists slightly easier. If you select top down, we assume you want to move the items
              // down. If you select bottom up, we assume you want to move the items up.
              if (key != null && selectionManager.isSelected(key)) {
                if (selectionManager.selectedKeys.size > 1 && selectionManager.firstSelectedKey === key) dropPosition = "before";
                else key = selectionManager.lastSelectedKey;
              }
              if (key != null) {
                target = { type: "item", key, dropPosition };
                // If the default target is not valid, find the next one that is.
                if (opFor(target, types, drag.allowedDropOperations) === "cancel")
                  target =
                    nextValidTarget(target, types, drag.allowedDropOperations, getNextTarget, false) ??
                    nextValidTarget(target, types, drag.allowedDropOperations, getPreviousTarget, false);
              }
              // If no focused key, then start from the root.
              if (!target) target = nextValidTarget(null, types, drag.allowedDropOperations, getNextTarget);
              state.setTarget(target);
            });
          },
          onDropExit() {
            setDropCollectionRef(undefined);
            state.setTarget(null);
          },
          onDropTargetEnter(target) {
            state.setTarget(target);
          },
          onDropActivate(e, target) {
            if (target?.type === "item" && target?.dropPosition === "on" && typeof props.onDropActivate === "function")
              props.onDropActivate({ type: "dropactivate", x: e.x, y: e.y, target });
          },
          onDrop(e, target) {
            setDropCollectionRef(ref);
            const current = untrack(() => state.target);
            if (current) onDrop(e, target || current);
          },
          onKeyDown(e, drag) {
            untrack(() => {
              const { keyboardDelegate } = props;
              const types = getTypes(drag.items);
              const ops = drag.allowedDropOperations;
              const move = (dir: "left" | "right" | "up" | "down") =>
                state.setTarget(nextValidTarget(state.target, types, ops, (target, wrap) => getNextTarget(target, wrap, dir)));
              switch (e.key) {
                case "ArrowDown":
                  if (keyboardDelegate.getKeyBelow) move("down");
                  break;
                case "ArrowUp":
                  if (keyboardDelegate.getKeyAbove) move("up");
                  break;
                case "ArrowLeft":
                  if (keyboardDelegate.getKeyLeftOf) move("left");
                  break;
                case "ArrowRight":
                  if (keyboardDelegate.getKeyRightOf) move("right");
                  break;
                case "Home":
                  if (keyboardDelegate.getFirstKey) state.setTarget(nextValidTarget(null, types, ops, getNextTarget));
                  break;
                case "End":
                  if (keyboardDelegate.getLastKey) state.setTarget(nextValidTarget(null, types, ops, getPreviousTarget));
                  break;
                case "PageDown": {
                  if (keyboardDelegate.getKeyPageBelow) {
                    let target = state.target;
                    if (!target) {
                      target = nextValidTarget(null, types, ops, getNextTarget);
                    } else {
                      // If on the root, go to the item a page below the top. Otherwise a page below the current item.
                      let targetKey = keyboardDelegate.getFirstKey?.();
                      if (target.type === "item") targetKey = target.key;
                      let nextKey: Key | null = null;
                      if (targetKey != null) nextKey = keyboardDelegate.getKeyPageBelow(targetKey);
                      let dropPosition = target.type === "item" ? target.dropPosition : "after";
                      // If there is no next key, or we are starting on the last key, jump to the last possible position.
                      if (nextKey == null || (target.type === "item" && target.key === keyboardDelegate.getLastKey?.())) {
                        nextKey = keyboardDelegate.getLastKey?.() ?? null;
                        dropPosition = "after";
                      }
                      if (nextKey == null) break;
                      target = { type: "item", key: nextKey, dropPosition };
                      // If the target does not accept the drop, find the next valid target.
                      // If no next valid target, find the previous valid target.
                      const { draggingCollectionRef, draggingKeys } = globalDndState;
                      const isInternal = draggingCollectionRef?.current === ref?.current;
                      const operation = state.getDropOperation({ target, types: types as IDragTypes, allowedOperations: ops, isInternal, draggingKeys });
                      if (operation === "cancel")
                        target = nextValidTarget(target, types, ops, getNextTarget, false) ?? nextValidTarget(target, types, ops, getPreviousTarget, false);
                    }
                    state.setTarget(target ?? state.target);
                  }
                  break;
                }
                case "PageUp": {
                  if (!keyboardDelegate.getKeyPageAbove) break;
                  let target = state.target;
                  if (!target) {
                    target = nextValidTarget(null, types, ops, getPreviousTarget);
                  } else if (target.type === "item") {
                    // If at the top already, switch to the root. Otherwise navigate a page up.
                    if (target.key === keyboardDelegate.getFirstKey?.()) {
                      target = { type: "root" };
                    } else {
                      let nextKey: Key | null | undefined = keyboardDelegate.getKeyPageAbove(target.key);
                      let dropPosition = target.dropPosition;
                      if (nextKey == null) {
                        nextKey = keyboardDelegate.getFirstKey?.();
                        dropPosition = "before";
                      }
                      if (nextKey == null) break;
                      target = { type: "item", key: nextKey, dropPosition };
                    }
                    // If the target does not accept the drop, find the previous valid target.
                    // If no next valid target, find the next valid target.
                    if (opFor(target, types, ops) === "cancel")
                      target = nextValidTarget(target, types, ops, getPreviousTarget, false) ?? nextValidTarget(target, types, ops, getNextTarget, false);
                  }
                  state.setTarget(target ?? state.target);
                  break;
                }
              }
              props.onKeyDown?.(e);
            });
          },
        }),
      );
    },
    { when: "interaction" },
  );

  const id = props.id;
  droppableCollectionMap.set(state, { id, ref });
  return {
    collectionProps: {
      ...dropProps,
      id,
      // Remove description from collection element. If dropping on the entire collection, there should be a drop
      // indicator that has this description, so no need to double announce.
      "aria-describedby": undefined,
    },
  };
}
