import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

export const head = { title: "Clock" };

export default function Home() {
  const ticks = signal(0);
  const running = signal(true);
  // Browser only; re-runs when `running` changes, and the returned cleanup stops the old timer first.
  clientEffect(
    () => {
      if (!running()) return;
      const timer = setInterval(() => ticks.update((n) => n + 1), 1000);
      return () => clearInterval(timer);
    },
    { when: "load" },
  );
  return (
    <main class="p-6">
      <p>
        Seconds: <span id="ticks">{ticks()}</span>
      </p>
      <button id="pause" type="button" onClick={() => running.update((on) => !on)}>
        {running() ? "Pause" : "Resume"}
      </button>
    </main>
  );
}
