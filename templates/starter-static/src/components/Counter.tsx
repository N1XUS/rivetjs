import { signal } from "@rivetjs/reactivity";

/** A button that counts clicks. Its code loads when you first point at it. */
export function Counter() {
  const count = signal(0);
  return (
    <button
      type="button"
      class="mt-4 rounded-md bg-teal-700 px-4 py-2 font-semibold text-white"
      onClick={() => count.update((n) => n + 1)}
    >
      Clicked {count()} times
    </button>
  );
}
