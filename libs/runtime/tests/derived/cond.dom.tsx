// Conditional boundaries fixture (M6-PARITY 6b), DOM module: `cond.server.tsx`'s components on the derived DOM ABI.
import { For } from "@rivetjs/runtime/dom";
import { _b, _sig } from "@rivetjs/runtime/dom-derived";

export function Label(props) {
  return _b("Label", () => <span class={"label " + props.id}>{props.text}</span>);
}

export function Box(props) {
  return _b("Box", () => <div class="box">{props.children}</div>);
}

export function App() {
  return _b("App", () => {
    const theme = _sig("a-0", "light");
    const items = _sig("a-1", [
      { id: 1, text: "one" },
      { id: 2, text: "two" },
    ]);
    return (
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
      </main>
    );
  });
}
