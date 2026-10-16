import { mount, Async, ErrorBoundary } from "@rivetjs/runtime/dom";
import { signal, onCleanup } from "@rivetjs/reactivity";
// Compiled with the DOM target and served to Chromium by ../dom-boundary.test.ts.
const assert = (v, message) => {
  if (!v) throw Error(message);
};
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const html = (host) => host.innerHTML.replace(/<!--[^>]*-->/g, "");
const message = (error) => (error instanceof Error ? error.message : String(error));

/** Synchronous render error → fallback; siblings intact; reset re-renders children. */
export function render(host) {
  let broken = true,
    fallbackCleanups = 0;
  const Boom = () => {
    if (broken) throw new Error("<render> & failed");
    return <b>fine</b>;
  };
  const Fallback = ({ error, reset }) => {
    onCleanup(() => fallbackCleanups++);
    return <button onClick={reset}>{message(error)}</button>;
  };
  const stop = mount(
    () => (
      <main>
        <h1>before</h1>
        <ErrorBoundary fallback={(error, reset) => <Fallback error={error} reset={reset} />}>{() => <section><i>partial</i><Boom /></section>}</ErrorBoundary>
        <footer>after</footer>
      </main>
    ),
    host,
  );
  assert(html(host) === "<main><h1>before</h1><button>&lt;render&gt; &amp; failed</button><footer>after</footer></main>", "fallback: " + html(host));
  broken = false;
  host.querySelector("button").click();
  assert(fallbackCleanups === 1, "fallback disposed");
  assert(html(host) === "<main><h1>before</h1><section><i>partial</i><b>fine</b></section><footer>after</footer></main>", "reset: " + html(host));
  stop();
  assert(html(host) === "", "unmounted");
  return "passed";
}

/** Plain JSX children (thunked by the compiler) render inside the boundary: caught, and reset re-renders them. */
export function plain(host) {
  let broken = true;
  const Boom = () => {
    if (broken) throw new Error("plain failed");
    return <b>fine</b>;
  };
  const stop = mount(
    () => (
      <main>
        <ErrorBoundary fallback={(error, reset) => <button onClick={reset}>{message(error)}</button>}>
          <i>partial</i>
          <Boom />
        </ErrorBoundary>
      </main>
    ),
    host,
  );
  assert(html(host) === "<main><button>plain failed</button></main>", "fallback: " + html(host));
  broken = false;
  host.querySelector("button").click();
  assert(html(host) === "<main><i>partial</i><b>fine</b></main>", "reset: " + html(host));
  stop();
  return "passed";
}

/** An effect/binding failing after an update (triggered by a handler write) → fallback; the writer does not throw. */
export function update(host) {
  const n = signal(0);
  let threw = null;
  const Counter = () => (
    <p>
      {() => {
        if (n() === 2) throw new Error("binding failed at " + n());
        return n();
      }}
    </p>
  );
  const stop = mount(
    () => (
      <div>
        <button
          onClick={() => {
            try {
              n.set(n() + 1);
            } catch (error) {
              threw = error;
            }
          }}
        >
          +
        </button>
        <ErrorBoundary fallback={(error, reset) => <em onClick={reset}>{message(error)}</em>}>{() => <Counter />}</ErrorBoundary>
      </div>
    ),
    host,
  );
  const button = host.querySelector("button");
  button.click();
  assert(host.querySelector("p").textContent === "1", "updated");
  button.click();
  assert(threw === null, "writer did not throw");
  assert(host.querySelector("p") === null && host.querySelector("em").textContent === "binding failed at 2", "fallback: " + html(host));
  button.click();
  host.querySelector("em").click();
  assert(host.querySelector("p").textContent === "3", "reset renders children with current state: " + html(host));
  stop();
  return "passed";
}

/** Async rejection without its own `error` → nearest boundary; with `error` the Async handles it. */
export async function async(host) {
  let reject, rejectOwn;
  const stop = mount(
    () => (
      <div>
        <ErrorBoundary fallback={(error) => <strong>{message(error)}</strong>}>
          {() => (
            <Async load={() => new Promise((_, no) => (reject = no))} fallback={() => <i>loading</i>}>
              {(value) => <span>{value}</span>}
            </Async>
          )}
        </ErrorBoundary>
        <ErrorBoundary fallback={() => <strong>wrong boundary</strong>}>
          {() => (
            <Async load={() => new Promise((_, no) => (rejectOwn = no))} error={(error) => <u>{message(error)}</u>}>
              {(value) => <span>{value}</span>}
            </Async>
          )}
        </ErrorBoundary>
      </div>
    ),
    host,
  );
  assert(html(host) === "<div><i>loading</i></div>", "pending: " + html(host));
  reject(new Error("load failed"));
  rejectOwn(new Error("own error"));
  await flush();
  assert(html(host) === "<div><strong>load failed</strong><u>own error</u></div>", "rejected: " + html(host));
  stop();
  return "passed";
}

/** Fallback errors go to the outer boundary; event handler throws are not caught (React model). */
export function nested(host) {
  const stop = mount(
    () => (
      <ErrorBoundary fallback={(error) => <p>outer: {message(error)}</p>}>
        {() => (
          <ErrorBoundary
            fallback={() => {
              throw new Error("fallback failed");
            }}
          >
            {() => {
              throw new Error("inner");
            }}
          </ErrorBoundary>
        )}
      </ErrorBoundary>
    ),
    host,
  );
  assert(html(host) === "<p>outer: fallback failed</p>", "outer: " + html(host));
  stop();
  const second = mount(
    () => (
      <ErrorBoundary fallback={() => <p>caught</p>}>
        {() => (
          <button
            onClick={() => {
              throw new Error("handler failed");
            }}
          >
            ok
          </button>
        )}
      </ErrorBoundary>
    ),
    host,
  );
  host.querySelector("button").click();
  assert(html(host) === "<button>ok</button>", "handler errors are not caught: " + html(host));
  second();
  return "passed";
}

/** No boundary: effect failures still reach the writer. */
export function unhandled(host) {
  const n = signal(0);
  const stop = mount(
    () => (
      <p>
        {() => {
          if (n()) throw new Error("unhandled binding");
          return "ok";
        }}
      </p>
    ),
    host,
  );
  let threw;
  try {
    n.set(1);
  } catch (error) {
    threw = error;
  }
  assert(message(threw) === "unhandled binding", "writer throws without a boundary");
  stop();
  return "passed";
}
