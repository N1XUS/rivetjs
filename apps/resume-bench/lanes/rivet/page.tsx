import { signal } from "@rivetjs/reactivity";
import { For, Router, defineRoute, lazyComponent, clientEffect, clientEvent } from "@rivetjs/runtime/dom";

export interface Item {
  id: number;
  label: string;
}
type Follow = (event: MouseEvent, href: string) => void;

const Detail = lazyComponent(() => import("./detail.js"), undefined, { fallback: () => <p>loading…</p> });

/** Bench page (see ../../FIXTURE.md). Rendered on the server, resumed in the browser. */
export function Page({ items, router }: { items: Item[]; router: any }) {
  const count = signal(0);
  const open = signal(false);
  const query = signal("");
  const picked = signal(0);
  const scrolled = signal(false);
  let canvas!: HTMLCanvasElement;
  clientEvent(window, "scroll", () => scrolled.set(scrollY > 100));
  clientEffect(
    () => {
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#0f766e";
      for (let i = 0; i < 10; i++) ctx.fillRect(i * 30, 150 - items[i].id * 10, 24, items[i].id * 10);
      canvas.dataset.drawn = "1";
    },
    { when: "visible" },
  );
  clientEffect(
    () => {
      router.location();
      ((window as any).__analytics ??= []).push(["pageview", location.pathname]);
    },
    { when: "idle" },
  );
  const follow: Follow = (event, href) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    router.navigate(href);
  };
  const routes = [
    defineRoute("/", { render: () => <List items={items} query={query} picked={picked} follow={follow} /> }),
    defineRoute("/item/:id", {
      load: (_work: unknown, match: any) => items.find((item) => String(item.id) === match.params.id) ?? null,
      render: (item: Item | null) => (item ? <Detail item={item} follow={follow} /> : <p id="missing">missing</p>),
    }),
  ];
  return (
    <main>
      <header id="bar">
        <button id="inc" onClick={() => count.update((value) => value + 1)}>
          +
        </button>
        <output id="count">{count()}</output>
        <span id="scrolled">{scrolled() ? "scrolled" : "top"}</span>
      </header>
      <button id="toggle" onClick={() => open.update((value) => !value)}>
        toggle
      </button>
      <div id="panel">
        {open() ? (
          <p id="open">
            open <b>{count()}</b>
          </p>
        ) : (
          <p id="closed">closed</p>
        )}
      </div>
      <Router router={router} routes={routes} fallback={() => <p>loading…</p>} notFound={() => <p>not found</p>} />
      <canvas id="chart" width={300} height={150} ref={(el) => (canvas = el)} />
    </main>
  );
}

function List({ items, query, picked, follow }: { items: Item[]; query: any; picked: any; follow: Follow }) {
  return (
    <section>
      <input id="filter" type="search" model:value={query} />
      <ul id="rows">
        <For
          each={() => {
            // Same filter in every lane (FIXTURE.md): query read + lowercased once, the original array for an empty query.
            const q = query().toLowerCase();
            return q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items;
          }}
          by={(item: Item) => item.id}
        >
          {(item: () => Item) => (
            <li class={picked() === item().id ? "row sel" : "row"} data-id={item().id}>
              <a class="open" href={"/item/" + item().id} onClick={(event) => follow(event, "/item/" + item().id)}>
                {item().label}
              </a>
              <button class="pick" onClick={() => picked.set(item().id)}>
                pick
              </button>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
