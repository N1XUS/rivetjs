// Rivet addition (no HeroUI v3.2.6 counterpart): KPI cards on one shared surface; feature set inspired by commercial UI kits' public
// KPI Group docs, independent implementation (see `kpi-group.tsx`).
import { KpiGroupRoot, KpiGroupSeparator } from "./kpi-group.tsx";
import type { KpiGroupRootProps, KpiGroupSeparatorProps } from "./kpi-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const KpiGroup = Object.assign(KpiGroupRoot, {
  Root: KpiGroupRoot,
  Separator: KpiGroupSeparator,
});

export type KpiGroup = {
  Props: KpiGroupRootProps;
  RootProps: KpiGroupRootProps;
  SeparatorProps: KpiGroupSeparatorProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { KpiGroupRoot, KpiGroupSeparator } from "./kpi-group.tsx";
export type { KpiGroupRootProps, KpiGroupRootProps as KpiGroupProps, KpiGroupSeparatorProps } from "./kpi-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { kpiGroupVariants } from "../../../styles/src/components/kpi-group/index.ts";

export type { KpiGroupVariants } from "../../../styles/src/components/kpi-group/index.ts";
