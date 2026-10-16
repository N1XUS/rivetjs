// Rivet-authored showcase piece: soft colour blobs drifting on a <canvas> (no image, no external asset).
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { startAurora } from "./aurora.ts";

// #region demo
/**
 * Animated backdrop for a panel with the `aurora` class. The server renders the panel's CSS gradient;
 * the canvas starts once it is visible (never while the panel is hidden), pauses off screen and in
 * background tabs, and draws one still frame with reduced motion.
 */
export function AuroraCanvas() {
  const canvas = ref<HTMLCanvasElement>();
  clientEffect(
    () => {
      const el = canvas();
      return el ? startAurora(el) : undefined;
    },
    { when: "visible" },
  );
  return (
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <canvas ref={canvas} class="size-full opacity-0 transition-opacity duration-1000" />
      <div class="aurora-grain absolute inset-0" />
      {/* Keeps the quote legible over the brightest blob. */}
      <div class="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/55 via-black/20 to-transparent" />
    </div>
  );
}
// #endregion
