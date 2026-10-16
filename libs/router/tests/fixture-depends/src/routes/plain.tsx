import type { PageProps } from "@rivetjs/router";

export default function Plain({ data }: PageProps<{ n: number }, {}>) {
  return (
    <article id="page">
      <h1>Plain</h1>
      <p id="page-n">{data.n}</p>
    </article>
  );
}
