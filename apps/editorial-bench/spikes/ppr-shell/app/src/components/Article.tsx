import { Markdown } from "../../../../../lanes/rivet/src/components/Markdown.tsx";
import type { MdNode } from "../../../../../lanes/rivet/src/types.ts";

export type ArticleData = {
  title: string;
  author: string;
  authorSlug: string;
  date: string;
  day: string;
  tags: string[];
  body: MdNode[];
  related: { slug: string; title: string; date: string; day: string }[];
};
/** The editorial lane's article page body (`lanes/rivet/src/routes/articles/[slug].tsx`). */
export function Article({ data }: { data: ArticleData }) {
  return (
    <main class="layout">
      <article>
        <h1>{data.title}</h1>
        <p class="meta">
          By <a href={"/authors/" + data.authorSlug + "/"}>{data.author}</a> · <time datetime={data.date}>{data.day}</time>
        </p>
        <ul class="tags">
          {data.tags.map((t) => (
            <li>
              <a href={"/tags/" + t + "/"}>{t}</a>
            </li>
          ))}
        </ul>
        <div class="body">
          <Markdown nodes={data.body} />
        </div>
      </article>
      <aside class="related">
        <h2>Related</h2>
        <ul>
          {data.related.map((r) => (
            <li>
              <a href={"/articles/" + r.slug + "/"}>{r.title}</a>
              <time datetime={r.date}>{r.day}</time>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
