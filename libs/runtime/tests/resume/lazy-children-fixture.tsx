// Lazy component children: `<Themed><ToneOf/></Themed>` — the plain JSX child is evaluated where
// Themed renders it, inside its Provider, so `useContext` in the child sees the parent's value.
import { signal, createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/server";

export const Tone = createContext<string>("default", { id: "lazy-tone" });

function Themed(props: { children?: unknown }) {
  return (
    <Provider token={Tone} value="themed">
      <div class="themed">{props.children}</div>
    </Provider>
  );
}

function ToneOf() {
  return <i class="tone">{useContext(Tone)}</i>;
}

export function Page() {
  const n = signal(1);
  return (
    <main>
      <Themed>
        <ToneOf />
        <b id="n">{n()}</b>
      </Themed>
      <button id="inc" onClick={() => n.update((v) => v + 1)}>
        inc
      </button>
      {n() > 1 ? (
        <Themed>
          <ToneOf />
          <span id="late">late</span>
        </Themed>
      ) : (
        <p id="wait">wait</p>
      )}
    </main>
  );
}
