import { signal } from "@rivetjs/reactivity";

export const head = { title: "Resume demo" };

// #region demo
export default function ResumeDemo() {
  // This line runs once, while the HTML is made (here: at build time).
  // It never runs in the browser, so the time below never changes.
  const renderedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
  const count = signal(0);

  // Only the click handler runs in the browser, when you click.
  return (
    <div class="m-4 space-y-3">
      <p id="rendered" class="text-sm text-slate-600">
        Component ran at {renderedAt} UTC
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
