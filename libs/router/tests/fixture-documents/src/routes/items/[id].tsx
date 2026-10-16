import type { PageProps } from "@rivetjs/router";

export default function Item({ params }: PageProps<unknown, { id: string }>) {
  return <h1>Item {params.id}</h1>;
}
