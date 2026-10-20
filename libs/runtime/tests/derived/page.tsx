// Derived model fixture, plain source: the components of `page.dom.tsx` before lowering. Compiled with the M2-C
// derived server target (`resume: { model: "derived" }`, wasm with `hasDerivedModel()`) by
// tests/derived-adopt-browser.test.ts — the compiled server shape (ATTR roots, content markers, keys `<h5>-<n>`) that
// the hand-lowered DOM module adopts.
import { createContext, provide, signal, useContext } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";

export const THEME = createContext(null);

export function Header() {
  const open = signal(false);
  return (
    <header>
      <button type="button" id="toggle" onClick={() => open.set(!open())}>
        Menu
      </button>
      <Show when={() => open()} fallback={<p id="closed">closed</p>}>
        <p id="open">open</p>
      </Show>
    </header>
  );
}

export function Counter(props) {
  const theme = useContext(THEME);
  const n = signal(props.start);
  return (
    <div class="counter">
      <button type="button" id="inc" onClick={() => n.set(n() + 1)} onKeyDown={(e) => e.key === "ArrowUp" && n.set(n() + 10)}>
        +
      </button>
      <span id="count">{n()}</span> <span id="theme">{theme()}</span>
    </div>
  );
}

export function App(props) {
  const theme = signal("light");
  const selected = signal(-1);
  return provide(THEME, theme, () => (
    <main>
      <Header />
      <button type="button" id="dark" onClick={() => theme.set("dark")}>
        Dark
      </button>
      <h1 id="title">
        {props.data.title} ({props.data.rows.length} rows)
      </h1>
      <Counter start={5} />
      <ul>
        <For each={() => props.data.rows} by={(row) => row.id}>
          {(row) => (
            <li data-sel={selected() === row().id ? "y" : "n"}>
              <button type="button" class="pick" onClick={() => selected.set(row().id)}>
                Pick {row().id}
              </button>
            </li>
          )}
        </For>
      </ul>
    </main>
  ));
}
