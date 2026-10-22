// Lazy rows fixture (M6-PARITY task 5), DOM module: `rows.server.tsx`'s components on the derived DOM ABI.
import { For } from "@rivetjs/runtime/dom";
import { _b, _sig } from "@rivetjs/runtime/dom-derived";

export function Tag(props) {
  return _b("Tag", () => {
    const on = _sig("t-0", false);
    return (
      <b class="tag" onClick={() => on.set(!on())}>
        {props.text}
        {on() ? "*" : ""}
      </b>
    );
  });
}

export function App() {
  return _b("App", () => {
    const items = _sig("a-0", [
      { id: 1, text: "one" },
      { id: 2, text: "two" },
    ]);
    const next = _sig("a-1", 3);
    return (
      <main>
        <button type="button" id="add" onClick={() => (items.set([{ id: next(), text: "n" + next() }, ...items()]), next.set(next() + 1))}>
          Add
        </button>
        <ul>
          <For each={() => items()} by={(x) => x.id}>
            {(x) => (
              <li id={"row-" + x().id}>
                <Tag text={x().text} />
                <button type="button" id={"del-" + x().id} onClick={() => items.set(items().filter((y) => y.id !== x().id))}>
                  x
                </button>
              </li>
            )}
          </For>
        </ul>
      </main>
    );
  });
}
