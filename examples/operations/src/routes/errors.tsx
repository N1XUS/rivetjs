import { signal } from "@rivetjs/reactivity";
import { ErrorBoundary } from "@rivetjs/runtime/dom";
export default function Errors() {
  const broken = signal(false);
  return (
    <main>
      <h1>Error recovery</h1>
      <button id="break-widget" onClick={() => broken.set(true)}>
        Break binding
      </button>
      <ErrorBoundary
        fallback={(e, reset) => (
          <section id="caught">
            <p>{String(e)}</p>
            <button
              id="recover-widget"
              onClick={() => {
                broken.set(false);
                reset();
              }}
            >
              Recover
            </button>
          </section>
        )}
      >
        <p id="healthy">
          {(() => {
            if (broken()) throw Error("widget-failed");
            return "healthy";
          })()}
        </p>
      </ErrorBoundary>
      <button id="outside-counter" onClick={() => broken.set(false)}>
        Outside still works
      </button>
    </main>
  );
}
