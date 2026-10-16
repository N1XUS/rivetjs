import { signal } from "@rivetjs/reactivity";
import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: load more" };

const page = (from: number) => Array.from({ length: 40 }, (_, i) => ({ id: `item-${from + i}`, label: `Post ${from + i}` }));

// #region demo
export default function Feed() {
  const items = signal(page(0));
  const loading = signal(false);
  const calls = signal(0);
  const top = signal(0);
  const loadMore = () => {
    calls.set(calls() + 1);
    loading.set(true);
    // Stand-in for a fetch.
    setTimeout(() => {
      items.set([...items(), ...page(items().length)]);
      loading.set(false);
    }, 300);
  };
  return (
    <section class="stack">
      <button
        id="feed-bottom"
        type="button"
        onClick={() => {
          const scroller = document.getElementById("feed")!;
          scroller.scrollTop = scroller.scrollHeight;
        }}
      >
        Bottom
      </button>
      <Virtualizer
        id="feed"
        role="list"
        label="Feed"
        tabIndex={0}
        items={() => items()}
        isLoading={() => loading()}
        onLoadMore={loadMore}
        loadMoreOffset={1}
        layout={() => new ListLayout()}
        layoutOptions={{ rowSize: 32, loaderSize: 40 }}
        initialSize={{ width: 320, height: 240 }}
        style={{ width: "320px", height: "240px" }}
        onScroll={(event) => top.set((event.currentTarget as HTMLElement).scrollTop)}
      >
        {(post, view) =>
          view().type === "loader" ? (
            // Always rendered, hidden when idle: a resumed binding keeps its kind (element vs text).
            <div class="loader" role="status" hidden={!loading()}>
              Loading…
            </div>
          ) : (
            <div role="listitem" class="row">
              {post().label}
            </div>
          )
        }
      </Virtualizer>
      <output id="feed-count">{items().length} items</output>
      <output id="feed-calls">onLoadMore calls: {calls()}</output>
      <output id="feed-top">scrollTop: {top()}</output>
    </section>
  );
}
// #endregion
