import { signal } from "@rivetjs/reactivity";
import type { PageProps } from "@rivetjs/router";

type Item = { id: string; title: string; loads: number };
export const head = ({ data }: { data: Item }) => ({ title: data.title, meta: [{ name: "description", content: "Item " + data.id }] });
export default function ItemPage({ data, params }: PageProps<Item, { id: string }>) {
  const likes = signal(0);
  return (
    <article id="item">
      <h1>{data.title}</h1>
      <p id="item-id">{params.id}</p>
      <p id="loads">{String(data.loads)}</p>
      <button type="button" id="likes" onClick={() => likes.update((n) => n + 1)}>
        Likes {likes()}
      </button>
    </article>
  );
}
