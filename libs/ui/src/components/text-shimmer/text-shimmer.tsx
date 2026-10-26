// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no text shimmer). Feature set inspired by HeroUI Pro's public
// TextShimmer docs (shimmering label for streaming / thinking states, `currentColor`, text at 45% alpha, a sweeping
// highlight that only animates `translate`, `--spread`, solid text under reduced motion); independent implementation,
// Rivet-authored styles.
// - Markup: one span; CSS paints its own text with a moving gradient (`background-clip: text`, transparent fill), so
//   there is no duplicated text node (screen readers read it once, no positioned layers to escape the root).
// - Pure markup + CSS animation: no script. `data-active="false"` turns the gradient off in CSS (an `isActive` accessor
//   toggles one attribute, nothing re-renders).
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { textShimmerVariants } from "../../../styles/src/components/text-shimmer/index.ts";
// `text-shimmer` is a core token tailwind-merge reads as a utility: any override merges (`UTILITY_CORE_TOKENS`).
import "../../../styles/src/utils/tv-merge.ts";
import { splitLive } from "../../utils/live.tsx";

const BASE = textShimmerVariants().base();

interface TextShimmerProps extends Omit<JSX.IntrinsicElements["span"], "class" | "children"> {
  /** The label (short text). */
  children?: Content;
  /** Classes of the root (colour and text size utilities work: the shimmer uses `currentColor`). */
  class?: string;
  /** Whether the highlight sweeps (default `true`); `false` renders the text solid. A value or an accessor (reactive). */
  isActive?: boolean | (() => boolean);
}

const TextShimmerRoot = (props: TextShimmerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "isActive"]);
  const active = (): boolean => {
    const value = local.isActive;
    return (typeof value === "function" ? value() : value) !== false;
  };
  return (
    // Joined, not tailwind-merged: tailwind-merge reads `text-shimmer` as a text colour and drops it next to `text-muted`.
    <span class={local.class ? `${BASE} ${local.class}` : BASE} data-slot="text-shimmer" data-active={() => (active() ? "true" : "false")} {...rest}>
      {local.children}
    </span>
  );
};

export { TextShimmerRoot };
export type { TextShimmerProps };
