// Ported from react-aria-components (src/NavigationTree.tsx: InternalNavigationTreeContext,
// NavigationTreeItemLinkContext, NavigationTreeItemStateContext, findKeyForRoute, closestVisibleKey,
// getSelectedAncestors), Apache-2.0, © Adobe.
// Rivet:
// - Lives next to TreeItem (not in `navigation-tree/`): RAC NavigationTreeItem wraps TreeItem's `render`
//   prop to add `data-current` / `data-current-ancestor` / link focus-visible and a context around the row
//   children. Rivet does not wrap TreeItem's `render` here: TreeItem itself applies them when an enclosing NavigationTree
//   provides `InternalNavigationTreeContext` (render props stay accessors).
// - Contexts are resumable (`rv-navigation-tree*`); values are plain data, signals and inline arrows.
// - `syncedRoute` is a plain `{ current }` object (RAC `syncedRouteRef`).
import { createContext, type Signal } from "@rivetjs/reactivity";
import type { Collection, Key, Node } from "../collections/types.ts";
import type { RouterOptions } from "../utils/links.tsx";
import { resumableContext } from "../slots/index.tsx";

/** NavigationTree → its items: the current route and the focus-sync bookkeeping. */
export interface InternalNavigationTreeContextValue {
  /** The route that is currently selected (accessor). */
  selectedRoute: () => string | null | undefined;
  /** The last route the focused key was synced to; dedupes the focus sync across items. */
  syncedRoute: { current: string | undefined };
}
export const InternalNavigationTreeContext = resumableContext(createContext<InternalNavigationTreeContextValue | null>(null, { id: "rv-navigation-tree" }));

/** The link props a NavigationTreeItem hands its NavigationTreeItemContent's `Link`. */
export interface NavigationTreeItemLinkContextValue {
  href?: string | undefined;
  hrefLang?: string | undefined;
  target?: string | undefined;
  rel?: string | undefined;
  download?: string | boolean | undefined;
  ping?: string | undefined;
  referrerPolicy?: ReferrerPolicy | undefined;
  routerOptions?: RouterOptions | undefined;
  isCurrent: () => boolean;
  /** Whether the item's link (as opposed to another focusable child such as a button) is focused. */
  isLinkFocused: Signal<boolean>;
}
export const NavigationTreeItemLinkContext = resumableContext(
  createContext<NavigationTreeItemLinkContextValue | null>(null, { id: "rv-navigation-tree-item-link" }),
);

/** RAC `NavigationTreeItemStateContext` (Rivet: `isCurrentAncestor` is an accessor). */
export const NavigationTreeItemStateContext = resumableContext(
  createContext<{ isCurrentAncestor: () => boolean }>({ isCurrentAncestor: () => false }, { id: "rv-navigation-tree-item-state" }),
);

/** The collection key of the item whose href matches `route`, or null. */
export function findKeyForRoute(collection: Collection<Node<unknown>>, route: string): Key | null {
  for (const key of collection.getKeys()) {
    if ((collection.getItem(key)?.props as { href?: string } | undefined)?.href === route) return key;
  }
  return null;
}

/**
 * Walks up from `key` to the closest ancestor that is actually rendered (all ancestors expanded).
 * Returns `key` unchanged when already visible. A collapsed ancestor hides everything beneath it,
 * so the highest collapsed ancestor is the closest visible row.
 */
export function closestVisibleKey(collection: Collection<Node<unknown>>, expandedKeys: Set<Key>, key: Key): Key {
  let target = key;
  let node = collection.getItem(key);
  while (node?.parentKey != null) {
    const parent = collection.getItem(node.parentKey);
    if (parent?.type === "item" && !expandedKeys.has(node.parentKey)) target = node.parentKey;
    node = parent;
  }
  return target;
}

// Cache so each row doesn't have to walk up the tree every time.
const selectedAncestorsCache = new WeakMap<object, { selection: unknown; ancestors: Set<Key> }>();

/** The set of collection keys that are ancestors of the item matching `selectedRoute`. */
export function getSelectedAncestors(collection: Collection<Node<unknown>>, selectedRoute: string): Set<Key> {
  const cached = selectedAncestorsCache.get(collection);
  if (cached && cached.selection === selectedRoute) return cached.ancestors;
  const matchKey = findKeyForRoute(collection, selectedRoute);
  const ancestors = new Set<Key>();
  let node = matchKey != null ? collection.getItem(matchKey) : null;
  while (node?.parentKey != null && !ancestors.has(node.parentKey)) {
    ancestors.add(node.parentKey);
    node = collection.getItem(node.parentKey);
  }
  selectedAncestorsCache.set(collection, { selection: selectedRoute, ancestors });
  return ancestors;
}

/** Whether the row `id` is an ancestor of the item matching `selectedRoute`. */
export function hasSelectedDescendant(id: Key | undefined, collection: Collection<Node<unknown>>, selectedRoute: string | undefined | null): boolean {
  if (id == null || selectedRoute == null) return false;
  return getSelectedAncestors(collection, selectedRoute).has(id);
}
