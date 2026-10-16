// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no trend chip). Feature set inspired by HeroUI Pro's public TrendChip
// docs (direction of a change with an icon and a colour; sizes); independent implementation, Rivet-authored styles.
// - `trend` up / down / neutral picks the lucide icon (`TrendingUp` / `TrendingDown` / `Minus`); the colour follows whether
//   the change is good: up = positive (success) unless `isInverted` (lower is better, e.g. churn or latency).
// - Pure markup: no state, no script.
import { Icon } from "@rivetjs/kit/icon";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { Minus, TrendingDown, TrendingUp } from "lucide";

import type { TrendChipVariants } from "../../../styles/src/components/trend-chip/index.ts";
import { trendChipVariants } from "../../../styles/src/components/trend-chip/index.ts";
import { splitLive } from "../../utils/live.tsx";

type TrendDirection = "up" | "down" | "neutral";

interface TrendChipProps extends Omit<JSX.IntrinsicElements["span"], "class">, Omit<TrendChipVariants, "tone"> {
  /** Direction of the change. @default "neutral" */
  trend?: TrendDirection;
  /** Lower is better: `down` reads as positive (green), `up` as negative. */
  isInverted?: boolean;
  /** Hide the icon. */
  hideIcon?: boolean;
  class?: string;
}

const toneOf = (trend: TrendDirection, inverted: boolean): NonNullable<TrendChipVariants["tone"]> =>
  trend === "neutral" ? "neutral" : (trend === "up") !== inverted ? "positive" : "negative";

const TrendChipRoot = (props: TrendChipProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "trend", "isInverted", "hideIcon", "size", "variant"]);
  const trend = local.trend ?? "neutral";
  const slots = trendChipVariants({ size: local.size, tone: toneOf(trend, local.isInverted === true), variant: local.variant });
  const iconClass = slots.icon();
  return (
    <span class={slots.base({ class: local.class })} data-slot="trend-chip" data-trend={trend} {...rest}>
      {local.hideIcon ? null : <Icon icon={trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus} size={14} class={iconClass} />}
      {local.children}
    </span>
  );
};

export { TrendChipRoot };
export type { TrendChipProps, TrendDirection };
