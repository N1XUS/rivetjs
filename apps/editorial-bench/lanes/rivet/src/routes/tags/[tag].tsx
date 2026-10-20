import { notFound, type PageProps, type RequestEvent, load, entries } from "@rivetjs/router";
import { Teasers } from "../../components/Teasers.tsx";
import { tagPage, tags } from "../../content.ts";

export const loader = load(({ params }: RequestEvent<{ tag: string }>) => {
  if (!tags().includes(params.tag)) throw notFound();
  return tagPage(params.tag);
});
export const paths = entries(() => tags().map((tag) => ({ tag })));
export const head = ({ data }: { data: { tag: string } }) => ({
  title: "Tag: " + data.tag,
  meta: [{ name: "description", content: "Stories tagged " + data.tag + "." }],
});

export default function TagPage({ data }: PageProps<typeof loader, { tag: string }>) {
  return (
    <main class="list">
      <h1>Tag: {data.tag}</h1>
      <Teasers items={data.items} />
    </main>
  );
}
