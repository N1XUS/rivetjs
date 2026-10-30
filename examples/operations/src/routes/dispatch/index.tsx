import { load, type RequestEvent, type PageProps } from "@rivetjs/router";
import { For } from "@rivetjs/runtime/dom";
import { articlePage } from "../../server/service.server.ts";
import { SiteNav } from "../../sites/SiteNav.tsx";
export const loader = load((e: RequestEvent) =>
  articlePage({
    q: e.url.searchParams.get("q") ?? "",
    category: e.url.searchParams.get("category") ?? "All",
    page: Number(e.url.searchParams.get("page") ?? "1"),
  }),
);
export const head = { title: "Dispatch · Notes on dependable products", meta: [{ name: "description", content: "Ideas for teams building useful things." }] };
export default function Dispatch({ data }: PageProps<typeof loader>) {
  return (
    <>
      <SiteNav />
      <main class="dispatch">
        <header class="dispatch-hero">
          <p class="eyebrow">THE FIELDWORK DISPATCH</p>
          <h1>
            Ideas worth
            <br />
            taking to work.
          </h1>
          <p>Field notes on design, security, and the craft of building things that last.</p>
        </header>
        <form method="get" class="filter-bar">
          <label>
            Search the journal
            <input id="article-search" name="q" value={data.q} />
          </label>
          <label>
            Topic
            <select id="article-category" name="category" value={data.category}>
              <option>All</option>
              <option>Security</option>
              <option>Design</option>
              <option>Engineering</option>
            </select>
          </label>
          <button id="article-filter">Search</button>
        </form>
        <p id="article-count">{data.total} stories</p>
        <div class="article-grid">
          <For each={data.items} by={(a) => a.slug}>
            {(a) => (
              <article class="article-card">
                <p class="eyebrow">{a().category}</p>
                <h2>
                  <a href={"/dispatch/" + a().slug}>{a().title}</a>
                </h2>
                <p>{a().excerpt}</p>
                <a href={"/dispatch/" + a().slug} class="read-story">
                  Read story
                </a>
              </article>
            )}
          </For>
        </div>
        <nav class="pagination" aria-label="Journal pages">
          <span id="article-page">
            Page {data.page} of {data.pages}
          </span>
          {data.page > 1 ? (
            <a id="article-prev" href={`/dispatch?page=${data.page - 1}&q=${encodeURIComponent(data.q)}&category=${encodeURIComponent(data.category)}`}>
              Previous
            </a>
          ) : null}
          {data.page < data.pages ? (
            <a id="article-next" href={`/dispatch?page=${data.page + 1}&q=${encodeURIComponent(data.q)}&category=${encodeURIComponent(data.category)}`}>
              Next page
            </a>
          ) : null}
        </nav>
      </main>
    </>
  );
}
