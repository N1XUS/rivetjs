// DOM twin of rows-focus.server.tsx.
import { For } from "@rivetjs/runtime/dom";
import { _b, _sig } from "@rivetjs/runtime/dom-derived";
export function View(props) {
  return _b("View", () => {
    return (
      <div role="option" tabIndex={0} data-key={props.id} aria-pressed={props.selected} onClick={props.onClick}>
        {props.id}
      </div>
    );
  });
}
function renderRows(items, selected) {
  return (
    <For each={items} by={(key) => key}>
      {(key) => <View id={key()} onClick={() => selected.set(key())} selected={selected() === key()} />}
    </For>
  );
}
export function App() {
  return _b("App", () => {
    const items = _sig("items", [0, 1, 2]);
    const selected = _sig("selected", -1);
    return (
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
      </main>
    );
  });
}
