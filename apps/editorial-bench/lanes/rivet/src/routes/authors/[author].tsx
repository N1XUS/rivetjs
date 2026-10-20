import { notFound, type PageProps, type RequestEvent, load, entries } from "@rivetjs/router";
import { Teasers } from "../../components/Teasers.tsx";
import { authorPage, authors } from "../../content.ts";

export const loader = load(({ params }: RequestEvent<{ author: string }>) => {
  const page = authorPage(params.author);
  if (!page) throw notFound();
  return page;
});
export const paths = entries(() => authors().map((author) => ({ author })));
export const head = ({ data }: { data: { name: string } }) => ({
  title: data.name,
  meta: [{ name: "description", content: "Stories by " + data.name + "." }],
});

export default function AuthorPage({ data }: PageProps<typeof loader, { author: string }>) {
  return (
    <main class="list">
      <h1>{data.name}</h1>
      <Teasers items={data.items} />
    </main>
  );
}
