// Rivet addition (no HeroUI v3.2.6 counterpart): change indicator (icon + colour by direction); feature set inspired by
// HeroUI Pro's public TrendChip docs, independent implementation (see `trend-chip.tsx`).
import { TrendChipIndicator, TrendChipPrefix, TrendChipRoot, TrendChipSuffix } from "./trend-chip.tsx";
import type { TrendChipPartProps, TrendChipProps } from "./trend-chip.tsx";

export const TrendChip = Object.assign(TrendChipRoot, {
  Root: TrendChipRoot,
  Prefix: TrendChipPrefix,
  Suffix: TrendChipSuffix,
  Indicator: TrendChipIndicator,
});

export type TrendChip = { Props: TrendChipProps; RootProps: TrendChipProps; PartProps: TrendChipPartProps };

export { TrendChipRoot, TrendChipPrefix, TrendChipSuffix, TrendChipIndicator } from "./trend-chip.tsx";
export type { TrendChipProps, TrendChipProps as TrendChipRootProps, TrendChipPartProps, TrendDirection } from "./trend-chip.tsx";

export { trendChipVariants } from "../../../styles/src/components/trend-chip/index.ts";

export type { TrendChipVariants } from "../../../styles/src/components/trend-chip/index.ts";
