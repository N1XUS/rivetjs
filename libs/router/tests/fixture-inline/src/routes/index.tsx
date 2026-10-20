import { signal } from "@rivetjs/reactivity";
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { items } from "../db.server.ts";
import { load, onGet, onPut, onOptions } from "@rivetjs/router";

const count = () => Object.keys(items).length;
export const loader = load(async () => {
  return { count: count() };
});
// Page-route middleware: `?ping` answers before the page renders.
export const GET = onGet(({ url }: RequestEvent) => (url.searchParams.has("ping") ? new Response("pong") : undefined));
export const PUT = onPut(() => new Response("put ok"));
export const OPTIONS = onOptions(() => new Response(null, { status: 204, headers: { "x-inline-options": "options ok" } }));

export const head = { title: "Home" };
export default function Home({ data }: PageProps<typeof loader>) {
  const likes = signal(0);
  return (
    <section>
      <h1 id="count">{data.count} items</h1>
      <button type="button" onClick={() => likes.update((n) => n + 1)}>
        Likes {likes()}
      </button>
    </section>
  );
}
