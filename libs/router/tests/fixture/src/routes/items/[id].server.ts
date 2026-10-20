import { notFound, type RequestEvent, load } from "@rivetjs/router";

let loads = 0;
const titles: Record<string, string> = { "1": "First item", "2": "Second item" };
export const loader = load(({ params }: RequestEvent<{ id: string }>) => {
  const title = titles[params.id];
  if (!title) throw notFound();
  return { id: params.id, title, loads: ++loads };
});
