// DOM twin of rows-move.server.tsx.
import { For } from "@rivetjs/runtime/dom";
import { _b, _sig } from "@rivetjs/runtime/dom-derived";
export function View(props) {
  return _b("View", () => {
    return (
      <>
        <i>{props.id}</i>
        <div role="option" tabIndex={0} data-key={props.id} aria-pressed={props.selected} onClick={props.onClick}>
          {props.id}
        </div>
      </>
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
            if (event.key === "ArrowDown") {
              const [a, b, ...rest] = items();
              items.set([b, a, ...rest]);
            }
            if (event.key === "End") items.set([...items(), 9999]);
            if (event.key === "PageDown") items.set([1, 9999]);
            if (event.key === "Home") items.set([1]);
            if (event.key === "Delete") items.set([]);
            if (event.key === "x") items.set(items().slice(1));
            if (event.key === "y") items.set(items().filter((_, index) => index !== 1));
            if (event.key === "z") items.set([7777, ...items().slice(1)]);
            if (event.key === "w") items.set([2, 0]);
            if (event.key === "v") items.set(items().slice(0, 2));
            if (event.key === "u") items.set([2, 7777, 0]);
          }}
        >
          {renderRows(items, selected)}
        </div>
      </main>
    );
  });
}
