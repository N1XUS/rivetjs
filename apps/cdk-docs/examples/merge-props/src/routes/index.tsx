import { signal } from "@rivetjs/reactivity";
import { mergeProps } from "@rivetjs/cdk/interactions/merge-props";
import { pressProps } from "@rivetjs/cdk/interactions/press";
import { hoverProps } from "@rivetjs/cdk/interactions/hover";
import { focusProps } from "@rivetjs/cdk/interactions/focus";

export const head = { title: "mergeProps" };

// #region demo
export default function Tile() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  const press = pressProps({ onPress: () => add("press") });
  const hover = hoverProps({ onHoverStart: () => add("hover:start"), onHoverEnd: () => add("hover:end") });
  const focus = focusProps({ onFocus: () => add("focus"), onBlur: () => add("blur") });
  // mergeProps chains handlers of the same name and joins the class values (`tile tile--interactive`).
  const props = mergeProps({ class: "tile" }, press.pressProps, hover.hoverProps, focus.focusProps, { class: "tile--interactive", "data-pressable": "" });
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div id="tile" role="button" tabIndex={0} {...props}>
        Tile
      </div>
      <button id="away" type="button" class="justify-self-start rounded border border-slate-300 px-2 py-1">
        Elsewhere
      </button>
      <output id="log" class="block font-mono text-xs">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
