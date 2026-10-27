import { signal } from "@rivetjs/reactivity";

/** A button that counts clicks. The browser fetches its code when idle after load and runs it on the first click. */
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
