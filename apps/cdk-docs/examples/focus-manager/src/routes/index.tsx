import { FocusScope, useFocusManager } from "@rivetjs/cdk/focus-scope";

export const head = { title: "useFocusManager" };

const tool = "rounded border border-slate-300 px-3 py-1 focus-visible:outline-2 focus-visible:outline-teal-700";

// #region demo
export default function Formatting() {
  // Resolves the scope from the focused element when a method runs.
  const manager = useFocusManager();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") manager.focusNext({ wrap: true });
    else if (e.key === "ArrowLeft") manager.focusPrevious({ wrap: true });
    else if (e.key === "Home") manager.focusFirst();
    else if (e.key === "End") manager.focusLast();
    else return;
    e.preventDefault();
  };
  return (
    <FocusScope>
      <div role="toolbar" aria-label="Formatting" class="m-4 flex gap-2 text-sm" onKeyDown={onKeyDown}>
        <button id="bold" type="button" class={tool}>
          Bold
        </button>
        <button id="italic" type="button" class={tool}>
          Italic
        </button>
        <button id="underline" type="button" class={tool}>
          Underline
        </button>
      </div>
    </FocusScope>
  );
}
// #endregion
