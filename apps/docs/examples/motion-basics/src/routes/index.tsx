import { signal } from "@rivetjs/reactivity";
import { Motion } from "@rivetjs/motion";
// Entrances in content streamed after the head use inline custom properties; this sheet plays them.
import "@rivetjs/motion/entrance.css";

export const head = { title: "Motion basics" };

const cards = ["Signals", "Resume", "Streaming", "Routing"];

// #region demo
export default function MotionBasics() {
  // Live target: changing the signal animates the cards with Motion (the code loads on the first click).
  const dimmed = signal(false);
  return (
    <section class="m-4 grid gap-3">
      <ul id="cards" class="grid gap-2">
        {cards.map((name, i) => (
          <Motion.li
            class="rounded-md border border-slate-300 bg-white px-4 py-3 font-medium text-slate-800"
            // The entrance plays as CSS: the server writes the final state and one @keyframes rule.
            initial={{ opacity: 0, y: 12 }}
            animate={() => (dimmed() && i > 0 ? { opacity: 0.35, scale: 0.97 } : { opacity: 1, y: 0, scale: 1 })}
            transition={{ duration: 0.35, delay: i * 0.06 }}
          >
            {name}
          </Motion.li>
        ))}
      </ul>
      <button id="toggle" type="button" class="justify-self-start rounded-md bg-teal-700 px-4 py-2 font-semibold text-white" onClick={() => dimmed.update((d) => !d)}>
        {dimmed() ? "Show all" : "Dim the rest"}
      </button>
    </section>
  );
}
// #endregion
