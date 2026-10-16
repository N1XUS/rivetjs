// A signal provided as an identified context (like the router's navigation state): the server ships it as a `{x}`
// reference and the client supplies its own signal through `createResume({ contexts })`.
import { signal, createContext, useContext, type Signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/server";

export const Live = createContext<Signal<string> | null>(null, { id: "ctx-live" });

// Reader's binding and Setter's handler live in separate chunks: nothing decodes the context reference before the
// runtime arms it at start (the router's root layout reading useSearchParams() is the same shape).
function Reader() {
  const live = useContext(Live)!;
  return <b id="v">{live()}</b>;
}

function Setter() {
  const live = useContext(Live)!;
  return (
    <button id="set" onClick={() => live.set("clicked")}>
      set
    </button>
  );
}

export function Page() {
  const live = signal("server");
  return (
    <Provider token={Live} value={live}>
      <main>
        <Reader />
        <Setter />
      </main>
    </Provider>
  );
}
