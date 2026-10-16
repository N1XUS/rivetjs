import type { PageProps } from "@rivetjs/router";

// #region demo
// File: src/routes/items/[id].tsx. URL: /items/42 → params.id === "42".
export default function Item({ params }: PageProps<unknown, { id: string }>) {
  return (
    <section class="p-4">
      <h1 class="text-xl font-semibold">Item {params.id}</h1>
      <a class="text-teal-700 underline" href="/">
        Back
      </a>
    </section>
  );
}
// #endregion
