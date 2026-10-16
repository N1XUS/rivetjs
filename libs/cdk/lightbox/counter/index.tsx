// Ported from yet-another-react-lightbox (src/plugins/counter/Counter.tsx, v3.32.2), MIT, © Igor Danchenko.
// Rivet: a part (`<LightboxCounter />`, position it with CSS) instead of a controller-level module; `aria-hidden` like
// YARL (the slide group label "k of n" already announces the position).
import type { StyleObject } from "@rivetjs/runtime/style";
import { useLightbox } from "../index.tsx";
import { lightboxIndex, lightboxSlides } from "../state.ts";

export interface LightboxCounterProps {
  /** @default "rv-LightboxCounter" */
  class?: string;
  style?: StyleObject;
  /** Text between the index and the total. @default "/" */
  separator?: string;
}

/** Slide counter `index / total` (YARL Counter). Renders nothing for an empty lightbox. */
export function LightboxCounter(props: LightboxCounterProps) {
  const state = useLightbox();
  const cls = props.class ?? "rv-LightboxCounter",
    style = props.style,
    separator = props.separator ?? "/";
  return (
    <div class={cls} style={style as never} aria-hidden="true" data-lightbox-counter="" hidden={lightboxSlides(state).length === 0}>
      {`${lightboxIndex(state) + 1} ${separator} ${lightboxSlides(state).length}`}
    </div>
  );
}
