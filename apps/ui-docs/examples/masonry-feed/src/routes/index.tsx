// Rivet-authored Masonry demo (Rivet addition, no HeroUI counterpart): measured cards with infinite loading.
import { signal } from "@rivetjs/reactivity";
import { Card } from "@rivetjs/ui/card";
import { Masonry } from "@rivetjs/ui/masonry";
import { Icon } from "@rivetjs/kit/icon";
import { LoaderCircle } from "lucide";

export const head = { title: "Masonry: Feed with load more" };

interface Note {
  id: number;
  title: string;
  body: string;
}

const WORDS = "The server renders every card and the client resumes where it stopped so scrolling to the end only loads the next page of notes".split(" ");
const note = (id: number): Note => ({ id, title: `Note ${id}`, body: WORDS.slice(0, 7 + ((id * 5) % 17)).join(" ") + "." });
const page = (from: number) => Array.from({ length: 10 }, (_, i) => note(from + i));

// #region demo
export function MasonryFeed() {
  const notes = signal<Note[]>(page(1));
  const loading = signal(false);
  return (
    <div class="h-[500px] w-[min(44rem,100%)] overflow-auto">
      <Masonry
        id="masonry-feed"
        items={notes}
        columns={{ 0: 1, 420: 2, 640: 3 }}
        gap={12}
        semantics="list"
        aria-label="Notes"
        isLoading={loading}
        onLoadMore={() => {
          if (loading() || notes().length >= 50) return;
          loading.set(true);
          setTimeout(() => {
            notes.set([...notes(), ...page(notes().length + 1)]);
            loading.set(false);
          }, 600);
        }}
        renderLoader={() => (
          <span class="flex items-center gap-2">
            <Icon icon={LoaderCircle} size={16} class="animate-spin" /> Loading more
          </span>
        )}
      >
        {(item) => (
          <Card>
            <Card.Header>
              <Card.Title>{item.title}</Card.Title>
              <Card.Description>{item.body}</Card.Description>
            </Card.Header>
          </Card>
        )}
      </Masonry>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 [:where(&>*)]:max-w-full">
      <MasonryFeed />
    </div>
  );
}
