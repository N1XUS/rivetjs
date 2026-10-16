import { signal } from "@rivetjs/reactivity";
import { Masonry } from "@rivetjs/cdk/masonry";
import { LoaderCircle } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Masonry: cards feed with load more" };

interface Post {
  id: number;
  title: string;
  body: string;
}

const WORDS = "Signals resume the page where the server left off without replaying components so a click only loads the handler it needs".split(" ");
const post = (id: number): Post => ({
  id,
  title: `Note ${id}`,
  body: WORDS.slice(0, 6 + ((id * 7) % 16)).join(" ") + ".",
});
const page = (from: number) => Array.from({ length: 12 }, (_, i) => post(from + i));

// #region demo
export default function MasonryFeed() {
  const posts = signal<Post[]>(page(1));
  const loading = signal(false);
  return (
    <div class="m-4 h-[480px] overflow-auto rounded-xl border border-slate-200 p-3">
      <Masonry
        id="feed"
        items={posts}
        columns={{ 0: 1, 420: 2, 680: 3 }}
        gap={12}
        semantics="list"
        aria-label="Notes"
        isLoading={loading}
        onLoadMore={() => {
          if (loading() || posts().length >= 60) return;
          loading.set(true);
          setTimeout(() => {
            posts.set([...posts(), ...page(posts().length + 1)]);
            loading.set(false);
          }, 600);
        }}
        renderLoader={() => (
          <span class="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
            <Icon icon={LoaderCircle} size={16} class="animate-spin" /> Loading more
          </span>
        )}
      >
        {(item) => (
          <article class="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <h3 class="m-0 text-sm font-semibold">{item.title}</h3>
            <p class="m-0 mt-1 text-sm text-slate-600">{item.body}</p>
          </article>
        )}
      </Masonry>
    </div>
  );
}
// #endregion
