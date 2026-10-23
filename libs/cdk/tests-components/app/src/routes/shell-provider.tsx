import { load, type PageProps } from "@rivetjs/router";
import { Async, Provider, type DOMValue } from "@rivetjs/runtime/dom";
import { createContext, signal, useContext, type Signal } from "@rivetjs/reactivity";

// Shell cache, PPR-T57: an ancestor component (`Board`) provides signals through context and the hole writes one during
// the server render (`seen`: each render registers). The hole itself is H-holes eligible (the compiler marks it), but a
// hit that re-ran only the hole under the fill's retained frame would count on from the previous visitor; the fill sees
// the write, so the entry replays (`x-rivet-cache: SHELL-HIT-REPLAY`). Primed like `shell-loader.tsx` (`RIVET_FUZZ_SHELL`).
// `seen` is never shown (its server value is written after the shell's state: a resumed page and a CSR render disagree on
// it by design); `picked` is the interactive state the fuzz drives.
const Board = createContext<{ seen: Signal<number>; picked: Signal<string> } | null>(null);

export const loader = load(
  async () => {
    await new Promise((done) => setTimeout(done, 20));
    return { items: ["Io", "Europa", "Ganymede"] };
  },
  { defer: true },
);

function Counted(props: { children: DOMValue }) {
  const seen = signal(0);
  const picked = signal("none");
  return (
    <Provider token={Board} value={{ seen, picked }}>
      {props.children}
    </Provider>
  );
}

export default function ShellProvider({ data }: PageProps<typeof loader>) {
  return (
    <section>
      <h1>Shell cache provider</h1>
      <Counted>
        <Async load={() => data} fallback={() => <p id="sp-wait">Loading…</p>}>
          {(value) => {
            const board = useContext(Board)!;
            board.seen.set(board.seen() + 1);
            return (
              <div id="sp-list">
                <ul>
                  {value.items.map((item) => (
                    <li>
                      <button type="button" onClick={() => board.picked.set(item)}>
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
                <p id="sp-picked">{board.picked()}</p>
              </div>
            );
          }}
        </Async>
      </Counted>
    </section>
  );
}
