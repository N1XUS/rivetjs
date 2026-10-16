// Search dialog: mounted in the browser on first use (dynamic import from SearchButton), queries the
// Pagefind index (built over the prerendered site; on the dev server, an in-memory index of the dev pages). A cdk Modal on the div overlay layer (focus trap,
// Escape, outside press, scroll lock, focus restore). Excerpts are split on <mark> into JSX nodes, so
// no HTML string is ever parsed into the page.
import { Dialog } from "@rivetjs/cdk/dialog";
import { Modal, ModalOverlay } from "@rivetjs/cdk/modal";
import { effect, signal } from "@rivetjs/reactivity";
import { For, mount } from "@rivetjs/runtime/dom";

interface Hit {
  url: string;
  title: string;
  section: string;
  excerpt: (string | { mark: string })[];
}
interface PagefindResult {
  data(): Promise<{ url: string; excerpt: string; meta: { title?: string }; filters: Record<string, string[]> }>;
}
interface Pagefind {
  options(options: Record<string, unknown>): Promise<void>;
  debouncedSearch(query: string, options?: Record<string, unknown>, ms?: number): Promise<{ results: PagefindResult[] } | null>;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };
const decode = (value: string) => value.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (entity) => ENTITIES[entity]!);

/** Split a Pagefind excerpt (escaped text with <mark>…</mark>) into text and marked parts. */
export function excerptParts(excerpt: string): Hit["excerpt"] {
  const out: Hit["excerpt"] = [];
  const pieces = excerpt.split(/<mark>|<\/mark>/);
  pieces.forEach((piece, index) => {
    if (!piece) return;
    out.push(index % 2 ? { mark: decode(piece) } : decode(piece));
  });
  return out;
}

/** Pagefind's entry: written by `docs-kit build`, served from memory by the dev server (`tools/dev-search.ts`). */
const PAGEFIND = "/pagefind/pagefind.js";
let pagefind: Promise<Pagefind> | undefined;
const loadPagefind = (): Promise<Pagefind> =>
  (pagefind ??= (import(/* @vite-ignore */ new URL(PAGEFIND, location.href).href) as Promise<Pagefind>).then(
    async (module) => {
      await module.options({ excerptLength: 24 });
      return module;
    },
    (error: unknown) => {
      pagefind = undefined; // retry on the next query (e.g. after a failed dev index build)
      throw error;
    },
  ));

/** What failed: the index answer (status + the dev server's plain-text reason), else the error itself. */
async function failure(error: unknown): Promise<string> {
  try {
    const response = await fetch(new URL(PAGEFIND, location.href), { cache: "no-store" });
    if (!response.ok) {
      const reason = response.headers.get("content-type")?.startsWith("text/plain") ? (await response.text()).trim().slice(0, 300) : "";
      return `Search index unavailable: ${PAGEFIND} answered ${response.status}${reason ? ` (${reason})` : ""}.`;
    }
  } catch {
    return "Search index unavailable: the server did not answer.";
  }
  return `Search failed: ${error instanceof Error ? error.message : String(error)}`;
}

/** Whether the dialog is open (two-way with the cdk ModalOverlay: Escape / outside press close it). */
const open = signal(false);
let mounted = false;

function SearchDialog({ initial }: { initial: string }) {
  const query = signal(initial);
  const hits = signal<Hit[]>([]);
  const active = signal(0);
  const status = signal("Type to search the docs.");
  effect(() => {
    const value = query().trim();
    if (!value) {
      hits.set([]);
      status.set("Type to search the docs.");
      return;
    }
    status.set("Searching…");
    loadPagefind()
      .then((engine) => engine.debouncedSearch(value, {}, 150))
      .then(async (search) => {
        if (!search) return; // superseded by a newer query
        const data = await Promise.all(search.results.slice(0, 10).map((result) => result.data()));
        hits.set(
          data.map((entry) => ({
            url: entry.url.replace(/index\.html$/, ""),
            title: entry.meta.title ?? entry.url,
            section: entry.filters.section?.[0] ?? "",
            excerpt: excerptParts(entry.excerpt),
          })),
        );
        active.set(0);
        status.set(data.length ? `${data.length} result${data.length === 1 ? "" : "s"}` : "No results.");
      })
      .catch(async (error: unknown) => status.set(await failure(error)));
  });
  const go = (index: number) => {
    const hit = hits()[index];
    if (hit) location.assign(hit.url);
  };
  const onKey = (event: KeyboardEvent) => {
    const count = hits().length;
    if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      active.set((active() + 1) % count);
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      active.set((active() - 1 + count) % count);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(active());
    }
  };
  return (
    <ModalOverlay isDismissable isOpen={open} class="search-overlay">
      <Modal class="search-modal">
        <Dialog class="search-dialog" aria-label="Search the documentation">
          <div class="search-box">
            <input
              autoFocus
              type="search"
              placeholder="Search the docs"
              aria-label="Search the docs"
              role="combobox"
              aria-expanded={hits().length > 0}
              aria-controls="search-results"
              aria-activedescendant={hits().length ? "search-hit-" + active() : ""}
              autoComplete="off"
              model:value={query}
              onKeyDown={onKey}
            />
            <button type="button" class="search-close" onClick={() => open.set(false)} aria-label="Close search">
              Esc
            </button>
          </div>
          <p class="search-status" role="status">
            {status()}
          </p>
          <ul id="search-results" role="listbox" aria-label="Results" class="search-results">
            <For each={hits} by={(hit) => hit.url}>
              {(hit, index) => (
                <li id={"search-hit-" + index()} role="option" aria-selected={index() === active()}>
                  <a href={hit().url} onClick={() => open.set(false)}>
                    <span class="search-hit-title">{hit().title}</span>
                    <span class="search-hit-section">{hit().section}</span>
                    <span class="search-hit-excerpt">{hit().excerpt.map((part) => (typeof part === "string" ? part : <mark>{part.mark}</mark>))}</span>
                  </a>
                </li>
              )}
            </For>
          </ul>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Open the search dialog (mounted once; its content is re-created on each open, the query is kept). */
export function openSearch(initial = ""): void {
  if (!mounted) {
    mounted = true;
    const host = document.createElement("div");
    document.body.append(host);
    mount(() => <SearchDialog initial={initial} />, host);
  }
  open.set(true);
  // The Dialog focuses the `autofocus` input from a client effect; select its text after that.
  requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".search-box input")?.select());
}
