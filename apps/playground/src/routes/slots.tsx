// Demo: web-component slots (`<slot r:name>` / `r:slot`) and in-file server code (`serverLoad`,
// `onGet`) in one route module. Server code is removed from the browser build.
import { signal } from "@rivetjs/reactivity";
import type { PageProps, RequestEvent } from "@rivetjs/router";
import type { Content, Slot, Slots } from "@rivetjs/runtime/jsx-runtime";

export async function serverLoad({ url }: RequestEvent) {
  return { rows: ["Lazy slot content", "Scoped slot arguments", "Fallbacks"], renderedAt: new Date().toISOString(), path: url.pathname };
}
// `/slots?format=json`: answered by the route's request handler before the page renders.
export const onGet = async (event: RequestEvent) =>
  event.url.searchParams.get("format") === "json" ? Response.json(await serverLoad(event)) : undefined;

/** Slots demo: named slots with fallbacks, a default slot, and a scoped slot called per row. */
export interface SlotCardProps extends Slots<"header" | "footer"> {
  rows: readonly string[];
  row?: Slot<[item: () => string, index: () => number]>;
  children?: Content;
}

export function SlotCard({ header, footer, row, rows, children }: SlotCardProps) {
  const open = signal(false);
  return (
    <article class="rounded border p-4">
      <header class="flex items-center justify-between">
        <slot r:name="header">
          <h2>Untitled card</h2>
        </slot>
        <button type="button" onClick={() => open.update((v) => !v)}>
          {open() ? "Hide" : "Show"} details
        </button>
      </header>
      <slot />
      {open() ? (
        <ul id="slot-rows">
          {rows.map((text, i) => (
            <slot r:name="row" r:args={[() => text, () => i]}>
              <li>{text}</li>
            </slot>
          ))}
        </ul>
      ) : (
        <p id="slot-closed">Details hidden</p>
      )}
      <footer>
        <slot r:name="footer">
          <small>No footer</small>
        </slot>
      </footer>
    </article>
  );
}

export const head = { title: "Slots · Rivet playground" };
export default function SlotsPage({ data }: PageProps<typeof serverLoad>) {
  const likes = signal(0);
  return (
    <section class="space-y-4">
      <SlotCard rows={data.rows} row={(item, index) => <li>{index() + 1}. {item()} ({likes()} likes)</li>}>
        <h2 r:slot="header">Slots in Rivet</h2>
        <p>Default slot content, rendered at {data.renderedAt}.</p>
        <button r:slot="footer" type="button" onClick={() => likes.update((n) => n + 1)}>
          Like ({likes()})
        </button>
      </SlotCard>
      <SlotCard rows={[]}>Card without named slots: fallbacks render.</SlotCard>
    </section>
  );
}
