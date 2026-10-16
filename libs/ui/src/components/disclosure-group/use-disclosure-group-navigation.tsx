// Ported from HeroUI v3.2.6 packages/react/src/components/disclosure-group/use-disclosure-group-navigation.ts (Apache-2.0,
// © 2025 NextUI Inc.; modified).
// Rivet:
// - `expandedKeys` is a plain Set or an accessor (a Signal works: read on every call); `currentIndex` / `isPrevDisabled` /
//   `isNextDisabled` are accessors (upstream: values recomputed on each render): read them in bindings
//   (`isDisabled={nav.isPrevDisabled}`).
// - `onPrevious` / `onNext` read the latest keys at press time (upstream: `useCallback` over the rendered keys). They and
//   the accessors are object-literal functions in a `.tsx` module: compiler-registered resumable functions, so a Button's
//   `onPress={nav.onNext}` resumes.
// - Keys: `Key` (`string | number`, cdk) for `expandedKeys`; `itemIds` stay strings (upstream).
import type { Key } from "@rivetjs/cdk/collections/types";

export interface UseDisclosureGroupNavigationProps {
  /** The expanded keys of the group: a Set, or an accessor / Signal of it (Rivet). */
  expandedKeys: Set<Key> | (() => Set<Key>);
  itemIds: string[];
  onExpandedChange: (keys: Set<Key>) => void;
  allowsMultipleExpanded?: boolean;
}

export interface UseDisclosureGroupNavigationReturn {
  /** Rivet: accessor. */
  currentIndex: () => number;
  /** Rivet: accessor. */
  isPrevDisabled: () => boolean;
  /** Rivet: accessor. */
  isNextDisabled: () => boolean;
  onPrevious: () => void;
  onNext: () => void;
}

const EMPTY_ITEM_IDS: string[] = [];

const keysOf = (keys: Set<Key> | (() => Set<Key>)): Set<Key> => (typeof keys === "function" ? keys() : keys);

const indexOf = (itemIds: string[], expandedKeys: Set<Key>): number => {
  const expandedItems = itemIds.filter((id) => expandedKeys.has(id));
  const currentItem = expandedItems.length > 0 ? expandedItems[0] : itemIds[0];

  if (!currentItem) return -1;

  return itemIds.indexOf(currentItem);
};

const step = (props: UseDisclosureGroupNavigationProps, itemIds: string[], delta: number): void => {
  const expandedKeys = keysOf(props.expandedKeys);
  const currentIndex = indexOf(itemIds, expandedKeys);

  if (delta < 0 ? currentIndex <= 0 : currentIndex >= itemIds.length - 1) return;

  const item = itemIds[currentIndex + delta];

  if (!item) return;

  if (props.allowsMultipleExpanded ?? false) {
    const newKeys = new Set(expandedKeys);

    newKeys.add(item);
    props.onExpandedChange(newKeys);
  } else {
    props.onExpandedChange(new Set([item]));
  }
};

export function useDisclosureGroupNavigation(props: UseDisclosureGroupNavigationProps): UseDisclosureGroupNavigationReturn {
  const itemIds = props.itemIds ?? EMPTY_ITEM_IDS;

  return {
    currentIndex: () => indexOf(itemIds, keysOf(props.expandedKeys)),
    isPrevDisabled: () => indexOf(itemIds, keysOf(props.expandedKeys)) <= 0,
    isNextDisabled: () => indexOf(itemIds, keysOf(props.expandedKeys)) >= itemIds.length - 1,
    onPrevious: () => step(props, itemIds, -1),
    onNext: () => step(props, itemIds, 1),
  };
}
