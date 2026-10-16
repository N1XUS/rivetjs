import type { PageProps } from "@rivetjs/router";

// #region demo
// File: src/routes/docs/[...path].tsx. URL: /docs/guide/intro → params.path === "guide/intro".
export default function Doc({ params }: PageProps<unknown, { path: string }>) {
  return (
    <section class="p-4">
      <h1 class="text-xl font-semibold">Docs</h1>
      <p>You asked for: {params.path || "(the docs home)"}</p>
      <a class="text-teal-700 underline" href="/">
        Back
      </a>
    </section>
  );
}
// #endregion
