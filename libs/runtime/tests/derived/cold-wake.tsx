import { createContext, provide, signal, useContext } from "@rivetjs/reactivity";

const Group = createContext<(event: KeyboardEvent) => void>(() => {});

// Like a group-provided field listener: helper JSX reports _rListens but does not widen data-events.
function field(id: string, down: (event: KeyboardEvent) => void) {
  const up = useContext(Group);
  return (
    <span id={id} tabIndex={0} data-rk="ArrowUp ArrowDown" onKeyDown={down} onKeyUp={up}>
      Field
    </span>
  );
}

export function Keys() {
  const log = signal("");
  const record = (event: KeyboardEvent) => log.set(log() + event.type + ":" + (event.target as Element).id + ":" + event.key + " ");
  return provide(Group, record, () => (
    <main>
      {field("a", record)}
      {field("b", record)}
      <output id="log">{log()}</output>
    </main>
  ));
}

// A helper's non-bubbling listener must be capturable before its boundary adopts.
function scrollbox(scrolled: () => void) {
  return (
    <div id="scroll" style={{ height: "80px", overflow: "auto" }} onScroll={() => scrolled()}>
      <div style={{ height: "400px" }}>Rows</div>
    </div>
  );
}

export function Scroll() {
  const count = signal(0);
  return (
    <main>
      {scrollbox(() => count.set(count() + 1))}
      <output id="count">{count()}</output>
    </main>
  );
}
