import { signal } from "@rivetjs/reactivity";
import { Async, clientEvent } from "@rivetjs/runtime/server";

// Delegated handler on an ancestor of the click target; a clientEvent whose chunk loads on first use.
export function Targets() {
  const seen = signal("");
  const custom = signal("");
  clientEvent(document, "rivet-test", (event: Event) => custom.set(event.currentTarget === document ? "document" : String(event.currentTarget)));
  return (
    <main>
      <div id="card" onClick={(event: MouseEvent) => seen.set((event.currentTarget as Element).id + "|" + (event.target as Element).id)}>
        <span id="inner">inner</span>
      </div>
      <output id="seen">{seen()}</output>
      <output id="custom">{custom()}</output>
    </main>
  );
}

// An Async whose load reads a signal: resumed, it reloads when the signal changes.
export function Loads() {
  const id = signal(1);
  return (
    <main>
      <button id="next" onClick={() => id.update((v) => v + 1)}>
        next
      </button>
      <Async load={async () => id() * 10}>{(value: number) => <b id="out">{value}</b>}</Async>
      <Async load={() => id() * 100}>{(value: number) => <i id="sync">{value}</i>}</Async>
    </main>
  );
}
