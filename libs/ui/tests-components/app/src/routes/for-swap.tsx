// Keyed `For` rows on a resumed page (music showcase repro, `../../../for-swap.test.ts`): the album's tracks are one keyed For over
// an accessor; picking another album swaps every row (all browser-created). Each row holds a like button whose `aria-pressed` reads
// a shared `liked` signal: `#u-*` a ui Button (accessor `aria-pressed`), `#v-*` a ui Button with the value form
// (`aria-pressed={liked().includes(…)}`, the music showcase's original code), `#p-*` a plain `<button>`.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";

type Track = { id: string; title: string };

const ALBUMS: { id: string; tracks: Track[] }[] = [
  {
    id: "a",
    tracks: [
      { id: "a1", title: "Low tide" },
      { id: "a2", title: "Harbour" },
      { id: "a3", title: "Salt" },
    ],
  },
  {
    id: "b",
    tracks: [
      { id: "b1", title: "Static" },
      { id: "b2", title: "Neon" },
    ],
  },
];

export default function ForSwap() {
  const uAlbum = signal("a");
  const uLiked = signal<string[]>([]);
  const vAlbum = signal("a");
  const vLiked = signal<string[]>([]);
  const pAlbum = signal("a");
  const pLiked = signal<string[]>([]);
  const toggle = (liked: typeof uLiked, key: string) => liked.set(liked().includes(key) ? liked().filter((k) => k !== key) : [...liked(), key]);
  return (
    <section class="flex flex-col gap-8 p-10">
      <div id="u">
        <Button id="u-a" onPress={() => uAlbum.set("a")}>
          Album a
        </Button>
        <Button id="u-b" onPress={() => uAlbum.set("b")}>
          Album b
        </Button>
        <ol>
          <For each={() => ALBUMS.find((a) => a.id === uAlbum())!.tracks} by={(t: Track) => t.id}>
            {(t: () => Track) => (
              <li>
                <span class="title">{t().title}</span>
                <Button
                  id={"u-like-" + t().id}
                  isIconOnly
                  aria-label={"Like " + t().title}
                  aria-pressed={() => uLiked().includes(t().id)}
                  onPress={() => toggle(uLiked, t().id)}
                >
                  like
                </Button>
              </li>
            )}
          </For>
        </ol>
        <span id="u-liked">{uLiked().join(",")}</span>
      </div>

      <div id="v">
        <Button id="v-a" onPress={() => vAlbum.set("a")}>
          Album a
        </Button>
        <Button id="v-b" onPress={() => vAlbum.set("b")}>
          Album b
        </Button>
        <ol>
          <For each={() => ALBUMS.find((a) => a.id === vAlbum())!.tracks} by={(t: Track) => t.id}>
            {(t: () => Track) => (
              <li>
                <span class="title">{t().title}</span>
                <Button
                  id={"v-like-" + t().id}
                  isIconOnly
                  aria-label={"Like " + t().title}
                  aria-pressed={vLiked().includes(t().id)}
                  onPress={() => toggle(vLiked, t().id)}
                >
                  like
                </Button>
              </li>
            )}
          </For>
        </ol>
        <span id="v-liked">{vLiked().join(",")}</span>
      </div>

      <div id="p">
        <button id="p-a" type="button" onClick={() => pAlbum.set("a")}>
          Album a
        </button>
        <button id="p-b" type="button" onClick={() => pAlbum.set("b")}>
          Album b
        </button>
        <ol>
          <For each={() => ALBUMS.find((a) => a.id === pAlbum())!.tracks} by={(t: Track) => t.id}>
            {(t: () => Track) => (
              <li>
                <span class="title">{t().title}</span>
                <button
                  id={"p-like-" + t().id}
                  type="button"
                  aria-label={"Like " + t().title}
                  aria-pressed={pLiked().includes(t().id)}
                  onClick={() => toggle(pLiked, t().id)}
                >
                  like
                </button>
              </li>
            )}
          </For>
        </ol>
        <span id="p-liked">{pLiked().join(",")}</span>
      </div>
    </section>
  );
}
