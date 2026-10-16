import { signal } from "@rivetjs/reactivity";
import { pressProps } from "@rivetjs/cdk/interactions/press";

export const head = { title: "Press propagation" };

// #region demo
export default function Card() {
  const log = signal("none");
  const parent = signal(0);
  // Default: the press stops here; the card's click listener never sees it.
  const stop = pressProps({ onPress: () => log.set("stop") });
  // continuePropagation(): the click bubbles on to the card.
  const pass = pressProps({
    onPress: (e) => {
      e.continuePropagation();
      log.set("pass");
    },
  });
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div id="card" class="grid gap-2 rounded-md border border-slate-300 p-3" onClick={() => parent.update((n) => n + 1)}>
        <p id="parent-count">Card clicks: {parent()}</p>
        <div class="flex gap-2">
          <div id="stop" role="button" tabIndex={0} {...stop.pressProps} class="rounded-md bg-teal-700 px-3 py-1 text-white">
            Stops
          </div>
          <div id="pass" role="button" tabIndex={0} {...pass.pressProps} class="rounded-md border border-teal-700 px-3 py-1">
            Continues
          </div>
        </div>
      </div>
      <output id="log">Last: {log()}</output>
    </section>
  );
}
// #endregion
