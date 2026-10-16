import { signal } from "@rivetjs/reactivity";
import type { DataOf, PageProps } from "@rivetjs/router";

// #region demo
// Server code in the page file: the compiler removes `serverLoad` from the browser build.
// In this static example, it runs once, when the site is built.
export const serverLoad = async () => {
  // A real app would read a database or call an API here.
  const books = [
    { id: "1", title: "The Left Hand of Darkness", read: true },
    { id: "2", title: "Kindred", read: false },
    { id: "3", title: "Piranesi", read: false },
  ];
  return { books, updated: new Date("2026-10-01T12:00:00Z") };
};

// The page title can use the loader's data too.
export const head = ({ data }: { data: DataOf<typeof serverLoad> }) => ({ title: `${data.books.length} books` });

// `data` is whatever `serverLoad` returned; `typeof serverLoad` gives its type.
export default function Books({ data }: PageProps<typeof serverLoad>) {
  const onlyUnread = signal(false);
  return (
    <section class="p-4">
      <h1 class="text-xl font-semibold">Reading list</h1>
      <p id="updated" class="text-sm text-slate-600">
        Updated {data.updated.toISOString().slice(0, 10)}
      </p>
      <label class="mt-2 flex items-center gap-2">
        <input id="unread" type="checkbox" onChange={(event) => onlyUnread.set((event.target as HTMLInputElement).checked)} />
        Only unread
      </label>
      <p id="count" class="mt-2 text-sm">
        Showing {data.books.filter((book) => !onlyUnread() || !book.read).length} of {data.books.length}
      </p>
      <ul id="books" class="mt-2 list-disc pl-5">
        {data.books
          .filter((book) => !onlyUnread() || !book.read)
          .map((book) => (
            <li>{book.title}</li>
          ))}
      </ul>
    </section>
  );
}
// #endregion
