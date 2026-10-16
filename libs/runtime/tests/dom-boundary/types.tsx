import { ErrorBoundary, mount } from "@rivetjs/runtime/dom";
const view = (
  <ErrorBoundary fallback={(error, reset) => <button onClick={reset}>{String(error)}</button>}>{() => <p>ok</p>}</ErrorBoundary>
);
mount(
  () => (
    <section>
      {view}
      <ErrorBoundary fallback={() => "failed"}>{() => [<i>a</i>, "b"]}</ErrorBoundary>
      {/* plain JSX children: the compiler thunks them */}
      <ErrorBoundary fallback={() => null}><p>plain</p><i>two</i></ErrorBoundary>
      {/* fallback must be a function: rejected */}
      <ErrorBoundary fallback={<p>no</p>}><p>plain</p></ErrorBoundary>
    </section>
  ),
  document.body,
);
