import { signal } from "@rivetjs/reactivity";
import { mergeProps } from "@rivetjs/cdk/interactions/merge-props";
import { pressProps } from "@rivetjs/cdk/interactions/press";
import { hoverProps } from "@rivetjs/cdk/interactions/hover";
import { useFocusRing } from "@rivetjs/cdk/focus-ring";

export const head = { title: "Interaction states with Tailwind" };

// #region demo
export default function Chip() {
  const count = signal(0);
  const press = pressProps({ onPress: () => count.update((n) => n + 1) });
  const hover = hoverProps({});
  const { focusProps, isFocused, isFocusVisible } = useFocusRing();
  return (
    <section class="m-4 flex items-center gap-3 text-sm">
      <button id="before" type="button" class="underline">
        Before
      </button>
      <div
        id="chip"
        role="button"
        tabIndex={0}
        {...mergeProps(press.pressProps, hover.hoverProps, focusProps)}
        data-pressed={press.isPressed() || undefined}
        data-hovered={hover.isHovered() || undefined}
        data-focused={isFocused() || undefined}
        data-focus-visible={isFocusVisible() || undefined}
        class="select-none rounded-full border border-slate-300 px-4 py-1.5 outline-none transition data-[hovered]:border-teal-600 data-[hovered]:bg-teal-50 data-[pressed]:scale-95 data-[pressed]:bg-teal-100 data-[focus-visible]:ring-2 data-[focus-visible]:ring-teal-600 data-[focus-visible]:ring-offset-2"
      >
        Like <span id="count">{count()}</span>
      </div>
    </section>
  );
}
// #endregion
