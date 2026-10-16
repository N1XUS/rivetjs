// Components exercised by the testing-helper suites (compiled by @rivetjs/runtime/testing/register).
import { signal, onCleanup } from "@rivetjs/reactivity";
import { Async, clientEffect } from "@rivetjs/runtime/dom";

export const log: string[] = [];

export function Counter(props: { start: number }) {
  const count = signal(props.start);
  onCleanup(() => log.push("counter cleanup"));
  return (
    <div class="counter">
      <button onClick={() => (count.set(count() + 1), count.set(count() + 1))}>+2</button>
      <output>{count()}</output>
    </div>
  );
}

export function Width() {
  const ready = signal("pending");
  clientEffect(() => {
    ready.set("mounted");
    return () => log.push("effect cleanup");
  });
  return <p>{ready()}</p>;
}

export function Greeting(props: { name: Promise<string> }) {
  return (
    <section>
      <Async load={() => props.name} fallback={() => <i>loading</i>}>
        {(name: string) => <b>hello {name}</b>}
      </Async>
    </section>
  );
}

export function Form() {
  const text = signal("");
  return (
    <form onSubmit={(event: Event) => event.preventDefault()}>
      <input value={text()} onInput={(event: Event) => text.set((event.target as HTMLInputElement).value)} />
      <span>{text().toUpperCase()}</span>
    </form>
  );
}
