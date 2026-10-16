import { signal } from "@rivetjs/reactivity";

export default function Home() {
  const count = signal(0);
  return (
    <section>
      <h1>CSR home</h1>
      <button type="button" onClick={() => count.update((value) => value + 1)}>
        Count {count()}
      </button>
      <a href="/about">About</a>
    </section>
  );
}
