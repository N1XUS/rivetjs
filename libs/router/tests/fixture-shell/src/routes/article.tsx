import { load, type PageProps } from "@rivetjs/router";
import { signal } from "@rivetjs/reactivity";
import { runs } from "../gate.server.ts";

// Shell data: request-independent (params only), so a fill stores the shell.
export const loader = load(({ url }) => {
  runs.article = (runs.article ?? 0) + 1;
  return { title: "Shell article", body: ["One", "Two", "Three"], path: url.pathname };
});

export default function Article({ data }: PageProps<typeof loader>) {
  const likes = signal(0);
  return (
    <article>
      <h1 id="title">{data.title}</h1>
      {data.body.map((line) => (
        <p class="line">{line}</p>
      ))}
      <button id="like" type="button" onClick={() => likes.update((n) => n + 1)}>
        Likes {likes()}
      </button>
    </article>
  );
}
