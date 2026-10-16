// loadMoreSentinel (react-aria utils/useLoadMoreSentinel port) in Chromium with a real IntersectionObserver.
// Upstream has no dedicated unit test (it is covered by the RAC GridList / ListBox / Table / Tree
// "load more" suites, which the component lanes port); these cover the hook contract directly.
import { afterEach, expect, test, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { loadMoreSentinel, type LoadMoreSentinelProps } from "../utils/load-more-sentinel.tsx";

afterEach(cleanup);

const frames = (n = 3) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });

function Scroller(props: Omit<LoadMoreSentinelProps, "collection"> & { collection: () => unknown; spacer: number }) {
  const sentinel = ref<HTMLDivElement>();
  loadMoreSentinel(
    { collection: props.collection as never, onLoadMore: () => props.onLoadMore?.(), scrollOffset: props.scrollOffset, direction: props.direction },
    sentinel,
  );
  return (
    <div id="scroller" style={{ height: "100px", overflow: "auto" }}>
      <div style={{ height: `${props.spacer}px` }} />
      <div ref={sentinel} id="sentinel" style={{ height: "1px" }} />
    </div>
  );
}

test("calls onLoadMore when the sentinel is inside the scroll region", async () => {
  const onLoadMore = vi.fn();
  render(() => <Scroller collection={() => 1} spacer={50} onLoadMore={onLoadMore} />);
  await flush();
  await frames();
  expect(onLoadMore).toHaveBeenCalledTimes(1);
});

test("does not call onLoadMore while the sentinel is farther than scrollOffset; calls it when scrolled near", async () => {
  const onLoadMore = vi.fn();
  render(() => <Scroller collection={() => 1} spacer={1000} scrollOffset={1} onLoadMore={onLoadMore} />);
  await flush();
  await frames();
  expect(onLoadMore).not.toHaveBeenCalled();
  // Within 100% of the client height (100px) of the bottom.
  document.getElementById("scroller")!.scrollTop = 850;
  await frames();
  expect(onLoadMore).toHaveBeenCalledTimes(1);
});

test("scrollOffset widens the trigger region", async () => {
  const onLoadMore = vi.fn();
  render(() => <Scroller collection={() => 1} spacer={250} scrollOffset={2} onLoadMore={onLoadMore} />);
  await flush();
  await frames();
  expect(onLoadMore).toHaveBeenCalledTimes(1);
});

test("re-creates the observer when the collection changes (fires again while still intersecting)", async () => {
  const onLoadMore = vi.fn();
  const collection = signal(1);
  render(() => <Scroller collection={collection} spacer={50} onLoadMore={onLoadMore} />);
  await flush();
  await frames();
  expect(onLoadMore).toHaveBeenCalledTimes(1);
  collection.set(2);
  await flush();
  await frames();
  expect(onLoadMore).toHaveBeenCalledTimes(2);
});

test("direction='start' only extends the top margin", async () => {
  const onLoadMore = vi.fn();
  render(() => <Scroller collection={() => 1} spacer={250} scrollOffset={2} direction="start" onLoadMore={onLoadMore} />);
  await flush();
  await frames();
  // Sentinel is 150px below the viewport; a top-only margin does not reach it.
  expect(onLoadMore).not.toHaveBeenCalled();
});

test("disconnects the observer on unmount", async () => {
  const onLoadMore = vi.fn();
  const disconnect = vi.spyOn(IntersectionObserver.prototype, "disconnect");
  const { unmount } = render(() => <Scroller collection={() => 1} spacer={1000} onLoadMore={onLoadMore} />) as { unmount: () => void };
  await flush();
  unmount();
  expect(disconnect).toHaveBeenCalled();
  disconnect.mockRestore();
});
