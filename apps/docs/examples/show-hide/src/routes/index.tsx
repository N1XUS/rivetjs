import { signal } from "@rivetjs/reactivity";

export const head = { title: "Show and hide" };

// #region demo
export default function Details() {
  const open = signal(false);
  const plan = signal<"free" | "pro">("free");
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <div class="flex gap-2">
        <button
          id="toggle"
          type="button"
          class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
          aria-expanded={open() ? "true" : "false"}
          onClick={() => open.update((value) => !value)}
        >
          {open() ? "Hide details" : "Show details"}
        </button>
        <button id="plan" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={() => plan.update((p) => (p === "free" ? "pro" : "free"))}>
          Switch plan
        </button>
      </div>
      {/* The panel exists only while open() is true; otherwise nothing is rendered. */}
      {open() && <p id="details" class="rounded bg-slate-100 p-3">Details are visible now.</p>}
      {/* A ternary picks one of two branches. */}
      <p id="price">{plan() === "pro" ? <strong>Pro: $9 a month</strong> : <span>Free plan</span>}</p>
      {/* `hidden` keeps the element (and what you typed) on the page, only hidden. */}
      <input id="note" class="rounded border border-slate-300 px-2 py-1" placeholder="Pro note" hidden={plan() !== "pro"} />
    </div>
  );
}
// #endregion
