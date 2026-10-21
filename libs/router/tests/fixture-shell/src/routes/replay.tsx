import { load, type PageProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { gate } from "../gate.server.ts";

// An H-holes ineligible hole: the page creates a signal in the shell (its context frame may hold it), so hits of this
// route replay the shell (`x-rivet-cache: SHELL-HIT-REPLAY`), the layout's eligible hole included.
export const loader = load(
  async ({ cookies }) => {
    await gate("user");
    return { stock: (cookies.get("user") ?? "guest").length };
  },
  { defer: true },
);

export default function Replay({ data }: PageProps<typeof loader>) {
  const picked = signal(0);
  return (
    <section>
      <button id="pick" type="button" onClick={() => picked.update((n) => n + 1)}>
        Picked {picked()}
      </button>
      <Async load={() => data} fallback={() => <span id="stock-wait">…</span>}>
        {(stock) => <p id="stock">Stock {String(stock.stock)}</p>}
      </Async>
    </section>
  );
}
