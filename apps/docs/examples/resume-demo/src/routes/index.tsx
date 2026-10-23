import { signal } from "@rivetjs/reactivity";

export const head = { title: "Resume demo" };

// #region demo
export default function ResumeDemo() {
  // The time is taken while the HTML is made (here: at build time) and kept in a signal: its value is written into
  // the page, so when the browser picks this component up on the first click it reads that value, not a new time.
  const renderedAt = signal(new Date().toISOString().slice(0, 19).replace("T", " "));
  const count = signal(0);

  // Nothing runs in the browser until you click; then the click handler runs.
  return (
    <div class="m-4 space-y-3">
      <p id="rendered" class="text-sm text-slate-600">
        Component rendered at {renderedAt()} UTC
      </p>
      <button
        id="add"
        type="button"
        class="rounded-md bg-teal-700 px-4 py-2 font-semibold text-white"
        onClick={() => count.update((n) => n + 1)}
      >
        Add one
      </button>
      <p id="count">Count: {count()}</p>
    </div>
  );
}
// #endregion
