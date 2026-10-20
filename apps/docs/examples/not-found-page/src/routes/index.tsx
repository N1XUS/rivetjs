export const head = { title: "Home" };

// #region demo
export default function Home() {
  return (
    <section class="p-4">
      <h1 class="text-xl font-semibold">Home</h1>
      <ul class="mt-2 list-disc pl-5">
        <li>
          <a class="text-teal-700 underline" href="/items/1">
            Item 1 (exists)
          </a>
        </li>
        <li>
          {/* Matches items/[id], but its loader throws notFound(). */}
          <a class="text-teal-700 underline" href="/items/99">
            Item 99 (missing)
          </a>
        </li>
        <li>
          {/* Matches no route at all. */}
          <a class="text-teal-700 underline" href="/no-such-page">
            A page that does not exist
          </a>
        </li>
      </ul>
    </section>
  );
}
// #endregion
