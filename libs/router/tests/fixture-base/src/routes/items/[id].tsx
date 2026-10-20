import type { PageProps } from "@rivetjs/router";
import { entries } from "@rivetjs/router";

export const paths = entries(() => [{ id: "1" }, { id: "2" }]);

export default function Item({ params }: PageProps<unknown, { id: string }>) {
  return <h1>Item {params.id}</h1>;
}
