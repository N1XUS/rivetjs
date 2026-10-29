// Rivet addition (no HeroUI v3.2.6 counterpart): metric card; feature set scoped from public docs of commercial UI kits,
// independent implementation (see `kpi.tsx`).
import {
  KpiActions,
  KpiBody,
  KpiChart,
  KpiContent,
  KpiDescription,
  KpiFooter,
  KpiHeader,
  KpiIcon,
  KpiProgress,
  KpiRoot,
  KpiSeparator,
  KpiTitle,
  KpiTrend,
  KpiValue,
} from "./kpi.tsx";
import type { KpiIconProps, KpiPartProps, KpiProgressProps, KpiRootProps, KpiTitleProps, KpiValueProps } from "./kpi.tsx";
import type { TrendChipProps } from "../trend-chip/trend-chip.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Kpi = Object.assign(KpiRoot, {
  Root: KpiRoot,
  Header: KpiHeader,
  Title: KpiTitle,
  Icon: KpiIcon,
  Body: KpiBody,
  Content: KpiContent,
  Value: KpiValue,
  Trend: KpiTrend,
  Progress: KpiProgress,
  Description: KpiDescription,
  Chart: KpiChart,
  Actions: KpiActions,
  Separator: KpiSeparator,
  Footer: KpiFooter,
});

export type Kpi = {
  Props: KpiRootProps;
  RootProps: KpiRootProps;
  PartProps: KpiPartProps;
  TitleProps: KpiTitleProps;
  ValueProps: KpiValueProps;
  IconProps: KpiIconProps;
  ProgressProps: KpiProgressProps;
  TrendProps: TrendChipProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  KpiRoot,
  KpiHeader,
  KpiTitle,
  KpiIcon,
  KpiBody,
  KpiContent,
  KpiValue,
  KpiTrend,
  KpiProgress,
  KpiDescription,
  KpiChart,
  KpiActions,
  KpiSeparator,
  KpiFooter,
} from "./kpi.tsx";
export type { KpiRootProps, KpiRootProps as KpiProps, KpiPartProps, KpiTitleProps, KpiValueProps, KpiIconProps, KpiProgressProps, KpiStatus } from "./kpi.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { kpiVariants } from "../../../styles/src/components/kpi/index.ts";

export type { KpiVariants } from "../../../styles/src/components/kpi/index.ts";
