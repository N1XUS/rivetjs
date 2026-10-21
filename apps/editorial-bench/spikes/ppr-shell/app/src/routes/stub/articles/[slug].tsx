import { notFound, type PageProps, type RequestEvent, load } from "@rivetjs/router";
import { article } from "../../../../../../../lanes/rivet/src/content.ts";
import { Article, type ArticleData } from "../../../components/Article.tsx";
import { Chrome } from "../../../components/Chrome.tsx";
import { PLACEHOLDER } from "../../../session.ts";

// stub: shell stand-in: the user menu is a constant placeholder of the same markup (no request read).
export const loader = load((event: RequestEvent<{ slug: string }>) => {
  const a = article(event.params.slug);
  if (!a) throw notFound();
  return { article: a as unknown as ArticleData, user: PLACEHOLDER };
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
