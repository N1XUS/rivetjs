import { day } from "../lib/site.js";

export function Teasers({ items }) {
  return (
    <ul className="teasers">
      {items.map((a) => (
        <li className="teaser" key={a.slug}>
          <h2>
            <a href={`/articles/${a.slug}/`}>{a.title}</a>
          </h2>
          <p className="meta">
            {a.author} · <time dateTime={a.date}>{day(a.date)}</time>
          </p>
          <p>{a.description}</p>
        </li>
      ))}
    </ul>
  );
}

export function ListPage({ n, pages, items }) {
  return (
    <main className="list">
      <h1>{n === 1 ? "Latest" : `Latest, page ${n}`}</h1>
      <Teasers items={items} />
      <nav className="pager">
        {n > 1 ? <a href={n === 2 ? "/" : `/page/${n - 1}/`}>Newer</a> : null}
        <span>
          Page {n} of {pages}
        </span>
        {n < pages ? <a href={`/page/${n + 1}/`}>Older</a> : null}
      </nav>
    </main>
  );
}
