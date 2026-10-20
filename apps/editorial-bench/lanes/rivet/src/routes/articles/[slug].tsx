import { notFound, type PageProps, type RequestEvent, load, entries } from "@rivetjs/router";
import { Markdown } from "../../components/Markdown.tsx";
import { article, slugs } from "../../content.ts";

export const loader = load(({ params }: RequestEvent<{ slug: string }>) => {
  const a = article(params.slug);
  if (!a) throw notFound();
  return a;
});
export const paths = entries(() => slugs().map((slug) => ({ slug })));
export const head = ({ data }: { data: { title: string; description: string } }) => ({
  title: data.title,
  meta: [{ name: "description", content: data.description }],
});

export default function ArticlePage({ data }: PageProps<typeof loader, { slug: string }>) {
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
