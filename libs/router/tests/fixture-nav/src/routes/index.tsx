import { signal } from "@rivetjs/reactivity";

// No head title: the announcer falls back to the page's h1.
export default function Home() {
  const count = signal(0);
  return (
    <section class="tall">
      <h1>Home</h1>
      <button type="button" id="count" onClick={() => count.update((n) => n + 1)}>
        Count {count()}
      </button>
      <a href="#one" id="to-one">To one</a>
      <p id="one" class="far">
        One <a href="#one" id="again-one">Again</a> <a href="/" id="no-hash">Top</a>
      </p>
    </section>
  );
}
