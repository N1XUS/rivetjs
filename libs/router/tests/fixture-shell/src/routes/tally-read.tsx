import { load, type PageProps } from "@rivetjs/router";
import { Async, Provider, type DOMValue } from "@rivetjs/runtime/dom";
import { createContext, signal, useContext, type Signal } from "@rivetjs/reactivity";
import { gate } from "../gate.server.ts";

// PPR-T57: the read-only twin of `tally.tsx`: the hole reads the signal an ancestor provides, never writes it, so hits
// stay H-holes (`SHELL-HIT`) — the retained frame is watched, unchanged after the fill and every hit.
const Tally = createContext<{ seen: Signal<number> } | null>(null);

export const loader = load(
  async ({ cookies }) => {
    await gate("user");
    return { name: cookies.get("user") ?? "guest" };
  },
  { defer: true },
);

function Counted(props: { children: DOMValue }) {
  const seen = signal(0);
  return (
    <Provider token={Tally} value={{ seen }}>
      {props.children}
    </Provider>
  );
}

export default function TallyRead({ data }: PageProps<typeof loader>) {
  return (
    <section>
      <Counted>
        <Async load={() => data} fallback={() => <span id="tally-wait">…</span>}>
          {(user) => {
            const tally = useContext(Tally)!;

            return (
              <p id="tally">
                Seen {String(tally.seen())} by {user.name}
              </p>
            );
          }}
        </Async>
      </Counted>
    </section>
  );
}
