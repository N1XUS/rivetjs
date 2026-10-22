import type { PageProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";

// Loader data large enough to be compressed (≥ 1 KiB): shared rows + this page's title.
export const loader = load(() => ({
  title: "Doc gamma",
  rows: Array.from({ length: 40 }, (_, i) => ({ id: i, label: "Shared row label of the documentation table", value: i * 3 })),
}));

export default function Doc({ data }: PageProps<{ title: string; rows: { id: number; label: string; value: number }[] }, {}>) {
  return (
    <section>
      <h1>{data.title}</h1>
      <ul>
        {data.rows.map((row) => (
          <li>
            {row.label} {row.value}
          </li>
        ))}
      </ul>
    </section>
  );
}
