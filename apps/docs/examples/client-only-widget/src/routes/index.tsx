import { signal } from "@rivetjs/reactivity";
import { clientOnly } from "@rivetjs/runtime/dom";

export const head = { title: "Client-only widget" };

// #region demo
// The server never loads this module. In the browser it loads the first time the widget renders.
const LocalInfo = clientOnly(() => import("../components/LocalInfo.tsx"), undefined, {
  fallback: () => <p class="rounded-lg bg-slate-100 p-3 text-slate-500">Loading browser details…</p>,
});

export default function Page() {
  const shown = signal(false);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <p>The server does not know your language or time zone. The browser does:</p>
      {shown() ? (
        <LocalInfo />
      ) : (
        <button id="show" type="button" class="justify-self-start rounded-lg bg-teal-700 px-3 py-2 font-medium text-white" onClick={() => shown.set(true)}>
          Show browser details
        </button>
      )}
    </div>
  );
}
// #endregion
