import { signal } from "@rivetjs/reactivity";
import { ErrorBoundary, Show } from "@rivetjs/runtime/server";

// E3: a branch that rendered null (or false) at SSR shows once its condition turns true, and back.
export function Hidden() {
  const on = signal(false);
  return (
    <main>
      <button id="toggle" onClick={() => on.set(!on())}>toggle</button>
      <p id="tern">{on() ? <b id="yes">yes</b> : null}</p>
      <p id="and">{on() && <i id="and-i">and</i>}</p>
    </main>
  );
}

// The reverse: shown at SSR, hidden, shown again.
export function Shown() {
  const on = signal(true);
  return (
    <main>
      <button id="toggle" onClick={() => on.set(!on())}>toggle</button>
      <p id="tern">{on() ? <b id="yes">yes</b> : null}</p>
      <p id="and">{on() && <i id="and-i">and</i>}</p>
    </main>
  );
}

// E6: consts derived through an arrow that hold primitives (a string, undefined) resume as values.
const items = [{ id: 1, name: "one" }, { id: 2, name: "two" }];
export function Derived() {
  const id = signal(1);
  const label = items.find((item) => item.id === 3)?.name ?? "fallback";
  const missing = items.find((item) => item.id === 4);
  return (
    <main>
      <button id="next" onClick={() => id.set(id() + 1)}>next</button>
      <output id="name">{items.find((item) => item.id === id())?.name ?? label + (missing === undefined ? "!" : "?")}</output>
    </main>
  );
}

// ErrorBoundary with plain (eager-looking) JSX children: thunked by the compiler, so reset re-renders them.
function Flaky() {
  if ((globalThis as { __fail?: boolean }).__fail) throw new Error("flaky");
  return <b id="ok">ok</b>;
}
export function Plain() {
  return (
    <main>
      <ErrorBoundary fallback={(error, reset) => <button id="fb" onClick={reset}>{(error as Error).message}</button>}>
        <Flaky />
        <i id="sibling">sibling</i>
      </ErrorBoundary>
    </main>
  );
}

// Show with plain JSX children in a resume module: thunked, so the hidden branch records nothing.
export function ShowPlain() {
  const on = signal(false);
  return (
    <main>
      <button id="toggle" onClick={() => on.set(!on())}>toggle</button>
      <Show when={() => on()} fallback={() => <i id="off">off</i>}>
        <b id="on">on</b>
      </Show>
    </main>
  );
}
