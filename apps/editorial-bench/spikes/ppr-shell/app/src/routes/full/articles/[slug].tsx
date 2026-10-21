import { notFound, type PageProps, type RequestEvent, load } from "@rivetjs/router";
import { article } from "../../../../../../../lanes/rivet/src/content.ts";
import { Article, type ArticleData } from "../../../components/Article.tsx";
import { Chrome } from "../../../components/Chrome.tsx";
import { session } from "../../../session.ts";

// full: signed-in article (today: cookie → route-cache bypass, full render).
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
