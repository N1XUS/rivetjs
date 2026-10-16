import type { PageProps, RequestEvent } from "@rivetjs/router";
import { listBooks } from "../books.server.ts"; // used only by server code: removed from the browser build

export const head = { title: "Books" };

// #region demo
// Server code in the page file: the compiler removes it from the browser build.
export async function serverLoad({ url }: RequestEvent) {
  const books = await listBooks();
  const query = (url.searchParams.get("q") ?? "").toLowerCase();
  return { books: books.filter((book) => book.title.toLowerCase().includes(query)), query };
}

// `/?format=json` answers with JSON before the page renders; otherwise the page renders.
export const onGet = async (event: RequestEvent) =>
  event.url.searchParams.get("format") === "json" ? Response.json(await serverLoad(event)) : undefined;

// `typeof serverLoad`: the data type comes from the loader, no hand-written type.
export default function Books({ data }: PageProps<typeof serverLoad>) {
  return (
    <main class="p-4">
      <h1 class="text-xl font-semibold">Books</h1>
      <form class="mt-2">
        <input name="q" value={data.query} class="rounded border px-2 py-1" aria-label="Search titles" />
        <button class="ml-2 rounded bg-teal-700 px-3 py-1 text-white">Search</button>
      </form>
      <ul class="mt-4 list-disc pl-5">
        {data.books.map((book) => (
          <li>
            {book.title} ({book.year})
          </li>
        ))}
      </ul>
      <a class="text-teal-700 underline" href="/?format=json" data-rivet-reload="">
        Same data as JSON
      </a>
    </main>
  );
}
// #endregion
