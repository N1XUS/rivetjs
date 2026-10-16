import { signal, createContext, useContext, provide, _regionState, type Signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/server";
import { resumableContext } from "@rivetjs/runtime/resume-format";

// Bug 1: a const derived through a function (`props.fn ?? default`) must keep the recipe of the
// function's creation site (the page's inline arrow), not re-register it under the field's symbol
// (whose captures include `props`, which holds the function: a cycle).
function Field(props: { hasError?: () => boolean; label: string }) {
  const shown = props.hasError ?? (() => false);
  return (
    <p id="err" hidden={!shown()}>
      {props.label}
    </p>
  );
}
// Bug 2: a local arrow passed as `items={filtered}`; the list reads it through `typeof === "function" ? items : () => items`.
function List(props: { items: string[] | (() => string[]) }) {
  const items = props.items;
  const each = typeof items === "function" ? items : () => items;
  return (
    <ul id="list">
      {each().map((item) => (
        <li>{item}</li>
      ))}
    </ul>
  );
}
export function Defaults() {
  const bad = signal(false);
  const query = signal("");
  const all = ["apple", "banana", "blueberry"];
  const filtered = () => all.filter((item) => item.includes(query()));
  return (
    <main>
      <button id="go" onClick={() => bad.set(true)}>
        go
      </button>
      <Field label="required" hasError={() => bad()} />
      <button id="b" onClick={() => query.set("b")}>
        b
      </button>
      <List items={filtered} />
      <output id="count">{filtered().length}</output>
    </main>
  );
}

// Bug 9a: `_regionState` locals holding a function of another chunk (the page's inline arrow) that
// no server-rendered handler captures; the region re-creates on its first change and adopts the
// state, so the arrow's symbol must be loadable from the region entry's chunk list.
function Standalone(props: { isOpen: () => boolean; onOpenChange: (open: boolean) => void }) {
  const state = _regionState(() => ({ isOpen: props.isOpen, onOpenChange: props.onOpenChange }));
  const open = state.isOpen();
  return (
    <section>
      <b id="st">{open ? "open" : "closed"}</b>
      {open ? (
        <button id="close" onClick={() => state.onOpenChange(false)}>
          close
        </button>
      ) : null}
    </section>
  );
}
export function Locals() {
  const log = signal("");
  const open = signal(false);
  return (
    <main>
      <button id="toggle" onClick={() => open.set(true)}>
        toggle
      </button>
      <Standalone isOpen={open} onOpenChange={(value) => log.set("changed:" + value)} />
      <output id="log">{log()}</output>
    </main>
  );
}

// Bug 10: a text binding whose read starts returning an element (JSX behind a call).
export function TextUpgrade() {
  const on = signal(false);
  const label = () => <b>bold</b>;
  const render = (v: boolean) => (v ? label() : "plain");
  return (
    <main>
      <button id="tu" onClick={() => on.update((v) => !v)}>
        t
      </button>
      <p id="p">{render(on())}</p>
    </main>
  );
}

// Bug 3: a spread handler bag from another chunk (slow to load) plus an explicit onInput on one
// element whose spread binding reads a signal the input handler writes: the cold keydown must not
// be lost when the spread binding activates (and takes the handler over) first.
function useKeys(keys: Signal<string>) {
  return { onKeyDown: (event: KeyboardEvent) => keys.update((v) => v + event.key) };
}
export function ColdKeys() {
  const keys = signal("");
  const text = signal("");
  const kb = useKeys(keys);
  return (
    <main>
      <input id="ck" {...kb} value={text()} onInput={(event) => text.set((event.target as HTMLInputElement).value)} />
      <output id="keys">{keys()}</output>
      <output id="text">{text()}</output>
    </main>
  );
}

// Bug 6: capture-phase handlers (spread `onXCapture`): an ancestor's capture handler runs before the
// target's bubbling handler, stopPropagation in it suppresses the bubbling one, and a non-bubbling
// `focus` still reaches an ancestor's capture handler.
export function Capture() {
  const log = signal("");
  const add = (entry: string) => log.update((v) => v + entry + ",");
  const outer = { onClickCapture: () => add("cap") };
  const stopper = { onClickCapture: (event: Event) => (add("stopcap"), event.stopPropagation()) };
  const focus = { onFocusCapture: () => add("fcap") };
  return (
    <main>
      <div id="outer" {...outer}>
        <button id="inner" onClick={() => add("bubble")}>
          x
        </button>
      </div>
      <div {...stopper}>
        <button id="stop" onClick={() => add("stopped-bubble")}>
          y
        </button>
      </div>
      <div {...focus}>
        <input id="f" />
      </div>
      <output id="log">{log()}</output>
    </main>
  );
}

// Bug 9c: an identified provider outside any region wraps a region; the re-created region must
// still read the provided value (the resume root has no providers).
const Theme = resumableContext(createContext("light", { id: "theme" }));
// Object value: must encode structurally (not as a `{x}` context reference the client would need
// from `createResume({ contexts })`).
const Locale = resumableContext(createContext({ locale: "en" }, { id: "locale" }));
// Registered on the server only: the client never loads a module registering it (nothing reads it).
const ServerOnly = createContext("none", { id: "server-only" });
if (typeof document === "undefined") resumableContext(ServerOnly);
function Themed(props: { n: () => number; id?: string }) {
  const theme = useContext(Theme);
  const { locale } = useContext(Locale);
  const n = props.n();
  return (
    <p id={props.id ?? "themed"}>
      {theme}/{locale}:{n}
    </p>
  );
}
export function Providers() {
  const n = signal(0);
  return (
    <main>
      <button id="inc" onClick={() => n.update((v) => v + 1)}>
        +
      </button>
      <Provider token={Theme} value="dark">
        <Provider token={Locale} value={{ locale: "de-DE" }}>
          <Provider token={ServerOnly} value="server">
            <div>
              <Themed n={n} />
            </div>
            {/* A second region under the same providers: one shared provider list (b[12] = its table index). */}
            <div>
              <Themed n={n} id="themed2" />
            </div>
          </Provider>
        </Provider>
      </Provider>
    </main>
  );
}

// Registered tokens held as values (cdk Popover `clearContexts`, a module-level list reached through a local object):
// the browser gets the registered tokens themselves (identity), so providing one clears / overrides that context.
const CLEAR = [Theme, Locale];
function TokenCheck(props: { id: string }) {
  const ctx = { clear: CLEAR };
  const out = signal("?");
  return (
    <button
      id={props.id}
      onClick={() => {
        const [theme, locale] = ctx.clear;
        out.set(String(theme === Theme && locale === Locale) + "/" + provide(theme!, "cleared", () => useContext(Theme)));
      }}
    >
      {out()}
    </button>
  );
}
export function Tokens() {
  return (
    <main>
      <TokenCheck id="t1" />
      <Provider token={Theme} value="dark">
        <TokenCheck id="t2" />
      </Provider>
    </main>
  );
}
