import { signal } from "@rivetjs/reactivity";
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { items } from "../db.server.ts";

const count = () => Object.keys(items).length;
export async function serverLoad() {
  return { count: count() };
}
// Page-route middleware: `?ping` answers before the page renders.
export const onGet = ({ url }: RequestEvent) => (url.searchParams.has("ping") ? new Response("pong") : undefined);
export const onPut = () => new Response("put ok");
export const onOptions = () => new Response(null, { status: 204, headers: { "x-inline-options": "options ok" } });

export const head = { title: "Home" };
export default function Home({ data }: PageProps<typeof serverLoad>) {
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
