import type { PageProps, RequestEvent } from "@rivetjs/router";
import { notFound, load } from "@rivetjs/router";
import { items } from "../../db.server.ts";

export const loader = load(({ params }: RequestEvent<{ id: string }>) => {
  const item = items[params.id];
  if (!item) throw notFound();
  return { id: params.id, title: item.title };
});

export default function Item({ data }: PageProps<typeof loader>) {
  return <h1 id="item">{data.title} ({data.id})</h1>;
}
