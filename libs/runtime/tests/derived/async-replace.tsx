import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/dom";

let initial: PromiseLike<string> | undefined;
export const seed = (data: PromiseLike<string>): void => void (initial = data);

export function App(props: { replacement: "async" | "text" | "empty"; array?: boolean }) {
  const id = signal(0);
  const count = signal(0);
  const card = (current: number) => {
    if (current && props.replacement !== "async") return props.replacement === "text" ? "finished" : null;
    return (
      <Async
        load={() => {
          if (typeof window !== "undefined") {
            const state = window as unknown as { loads: number };
            state.loads = (state.loads ?? 0) + 1;
          }
          return current === 0 && initial ? initial : Promise.resolve(["Ada Lovelace", "Grace Hopper", "Alan Turing"][current % 3]!);
        }}
        fallback={() => <i id="wait">Loading</i>}
      >
        {(name) => (
          <>
            <span id="name">{name}</span>
            <small id="detail">detail</small>
          </>
        )}
      </Async>
    );
  };
  const content = () => (props.array ? [card(id()), <em id="suffix">suffix</em>] : card(id()));
  return (
    <section>
      <button id="wake" onClick={() => count.update((n) => n + 1)}>
        {count()}
      </button>
      <button id="next" onClick={() => id.update((n) => n + 1)}>
        Next
      </button>
      <p id="user">
        <b id="before">before</b>
        {content()}
        <b id="after">after</b>
      </p>
    </section>
  );
}
