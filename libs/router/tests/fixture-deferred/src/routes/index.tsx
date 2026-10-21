import { load, type PageProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { gate } from "../gate.server.ts";

// Deferred page loader + a synchronous sibling after the boundary (rendered in the shell).
export const loader = load(
  async ({ params }) => {
    await gate("item");
    return { title: "Deferred item", tags: ["a", "b"], at: new Date(0), id: params.id ?? "1" };
  },
  { defer: true },
);

export default function Home({ data }: PageProps<typeof loader>) {
  const picked = signal("none");
  return (
    <section>
      <h1>Shell</h1>
      <Async load={() => data} fallback={() => <p id="item-wait">Loading item…</p>}>
        {(item) => (
          <article id="item">
            <h2>{item.title}</h2>
            <p id="year">{item.at.getUTCFullYear()}</p>
            {item.tags.map((tag) => (
              <button type="button" class="tag" onClick={() => picked.set(tag)}>
                {tag}
              </button>
            ))}
            <p id="picked">{picked()}</p>
          </article>
        )}
      </Async>
      <p id="sync">Sync sibling</p>
    </section>
  );
}
