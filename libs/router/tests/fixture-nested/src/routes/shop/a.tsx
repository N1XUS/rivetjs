import type { PageProps } from "@rivetjs/router";

export const head = { title: "Shop A" };
export default function Page({ data }: PageProps<{ n: number }, {}>) {
  return (
    <article class="tall">
      <h1>Page a</h1>
      <p id="page-n">{data.n}</p>
    </article>
  );
}
