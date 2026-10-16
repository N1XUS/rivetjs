// Resumed spreads and classes added by client code (resume-spread-class-browser.test.ts): a DOM plugin (embla
// ClassNames) adds `is-snapped` at init; the spread's first run must leave an unchanged class alone.
import { signal } from "@rivetjs/reactivity";

export function Page() {
  const n = signal(1);
  const on = signal(false);
  const extra = { "data-kind": "slide" };
  return (
    <main>
      <button id="inc" onClick={() => n.set(n() + 1)}>
        inc
      </button>
      <button id="flip" onClick={() => on.set(!on())}>
        flip
      </button>
      {/* Class constant, another key reads `n`. */}
      <div id="keep" class="slide  embla__slide" {...extra} data-n={n()} />
      {/* Class reads `on`, another key reads `n`. */}
      <div id="swap" {...extra} class={on() ? "slide on" : "slide"} data-n={n()} />
      {/* No class on the server. */}
      <div id="none" {...extra} data-n={n()} />
    </main>
  );
}
