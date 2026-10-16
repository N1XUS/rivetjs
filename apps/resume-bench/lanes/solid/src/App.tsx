import { createEffect, createMemo, createSignal, For, lazy, Loading, onSettled, Show } from "solid-js";
import { isServer } from "@solidjs/web";
import { loadItems, type Item } from "./items";

const Detail = lazy(() => import("./Detail"));

/** Bench page (see ../../../FIXTURE.md). SSR'd, then hydrated. */
export function App() {
  const items = createMemo(loadItems, { deferStream: true });
  const [count, setCount] = createSignal(0);
  const [open, setOpen] = createSignal(false);
  const [scrolled, setScrolled] = createSignal(false);
  const [filter, setFilter] = createSignal("");
  const [selected, setSelected] = createSignal(0);
  const [path, setPath] = createSignal(isServer ? "/" : location.pathname);

  const detailId = createMemo(() => {
    const m = /^\/item\/(\d+)$/.exec(path());
    return m ? Number(m[1]) : 0;
  });
  const filtered = createMemo(() => {
    const q = filter().toLowerCase();
    const all = items();
    return q ? all.filter((item) => item.label.toLowerCase().includes(q)) : all;
  });

  const navigate = (e: MouseEvent, href: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    history.pushState(null, "", href);
    setPath(href);
  };

  let canvas!: HTMLCanvasElement;

  onSettled(() => {
    const onPop = () => setPath(location.pathname);
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("popstate", onPop);
    window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      io.disconnect();
      const ctx = canvas.getContext("2d")!;
      const first = items().slice(0, 10);
      ctx.fillStyle = "#2c4f7c";
      first.forEach((item, i) => ctx.fillRect(i * 30, 150 - item.id * 10, 24, item.id * 10));
      canvas.dataset.drawn = "1";
    });
    io.observe(canvas);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  });

  // gtag-style pageview at idle: once after hydration, again on each client navigation.
  createEffect(path, () => {
    requestIdleCallback(() => ((window as any).__analytics ??= []).push(["pageview", location.pathname]));
  });

  return (
    <main>
      <header id="bar" style="position:sticky;top:0;background:#fff">
        <button id="inc" onClick={() => setCount((c) => c + 1)}>
          +
        </button>
        <output id="count">{count()}</output>
        <span id="scrolled">{scrolled() ? "scrolled" : "top"}</span>
      </header>
      <button id="toggle" onClick={() => setOpen((o) => !o)}>
        toggle
      </button>
      <div id="panel">
        <Show when={open()} fallback={<p id="closed">closed</p>}>
          <p id="open">
            open <b>{count()}</b>
          </p>
        </Show>
      </div>
      <Loading fallback={<p>loading…</p>}>
        <Show
          when={detailId()}
          fallback={
            <section>
              <input id="filter" type="search" value={filter()} onInput={(e) => setFilter(e.currentTarget.value)} />
              <ul id="rows">
                <For each={filtered()}>
                  {(item: Item) => (
                    <li class={["row", { sel: selected() === item.id }]} data-id={item.id}>
                      <a class="open" href={"/item/" + item.id} onClick={(e) => navigate(e, "/item/" + item.id)}>
                        {item.label}
                      </a>
                      <button class="pick" onClick={() => setSelected(item.id)}>
                        pick
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          }
        >
          {(id) => <Detail item={items().find((item) => item.id === id())} onNavigate={navigate} />}
        </Show>
      </Loading>
      <canvas id="chart" width="300" height="150" ref={canvas} />
    </main>
  );
}
