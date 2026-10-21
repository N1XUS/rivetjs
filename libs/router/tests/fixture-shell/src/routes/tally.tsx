import { load, type PageProps } from "@rivetjs/router";
import { Async, Provider, type DOMValue } from "@rivetjs/runtime/dom";
import { createContext, signal, useContext, type Signal } from "@rivetjs/reactivity";
import { gate } from "../gate.server.ts";

// PPR-T57: an ancestor component provides a signal through context; the hole writes it on the server. A hit that re-ran
// only the hole under the fill's retained frame would count on from the previous visitor (`Seen 2`, `Seen 3`, …), so
// the fill sees the write and the entry replays (`SHELL-HIT-REPLAY`); `tally-read.tsx` only reads it (H-holes).
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

export default function TallyPage({ data }: PageProps<typeof loader>) {
  return (
    <section>
      <Counted>
        <Async load={() => data} fallback={() => <span id="tally-wait">…</span>}>
          {(user) => {
            const tally = useContext(Tally)!;
            tally.seen.set(tally.seen() + 1);
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
