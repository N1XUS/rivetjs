import type { Item } from "./page.js";

/** Lazily loaded detail route. */
export default function Detail({ item, follow }: { item: Item; follow: (event: MouseEvent, href: string) => void }) {
  return (
    <article id="detail">
      <h2>{item.label}</h2>
      <a id="back" href="/" onClick={(event) => follow(event, "/")}>
        back
      </a>
    </article>
  );
}
