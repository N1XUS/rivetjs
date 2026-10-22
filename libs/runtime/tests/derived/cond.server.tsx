// Conditional boundaries fixture (M6-PARITY 6b), server module, hand-lowered to the derived ABI: `Label` / `Box` carry
// `COND` (1024: no change source of their own). App: the root (keyed `theme`, `items`). Static: a `Label` with a literal
// prop. Live: a `Label` whose prop getter reads `theme`, a `Box` whose slot reads it. Rows: `Label`s over row items
// (plain accessors on the server: dropped, the browser runs them inline when App adopts). `Static`: a page of static
// instances only.
import { For } from "@rivetjs/runtime/dom";
import { _rB, _rBOut, _rBEnd, _rSig } from "@rivetjs/runtime/server-derived";

export function Label(props) {
  const B = _rB("Label", 1024);
  try {
    return _rBOut(B, <span class={"label " + props.id}>{props.text}</span>);
  } finally {
    _rBEnd(B);
  }
}

export function Box(props) {
  const B = _rB("Box", 1024);
  try {
    return _rBOut(B, <div class="box">{props.children}</div>);
  } finally {
    _rBEnd(B);
  }
}

export function App() {
  const B = _rB("App", 1, {}, "click");
  try {
    const theme = _rSig("a-0", "light");
    const items = _rSig("a-1", [
      { id: 1, text: "one" },
      { id: 2, text: "two" },
    ]);
    return _rBOut(
      B,
      <main>
        <button type="button" id="dark" onClick={() => (theme.set("dark"), items.set(items().map((x) => ({ ...x, text: x.text + "!" }))))}>
          Dark
        </button>
        <Label id="static" text="fixed" />
        <Label id="live" text={theme()} />
        <Box>
          <b id="slot">{theme()}</b>
        </Box>
        <ul>
          <For each={() => items()} by={(x) => x.id}>
            {(x) => (
              <li>
                <Label id={"row" + x().id} text={x().text} />
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

export function Static() {
  return (
    <main>
      <Label id="a" text="one" />
      <Box>
        <b>two</b>
      </Box>
    </main>
  );
}
