import type { Item } from "./items";

/** Lazily loaded detail route (own chunk). */
export default function Detail(props: { item: Item | undefined; onNavigate: (e: MouseEvent, href: string) => void }) {
  return (
    <article id="detail">
      <h2>{props.item?.label}</h2>
      <a id="back" href="/" onClick={(e) => props.onNavigate(e, "/")}>
        back
      </a>
    </article>
  );
}
