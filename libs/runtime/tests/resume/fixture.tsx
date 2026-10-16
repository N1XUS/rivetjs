import { signal, computed, createContext } from "@rivetjs/reactivity";
import { clientEffect, clientEvent, For, clientOnly, Router, defineRoute } from "@rivetjs/runtime/server";

const items = ["alpha", "beta", "gamma"];
const ran = () => ((globalThis as any).__componentRuns = ((globalThis as any).__componentRuns ?? 0) + 1);

export function Counter() {
  ran();
  const count = signal(0);
  return (
    <main>
      <button id="inc" class={count() > 0 ? "on" : "off"} onClick={() => count.update((v) => v + 1)}>
        +
      </button>
      <output id="count">{count()}</output>
      <form id="form" action="/submitted" onSubmit={(event) => count.update((v) => v + (event.defaultPrevented ? 1 : 100))}>
        <button id="send">send</button>
      </form>
    </main>
  );
}

export function App() {
  ran();
  const count = signal(0);
  const query = signal("");
  const matches = computed(() => items.filter((item) => item.includes(query())).length);
  const size = signal(0);
  const keys = signal("");
  let canvas;
  clientEffect(() => {
    canvas.dataset.drawn = String(count());
  });
  clientEvent(window, "resize", () => size.update((v) => v + 1));
  return (
    <main>
      <button id="inc" onClick={() => count.update((v) => v + 1)}>+</button>
      <output id="count">{count()}</output>
      <input id="filter" type="search" model:value={query} />
      <p id="matches">{matches()}</p>
      <p id="size">{size()}</p>
      <p id="keys" window:onKeyDown={(event: KeyboardEvent) => keys.update((k) => k + event.key)}>
        {keys()}
      </p>
      <a id="stay" href="/never" onClick={(event: MouseEvent) => event.preventDefault()}>
        stay
      </a>
      <a id="link" href="/next" onClick={() => count.update((v) => v + 10)}>
        next
      </a>
      <canvas id="canvas" ref={(el) => (canvas = el)} />
    </main>
  );
}

const Widget = clientOnly(() => import("/widget.mjs"), undefined, {
  fallback: () => <i id="widget">fallback</i>,
});
export const Store = createContext<{ name: string } | null>(null, { id: "store" });

function Panel({ label, close }: { label: string; close: () => void }) {
  ran();
  return (
    <div id="panel">
      <b>{label}</b>
      <button id="close" onClick={close}>
        x
      </button>
    </div>
  );
}

export function Regions({ items, router }: { items: string[]; router: any }) {
  ran();
  const open = signal(false);
  const query = signal("");
  const picked = signal("");
  const close = () => open.set(false);
  const routes = [
    defineRoute("/regions", { render: () => <p id="route">home</p> }),
    defineRoute("/regions/:id", {
      load: (work: any, match: any) => work.get(Store).name + ":" + match.params.id,
      render: (data: string) => <p id="route">{data}</p>,
    }),
  ];
  return (
    <main>
      <button id="toggle" onClick={() => open.update((v) => !v)}>
        toggle
      </button>
      <section id="slot">{open() ? <Panel label="opened" close={close} /> : <p id="closed">closed</p>}</section>
      <input id="q" type="search" model:value={query} />
      <ul id="list">
        <For each={() => items.filter((item) => item.includes(query()))} by={(item: string) => item}>
          {(item: () => string) => (
            <li>
              <button class={picked() === item() ? "pick on" : "pick"} onClick={() => picked.set(item())}>
                {item()}
              </button>
            </li>
          )}
        </For>
      </ul>
      <output id="picked">{picked()}</output>
      <a
        id="go"
        href="/regions/7"
        onClick={(event: MouseEvent) => {
          event.preventDefault();
          router.navigate?.("/regions/7");
        }}
      >
        go
      </a>
      <div id="routes">
        <Router router={router} routes={routes} />
      </div>
      <footer>
        <Widget />
      </footer>
    </main>
  );
}

const sameId = (a: { id: number }, b: { id: number }) => a.id === b.id;
export function Equality() {
  const item = signal({ id: 1, n: 0 }, { equals: sameId });
  const box = { n: 0 };
  const tick = signal(box, { equals: false });
  const bucket = computed(() => Math.floor(item().n / 10), { equals: (a, b) => a === b });
  return (
    <main>
      <button id="same" onClick={() => item.set({ id: 1, n: 5 })}>same</button>
      <button id="next" onClick={() => item.set({ id: 2, n: 25 })}>next</button>
      <button id="tick" onClick={() => ((box.n += 1), tick.set(box))}>tick</button>
      <output id="n">{item().n}</output>
      <output id="bucket">{bucket()}</output>
      <output id="ticks">{tick().n}</output>
    </main>
  );
}

// Document-level link interception (a router's): its handler chunk may still be loading when a link is clicked.
export function Intercept() {
  const routed = signal("");
  clientEvent(document, "click", (event: MouseEvent) => {
    const anchor = (event.target as Element).closest("a");
    if (!anchor || anchor.id !== "routed-link") return;
    event.preventDefault();
    routed.set(new URL(anchor.href).pathname);
  });
  // A second cold listener of the same click (analytics-like): shares the hold, never cancels.
  const clicks = signal(0);
  clientEvent(document, "click", () => clicks.update((n) => n + 1));
  // Document-level form enhancement: cancels #routed-form, leaves the others to the browser.
  clientEvent(document, "submit", (event: SubmitEvent) => {
    if ((event.target as Element).id !== "routed-form") return;
    event.preventDefault();
    routed.set("form");
  });
  // A second cold submit listener: shares the hold; reports each run (a re-entered resubmit would run it twice).
  const submits = signal(0);
  clientEvent(document, "submit", (event: SubmitEvent) => {
    submits.update((n) => n + 1);
    (globalThis as any).report?.(["submit", (event.target as Element).id]);
  });
  return (
    <main>
      <a id="routed-link" href="/never">
        routed
      </a>
      <a id="plain-link" href="/next">
        plain
      </a>
      <output id="routed">{routed()}</output>
      <output id="clicks">{clicks()}</output>
      <form id="routed-form" action="/never">
        <button id="routed-send">send</button>
      </form>
      <form id="plain-form" action="/never">
        <input name="q" value="x" />
        <button id="plain-send" name="b" value="v" formaction="/submitted" formmethod="post">
          send
        </button>
      </form>
      <iframe name="side"></iframe>
      <form id="side-form" action="/next" target="side">
        <button id="side-send">send</button>
      </form>
      <output id="submits">{submits()}</output>
    </main>
  );
}

// A const derived through a function that returns state, with a callback argument (cdk
// `createSelectState({ onSelectionChange: (key) => … })` pattern).
const makeBox = (options: { start: number; onChange: (n: number) => void }) => ({ n: signal(options.start), label: "box", onChange: options.onChange });

export function Shared() {
  ran();
  const changes = signal(0);
  const box = makeBox({ start: 5, onChange: () => changes.update((v) => v + 1) });
  return (
    <main>
      <button id="shared" onClick={() => (box.n.update((v) => v + 1), box.onChange(box.n()))}>
        {box.label}
      </button>
      <output id="shared-n">{box.n()}</output>
      <output id="shared-changes">{changes()}</output>
    </main>
  );
}

/** Resumed handlers of one event type on nested elements run in bubbling order; stopPropagation stops them. */
export function Bubbling() {
  ran();
  const log = signal("");
  const add = (entry: string) => log.update((v) => (v ? v + " " : "") + entry);
  return (
    <main onClick={() => add("main")} onPointerEnter={() => add("main-enter")}>
      <div onClick={() => add("div")}>
        <button id="bubble-inner" onClick={() => add("button")}>
          <b>inner</b>
        </button>
        <button id="bubble-stop" onClick={(event) => (add("stop"), event.stopPropagation())}>
          stop
        </button>
      </div>
      <output id="bubble-log">{log()}</output>
    </main>
  );
}
