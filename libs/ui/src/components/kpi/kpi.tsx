// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no KPI). Feature set inspired by HeroUI Pro's public KPI docs
// (a metric card: title, icon, formatted value, trend, description, chart slot, footer); independent implementation,
// Rivet-authored styles on HeroUI tokens.
// - `Kpi.Value` formats `value` with `Intl.NumberFormat(locale, formatOptions)` (value, accessor or live prop: the text
//   follows) or shows its children; `Kpi.Trend` is the ui TrendChip.
// - Pure markup: no state, no script. The root provides `SurfaceContext` so nested ui parts pick the surface.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { KpiVariants } from "../../../styles/src/components/kpi/index.ts";
import { kpiVariants } from "../../../styles/src/components/kpi/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { cachedIntl } from "@rivetjs/cdk/i18n/intl-cache";
import { TrendChipRoot } from "../trend-chip/trend-chip.tsx";
import type { TrendChipProps } from "../trend-chip/trend-chip.tsx";

/** One slots object per variant (parts only read the variant-independent element classes). */
const SLOTS = kpiVariants();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class"> & { class?: string };

interface KpiRootProps extends DivProps, KpiVariants {}

const KpiRoot = (props: KpiRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "variant"]);
  return (
    <div class={kpiVariants({ variant: local.variant }).base({ class: local.class })} data-slot="kpi" {...rest}>
      {local.children}
    </div>
  );
};

const part =
  (slot: "header" | "body" | "chart" | "description" | "footer" | "icon", dataSlot: string) =>
  (props: DivProps): JSX.Element => {
    const [local, rest] = splitLive(props, ["children", "class"]);
    return (
      <div class={composeSlotClassName(SLOTS[slot], local.class)} data-slot={dataSlot} {...rest}>
        {local.children}
      </div>
    );
  };

const KpiHeader = part("header", "kpi-header");
const KpiBody = part("body", "kpi-body");
const KpiChart = part("chart", "kpi-chart");
const KpiDescription = part("description", "kpi-description");
const KpiFooter = part("footer", "kpi-footer");
const KpiIcon = part("icon", "kpi-icon");

type HeadingProps = Omit<JSX.IntrinsicElements["h3"], "class"> & { class?: string };

const KpiTitle = (props: HeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <h3 class={composeSlotClassName(SLOTS.title, local.class)} data-slot="kpi-title" {...rest}>
      {local.children}
    </h3>
  );
};

interface KpiValueProps extends Omit<JSX.IntrinsicElements["span"], "class"> {
  /** Number to format (value, accessor or live prop). Without it the children render. */
  value?: number | (() => number);
  /** `Intl.NumberFormat` options (currency, percent, compact …). */
  formatOptions?: Intl.NumberFormatOptions;
  /** @default "en-US" */
  locale?: string;
  class?: string;
}

const KpiValue = (props: KpiValueProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "value", "formatOptions", "locale"]);
  // Plain data only in the binding (an Intl.NumberFormat instance is not a resumable capture); formatters are
  // cached per locale + options (`cachedIntl`), so a render / binding run costs a `format` call only.
  const locale = local.locale ?? "en-US";
  const options = local.formatOptions;
  const v = local.value;
  const text = typeof v === "number" ? cachedIntl(Intl.NumberFormat, locale, options).format(v) : undefined;
  return (
    <span class={composeSlotClassName(SLOTS.value, local.class)} data-slot="kpi-value" {...rest}>
      {text ?? (typeof v === "function" ? cachedIntl(Intl.NumberFormat, locale, options).format(v()) : local.children)}
    </span>
  );
};

const KpiTrend = (props: TrendChipProps): JSX.Element => <TrendChipRoot data-slot="kpi-trend" size="sm" {...props} />;

export { KpiRoot, KpiHeader, KpiTitle, KpiIcon, KpiBody, KpiValue, KpiTrend, KpiDescription, KpiChart, KpiFooter };
export type { KpiRootProps, KpiValueProps, DivProps as KpiPartProps, HeadingProps as KpiTitleProps };
