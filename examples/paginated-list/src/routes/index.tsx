import { For } from "@rivetjs/runtime/dom";
import { navigate } from "@rivetjs/router/client";
import { load, redirect, type DataOf, type LivePageProps, type RequestEvent } from "@rivetjs/router";
import { Icon } from "@rivetjs/kit/icon";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Ellipsis, Search } from "lucide";
import { pageOf, type Dir, type Query, type Sort } from "../server/books.server.ts";

const SORTS: readonly Sort[] = ["title", "author", "year", "rating"];
const SIZES = [10, 20, 50] as const;
const DEFAULTS: Query = { q: "", sort: "title", dir: "asc", page: 1, per: 10 };

/** The address of the same list with some parameters changed; defaults are left out, so URLs stay short. */
function hrefFor(query: Query, patch: Partial<Query>): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  for (const key of ["q", "sort", "dir", "per", "page"] as const) if (next[key] !== DEFAULTS[key]) params.set(key, String(next[key]));
  const text = params.toString();
  return text ? `?${text}` : "?";
}

/** Page links to show: first, last, two around the current one, gaps in between (constant length: no layout jump). */
function pageItems(page: number, pages: number): (number | "gap-start" | "gap-end")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "gap-end", pages];
  if (page >= pages - 3) return [1, "gap-start", pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, "gap-start", page - 1, page, page + 1, "gap-end", pages];
}

// #region loader
/** Runs on the server for every request, also when a link changes only the search parameters. */
export const loader = load(({ url }: RequestEvent) => {
  const read = url.searchParams;
  const sort = (SORTS as readonly string[]).includes(read.get("sort") ?? "") ? (read.get("sort") as Sort) : DEFAULTS.sort;
  const dir: Dir = read.get("dir") === "desc" ? "desc" : "asc";
  const per = SIZES.find((n) => String(n) === read.get("per")) ?? DEFAULTS.per;
  const q = (read.get("q") ?? "").slice(0, 80);
  const raw = Number(read.get("page") ?? "1");
  const query: Query = { q, sort, dir, per, page: Number.isInteger(raw) && raw >= 1 ? raw : 1 };
  const { items, total, pages } = pageOf(query);
  // "?page=abc", "?page=0" or past the end: send the visitor to a page that exists (one canonical URL per page).
  if (String(query.page) !== (read.get("page") ?? "1") || query.page > pages) {
    const fixed = hrefFor(query, { page: Math.min(query.page, pages) });
    if (fixed !== `?${read.toString()}`) throw redirect(`/${fixed}`);
  }
  return { query, items, total, pages };
});
// #endregion

export const head = ({ data }: { data: DataOf<typeof loader> }) => ({
  title: data.query.q ? `“${data.query.q}”: page ${data.query.page} of ${data.pages}` : `Books, page ${data.query.page} of ${data.pages}`,
});

// A live page: following a link to the same page with other search parameters updates `data` in place
// (rows keyed by id stay, focus and scroll stay) instead of rendering the page again.
export const live = true;

export default function Books({ data }: LivePageProps<typeof loader>) {
  return (
    <main class="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-10">
      <header class="flex flex-wrap items-end gap-4">
        <div class="mr-auto">
          <h1 class="text-2xl font-semibold">Books</h1>
          <p id="summary" class="text-sm text-muted">
            {data().total === 0
              ? "No books match."
              : `Showing ${(data().query.page - 1) * data().query.per + 1}–${Math.min(data().query.page * data().query.per, data().total)} of ${data().total}`}
          </p>
        </div>
        {/* A plain GET form: it works without JavaScript; with it, navigate() updates the list in place. The page number resets. */}
        <form
          method="get"
          action="/"
          role="search"
          class="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const q = String(new FormData(event.currentTarget as HTMLFormElement).get("q") ?? "").trim();
            void navigate(hrefFor(data().query, { q, page: 1 }));
          }}
        >
          <label for="q" class="sr-only">
            Search title or author
          </label>
          <input
            id="q"
            name="q"
            value={data().query.q}
            placeholder="Search title or author"
            class="h-9 w-56 rounded-field border border-border bg-field px-3 text-sm"
          />
          {data().query.sort !== DEFAULTS.sort ? <input type="hidden" name="sort" value={data().query.sort} /> : null}
          {data().query.dir !== DEFAULTS.dir ? <input type="hidden" name="dir" value={data().query.dir} /> : null}
          {data().query.per !== DEFAULTS.per ? <input type="hidden" name="per" value={String(data().query.per)} /> : null}
          <button class="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-3 text-sm font-medium text-accent-foreground">
            <Icon icon={Search} size={16} /> Search
          </button>
        </form>
      </header>

      <div class="overflow-x-auto rounded-2xl bg-surface shadow-surface">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-separator text-left text-muted">
              <For each={SORTS} by={(s) => s}>
                {(column) => (
                  <th
                    scope="col"
                    class="px-4 py-3 font-medium"
                    aria-sort={data().query.sort === column() ? (data().query.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {/* Sorting is a link too: the first click sorts ascending, the second flips it. */}
                    <a
                      class="inline-flex items-center gap-1 capitalize hover:text-foreground"
                      href={hrefFor(data().query, {
                        sort: column(),
                        dir: data().query.sort === column() && data().query.dir === "asc" ? "desc" : "asc",
                        page: 1,
                      })}
                    >
                      {column()}
                      {data().query.sort === column() ? <Icon icon={data().query.dir === "asc" ? ArrowUp : ArrowDown} size={14} /> : null}
                    </a>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody id="rows">
            <For each={data().items} by={(book) => book.id}>
              {(book) => (
                <tr class="border-b border-separator last:border-0">
                  <td class="px-4 py-2.5 font-medium">{book().title}</td>
                  <td class="px-4 py-2.5">{book().author}</td>
                  <td class="px-4 py-2.5 tabular-nums">{book().year}</td>
                  <td class="px-4 py-2.5 tabular-nums">{book().rating.toFixed(1)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <footer class="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Rows per page" class="flex items-center gap-1 text-sm text-muted">
          Rows:
          <For each={SIZES} by={(n) => n}>
            {(size) => (
              <a
                href={hrefFor(data().query, { per: size(), page: 1 })}
                aria-current={data().query.per === size() ? "true" : undefined}
                class="rounded-md px-2 py-0.5 hover:bg-default aria-[current]:bg-default aria-[current]:text-foreground"
              >
                {size()}
              </a>
            )}
          </For>
        </nav>

        {/* Plain links with the @rivetjs/ui Pagination look: they work without JavaScript; with it, Rivet navigates in place. */}
        <nav aria-label="Pages" class="pagination pagination--md sm:w-auto">
          <ul class="pagination__content flex-wrap">
            <li class="pagination__item">
              {data().query.page > 1 ? (
                <a id="prev" rel="prev" class="pagination__link pagination__link--nav" href={hrefFor(data().query, { page: data().query.page - 1 })}>
                  <Icon icon={ChevronLeft} size={16} /> Previous
                </a>
              ) : (
                <span class="pagination__link pagination__link--nav" aria-disabled="true" data-disabled="true">
                  <Icon icon={ChevronLeft} size={16} /> Previous
                </span>
              )}
            </li>
            <For each={pageItems(data().query.page, data().pages)} by={(item) => item}>
              {(item) => (
                <li class="pagination__item">
                  {typeof item() === "number" ? (
                    <a
                      class="pagination__link"
                      href={hrefFor(data().query, { page: item() as number })}
                      aria-current={item() === data().query.page ? "page" : undefined}
                      data-active={item() === data().query.page ? "true" : undefined}
                    >
                      {item()}
                    </a>
                  ) : (
                    <span class="pagination__ellipsis" aria-hidden="true">
                      <Icon icon={Ellipsis} size={16} />
                    </span>
                  )}
                </li>
              )}
            </For>
            <li class="pagination__item">
              {data().query.page < data().pages ? (
                <a id="next" rel="next" class="pagination__link pagination__link--nav" href={hrefFor(data().query, { page: data().query.page + 1 })}>
                  Next <Icon icon={ChevronRight} size={16} />
                </a>
              ) : (
                <span class="pagination__link pagination__link--nav" aria-disabled="true" data-disabled="true">
                  Next <Icon icon={ChevronRight} size={16} />
                </span>
              )}
            </li>
          </ul>
        </nav>
      </footer>
    </main>
  );
}
