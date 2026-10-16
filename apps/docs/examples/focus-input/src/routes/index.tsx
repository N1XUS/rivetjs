import { signal } from "@rivetjs/reactivity";

export const head = { title: "Focus an input" };

// #region demo
export default function Search() {
  // `input` will hold the real <input> element in the browser.
  let input!: HTMLInputElement;
  const length = signal(0);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <input
        id="query"
        class="rounded border border-slate-300 px-2 py-1"
        placeholder="Search"
        ref={(el) => (input = el)}
        onInput={() => length.set(input.value.length)}
      />
      <div class="flex items-center gap-3">
        <button
          id="focus"
          type="button"
          class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
          onClick={() => {
            input.focus();
            input.select();
          }}
        >
          Focus the field
        </button>
        <span id="length" class="text-slate-600">{length()} characters</span>
      </div>
    </div>
  );
}
// #endregion
