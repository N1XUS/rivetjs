import { notFound, type PageProps, type RequestEvent, load, entries } from "@rivetjs/router";
import { Pager, Teasers } from "../../components/Teasers.tsx";
import { listPage, listPages } from "../../content.ts";

export const loader = load(({ params }: RequestEvent<{ n: string }>) => {
  const n = Number(params.n);
  if (!(n >= 2 && n <= listPages()) || String(n) !== params.n) throw notFound();
  return listPage(n);
});
export const paths = entries(() => Array.from({ length: listPages() - 1 }, (_, i) => ({ n: String(i + 2) })));
export const head = ({ data }: { data: { n: number } }) => ({
  title: "Latest, page " + data.n,
  meta: [{ name: "description", content: "Latest stories from The Daily Fixture." }],
});

export default function ListPage({ data }: PageProps<typeof loader, { n: string }>) {
  return (
    <main class="list">
      <h1>Latest, page {data.n}</h1>
      <Teasers items={data.items} />
      <Pager n={data.n} pages={data.pages} />
    </main>
  );
}
