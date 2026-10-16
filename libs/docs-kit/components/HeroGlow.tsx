import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { mountGlow } from "./hero-glow.ts";

/**
 * Soft brand glow behind a hero visual. Server markup = the element with its static CSS glow (first
 * paint, no JS, reduced motion); at idle `hero-glow.ts` draws drifting blobs on a small canvas and sets
 * `data-live`, which cross-fades the static glow out. Colours / alphas / centres: `--glow-*` custom
 * properties on `class` (see hero-glow.ts). Decorative: `aria-hidden`.
 */
export function HeroGlow({ class: className }: { class?: string }) {
  const root = ref<HTMLElement>();
  clientEffect(() => mountGlow(root()!), { when: "idle" });
  return (
    <div class={className ? `hero-glow ${className}` : "hero-glow"} ref={root} aria-hidden="true">
      <canvas class="hero-glow-canvas" width="8" height="8" />
    </div>
  );
}
