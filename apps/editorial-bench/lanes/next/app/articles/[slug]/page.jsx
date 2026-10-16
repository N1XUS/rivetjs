import { marked } from "marked";
import { day, load } from "../../../lib/site.js";

export const dynamicParams = false;
export function generateStaticParams() {
  return load().articles.map((a) => ({ slug: a.slug }));
}
export async function generateMetadata({ params }) {
  const a = load().bySlug.get((await params).slug);
  return { title: a.title, description: a.description };
}

export default async function Article({ params }) {
  const { bySlug } = load();
  const a = bySlug.get((await params).slug);
  return (
    <main className="layout">
      <article>
        <h1>{a.title}</h1>
        <p className="meta">
          By <a href={`/authors/${a.authorSlug}/`}>{a.author}</a> · <time dateTime={a.date}>{day(a.date)}</time>
        </p>
        <ul className="tags">
          {a.tags.map((t) => (
            <li key={t}>
              <a href={`/tags/${t}/`}>{t}</a>
            </li>
          ))}
        </ul>
        <div className="body" dangerouslySetInnerHTML={{ __html: marked.parse(a.body) }} />
      </article>
      <aside className="related">
        <h2>Related</h2>
        <ul>
          {a.related.map((s) => {
            const r = bySlug.get(s);
            return (
              <li key={s}>
                <a href={`/articles/${s}/`}>{r.title}</a>
                <time dateTime={r.date}>{day(r.date)}</time>
              </li>
            );
          })}
        </ul>
      </aside>
    </main>
  );
}
