import { notFound, type PageProps, type RequestEvent, load } from "@rivetjs/router";

const items: Record<string, string> = { "1": "Desk lamp", "2": "Notebook" };

// #region demo
export const loader = load(({ params }: RequestEvent<{ id: string }>) => {
  const title = items[params.id];
  // The URL matched a route, but the item does not exist: answer 404.
  if (!title) throw notFound();
  return { title };
});
// #endregion

export default function Item({ data }: PageProps<typeof loader, { id: string }>) {
  return (
    <section class="p-4">
      <h1 class="text-xl font-semibold">{data.title}</h1>
      <a class="text-teal-700 underline" href="/">
        Back home
      </a>
    </section>
  );
}
