import type { PageProps } from "@rivetjs/router";

export const head = { title: "Counter" };
export default function Counter({ data }: PageProps<{ count: number }, {}>) {
  return (
    <section>
      <h1>Counter</h1>
      <p id="count">{data.count}</p>
    </section>
  );
}
