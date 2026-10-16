import {
  $,
  component$,
  sync$,
  useOnWindow,
  useSignal,
  useVisibleTask$,
  type QRL,
  type Signal,
} from '@qwik.dev/core';
import { Detail } from './detail';

export interface Item {
  id: number;
  label: string;
}

declare global {
  interface Window {
    __analytics?: unknown[];
  }
}

/** Synchronously cancels the browser navigation only for plain left clicks. */
const plainClick = sync$((e: MouseEvent) => {
  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) e.preventDefault();
});

export const App = component$<{ items: Item[] }>(({ items }) => {
  const count = useSignal(0);
  const open = useSignal(false);
  const scrolled = useSignal(false);
  const path = useSignal('/');
  const filter = useSignal('');
  const selected = useSignal(0);

  useOnWindow(
    'scroll',
    $(() => {
      scrolled.value = window.scrollY > 100;
    }),
    { passive: true }
  );
  useOnWindow(
    'popstate',
    $(() => {
      path.value = location.pathname;
    })
  );

  // gtag-style analytics: at idle, and again on every client navigation.
  useVisibleTask$(
    ({ track }) => {
      track(path);
      (window.__analytics ??= []).push(['pageview', location.pathname]);
    },
    { strategy: 'document-idle' }
  );

  const navigate = $((href: string) => {
    history.pushState(null, '', href);
    path.value = href;
  });

  const m = /^\/item\/(\d+)$/.exec(path.value);
  const item = m ? items.find((it) => it.id === Number(m[1])) : undefined;

  return (
    <>
      <header id="bar" style="position:sticky;top:0;background:#fff">
        <button id="inc" onClick$={() => count.value++}>
          +
        </button>
        <output id="count">{count.value}</output>
        <span id="scrolled">{scrolled.value ? 'scrolled' : 'top'}</span>
      </header>
      <button id="toggle" onClick$={() => (open.value = !open.value)}>
        toggle
      </button>
      <div id="panel">
        {open.value ? (
          <p id="open">
            open <b>{count.value}</b>
          </p>
        ) : (
          <p id="closed">closed</p>
        )}
      </div>
      {item ? (
        <Detail label={item.label} navigate={navigate} />
      ) : (
        <List items={items} filter={filter} selected={selected} navigate={navigate} />
      )}
      <Chart items={items} />
    </>
  );
});

export const List = component$<{
  items: Item[];
  filter: Signal<string>;
  selected: Signal<number>;
  navigate: QRL<(href: string) => void>;
}>(({ items, filter, selected, navigate }) => {
  const q = filter.value.toLowerCase();
  return (
    <>
      <input id="filter" type="search" bind:value={filter} />
      <ul id="rows">
        {(q ? items.filter((it) => it.label.toLowerCase().includes(q)) : items).map((it) => (
            <li key={it.id} class={selected.value === it.id ? 'row sel' : 'row'} data-id={it.id}>
              <a
                class="open"
                href={`/item/${it.id}`}
                onClick$={[
                  plainClick,
                  $((e: MouseEvent, el: HTMLAnchorElement) => {
                    if (e.defaultPrevented) navigate(el.getAttribute('href')!);
                  }),
                ]}
              >
                {it.label}
              </a>
              <button class="pick" onClick$={() => (selected.value = it.id)}>
                pick
              </button>
            </li>
          ))}
      </ul>
    </>
  );
});

export const Chart = component$<{ items: Item[] }>(({ items }) => {
  const canvas = useSignal<HTMLCanvasElement>();
  // Browser-only, runs when the canvas scrolls into view (default intersection-observer strategy).
  useVisibleTask$(() => {
    const el = canvas.value!;
    const ctx = el.getContext('2d')!;
    const first = items.slice(0, 10);
    const w = el.width / first.length;
    ctx.fillStyle = '#4a7';
    first.forEach((it, i) => {
      const h = ((it.id % 10) + 1) * (el.height / 10);
      ctx.fillRect(i * w + 2, el.height - h, w - 4, h);
    });
    el.setAttribute('data-drawn', '1');
  });
  return <canvas id="chart" ref={canvas} width={300} height={150} />;
});
