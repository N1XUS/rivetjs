import type { PageProps } from "@rivetjs/router";

export default function Item({ params }: PageProps<undefined, { id: string }>) {
  return (
    <section>
      <h1>Item {params.id}</h1>
    </section>
  );
}
