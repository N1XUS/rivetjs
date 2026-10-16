// CORE-GAPS (b): an ErrorBoundary catches errors from server-rendered bindings in its content after a later change
// on a resumed page (as it does on a client mount): `direct` sits right in the page's JSX, `cond` behind a condition.
import { signal } from "@rivetjs/reactivity";
import { ErrorBoundary } from "@rivetjs/runtime/server";

const check = (v: number) => {
  if (v % 2) throw new Error("odd " + v);
  return "even " + v;
};

export function Page() {
  const n = signal(0);
  const on = signal(true);
  return (
    <div>
      <section class="direct">
        <ErrorBoundary
          fallback={(e, reset) => (
            <p class="err" onClick={() => (n.set(n() + 1), reset())}>
              {(e as Error).message}
            </p>
          )}
        >
          <p class="ok">{check(n())}</p>
        </ErrorBoundary>
      </section>
      <section class="cond">
        {on() && (
          <ErrorBoundary fallback={(e) => <p class="err">{(e as Error).message}</p>}>
            <p class="ok" title={check(n())}>
              {String(n())}
            </p>
          </ErrorBoundary>
        )}
      </section>
      <button class="go" onClick={() => n.set(n() + 1)}>
        +
      </button>
    </div>
  );
}
