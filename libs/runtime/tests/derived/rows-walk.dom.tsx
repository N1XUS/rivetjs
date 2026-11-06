// Per-event walks over a long sole list (KEYDOWN 2026-11-06), DOM module: `rows-walk.server.tsx`'s components on the
// derived DOM ABI.
import { For } from "@rivetjs/runtime/dom";
import { _b, _sig } from "@rivetjs/runtime/dom-derived";

export function Tag(props) {
  return _b("Tag", () => {
    const on = _sig("t-0", false);
    return (
      <>
        <li id={"row-" + props.id}>
          <b class="tag" onClick={() => on.set(!on())}>
            {props.text}
            {on() ? "*" : ""}
          </b>
        </li>
        <li class="sep" />
      </>
    );
  });
}

export function App() {
  return _b("App", () => {
    const items = _sig(
      "a-0",
      Array.from({ length: 300 }, (_, i) => ({ id: i + 1, text: "t" + (i + 1) })),
    );
    const count = _sig("a-1", 0);
    return (
      <main>
        <button type="button" id="bump" onClick={() => count.set(count() + 1)}>
          {count()}
        </button>
        <ul>
          <For each={() => items()} by={(x) => x.id}>
            {(x) => <Tag id={x().id} text={x().text} />}
          </For>
        </ul>
      </main>
    );
  });
}
