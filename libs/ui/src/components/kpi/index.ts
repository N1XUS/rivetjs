// Rivet addition (no HeroUI v3.2.6 counterpart): metric card; feature set inspired by HeroUI Pro's public KPI docs,
// independent implementation (see `kpi.tsx`).
import { KpiBody, KpiChart, KpiDescription, KpiFooter, KpiHeader, KpiIcon, KpiRoot, KpiTitle, KpiTrend, KpiValue } from "./kpi.tsx";
import type { KpiPartProps, KpiRootProps, KpiTitleProps, KpiValueProps } from "./kpi.tsx";
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
  Value: KpiValue,
  Trend: KpiTrend,
  Description: KpiDescription,
  Chart: KpiChart,
  Footer: KpiFooter,
});

export type Kpi = {
  Props: KpiRootProps;
  RootProps: KpiRootProps;
  PartProps: KpiPartProps;
  TitleProps: KpiTitleProps;
  ValueProps: KpiValueProps;
  TrendProps: TrendChipProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { KpiRoot, KpiHeader, KpiTitle, KpiIcon, KpiBody, KpiValue, KpiTrend, KpiDescription, KpiChart, KpiFooter } from "./kpi.tsx";
export type { KpiRootProps, KpiRootProps as KpiProps, KpiPartProps, KpiTitleProps, KpiValueProps } from "./kpi.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { kpiVariants } from "../../../styles/src/components/kpi/index.ts";

export type { KpiVariants } from "../../../styles/src/components/kpi/index.ts";
