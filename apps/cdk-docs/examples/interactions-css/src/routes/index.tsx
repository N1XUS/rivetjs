import { signal } from "@rivetjs/reactivity";
import { mergeProps } from "@rivetjs/cdk/interactions/merge-props";
import { pressProps } from "@rivetjs/cdk/interactions/press";
import { hoverProps } from "@rivetjs/cdk/interactions/hover";
import { useFocusRing } from "@rivetjs/cdk/focus-ring";

export const head = { title: "Interaction states with CSS" };

// #region demo
export default function Chip() {
  const count = signal(0);
  const press = pressProps({ onPress: () => count.update((n) => n + 1) });
  const hover = hoverProps({});
  const { focusProps, isFocusVisible } = useFocusRing();
  return (
    <section class="demo">
      <button id="before" type="button" class="link">
        Before
      </button>
      <div
        id="chip"
        class="chip"
        role="button"
        tabIndex={0}
        {...mergeProps(press.pressProps, hover.hoverProps, focusProps)}
        data-pressed={press.isPressed() || undefined}
        data-hovered={hover.isHovered() || undefined}
        data-focus-visible={isFocusVisible() || undefined}
      >
        Like <span id="count">{count()}</span>
      </div>
    </section>
  );
}
// #endregion
