// Derived model fixture, DOM module: what the compiler's derived DOM target emits (M2-C) for the components of
// `page.server.tsx`, hand-lowered to the derived DOM ABI (`_b` / `_sig`, `@rivetjs/runtime/dom-derived`) and compiled
// with the plain DOM target (tests/derived-*.test.ts read this file as source). `/*H1*/` marks the spot the verifier
// test breaks (an `<h1>` → `<h2>` swap: a structural mismatch the dev verifier names).
import { createContext, provide, useContext } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import { _b, _sig } from "@rivetjs/runtime/dom-derived";

export const THEME = createContext(null);

export function Header() {
  return _b("Header", () => {
    const open = _sig("h-0", false);
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
  });
}

export function Counter(props) {
  return _b("Counter", () => {
    const theme = useContext(THEME);
    const n = _sig("c-0", props.start);
    return (
      <div class="counter">
        <button type="button" id="inc" onClick={() => n.set(n() + 1)} onKeyDown={(e) => e.key === "ArrowUp" && n.set(n() + 10)}>
          +
        </button>
        <span id="count">{n()}</span> <span id="theme">{theme()}</span>
      </div>
    );
  });
}

export function App(props) {
  return _b("App", () => {
    const theme = _sig("a-0", "light");
    const selected = _sig("a-1", -1);
    return provide(THEME, theme, () => (
      <main>
        <Header />
        <button type="button" id="dark" onClick={() => theme.set("dark")}>
          Dark
        </button>
        {/*H1*/}
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
  });
}
