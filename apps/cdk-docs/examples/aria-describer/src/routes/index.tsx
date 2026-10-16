import { ref } from "@rivetjs/runtime/dom";
import { getAriaDescriber } from "@rivetjs/cdk/a11y/aria-describer";

export const head = { title: "AriaDescriber" };

const btn = "rounded border border-slate-300 px-2 py-1";

// #region demo
export default function Actions() {
  const remove = ref<HTMLButtonElement>();
  const archive = ref<HTMLButtonElement>();
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div class="flex gap-2">
        <button id="delete" ref={remove} type="button" class={btn} aria-describedby="own-hint">
          Delete
        </button>
        <button id="archive" ref={archive} type="button" class={btn}>
          Archive
        </button>
      </div>
      <p id="own-hint">Removes the file.</p>
      <div class="flex gap-2">
        <button
          id="describe"
          type="button"
          class={btn}
          onClick={() => {
            // One shared message element for both hosts (reference counted).
            getAriaDescriber().describe(remove()!, "Cannot be undone");
            getAriaDescriber().describe(archive()!, "Cannot be undone");
          }}
        >
          Describe both
        </button>
        <button
          id="undescribe"
          type="button"
          class={btn}
          onClick={() => {
            getAriaDescriber().removeDescription(remove()!, "Cannot be undone");
            getAriaDescriber().removeDescription(archive()!, "Cannot be undone");
          }}
        >
          Remove descriptions
        </button>
      </div>
    </section>
  );
}
// #endregion
