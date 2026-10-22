// Lazy rows fixture (M6-PARITY task 5), server module: App's keyed For rows each hold a dependent boundary (`Tag`, own
// keyed state) and a remove button; `add` prepends a row (the reconcile keeps the server rows lazy).
import { For } from "@rivetjs/runtime/dom";
import { _rB, _rBOut, _rBEnd, _rSig } from "@rivetjs/runtime/server-derived";

export function Tag(props) {
  const B = _rB("Tag", 0, null, "click");
  try {
    const on = _rSig("t-0", false);
    return _rBOut(
      B,
      <b class="tag" onClick={() => on.set(!on())}>
        {props.text}
        {on() ? "*" : ""}
      </b>,
    );
  } finally {
    _rBEnd(B);
  }
}

export function App() {
  const B = _rB("App", 1, {}, "click");
  try {
    const items = _rSig("a-0", [
      { id: 1, text: "one" },
      { id: 2, text: "two" },
    ]);
    const next = _rSig("a-1", 3);
    return _rBOut(
      B,
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
      </main>,
    );
  } finally {
    _rBEnd(B);
  }
}
