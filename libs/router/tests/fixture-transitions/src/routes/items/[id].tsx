import type { PageProps } from "@rivetjs/router";

type Item = { id: string; title: string };
export const head = ({ data }: { data: Item }) => ({ title: data.title });
// Added to the view transition types (a link's data-transition overrides it).
export const transition = { types: ["detail"] };
export default function ItemPage({ data }: PageProps<Item, { id: string }>) {
  return (
    <article id="item">
      <span class="hero" data-vt-name={"item-" + data.id} data-vt-class="card" />
      <h1>{data.title}</h1>
    </article>
  );
}
