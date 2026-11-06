// Per-event walks over a long sole list (KEYDOWN 2026-11-06), server module: App's keyed For is its `<ul>`'s only
// content and each row is a `Tag` boundary rendering two `<li>`s (its `<!--bN-->` opener sits at the list's level).
import { For } from "@rivetjs/runtime/dom";
import { _rB, _rBOut, _rBEnd, _rSig } from "@rivetjs/runtime/server-derived";

export function Tag(props) {
  const B = _rB("Tag", 0, null, "click");
  try {
    const on = _rSig("t-0", false);
    return _rBOut(
      B,
      <>
        <li id={"row-" + props.id}>
          <b class="tag" onClick={() => on.set(!on())}>
            {props.text}
            {on() ? "*" : ""}
          </b>
        </li>
        <li class="sep" />
      </>,
    );
  } finally {
    _rBEnd(B);
  }
}

export function App() {
  const B = _rB("App", 1, {}, "click");
  try {
    const items = _rSig(
      "a-0",
      Array.from({ length: 300 }, (_, i) => ({ id: i + 1, text: "t" + (i + 1) })),
    );
    const count = _rSig("a-1", 0);
    return _rBOut(
      B,
      <main>
        <button type="button" id="bump" onClick={() => count.set(count() + 1)}>
          {count()}
        </button>
        <ul>
          <For each={() => items()} by={(x) => x.id}>
            {(x) => <Tag id={x().id} text={x().text} />}
          </For>
        </ul>
      </main>,
    );
  } finally {
    _rBEnd(B);
  }
}
