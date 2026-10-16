import { redirect, type DataOf, type PageProps, type RequestEvent } from "@rivetjs/router";

// Stand-in for a database table.
const books = Array.from({ length: 47 }, (_, i) => ({ id: i + 1, title: `Book ${i + 1}` }));
const PER_PAGE = 10;

// #region demo
/** Runs on the server for every request, also for client navigation between pages. */
export const serverLoad = ({ url }: RequestEvent) => {
  const pages = Math.max(1, Math.ceil(books.length / PER_PAGE));
  const raw = url.searchParams.get("page") ?? "1";
  const page = Number(raw);
  // "?page=abc", "?page=0" or "?page=99": send the visitor to a page that exists.
  if (!Number.isInteger(page) || page < 1 || page > pages) throw redirect(`/?page=${Math.min(Math.max(1, Math.trunc(page) || 1), pages)}`);
  const start = (page - 1) * PER_PAGE;
  // Return only this page's rows: that is all the browser receives.
  return { items: books.slice(start, start + PER_PAGE), page, pages, total: books.length };
};

// The page number is part of the title, so each page has its own history entry name.
export const head = ({ data }: { data: DataOf<typeof serverLoad> }) => ({ title: `Books, page ${data.page} of ${data.pages}` });

export default function Books({ data }: PageProps<typeof serverLoad>) {
  const { items, page, pages, total } = data;
  return (
    <main class="mx-auto max-w-xl p-6">
      <h1 class="text-2xl font-bold">Books</h1>
      <p id="status" class="mt-2 text-sm text-slate-600">
        Page {page} of {pages} ({total} books)
      </p>
      <ol id="items" class="mt-4 list-decimal pl-6" start={(page - 1) * 10 + 1}>
        {items.map((book) => (
          <li>{book.title}</li>
        ))}
      </ol>
      {/* Plain links: they work without JavaScript; with it, Rivet navigates without a full reload. */}
      <nav aria-label="Pages" class="mt-6 flex gap-2">
        {page > 1 ? (
          <a id="prev" class="rounded-md border px-3 py-1" href={`?page=${page - 1}`} rel="prev">
            Previous
          </a>
        ) : null}
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <a class="rounded-md border px-3 py-1" href={`?page=${n}`} aria-current={n === page ? "page" : undefined}>
            {n}
          </a>
        ))}
        {page < pages ? (
          <a id="next" class="rounded-md border px-3 py-1" href={`?page=${page + 1}`} rel="next">
            Next
          </a>
        ) : null}
      </nav>
    </main>
  );
}
// #endregion
