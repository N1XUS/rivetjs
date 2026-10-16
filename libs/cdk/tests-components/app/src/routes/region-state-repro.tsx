// Repro: `_regionState` adoption on a resumed page. Each case is a child component that creates its
// state in its body with `_regionState`, renders the second state's signal (text binding, Show
// branch, For row) and writes it from a click handler.
import { signal, _regionState, type Signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";

interface Counter {
  count: Signal<number>;
}
const counter = (): Counter => ({ count: signal(0) });

/** Outer region state that nests an inner `_regionState` (like createOverlayTriggerState inside a picker state). */
const outer = () => _regionState(() => ({ inner: _regionState(counter), flag: signal(false) }));
/** Outer region state without a nested one. */
const flat = () => _regionState(() => ({ flag: signal(false) }));

/** Case A: nested outer, then a second top-level `_regionState`. */
function NestedThenSecond(props: { id: string }) {
  const first = outer();
  const second = _regionState(counter);
  const id = props.id;
  return (
    <div id={id}>
      <button id={id + "-bump"} type="button" onClick={() => second.count.set(second.count() + 1)}>
        bump
      </button>
      <span id={id + "-text"}>{String(second.count())}</span>
      <For each={() => [String(second.count())]} by={(key) => "row"}>
        {(key) => <span id={id + "-row"}>{key()}</span>}
      </For>
      <span id={id + "-first"} hidden>
        {String(first.inner.count())}
      </span>
    </div>
  );
}

/** Case B (control): flat outer, then a second top-level `_regionState`. */
function FlatThenSecond(props: { id: string }) {
  const first = flat();
  const second = _regionState(counter);
  const id = props.id;
  return (
    <div id={id}>
      <button id={id + "-bump"} type="button" onClick={() => second.count.set(second.count() + 1)}>
        bump
      </button>
      <span id={id + "-text"}>{String(second.count())}</span>
      <For each={() => [String(second.count())]} by={(key) => "row"}>
        {(key) => <span id={id + "-row"}>{key()}</span>}
      </For>
      <span id={id + "-first"} hidden>
        {String(first.flag())}
      </span>
    </div>
  );
}

/** Second state linked to the first (one-way `owner` ref), created by an arrow capturing it. */
const linked = (owner: object) => ({ owner, count: signal(0) });

/** Case C: nested outer, then `_regionState(() => linked(first))` (the DatePicker field shape). */
function NestedThenLinked(props: { id: string }) {
  const first = outer();
  const second = _regionState(() => linked(first));
  const id = props.id;
  return (
    <div id={id}>
      <button id={id + "-bump"} type="button" onClick={() => second.count.set(second.count() + 1)}>
        bump
      </button>
      <span id={id + "-text"}>{String(second.count())}</span>
      <For each={() => [String(second.count())]} by={(key) => "row"}>
        {(key) => <span id={id + "-row"}>{key()}</span>}
      </For>
      <span id={id + "-first"} hidden>
        {String(first.inner.count())}
      </span>
    </div>
  );
}

export const head = { title: "Region state repro" };

export default function RegionStateRepro() {
  return (
    <section>
      <h1>Region state repro</h1>
      <NestedThenSecond id="nested" />
      <FlatThenSecond id="flat" />
      <NestedThenLinked id="linked" />
    </section>
  );
}
