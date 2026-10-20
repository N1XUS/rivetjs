import type { PageProps } from "@rivetjs/router";
import { Pager, Teasers } from "../components/Teasers.tsx";
import { listPage } from "../content.ts";
import { load } from "@rivetjs/router";

export const loader = load(() => listPage(1));
export const head = { title: "Latest", meta: [{ name: "description", content: "Latest stories from The Daily Fixture." }] };

export default function Home({ data }: PageProps<typeof loader>) {
  return (
    <main class="list">
      <h1>Latest</h1>
      <Teasers items={data.items} />
      <Pager n={data.n} pages={data.pages} />
    </main>
  );
}
