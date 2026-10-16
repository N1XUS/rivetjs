import type { Teaser } from "../types.ts";

export function Teasers({ items }: { items: Teaser[] }) {
  return (
    <ul class="teasers">
      {items.map((a) => (
        <li class="teaser">
          <h2>
            <a href={"/articles/" + a.slug + "/"}>{a.title}</a>
          </h2>
          <p class="meta">
            {a.author} · <time datetime={a.date}>{a.day}</time>
          </p>
          <p>{a.description}</p>
        </li>
      ))}
    </ul>
  );
}

export function Pager({ n, pages }: { n: number; pages: number }) {
  return (
    <nav class="pager">
      {n > 1 ? <a href={n === 2 ? "/" : "/page/" + (n - 1) + "/"}>Newer</a> : null}
      <span>
        Page {n} of {pages}
      </span>
      {n < pages ? <a href={"/page/" + (n + 1) + "/"}>Older</a> : null}
    </nav>
  );
}
