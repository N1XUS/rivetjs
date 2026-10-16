/// <reference types="vite/client" />
import { signal } from "@rivetjs/reactivity";
import { css, cx } from "@rivetjs/runtime/css";
import notes from "./styles.module.css";

export const head = { title: "Scoped styles" };

// Compiled away: the sheet goes through Vite's CSS pipeline (linked for this route only) and
// `styles.card` folds to its scoped class name.
const styles = css`
  .card {
    border: 1px solid rgb(13 148 136 / 0.4);
    border-radius: 0.75rem;
    padding: 1.25rem;
  }
  .active {
    background: rgb(240 253 250);
  }
  .card :global(code) {
    font-weight: 600;
  }
`;

export default function Styles() {
  const active = signal(false);
  return (
    <section class="space-y-4">
      <h1 class="text-2xl font-semibold">Scoped styles</h1>
      <div class={cx(styles.card, active() && styles.active)}>
        <p>
          A <code>css``</code> block: class names scoped per module, emitted as a real stylesheet in{" "}
          <code>@layer components</code>.
        </p>
        <button type="button" class="mt-3 underline" onClick={() => active.update((on) => !on)}>
          {active() ? "Deactivate" : "Activate"}
        </button>
      </div>
      <p class={notes.note}>And a CSS module (`styles.module.css`) with the same naming scheme.</p>
    </section>
  );
}
