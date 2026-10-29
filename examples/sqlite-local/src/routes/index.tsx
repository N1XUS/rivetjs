import type { PageProps } from "@rivetjs/router";
import { Icon } from "@rivetjs/kit/icon";
import { Pencil, Plus, Search, Trash2 } from "lucide";

export const head = { title: "Bookmarks" };

/** Everything is a link or a form: it works with JavaScript off; the server answers each submit with a redirect. */
export default function Home({ data, url }: PageProps<"index">) {
  const q = url.searchParams.get("q") ?? "";
  const tag = url.searchParams.get("tag") ?? "";
  const more = new URLSearchParams(url.searchParams);
  more.delete("edit");
  more.delete("error");
  if (data.next) more.set("before", String(data.next));
  const keep = (extra: Record<string, string>) => "/?" + new URLSearchParams({ ...(q ? { q } : {}), ...extra }).toString();
  return (
    <main class="wrap">
      <h1>Bookmarks</h1>
      <p class="muted">{data.total} saved. SQLite file via node:sqlite.</p>
      {data.error ? (
        <p role="alert" class="error">
          {data.error}
        </p>
      ) : null}
      <form method="get" action="/" class="row" role="search">
        <label class="sr" for="q">
          Search
        </label>
        <input id="q" name="q" value={q} placeholder="Search title or URL" />
        {tag ? <input type="hidden" name="tag" value={tag} /> : null}
        <button>
          <Icon icon={Search} /> Search
        </button>
      </form>
      <nav class="tags" aria-label="Tags">
        <a href={keep({})} aria-current={tag ? undefined : "true"}>
          all
        </a>
        {data.tags.map((t) => (
          <a href={keep({ tag: t })} aria-current={tag === t ? "true" : undefined}>
            {t}
          </a>
        ))}
      </nav>
      <ul class="list">
        {data.items.map((b) =>
          data.editing && data.editing.id === b.id ? (
            <li>
              <form method="post" action="?/update" class="grid">
                <input type="hidden" name="id" value={String(b.id)} />
                <input name="title" value={b.title} aria-label="Title" required />
                <input name="url" value={b.url} aria-label="URL" required />
                <input name="tags" value={b.tags.join(" ")} aria-label="Tags" />
                <span class="row">
                  <button>Save</button>
                  <a href={keep(tag ? { tag } : {})}>Cancel</a>
                </span>
              </form>
            </li>
          ) : (
            <li class="item">
              <div>
                <a href={b.url} rel="noopener noreferrer">
                  {b.title}
                </a>
                <div class="muted">
                  {b.url}{" "}
                  {b.tags.map((t) => (
                    <span class="chip">{t}</span>
                  ))}
                </div>
              </div>
              <span class="row">
                <a href={keep({ ...(tag ? { tag } : {}), edit: String(b.id) })} aria-label={"Edit " + b.title}>
                  <Icon icon={Pencil} />
                </a>
                <form method="post" action="?/remove">
                  <input type="hidden" name="id" value={String(b.id)} />
                  <button aria-label={"Delete " + b.title}>
                    <Icon icon={Trash2} />
                  </button>
                </form>
              </span>
            </li>
          ),
        )}
      </ul>
      {data.items.length === 0 ? <p class="muted">No bookmarks match.</p> : null}
      {data.next ? (
        <a class="more" href={"/?" + more.toString()} rel="next">
          Older
        </a>
      ) : null}
      <h2>Add</h2>
      <form method="post" action="?/create" class="grid">
        <input name="title" placeholder="Title" aria-label="Title" required />
        <input name="url" placeholder="https://" aria-label="URL" required />
        <input name="tags" placeholder="tags, separated by spaces" aria-label="Tags" />
        <button>
          <Icon icon={Plus} /> Add
        </button>
      </form>
      <p class="muted">
        <a href="/api/export.json">Export JSON</a>. Import: POST a JSON array to /api/import.
      </p>
    </main>
  );
}
