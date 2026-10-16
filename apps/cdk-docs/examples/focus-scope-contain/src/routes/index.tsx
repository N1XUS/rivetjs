import { FocusScope } from "@rivetjs/cdk/focus-scope";

export const head = { title: "FocusScope" };

// #region demo
export default function InlineEditor() {
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <button id="before" type="button" class="justify-self-start rounded border border-slate-300 px-2 py-1">
        Before
      </button>
      {/* Tab and Shift+Tab wrap inside the scope instead of leaving it. */}
      <FocusScope contain class="grid gap-2 rounded-md border border-teal-700 p-3">
        <label class="grid gap-1">
          Title <input id="title" class="rounded border border-slate-300 px-2 py-1" value="Draft" />
        </label>
        <div class="flex gap-2">
          <button id="save" type="button" class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white">
            Save
          </button>
          <button id="cancel" type="button" class="rounded-md border border-slate-300 px-3 py-1">
            Cancel
          </button>
        </div>
      </FocusScope>
      <button id="after" type="button" class="justify-self-start rounded border border-slate-300 px-2 py-1">
        After
      </button>
    </section>
  );
}
// #endregion
