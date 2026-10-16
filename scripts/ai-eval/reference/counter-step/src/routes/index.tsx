import { signal } from "@rivetjs/reactivity";

export const head = { title: "Counter" };

export default function Home() {
  const count = signal(0);
  const step = signal(1);
  return (
    <main class="p-6">
      <label for="step">Step</label>
      <input id="step" type="number" value={step()} onInput={(event) => step.set(Number(event.currentTarget.value) || 0)} />
      <button id="dec" type="button" onClick={() => count.update((n) => n - step())}>
        Subtract
      </button>
      <output id="count">{count()}</output>
      <button id="inc" type="button" onClick={() => count.update((n) => n + step())}>
        Add
      </button>
    </main>
  );
}
