import { signal } from "@rivetjs/reactivity";
import { css, cx } from "@rivetjs/runtime/css";

export const head = { title: "Scoped card" };

// #region demo
// One css`` block, at the top level of the file. The compiler makes each class
// name unique to this file and moves the CSS into the page's stylesheet.
const styles = css`
  .card {
    margin: 1rem;
    max-width: 20rem;
    border: 2px solid #cbd5e1;
    border-radius: 0.75rem;
    padding: 1rem;
  }
  .selected {
    border-color: #0f766e;
    background: #f0fdfa;
  }
  .card :global(code) {
    font-weight: 600;
  }
`;

export default function ScopedCard() {
  const selected = signal(false);
  // cx joins class names and skips false values.
  return (
    <article class={cx(styles.card, selected() && styles.selected)}>
      <p>
        This card uses the <code>.card</code> class from its own file.
      </p>
      <button id="toggle" type="button" class="mt-3 underline" onClick={() => selected.update((on) => !on)}>
        {selected() ? "Selected" : "Select"}
      </button>
    </article>
  );
}
// #endregion
