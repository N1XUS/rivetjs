// Ported from react-aria-components (src/NavigationTree.tsx), Apache-2.0, © Adobe.
// Rivet:
// - NavigationTree / NavigationTreeItem / NavigationTreeItemContent / NavigationTreeSection /
//   NavigationTreeHeader over `../tree` (Tree with selectionMode "none", keyboardNavigationBehavior "tab";
//   items: focusMode "child" when linked, allowsArrowNavigation).
// - RAC NavigationTreeItem wraps TreeItem's `render` prop to add `data-current` / `data-current-ancestor`,
//   the link-driven `data-focus-visible` and contexts around the row children. Rivet's TreeItem applies them
//   itself (no `render` wrapper) when an enclosing NavigationTree provides
//   `InternalNavigationTreeContext` (`../tree/navigation-context.tsx`).
// - `selectedRoute` is a value or an accessor / Signal (a re-render in React).
// - Render props are accessors (`isCurrent()`, `isCurrentAncestor()`); default classes `rv-NavigationTree*`.
// - useRouteFocusSync: a `clientEffect` in NavigationTreeItemContent (React `useEffect`).
// `render` (RAC DOMRenderProps): NavigationTree* parts pass `render` through to Tree / TreeItem / TreeSection / TreeHeader (which support it).
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { Key } from "../collections/types.ts";
import { toggleTreeKey, treeCollection, treeSelectionManager, type TreeState } from "../collections/tree-state.ts";
import { LinkContext } from "../link/index.tsx";
import { Provider, contextProps, renderProps, type ContextValue, type RefValue, type RenderProps, type StyleRenderProps } from "../slots/index.tsx";
import {
  Tree,
  TreeHeader,
  TreeItem,
  TreeItemContent,
  TreeSection,
  type TreeHeaderProps,
  type TreeItemContentRenderProps,
  type TreeItemProps,
  type TreeItemRenderProps,
  type TreeProps,
  type TreeRenderProps,
  type TreeSectionProps,
} from "../tree/index.tsx";
import {
  InternalNavigationTreeContext,
  NavigationTreeItemLinkContext,
  NavigationTreeItemStateContext,
  closestVisibleKey,
  findKeyForRoute,
} from "../tree/navigation-context.tsx";

export { NavigationTreeItemStateContext };

type MaybeAccessor<T> = T | (() => T);

/** RAC `NavigationTreeContext`: props for the NavigationTrees inside a component. */
export const NavigationTreeContext = createContext<ContextValue<NavigationTreeProps<any>, HTMLDivElement>>(null);

export interface NavigationTreeRenderProps extends Pick<TreeRenderProps, "isEmpty" | "isFocused" | "isFocusVisible" | "state"> {}

export interface NavigationTreeProps<T>
  extends
    Omit<
      TreeProps<T>,
      | "selectionMode"
      | "selectionBehavior"
      | "selectedKeys"
      | "defaultSelectedKeys"
      | "onSelectionChange"
      | "disallowEmptySelection"
      | "disabledBehavior"
      | "keyboardNavigationBehavior"
      | "escapeKeyBehavior"
      | "shouldSelectOnPressUp"
      | "renderEmptyState"
      | "onAction"
      | "class"
      | "style"
    >,
    StyleRenderProps<NavigationTreeRenderProps> {
  /** The route that is currently selected, matched against each item's `href` (a value or an accessor / Signal). */
  selectedRoute?: MaybeAccessor<string | null | undefined>;
}

/** A NavigationTree provides users with a way to navigate a nested, hierarchical set of links. */
export function NavigationTree<T>(inProps: NavigationTreeProps<T>): unknown {
  const [props, ref] = contextProps(inProps, inProps.ref, NavigationTreeContext) as [NavigationTreeProps<T>, RefValue<HTMLDivElement> | undefined];
  const { class: className, style, children, selectedRoute, ref: _ownRef, ...rest } = props;
  const context = {
    selectedRoute: () => (typeof selectedRoute === "function" ? selectedRoute() : selectedRoute),
    syncedRoute: { current: undefined as string | undefined },
  };
  return (
    <Provider values={[[InternalNavigationTreeContext, context]]}>
      <Tree
        {...(rest as TreeProps<T>)}
        ref={ref}
        class={(className ?? "rv-NavigationTree") as TreeProps<T>["class"]}
        style={style as TreeProps<T>["style"]}
        selectionMode="none"
        keyboardNavigationBehavior="tab"
      >
        {children as never}
      </Tree>
    </Provider>
  );
}

export interface NavigationTreeItemRenderProps extends TreeItemRenderProps {
  /** Whether this item is the current route (its `href` matches the NavigationTree's `selectedRoute`). @selector [data-current] */
  isCurrent: () => boolean;
  /** Whether this item is an ancestor of the current-route item (at any level, expanded or not). @selector [data-current-ancestor] */
  isCurrentAncestor: () => boolean;
}

export interface NavigationTreeItemProps<T = object>
  extends Omit<TreeItemProps<T>, "class" | "style" | "onAction" | "allowsArrowNavigation" | "value">, StyleRenderProps<NavigationTreeItemRenderProps> {
  /** The content of the item along with any nested children (static items or a Collection). */
  children: unknown;
}

/** A NavigationTreeItem represents an individual item in a NavigationTree. */
export function NavigationTreeItem<T extends object>(props: NavigationTreeItemProps<T>): unknown {
  const { class: className, style, focusMode, children, ...rest } = props;
  const hasLink = rest.href != null && rest.href.length > 0;
  return (
    <TreeItem
      {...(rest as TreeItemProps<T>)}
      focusMode={focusMode ?? (hasLink ? "child" : undefined)}
      allowsArrowNavigation
      class={(className ?? "rv-NavigationTreeItem") as TreeItemProps<T>["class"]}
      style={style as TreeItemProps<T>["style"]}
    >
      {children as never}
    </TreeItem>
  );
}

export interface NavigationTreeItemContentRenderProps extends NavigationTreeItemRenderProps {}

export interface NavigationTreeItemContentProps {
  /** The children of the component. A function may be provided to alter the children based on component state. */
  children: RenderProps<NavigationTreeItemContentRenderProps>["children"];
}

/** The content of a NavigationTreeItem: its `Link` gets the item's href, `aria-current` and focus tracking. */
export function NavigationTreeItemContent(props: NavigationTreeItemContentProps): unknown {
  const children = props.children;
  return (
    <TreeItemContent>
      {(values: TreeItemContentRenderProps) => <NavigationTreeItemContentInner values={values}>{children}</NavigationTreeItemContentInner>}
    </TreeItemContent>
  );
}

function NavigationTreeItemContentInner(props: { values: TreeItemContentRenderProps; children: unknown }): unknown {
  const values = props.values as NavigationTreeItemContentRenderProps;
  const children = props.children;
  const link = useContext(NavigationTreeItemLinkContext);
  const nav = useContext(InternalNavigationTreeContext);
  const state = values.state as TreeState<unknown>;
  const id: Key = values.id;
  // useRouteFocusSync: move the tree's focused key to the item matching selectedRoute (once per change,
  // deduped across items).
  clientEffect(() => {
    const route = nav?.selectedRoute();
    if (route == null || !nav || nav.syncedRoute.current === route) return;
    const collection = treeCollection(state);
    let key = findKeyForRoute(collection, route);
    if (key != null) {
      key = closestVisibleKey(collection, state.expandedKeys(), key);
      nav.syncedRoute.current = route;
      untrack(() => treeSelectionManager(state, collection).setFocusedKey(key));
    }
  });
  const href = link?.href;
  const isCurrent = link?.isCurrent;
  const isLinkFocused = link?.isLinkFocused;
  // RAC: a parent row's Link without href expands / collapses the row. The arrow lives in an object literal (a
  // resumable closure) and is picked by reference: a bare `c ? () => … : undefined` branch is not resumable.
  const toggle = { onPress: () => toggleTreeKey(state, id) };
  const togglesRow = href == null && untrack(values.hasChildItems);
  const linkContextValue = {
    href,
    hrefLang: link?.hrefLang,
    target: link?.target,
    rel: link?.rel,
    download: link?.download,
    ping: link?.ping,
    referrerPolicy: link?.referrerPolicy,
    routerOptions: link?.routerOptions,
    "aria-current": () => (isCurrent?.() ? ("page" as const) : undefined),
    onFocusChange: (isFocused: boolean) => isLinkFocused?.set(isFocused),
    onPress: togglesRow ? toggle.onPress : undefined,
  };
  const rp = renderProps({ children: children as RenderProps<NavigationTreeItemContentRenderProps>["children"], values });
  return <Provider values={[[LinkContext, linkContextValue as never]]}>{rp.children() as never}</Provider>;
}

export interface NavigationTreeSectionProps<T> extends Omit<TreeSectionProps<T>, "value"> {}

/** A NavigationTreeSection represents a section within a NavigationTree. */
export function NavigationTreeSection<T extends object>(props: NavigationTreeSectionProps<T>): unknown {
  const { children, ...rest } = props;
  return (
    <TreeSection class="rv-NavigationTreeSection" {...(rest as TreeSectionProps<T>)}>
      {children as never}
    </TreeSection>
  );
}

export interface NavigationTreeHeaderProps extends TreeHeaderProps {}

/** A NavigationTreeHeader renders the header of a NavigationTreeSection. */
export function NavigationTreeHeader(props: NavigationTreeHeaderProps): unknown {
  const { children, ...rest } = props;
  return (
    <TreeHeader class="rv-NavigationTreeHeader" {...rest}>
      {children as never}
    </TreeHeader>
  );
}
