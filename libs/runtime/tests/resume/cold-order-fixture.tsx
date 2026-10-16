// Cold events replay in dispatch order even when their handlers' chunks load out of order
// (keydown handler in Outer's chunk, held; input handler in Inner's chunk, instant).
import { signal } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import type { Content } from "@rivetjs/runtime/jsx-runtime";

function Outer(props: { log: Signal<string[]>; children?: Content }) {
  return <div onKeyDown={(e: KeyboardEvent) => props.log.update((l) => [...l, "down:" + e.key])}>{props.children}</div>;
}
function Inner(props: { log: Signal<string[]> }) {
  return <input id="in" onInput={(e: InputEvent) => props.log.update((l) => [...l, "input:" + e.data])} />;
}
export function Page() {
  const log = signal<string[]>([]);
  return (
    <main>
      <Outer log={log}>
        <Inner log={log} />
      </Outer>
      <p id="log">{log().join(",")}</p>
    </main>
  );
}
