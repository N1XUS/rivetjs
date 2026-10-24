import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { Pause, Play } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { mountHomeAurora } from "./home-aurora.ts";

export function HomeCanvas() {
  const root = ref<HTMLElement>();
  clientEffect(() => (root() ? mountHomeAurora(root()!) : undefined), { when: "visible" });
  return (
    <div class="hs-backdrop" ref={root}>
      <div class="hs-aurora" aria-hidden="true">
        <canvas width="8" height="8" />
      </div>
      <button
        type="button"
        class="hs-ambient-control"
        aria-label="Pause background animation"
        aria-pressed="false"
        onClick={(event) => {
          const button = (event.target as Element).closest("button")!;
          const backdrop = button.closest(".hs-backdrop")!;
          const paused = backdrop.toggleAttribute("data-paused");
          button.setAttribute("aria-label", paused ? "Resume background animation" : "Pause background animation");
          button.setAttribute("aria-pressed", String(paused));
        }}
      >
        <span class="hs-ambient-pause">
          <Icon icon={Pause} size={13} />
        </span>
        <span class="hs-ambient-play">
          <Icon icon={Play} size={13} />
        </span>
        <span>Ambient motion</span>
      </button>
    </div>
  );
}
