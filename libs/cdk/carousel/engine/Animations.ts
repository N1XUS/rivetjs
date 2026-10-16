// Ported from embla-carousel (packages/embla-carousel/src/components/Animations.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: the fixed-timestep loop itself is `AnimationLoop` of `@rivetjs/cdk/motion` (`../../motion/Animations.ts`,
// same code, scheduler = `ownerWindow`); this file keeps upstream's carousel-facing `Animations` (same signature,
// `init` = reset the loop clock when the document is hidden, `destroy`).
import type { EngineType } from "./Engine.ts";
import { EventStore } from "./EventStore.ts";
import type { WindowType } from "./utils.ts";
import { AnimationLoop } from "../../motion/Animations.ts";

export type AnimationsUpdateType = (engine: EngineType) => void;
export type AnimationsRenderType = (engine: EngineType, alpha: number) => void;

export type AnimationsType = {
  init: () => void;
  destroy: () => void;
  start: () => void;
  stop: () => void;
  update: () => void;
  render: (alpha: number) => void;
};

export function Animations(ownerDocument: Document, ownerWindow: WindowType, update: () => void, render: (alpha: number) => void): AnimationsType {
  const documentVisibleHandler = EventStore();
  const loop = AnimationLoop(update, render, {
    requestAnimationFrame: (callback) => ownerWindow.requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => ownerWindow.cancelAnimationFrame(handle),
  });

  function init(): void {
    documentVisibleHandler.add(ownerDocument, "visibilitychange", () => {
      if (ownerDocument.hidden) loop.reset();
    });
  }

  function destroy(): void {
    loop.stop();
    documentVisibleHandler.clear();
  }

  const self: AnimationsType = {
    init,
    destroy,
    start: loop.start,
    stop: loop.stop,
    update,
    render,
  };
  return self;
}
