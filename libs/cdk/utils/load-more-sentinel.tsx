// Ported from packages/react-aria/src/utils/useLoadMoreSentinel.ts, Apache-2.0, © Adobe.
// Rivet:
// - Name: `useLoadMoreSentinel` → `loadMoreSentinel(props, ref)` (no `use*` exports).
// - `.tsx` (no JSX): `.ts` modules are not server-rewritten, and this one calls `clientEffect`.
// - `useLayoutEffect(…, [collection, ref, scrollOffset, direction])` → `clientEffect` that tracks the
//   same inputs: `ref` is an element accessor (`ref()` from `@rivetjs/runtime/dom`), `collection`,
//   `scrollOffset` and `direction` a value or an accessor. Any change tears the observer down and sets up
//   a new one, as upstream.
// - `useEffectEvent(triggerLoadMore)` → `props.onLoadMore` read when the observer fires (always the latest).
import { untrack } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { Collection } from "../collections/types.ts";
import { getScrollParent } from "./dom.ts";

type MaybeAccessor<T> = T | (() => T);
const read = <T,>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

export interface LoadMoreSentinelProps {
  /** The collection the sentinel trails; the observer is re-created whenever it changes. */
  collection: MaybeAccessor<Collection<any> | null | undefined>;
  /** Handler that is called when more items should be loaded, e.g. while scrolling near the bottom. */
  onLoadMore?: () => any;
  /**
   * The amount of offset from the bottom of your scrollable region that should trigger load more.
   * Uses a percentage value relative to the scroll body's client height. Load more is then
   * triggered when your current scroll position's distance from the bottom of the currently loaded
   * list of items is less than or equal to the provided value. (e.g. 1 = 100% of the scroll
   * region's height).
   *
   * @default 1
   */
  scrollOffset?: MaybeAccessor<number | undefined>;
  /**
   * The scroll direction that triggers load more. Use 'start' for reversed layouts where older
   * content loads when scrolling toward the top.
   *
   * @default 'end'
   */
  direction?: MaybeAccessor<"start" | "end" | undefined>;
}

/** Calls `props.onLoadMore` whenever the sentinel element `ref` scrolls within `scrollOffset` of its scroll parent's viewport. */
export function loadMoreSentinel(props: LoadMoreSentinelProps, ref: () => HTMLElement | null | undefined): void {
  const triggerLoadMore = (entries: IntersectionObserverEntry[]) => {
    // Use "isIntersecting" over an equality check of 0 since it seems like there is cases where
    // a intersection ratio of 0 can be reported when isIntersecting is actually true
    for (const entry of entries) {
      // Note that this will be called if the collection changes, even if onLoadMore was already called and is being processed.
      // Up to user discretion as to how to handle these multiple onLoadMore calls
      const onLoadMore = props.onLoadMore;
      if (entry.isIntersecting && onLoadMore) untrack(() => onLoadMore());
    }
  };

  // Resumed page: the owning boundary must be visible before this observer starts. Lazy collection loaders give
  // the sentinel its own boundary; the first load waits for it to intersect, then scrollOffset controls later loads.
  clientEffect(
    () => {
      // Dependencies: collection, ref, scrollOffset, direction.
      read(props.collection);
      const element = ref();
      const scrollOffset = read(props.scrollOffset) ?? 1;
      const direction = read(props.direction) ?? "end";
      let sentinelObserver: IntersectionObserver | null = null;
      if (element) {
        // Tear down and set up a new IntersectionObserver when the collection changes so that we can properly trigger additional loadMores if there is room for more items
        // Need to do this tear down and set up since using a large rootMargin will mean the observer's callback isn't called even when scrolling the item into view beause its visibility hasn't actually changed
        // https://codesandbox.io/p/sandbox/magical-swanson-dhgp89?file=%2Fsrc%2FApp.js%3A21%2C21
        const margin = 100 * scrollOffset;
        // For direction='start', right/left margins have no affect for vertical scroll containers. We are not supporting reverse horizontal scroll containers for now.
        const rootMargin = direction === "start" ? `${margin}% 0px 0px 0px` : `0px ${margin}% ${margin}% ${margin}%`;
        sentinelObserver = new IntersectionObserver(triggerLoadMore, {
          root: getScrollParent(element) as HTMLElement,
          rootMargin,
        });
        sentinelObserver.observe(element);
      }

      return () => {
        if (sentinelObserver) sentinelObserver.disconnect();
      };
    },
    { when: "visible" },
  );
}
