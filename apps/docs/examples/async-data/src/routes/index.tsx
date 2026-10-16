import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/dom";

export const head = { title: "Async data" };

const people = ["Ada Lovelace", "Grace Hopper", "Alan Turing"];

/** Pretend network call: resolves after a short delay, or rejects if the request is cancelled. */
function fetchPerson(id: number, signal: AbortSignal): Promise<{ id: number; name: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ id, name: people[id % people.length]! }), 400);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

// #region demo
export default function Person() {
  const id = signal(0);

  // One Async boundary for one id. `work.signal` is aborted when this boundary is replaced.
  const card = (current: number) => (
    <Async
      load={(work) => fetchPerson(current, work.signal)}
      fallback={() => <span class="text-slate-400">Loading…</span>}
      error={() => <span class="text-red-700">Could not load.</span>}
    >
      {(person) => <span>{person.name}</span>}
    </Async>
  );

  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <button
        id="next"
        type="button"
        class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
        onClick={() => id.update((n) => n + 1)}
      >
        Next person
      </button>
      {/* This expression reads id(). When id changes, Rivet renders it again: a new load starts. */}
      <p id="user" class="text-lg">
        {card(id())}
      </p>
    </div>
  );
}
// #endregion
