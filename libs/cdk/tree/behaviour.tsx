// Ported from react-aria (src/tree/useTree.ts, src/tree/useTreeItem.ts; @react-aria/tree), Apache-2.0, © Adobe.
//
// Tree behaviour for custom markup: a single column treegrid over the gridlist hooks.
// Rivet:
// - Naming (wave-2 convention): `useTree` → `treeProps(props, state) → { gridProps }`,
//   `useTreeItem` → `treeItemProps(props, state) → { rowProps, gridCellProps, descriptionProps,
//   expandButtonProps, …item states }`; the expand button's `onPress` body is the free function
//   `treeItemExpandPress(event, props, state)` (wire it from an inline arrow so it resumes).
// - `state` is a gridlist VIEW (`../grid-list/behaviour.ts` `GridListStateLike`) over a serializable
//   tree state, rebuilt per event: `treeStateView(treeState, shared)` or, for the RAC `Tree`, a view
//   over its flattened `TreeCollection` (`./collection.ts`). Never capture a view in a resumable closure.
// - Row / grid handlers are the gridlist ones (`gridListItem<Event>`, `gridList<Event>`): react-aria
//   useTree / useTreeItem add no handlers of their own.
// - Localized "Expand" / "Collapse" from `./intl.ts` (react-aria intl/tree); locale = `props.locale`,
//   else the document language.
// - `data-react-aria-prevent-focus` → `data-rv-prevent-focus` (the attribute the Rivet focus walkers skip).
// Deviation: the expand button id (react-aria `useLabels` → `useId()`) derives from the row id
// (`<row id>-chevron`) so server HTML is byte-stable and the id is known before the button renders.
import type { Key, KeyboardDelegate, Node } from "../collections/types.ts";
import {
  gridListItemProps,
  gridListProps,
  type AriaGridListItemOptions,
  type AriaGridListOptions,
  type GridListItemAria,
  type GridListStateLike,
} from "../grid-list/behaviour.ts";
import { formatMessage, localeOf } from "../_adapters/intl.ts";
import { useLabels } from "../utils/index.ts";
import { strings } from "./intl.ts";

export interface AriaTreeOptions extends Omit<AriaGridListOptions, "shouldFocusWrap"> {
  /** An optional keyboard delegate implementation for type to select, to override the default. */
  keyboardDelegate?: KeyboardDelegate | undefined;
}

export interface TreeAria {
  /** Props for the treegrid element. */
  gridProps: Record<string, unknown>;
}

/**
 * Provides the behavior and accessibility implementation for a single column treegrid component with
 * interactive children (react-aria `useTree`). Reads state: bind values as accessors. Wire the grid
 * handlers of `../grid-list/behaviour.ts` (`gridListKeyDown`, `gridListFocus`, …) on the element.
 */
export function treeProps(props: AriaTreeOptions, state: GridListStateLike<any>, hasTabbableChild = false): TreeAria {
  const { gridProps } = gridListProps(props, state, hasTabbableChild);
  gridProps.role = "treegrid";
  return { gridProps };
}

export interface AriaTreeItemOptions extends Omit<AriaGridListItemOptions, "isVirtualized"> {
  /** The node of the treegrid row. */
  node: Node<unknown>;
  /** Rivet: locale of the expand button label (default: the row's / document's language). */
  locale?: string | undefined;
}

export interface TreeItemAria extends GridListItemAria {
  /** Props for the tree grid row element. */
  rowProps: Record<string, unknown>;
  /** Props for the tree grid cell element within the tree grid list row. */
  gridCellProps: Record<string, unknown>;
  /** Props for the tree grid row description element, if any. */
  descriptionProps: Record<string, unknown>;
  /** Props for the tree grid row expand button (RAC Button props; `onPress` = `treeItemExpandPress`). */
  expandButtonProps: TreeExpandButtonProps;
}

export interface TreeExpandButtonProps {
  id: string;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  excludeFromTabOrder: true;
  preventFocusOnPress: true;
  "data-rv-prevent-focus": true;
  onPress: (event?: unknown) => void;
}

/**
 * Provides the behavior and accessibility implementation for a row in a tree grid list (react-aria
 * `useTreeItem`). Reads state: bind values as accessors. Row handlers: `gridListItem<Event>`.
 */
export function treeItemProps(props: AriaTreeItemOptions, state: GridListStateLike<any>): TreeItemAria {
  const gridListAria = gridListItemProps(props, state);
  const isExpanded = gridListAria.rowProps["aria-expanded"] === true;
  const locale = props.locale ?? localeOf();
  const rowId = gridListAria.rowProps.id as string | undefined;
  const labelProps = useLabels({
    id: rowId ? `${rowId}-chevron` : undefined,
    "aria-label": isExpanded ? formatMessage(strings, locale, "collapse") : formatMessage(strings, locale, "expand"),
    "aria-labelledby": rowId,
  });

  const expandButtonProps: TreeExpandButtonProps = {
    onPress: (event?: unknown) => treeItemExpandPress(event, props, state, gridListAria.isDisabled),
    excludeFromTabOrder: true,
    preventFocusOnPress: true,
    "data-rv-prevent-focus": true,
    ...labelProps,
    id: labelProps.id!,
  };

  // TODO (upstream): should it return a state specifically for isExpanded? Or is the aria attribute sufficient?
  return { ...gridListAria, expandButtonProps };
}

/**
 * The expand button's `onPress` (react-aria useTreeItem): toggles the row's expansion and moves
 * focus state to it, unless the row is disabled. `isDisabled` defaults to the manager's answer.
 */
export function treeItemExpandPress(
  _event: unknown,
  props: Pick<AriaTreeItemOptions, "node">,
  state: GridListStateLike<any>,
  isDisabled: boolean = state.selectionManager.isDisabled(props.node.key),
): void {
  if (!isDisabled) {
    const key: Key = props.node.key;
    state.toggleKey?.(key);
    state.selectionManager.setFocused(true);
    state.selectionManager.setFocusedKey(key);
  }
}
