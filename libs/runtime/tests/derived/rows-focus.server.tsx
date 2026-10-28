// Attribute-root rows gain boundary anchors when they adopt. A helper-returned For
// also has an insertion anchor, so its parent slot must defer flattening its range.
import { For } from "@rivetjs/runtime/dom";
import { _rB, _rBOut, _rBEnd, _rSig, _rBAttr } from "@rivetjs/runtime/server-derived";
export function View(props) {
  const B = _rB("View", 2, props, "click");
  try {
    _rBAttr(B);
    return _rBOut(
      B,
      <div role="option" tabIndex={0} data-b={B.id} data-key={props.id} aria-pressed={props.selected} onClick={props.onClick}>
        {props.id}
      </div>,
    );
  } finally {
    _rBEnd(B);
  }
}
function renderRows(items, selected) {
  return (
    <For each={items} by={(key) => key}>
      {(key) => <View id={key()} onClick={() => selected.set(key())} selected={selected() === key()} />}
    </For>
  );
}
export function App() {
  const B = _rB("App", 1, {}, "click keydown");
  try {
    const items = _rSig("items", [0, 1, 2]);
    const selected = _rSig("selected", -1);
    return _rBOut(
      B,
      <main>
        <div
          id="list"
          onKeyDown={(event) => {
            if (event.key === "End") items.set([...items(), 9999]);
            if (event.key === "PageDown") items.set([1, 9999]);
            if (event.key === "Home") items.set([1]);
            if (event.key === "Delete") items.set([]);
          }}
        >
          {renderRows(items, selected)}
        </div>
      </main>,
    );
  } finally {
    _rBEnd(B);
  }
}
