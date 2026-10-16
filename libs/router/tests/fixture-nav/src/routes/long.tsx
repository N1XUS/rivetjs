import type { PageProps } from "@rivetjs/router";

export const head = { title: "Long" };
export default function Long({ data }: PageProps<{ load: number }, {}>) {
  return (
    <section class="tall">
      <h1>Long</h1>
      <p id="loads">{data.load}</p>
      <a href="#far" id="to-far">To far</a>
      <p id="far" class="far">
        Far <a href="/long" id="drop-hash">Drop hash</a>
      </p>
    </section>
  );
}
