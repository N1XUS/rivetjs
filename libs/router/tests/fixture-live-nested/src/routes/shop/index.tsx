import { signal } from "@rivetjs/reactivity";
import type { LivePageProps } from "@rivetjs/router";
import { invalidate } from "@rivetjs/router/client";
import { count } from "../../counts.server.ts";

// Live page under a nested layout level: a search-only navigation (`?q=`) refreshes `data` in place.
export const live = true;
export const serverLoad = ({ url }: { url: URL }) => ({ q: url.searchParams.get("q") ?? "", loads: count("page") });

export default function Shop({ data }: LivePageProps<typeof serverLoad>) {
  const clicks = signal(0);
  return (
    <article id="page">
      <h1>Shop</h1>
      <p id="q">{data().q}</p>
      <p id="page-loads">{data().loads}</p>
      <button id="clicks" type="button" onClick={() => clicks.update((n) => n + 1)}>
        Clicked {clicks()}
      </button>
      <button id="refresh" type="button" onClick={() => invalidate()}>
        Refresh
      </button>
      <input id="typed" />
      <a id="to-c" href="/shop?q=c">
        Shop c
      </a>
    </article>
  );
}
