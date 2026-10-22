import { signal } from "@rivetjs/reactivity";

// CSR: the client applies route heads (the shell has none).
export const head = { title: "CSR home" };

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
