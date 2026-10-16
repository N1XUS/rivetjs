import { notFound, type RequestEvent } from "@rivetjs/router";

let loads = 0;
const titles: Record<string, string> = { "1": "First item", "2": "Second item" };
export const load = ({ params }: RequestEvent<{ id: string }>) => {
  const title = titles[params.id];
  if (!title) throw notFound();
  return { id: params.id, title, loads: ++loads };
};
