import { notFound, type DataOf, type PageProps, type RequestEvent, load } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";
import { createServerServices } from "../../services/server.js";

export const loader = load(async ({ params, signal }: RequestEvent<{ id: string }>) => {
  const item = await createServerServices().detail(params.id, signal);
  if (!item) throw notFound();
  return item;
});

export const head = ({ data }: { data: DataOf<typeof loader> }) => ({ title: data.title + " · Rivet playground", meta: [{ name: "description", content: data.description }] });

/** Detail view: its own route chunk, loaded when the route is visited. */
export default function Detail({ data: item }: PageProps<typeof loader, { id: string }>) {
  return (
    <article id="detail" class="rounded-xl border border-slate-200 bg-white p-6">
      <Link class="text-sm font-semibold text-teal-700 underline underline-offset-4" to="/">
        Back to examples
      </Link>
      <h1 class="mt-6 text-2xl font-semibold" data-vt-name={"item-" + item.id}>
        {item.title}
      </h1>
      <p class="mt-4 leading-7 text-slate-600">{item.description}</p>
      <p class="mt-6 text-sm text-slate-500">
        This view loads when its route is visited. Navigation cancels work owned by the previous route.
      </p>
    </article>
  );
}
