import { notFound, type PageProps, type RequestEvent } from "@rivetjs/router";
import { Teasers } from "../../components/Teasers.tsx";
import { authorPage, authors } from "../../content.ts";

export const serverLoad = ({ params }: RequestEvent<{ author: string }>) => {
  const page = authorPage(params.author);
  if (!page) throw notFound();
  return page;
};
export const serverEntries = () => authors().map((author) => ({ author }));
export const head = ({ data }: { data: { name: string } }) => ({
  title: data.name,
  meta: [{ name: "description", content: "Stories by " + data.name + "." }],
});

export default function AuthorPage({ data }: PageProps<typeof serverLoad, { author: string }>) {
  return (
    <main class="list">
      <h1>{data.name}</h1>
      <Teasers items={data.items} />
    </main>
  );
}
