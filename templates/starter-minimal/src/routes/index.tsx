import { signal } from "@rivetjs/reactivity";

export const head = { title: "Minimal Rivet app" };

/** One page, one piece of state. */
export default function Home() {
  const count = signal(0);
  return (
    <main>
      <h1>Hello</h1>
      <button type="button" onClick={() => count.update((n) => n + 1)}>
        Clicked {count()} times
      </button>
    </main>
  );
}
