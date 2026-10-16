import type { PageProps } from "@rivetjs/router";
import { Pager, Teasers } from "../components/Teasers.tsx";
import { listPage } from "../content.ts";

export const serverLoad = () => listPage(1);
export const head = { title: "Latest", meta: [{ name: "description", content: "Latest stories from The Daily Fixture." }] };

export default function Home({ data }: PageProps<typeof serverLoad>) {
  return (
    <main class="list">
      <h1>Latest</h1>
      <Teasers items={data.items} />
      <Pager n={data.n} pages={data.pages} />
    </main>
  );
}
