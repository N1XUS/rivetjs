import { load, notFound, type RequestEvent, type PageProps } from "@rivetjs/router";
import { articleFor } from "../../server/service.server.ts";
import { SiteNav } from "../../sites/SiteNav.tsx";
export const loader = load((e: RequestEvent) => {
  const article = articleFor(e.params.slug);
  if (!article) throw notFound();
  return { article };
});
export const head = ({ data }: { data: { article: { title: string } } }) => ({ title: data.article.title + " · Dispatch" });
export default function Article({ data }: PageProps<typeof loader>) {
  return (
    <>
      <SiteNav />
      <main class="reading-page">
        <a href="/dispatch" class="text-link">
          All stories
        </a>
        <p class="eyebrow">{data.article.category} / FIELD NOTES</p>
        <h1 id="story-title">{data.article.title}</h1>
        <p class="standfirst">{data.article.excerpt}</p>
        <p class="article-prose">{data.article.body}</p>
      </main>
    </>
  );
}
