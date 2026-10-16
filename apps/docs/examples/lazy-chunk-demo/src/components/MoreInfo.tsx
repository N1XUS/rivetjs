import { signal } from "@rivetjs/reactivity";

// A second component: its code is a separate file. Using the Like button does not load it.
export function MoreInfo() {
  const open = signal(false);
  return (
    <div>
      <button id="more" type="button" class="rounded-md border border-teal-700 px-3 py-1 text-teal-700" onClick={() => open.update((value) => !value)}>
        {open() ? "Hide details" : "Show details"}
      </button>
      <p id="details" class="mt-2 text-sm text-slate-600">
        {open() ? "Science fiction, first published in 1965." : ""}
      </p>
    </div>
  );
}
