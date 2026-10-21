import { notFound, type PageProps, type RequestEvent, load } from "@rivetjs/router";
import { article } from "../../../../../../../lanes/rivet/src/content.ts";
import { Article, type ArticleData } from "../../../components/Article.tsx";

// shell: the article loader reads no request state, so a shell hit serves it from the store (the user menu is the
// layout's deferred hole).
export const loader = load((event: RequestEvent<{ slug: string }>) => {
  const a = article(event.params.slug);
  if (!a) throw notFound();
  return { article: a as unknown as ArticleData };
});
export const head = ({ data }: { data: { article: { title: string; description?: string } } }) => ({
  title: data.article.title,
  meta: [{ name: "description", content: data.article.description ?? "" }],
});

export default function Page({ data }: PageProps<typeof loader, { slug: string }>) {
  return <Article data={data.article} />;
}
