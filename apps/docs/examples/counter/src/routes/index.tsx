import { signal } from "@rivetjs/reactivity";

export const head = { title: "Counter" };

// #region demo
export default function Counter() {
  // A signal holds a value and tells the page when it changes.
  const count = signal(0);
  return (
    <button
      id="count"
      type="button"
      class="m-4 rounded-md bg-teal-700 px-4 py-2 font-semibold text-white"
      onClick={() => count.update((n) => n + 1)}
    >
      Clicked {count()} {count() === 1 ? "time" : "times"}
    </button>
  );
}
// #endregion
