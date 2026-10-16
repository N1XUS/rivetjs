// Rivet addition (no HeroUI v3.2.6 counterpart): change indicator (icon + colour by direction); feature set inspired by
// HeroUI Pro's public TrendChip docs, independent implementation (see `trend-chip.tsx`).
import { TrendChipRoot } from "./trend-chip.tsx";
import type { TrendChipProps } from "./trend-chip.tsx";

export const TrendChip = Object.assign(TrendChipRoot, { Root: TrendChipRoot });

export type TrendChip = { Props: TrendChipProps; RootProps: TrendChipProps };

export { TrendChipRoot } from "./trend-chip.tsx";
export type { TrendChipProps, TrendChipProps as TrendChipRootProps, TrendDirection } from "./trend-chip.tsx";

export { trendChipVariants } from "../../../styles/src/components/trend-chip/index.ts";

export type { TrendChipVariants } from "../../../styles/src/components/trend-chip/index.ts";
