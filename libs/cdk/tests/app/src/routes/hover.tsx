import { signal } from "@rivetjs/reactivity";
import { hoverProps } from "@rivetjs/cdk/interactions/hover";
import { useFocusRing } from "@rivetjs/cdk/focus-ring";

export const head = { title: "Hover" };

export default function HoverStory() {
  const events = signal<string[]>([]);
  const { hoverProps: hover, isHovered } = hoverProps({
    onHoverStart: (e) => events.update((l) => [...l, "start:" + e.pointerType]),
    onHoverEnd: (e) => events.update((l) => [...l, "end:" + e.pointerType]),
  });
  const { focusProps: ringProps, isFocused: ringFocused, isFocusVisible: ringVisible } = useFocusRing();
  const { focusProps: withinProps, isFocusVisible: withinVisible } = useFocusRing({ within: true });
  return (
    <section>
      <div id="hover" {...hover} data-hovered={isHovered() ? "true" : "false"}>
        Hover <span id="hover-child">child</span>
      </div>
      <p id="hover-log">{events().join(" ")}</p>
      <button id="before" type="button">
        Before
      </button>
      <button id="ring" type="button" {...ringProps} data-focused={ringFocused() ? "true" : "false"} data-focus-visible={ringVisible() ? "true" : "false"}>
        Ring
      </button>
      <div id="within" {...withinProps} data-focus-visible={withinVisible() ? "true" : "false"}>
        <input id="within-input" aria-label="Within" />
      </div>
    </section>
  );
}
