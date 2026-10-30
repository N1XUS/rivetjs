import { signal } from "@rivetjs/reactivity";
import { load, type PageProps } from "@rivetjs/router";
export const loader = load(() => ({ date: new Date("2026-01-02T00:00:00Z"), big: 42n, map: new Map([["n", 7]]), set: new Set(["a"]) }));
export default function Rich({ data }: PageProps<typeof loader>) {
  const count = signal(0);
  return (
    <main>
      <h1>Rich loader data</h1>
      <p id="rich-value">
        {data.date.toISOString()}|{String(data.big)}|{data.map.get("n")}|{String(data.set.has("a"))}
      </p>
      <button id="rich-click" onClick={() => count.update((n) => n + 1)}>
        Resume
      </button>
      <output id="rich-counter">{count()}</output>
    </main>
  );
}
