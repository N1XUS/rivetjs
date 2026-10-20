// Derived model fixture, server module: what the compiler's derived server target emits (M2-C) for `page.dom.tsx`'s
// components, hand-lowered to the boundary ABI (`_rB` / `_rBOut` / `_rBEnd` / `_rSig`) and compiled with the plain server
// target (tests/derived-*.test.ts read this file as source). App: the page root, independent (props are data). Header:
// dependent, a Show branch. Counter: independent (`start` is data), reads App's `theme` through a context (wake list).
// Rows: a keyed For reading App's `selected`.
import { createContext, provide, useContext } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import { _rB, _rBOut, _rBEnd, _rSig } from "@rivetjs/runtime/server-derived";

export const THEME = createContext(null);

export function Header() {
  const B = _rB("Header", 0, null, "click");
  try {
    const open = _rSig("h-0", false);
    return _rBOut(
      B,
      <header>
        <button type="button" id="toggle" onClick={() => open.set(!open())}>
          Menu
        </button>
        <Show when={() => open()} fallback={<p id="closed">closed</p>}>
          <p id="open">open</p>
        </Show>
      </header>,
    );
  } finally {
    _rBEnd(B);
  }
}

export function Counter(props) {
  const B = _rB("Counter", 1, props, "click keydown", "ArrowUp");
  try {
    const theme = useContext(THEME);
    const n = _rSig("c-0", props.start);
    return _rBOut(
      B,
      <div class="counter">
        <button type="button" id="inc" onClick={() => n.set(n() + 1)} onKeyDown={(e) => e.key === "ArrowUp" && n.set(n() + 10)}>
          +
        </button>
        <span id="count">{n()}</span> <span id="theme">{theme()}</span>
      </div>,
    );
  } finally {
    _rBEnd(B);
  }
}

export function App(props) {
  const B = _rB("App", 1, props, "click");
  try {
    const theme = _rSig("a-0", "light");
    const selected = _rSig("a-1", -1);
    return _rBOut(
      B,
      provide(THEME, theme, () => (
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
      )),
    );
  } finally {
    _rBEnd(B);
  }
}
