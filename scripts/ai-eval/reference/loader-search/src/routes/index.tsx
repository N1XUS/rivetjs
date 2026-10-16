import type { PageProps, RequestEvent } from "@rivetjs/router";

const books = ["Dune", "Emma", "Ulysses", "Dracula", "Beloved"];

export const serverLoad = ({ url }: RequestEvent<"index">) => {
  const q = (url.searchParams.get("q") ?? "").trim();
  return { q, books: books.filter((book) => book.toLowerCase().includes(q.toLowerCase())) };
};

export const head = { title: "Books" };

export default function Books({ data }: PageProps<"index">) {
  return (
    <main class="mx-auto max-w-xl p-6">
      <form method="get" class="flex gap-2">
        <label for="q" class="sr-only">
          Search books
        </label>
        <input id="q" name="q" type="search" value={data.q} class="flex-1 rounded-md border px-3 py-2" />
        <button id="search" class="rounded-md bg-teal-700 px-4 py-2 text-white">
          Search
        </button>
      </form>
      <p id="summary" class="mt-4">
        {data.books.length} books{data.q ? ` for “${data.q}”` : ""}
      </p>
      <ol id="books" class="list-decimal pl-6">
        {data.books.map((book) => (
          <li>{book}</li>
        ))}
      </ol>
    </main>
  );
}
