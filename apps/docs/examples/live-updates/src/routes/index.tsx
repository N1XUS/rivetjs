import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { PageProps } from "@rivetjs/router";
import { currentVisitors } from "../visitors.server.ts";
import { load } from "@rivetjs/router";

export const head = { title: "Live updates" };

// #region demo
// The first value comes with the HTML, so the page is never empty. Server only.
export const loader = load(() => ({ visitors: currentVisitors() }));

export default function Live({ data }: PageProps<typeof loader>) {
  const visitors = signal(data.visitors);
  const status = signal<"connecting" | "live" | "reconnecting">("connecting");

  // Browser only. Opens the connection when the browser is idle and closes it when the page goes away.
  clientEffect(() => {
    const source = new EventSource("/events");
    source.onopen = () => status.set("live");
    source.onmessage = (event) => visitors.set((JSON.parse(event.data) as { visitors: number }).visitors);
    // EventSource reconnects by itself after an error.
    source.onerror = () => status.set("reconnecting");
    return () => source.close();
  });

  return (
    <main class="p-6">
      <p class="text-sm text-slate-600">
        Visitors right now <span id="status">({status()})</span>
      </p>
      <p id="visitors" class="text-4xl font-bold" aria-live="polite">
        {visitors()}
      </p>
    </main>
  );
}
// #endregion
