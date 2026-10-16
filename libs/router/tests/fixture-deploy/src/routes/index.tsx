import { signal } from "@rivetjs/reactivity";
import type { PageProps } from "@rivetjs/router";

export const head = { title: "Home" };
export default function Home({ data }: PageProps<{ greeting: string; platform: string }, {}>) {
  const clicks = signal(0);
  return (
    <section>
      <h1>{data.greeting}</h1>
      <p id="platform">{data.platform}</p>
      <button type="button" id="clicks" onClick={() => clicks.set(clicks() + 1)}>
        Clicks {clicks()}
      </button>
    </section>
  );
}
