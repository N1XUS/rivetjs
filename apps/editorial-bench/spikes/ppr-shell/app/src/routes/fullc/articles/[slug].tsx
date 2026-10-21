import { notFound, type PageProps, type RequestEvent, load } from "@rivetjs/router";
import { cachedArticle as article } from "../../../cached.ts";
import { Article, type ArticleData } from "../../../components/Article.tsx";
import { Chrome } from "../../../components/Chrome.tsx";
import { session } from "../../../session.ts";

// fullc: `full` with the article loader memoised (cached-loader variant, PPR-T3B).
export const loader = load((event: RequestEvent<{ slug: string }>) => {
  const a = article(event.params.slug);
  if (!a) throw notFound();
  return { article: a as unknown as ArticleData, user: session(event) };
});
export const head = ({ data }: { data: { article: { title: string; description?: string } } }) => ({
  title: data.article.title,
  meta: [{ name: "description", content: data.article.description ?? "" }],
});

export default function Page({ data }: PageProps<typeof loader, { slug: string }>) {
  return (
    <Chrome user={data.user}>
      <Article data={data.article} />
    </Chrome>
  );
}
