// Ported from react-aria-components (src/Tree.tsx: the drag and drop parts of TreeInner / TreeItem,
// TreeDropIndicatorWrapper, TreeDropIndicator, RootDropIndicator), Apache-2.0, © Adobe.
//
// Drag and drop of the cdk Tree (`dragAndDropHooks` from `@rivetjs/cdk/dnd` `useDragAndDrop`).
// Rivet:
// - `treeDnd` (Tree body) / `treeItemDnd` (TreeItem body) run the collection / item hooks once and return accessors,
//   DOM handlers and the parts to render; `tree/index.tsx` wires them into both of its render branches.
// - The visually hidden "drop on" row before a TreeItem and the drop indicators between rows render only during a drag
//   (`isHidden` / `useRenderDropIndicator`): server markup only gains the drag button's attributes and `draggable`.
// - The droppable collection id is the treegrid's id (react-aria overrides it with `useId()`: the row ids keep their
//   prefix here).
// - Expanding a folder on drop activation / the expand keys while targeting a row: `toggleTreeKey` (react-stately
//   `state.toggleKey`).
import { untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as elementRef } from "@rivetjs/runtime/dom";
import { visuallyHidden } from "../a11y/index.ts";
import { direction as elementDirection } from "../bidi/index.ts";
import type { Collection as ICollection, Direction, Key, LayoutDelegate, Node } from "../collections/types.ts";
import { toggleTreeKey, type TreeState } from "../collections/tree-state.ts";
import {
  DragAndDropContext,
  DropIndicatorContext,
  dragPreviewOf,
  dropIndicatorRow,
  useRenderDropIndicator,
  type DragAndDropHooks,
  type DropIndicatorProps,
} from "../dnd/index.tsx";
import type { DropTargetDelegate, ElementRef, ItemDropTarget } from "../dnd/types.ts";
import type { DraggableCollectionState } from "../state/draggable-collection.ts";
import type { DroppableCollectionState } from "../state/droppable-collection.ts";
import type { DragButtonProps } from "../dnd/use-drag.ts";
import type { DraggableItemDragProps } from "../dnd/use-draggable-item.ts";
import type { DropProps } from "../dnd/use-drop.tsx";
import { ListKeyboardDelegate } from "../selection/list-keyboard-delegate.ts";
import type { GridListStateLike } from "../grid-list/behaviour.ts";
import { renderProps } from "../slots/index.tsx";
import { dataBool } from "../utils/data-attrs.tsx";
import { DEV } from "../utils/dom.ts";
import { useId } from "../utils/id.ts";
import { TreeDropTargetDelegate } from "./drop-target-delegate.ts";

const EXPANSION_KEYS = {
  expand: { ltr: "ArrowRight", rtl: "ArrowLeft" },
  collapse: { ltr: "ArrowLeft", rtl: "ArrowRight" },
} as const;

/** The Tree's drag and drop wiring (`treeDnd`). */
export interface TreeDnd {
  dragState: DraggableCollectionState | undefined;
  dropState: DroppableCollectionState | undefined;
  /** Root element props of the droppable collection (drop handlers; `aria-describedby` removed). */
  collectionProps: (DropProps & { id: string }) | undefined;
  /** Whether the tree is the root drop target. */
  isRootDropTarget: () => boolean;
  /** Whether the tree allows dragging. */
  allowsDragging: () => boolean;
  /** Context values for the rows. */
  providers: [unknown, unknown][];
  /** Renders the root drop indicator (drop hooks only; call it under the providers). */
  rootIndicator: (() => unknown) | null;
  /** The collection renderer's drop indicator renderer / row renderer (drop hooks only). */
  renderDropIndicator: ((target: ItemDropTarget) => unknown) | undefined;
  renderRow: ((key: Key) => unknown) | undefined;
}

export interface TreeDndOptions<T> {
  state: TreeState<T>;
  view: () => GridListStateLike<T>;
  flat: () => ICollection<Node<unknown>>;
  expanded: Signal<Set<Key>>;
  el: () => HTMLElement | undefined;
  id: string;
  direction: Direction | undefined;
  layoutDelegate: LayoutDelegate | undefined;
  /** The collection renderer's drop target delegate (RAC `CollectionRendererContext.dropTargetDelegate`). */
  rendererDropTargetDelegate: DropTargetDelegate | undefined;
}

/** RAC TreeInner's drag and drop part: the collection hooks of `dragAndDropHooks` (null without hooks). */
export function treeDnd<T>(dragAndDropHooks: DragAndDropHooks<T> | undefined, o: TreeDndOptions<T>): TreeDnd | null {
  const hasDragHooks = !!dragAndDropHooks?.useDraggableCollectionState;
  const hasDropHooks = !!dragAndDropHooks?.useDroppableCollectionState;
  if (!dragAndDropHooks || (!hasDragHooks && !hasDropHooks)) return null;
  const ref: ElementRef = {
    get current() {
      return o.el() ?? null;
    },
  };
  const collection = () => o.view().collection as ICollection<Node<unknown>>;
  const selectionManager = () => o.view().selectionManager;
  let dragState: DraggableCollectionState | undefined;
  let dropState: DroppableCollectionState | undefined;
  let collectionProps: TreeDnd["collectionProps"];
  if (hasDragHooks) {
    dragState = dragAndDropHooks.useDraggableCollectionState!({ collection, selectionManager, preview: dragPreviewOf(dragAndDropHooks) });
    dragAndDropHooks.useDraggableCollection!({}, dragState, ref);
  }
  if (hasDropHooks) {
    const ds = (dropState = dragAndDropHooks.useDroppableCollectionState!({ collection, selectionManager }));
    const direction = o.direction ?? "ltr";
    const dirAt = (): Direction => o.direction ?? elementDirection(o.el());
    const dropTargetDelegate =
      dragAndDropHooks.dropTargetDelegate || o.rendererDropTargetDelegate || new dragAndDropHooks.ListDropTargetDelegate!(o.flat, ref, { direction });
    const treeDropTargetDelegate = new TreeDropTargetDelegate<unknown>();
    treeDropTargetDelegate.setup(
      dropTargetDelegate,
      {
        get collection() {
          return o.flat();
        },
        get expandedKeys() {
          return o.expanded();
        },
      },
      direction,
    );
    const options = {
      get keyboardDelegate() {
        const sm = selectionManager();
        return new ListKeyboardDelegate({
          collection: o.flat(),
          ref: o.el() ?? null,
          disabledKeys: sm.disabledKeys,
          disabledBehavior: sm.disabledBehavior,
          direction: dirAt(),
          layoutDelegate: o.layoutDelegate,
        });
      },
      dropTargetDelegate: treeDropTargetDelegate,
      id: o.id,
      onDropActivate: (e: { target: { type: string; key?: Key } }) => {
        // Expand collapsed item when dragging over. For keyboard, allow collapsing.
        if (e.target.type === "item") {
          const key = e.target.key!;
          untrack(() => {
            const item = o.flat().getItem(key);
            const isExpanded = o.expanded().has(key);
            if (item && item.hasChildNodes && (!isExpanded || dragAndDropHooks.isVirtualDragging?.())) toggleTreeKey(o.state, key);
          });
        }
      },
      onKeyDown: (e: KeyboardEvent) => {
        untrack(() => {
          const target = ds.target;
          if (target && target.type === "item" && target.dropPosition === "on") {
            const item = o.flat().getItem(target.key);
            const dir = dirAt();
            const expanded = o.expanded();
            if (e.key === EXPANSION_KEYS.expand[dir] && item?.hasChildNodes && !expanded.has(target.key)) toggleTreeKey(o.state, target.key);
            else if (e.key === EXPANSION_KEYS.collapse[dir] && item?.hasChildNodes && expanded.has(target.key)) toggleTreeKey(o.state, target.key);
          }
        });
      },
    };
    collectionProps = dragAndDropHooks.useDroppableCollection!(options as never, ds, ref).collectionProps;
  }
  const isRootDropTarget = () => !!dropState?.isDropTarget({ type: "root" });
  const renderDropIndicator = useRenderDropIndicator(dragAndDropHooks as DragAndDropHooks, dropState);
  const ctx = { dragAndDropHooks: dragAndDropHooks as DragAndDropHooks, dragState, dropState };
  return {
    dragState,
    dropState,
    collectionProps,
    isRootDropTarget,
    allowsDragging: () => hasDragHooks && !dragState?.isDisabled,
    providers: [
      [DragAndDropContext, ctx],
      [DropIndicatorContext, { render: TreeDropIndicatorWrapper }],
    ],
    rootIndicator: hasDropHooks ? () => <RootDropIndicator /> : null,
    renderDropIndicator,
    renderRow: renderDropIndicator ? dropIndicatorRow(o.flat, renderDropIndicator) : undefined,
  };
}

/** The TreeItem's drag and drop wiring (`treeItemDnd`). */
export interface TreeItemDnd {
  dragState: DraggableCollectionState | undefined;
  /** Whether the row can be dragged now (RAC `isDraggable`). */
  isDraggable: () => boolean;
  isDragging: () => boolean;
  isDropTarget: () => boolean;
  /** Row drag props (drag hooks only). */
  dragProps: DraggableItemDragProps | undefined;
  /** The `drag` slot of the row's ButtonContext. */
  dragButton: DragButtonProps & { style: { pointerEvents: "none" } };
  /** The visually hidden "drop on" row rendered before the row (drop hooks only). */
  indicatorRow: unknown;
}

export interface TreeItemDndOptions {
  key: Key;
  row: () => HTMLElement | undefined;
  rowAttr: (name: string) => unknown;
  expandLabel: () => string | undefined;
}

/** RAC TreeItem's drag and drop part. */
export function treeItemDnd(o: TreeItemDndOptions): TreeItemDnd {
  const { dragAndDropHooks, dragState, dropState } = useContext(DragAndDropContext) ?? {};
  const { key } = o;
  const isDraggable = () => !!dragState && !(dragState.isDisabled || dragState.selectionManager.isDisabled(key));
  const draggableItem = dragState && dragAndDropHooks ? dragAndDropHooks.useDraggableItem!({ key, hasDragButton: true }, dragState) : null;
  let indicatorRow: unknown = null;
  let isDropTarget = (): boolean => false;
  if (dropState && dragAndDropHooks?.useDropIndicator) {
    const dropIndicatorEl = elementRef<HTMLDivElement>();
    const activateButtonEl = elementRef<HTMLDivElement>();
    const activateButtonRef: ElementRef<HTMLElement> = {
      get current() {
        return activateButtonEl() ?? null;
      },
    };
    const dropIndicator = dragAndDropHooks.useDropIndicator(
      { target: { type: "item", key, dropPosition: "on" }, activateButtonRef },
      dropState,
      dropIndicatorEl as () => HTMLElement | undefined,
    );
    isDropTarget = dropIndicator.isDropTarget;
    const activateButtonId = useId();
    const props = dropIndicator.dropIndicatorProps;
    indicatorRow = (
      <Show when={() => !dropIndicator.isHidden()}>
        {() => (
          <div
            role="row"
            aria-level={o.rowAttr("aria-level") as number}
            aria-expanded={o.rowAttr("aria-expanded") == null ? undefined : String(o.rowAttr("aria-expanded"))}
            aria-label={props["aria-label"]()}
          >
            <div role="gridcell" aria-colindex="1" style={{ display: "contents" }}>
              <div
                role="button"
                style={visuallyHidden}
                id={props.id}
                aria-roledescription={props["aria-roledescription"]}
                aria-label={props["aria-label"]()}
                aria-labelledby={props["aria-labelledby"]}
                aria-hidden={props["aria-hidden"]()}
                aria-describedby={props["aria-describedby"]()}
                tabIndex={-1}
                onClick={props.onClick}
                ref={dropIndicatorEl}
              />
              {o.rowAttr("aria-expanded") != null ? (
                // Button to allow touch screen reader users to expand the item while dragging.
                <div
                  role="button"
                  style={visuallyHidden}
                  id={activateButtonId}
                  aria-label={o.expandLabel()}
                  aria-labelledby={`${activateButtonId} ${o.rowAttr("id") as string}`}
                  tabIndex={-1}
                  ref={activateButtonEl}
                />
              ) : null}
            </div>
          </div>
        )}
      </Show>
    );
  }
  if (DEV && dragState)
    clientEffect(() => {
      const el = o.row();
      if (el && !el.querySelector('[slot="drag"]'))
        console.warn('Draggable items in a Tree must contain a <Button slot="drag"> element so that keyboard and screen reader users can drag them.');
    });
  return {
    dragState,
    isDraggable,
    isDragging: () => !!dragState?.isDragging(key),
    isDropTarget,
    dragProps: draggableItem?.dragProps,
    dragButton: { ...draggableItem?.dragButtonProps, style: { pointerEvents: "none" } },
    indicatorRow,
  };
}

/** RAC `TreeDropIndicatorWrapper` + `TreeDropIndicator`: a drop indicator row between rows. */
function TreeDropIndicatorWrapper(props: DropIndicatorProps): unknown {
  const { dragAndDropHooks, dropState } = useContext(DragAndDropContext);
  const buttonEl = elementRef<HTMLDivElement>();
  const { dropIndicatorProps, isHidden, isDropTarget } = dragAndDropHooks!.useDropIndicator!(props, dropState!, buttonEl as () => HTMLElement | undefined);
  const target = props.target;
  const level = () => (dropState && target.type === "item" ? (dropState.collection.getItem(target.key)?.level || 0) + 1 : 1);
  const rp = untrack(() =>
    renderProps({
      class: props.class,
      style: props.style,
      children: props.children,
      values: { isDropTarget },
      defaultClassName: "rv-DropIndicator",
      defaultStyle: { position: "relative", "--tree-item-level": level() },
    }),
  );
  return (
    <Show when={() => !isHidden()}>
      {() => (
        <div class={rp.class()} style={rp.style()} role="row" aria-level={level()} ref={props.ref as never} data-drop-target={dataBool(isDropTarget())}>
          <div role="gridcell">
            <div
              style={visuallyHidden}
              role="button"
              id={dropIndicatorProps.id}
              aria-roledescription={dropIndicatorProps["aria-roledescription"]}
              aria-label={dropIndicatorProps["aria-label"]()}
              aria-labelledby={dropIndicatorProps["aria-labelledby"]}
              aria-hidden={dropIndicatorProps["aria-hidden"]()}
              aria-describedby={dropIndicatorProps["aria-describedby"]()}
              tabIndex={-1}
              onClick={dropIndicatorProps.onClick}
              ref={buttonEl}
            />
            {rp.children() as never}
          </div>
        </div>
      )}
    </Show>
  );
}

/** RAC `RootDropIndicator`: the drop target of the whole tree (keyboard / screen reader drags). */
function RootDropIndicator(): unknown {
  const { dragAndDropHooks, dropState } = useContext(DragAndDropContext);
  const el = elementRef<HTMLDivElement>();
  const { dropIndicatorProps } = dragAndDropHooks!.useDropIndicator!({ target: { type: "root" } }, dropState!, el as () => HTMLElement | undefined);
  const isDropTarget = () => dropState!.isDropTarget({ type: "root" });
  return (
    <Show when={() => isDropTarget() || !dropIndicatorProps["aria-hidden"]()}>
      {() => (
        <div role="row" aria-hidden={dropIndicatorProps["aria-hidden"]()} style={{ position: "absolute" }}>
          <div role="gridcell">
            <div
              role="button"
              style={visuallyHidden}
              id={dropIndicatorProps.id}
              aria-roledescription={dropIndicatorProps["aria-roledescription"]}
              aria-label={dropIndicatorProps["aria-label"]()}
              aria-labelledby={dropIndicatorProps["aria-labelledby"]}
              aria-hidden={dropIndicatorProps["aria-hidden"]()}
              aria-describedby={dropIndicatorProps["aria-describedby"]()}
              tabIndex={-1}
              onClick={dropIndicatorProps.onClick}
              ref={el}
            />
          </div>
        </div>
      )}
    </Show>
  );
}
