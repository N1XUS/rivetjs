// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no charts). Feature set inspired by HeroUI Pro's public Chart Tooltip
// docs (a tooltip card for chart data points: parts `.Header`, `.Item`, `.Indicator` (dot / line), `.Label`, `.Value`;
// `active`, `indicator`; an auto `.Content` with `hideHeader`, `labelFormatter`, `valueFormatter`); independent
// implementation, Rivet-authored styles on HeroUI tokens.
// - Plain markup, no state: the Rivet charts render their tooltips on the server and show them with CSS (`:hover` /
//   `:focus-visible`), so a chart's `tooltip` render function returns a `ChartTooltip` (see `../chart/chart.tsx`
//   `ChartPoint`). `.Content` takes that point (`label` + `payload`) and lays out the default rows.
// - Context `rv-ui-chart-tooltip` `{ indicator }` (plain data) lets `.Indicator` pick its shape from the root.
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { chartTooltipVariants } from "../../../styles/src/components/chart-tooltip/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";

type DivProps = Omit<JSX.IntrinsicElements["div"], "children" | "class"> & { class?: string; children?: Content };
type SpanProps = Omit<JSX.IntrinsicElements["span"], "children" | "class"> & { class?: string; children?: Content };

type Indicator = "dot" | "line";

const ChartTooltipContext = createContext<{ indicator?: Indicator }>({});

const SLOTS = chartTooltipVariants();

/* -------------------------------------------------------------------------------------------------
 * ChartTooltip Root
 * -----------------------------------------------------------------------------------------------*/
interface ChartTooltipRootProps extends DivProps {
  /** Render the card (false renders nothing). @default true */
  active?: boolean;
  /** Shape of the colour marker next to each series. @default "dot" */
  indicator?: Indicator;
}

const ChartTooltipRoot = (props: ChartTooltipRootProps): JSX.Element => {
  const { active, indicator, class: cls, children, ...rest } = props;
  if (active === false) return null as unknown as JSX.Element;
  // A function: the parts must render inside the provider.
  const content = () => (
    <div class={composeSlotClassName(SLOTS.base, cls)} data-slot="chart-tooltip" data-indicator={indicator ?? "dot"} {...rest}>
      {children}
    </div>
  );
  return (
    <Provider token={ChartTooltipContext} value={{ indicator }}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/
const ChartTooltipHeader = (props: DivProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <div class={composeSlotClassName(SLOTS.header, cls)} data-slot="chart-tooltip-header" {...rest}>
      {children}
    </div>
  );
};

const ChartTooltipItem = (props: DivProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <div class={composeSlotClassName(SLOTS.item, cls)} data-slot="chart-tooltip-item" {...rest}>
      {children}
    </div>
  );
};

interface ChartTooltipIndicatorProps extends Omit<SpanProps, "children"> {
  /** Any CSS colour (the series colour). */
  color?: string;
  /** Shape (default: the root's `indicator`). */
  indicator?: Indicator;
}

const ChartTooltipIndicator = (props: ChartTooltipIndicatorProps): JSX.Element => {
  const { class: cls, color, indicator, style, ...rest } = props;
  const context = useContext(ChartTooltipContext);
  const shape = indicator ?? context.indicator ?? "dot";
  return (
    <span
      aria-hidden="true"
      class={composeSlotClassName(SLOTS.indicator, `chart-tooltip__indicator--${shape} ${cls ?? ""}`.trim())}
      data-slot="chart-tooltip-indicator"
      {...rest}
      style={{ ...(color ? { "--chart-color": color } : {}), ...((style as object | undefined) ?? {}) }}
    />
  );
};

const ChartTooltipLabel = (props: SpanProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <span class={composeSlotClassName(SLOTS.label, cls)} data-slot="chart-tooltip-label" {...rest}>
      {children}
    </span>
  );
};

const ChartTooltipValue = (props: SpanProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <span class={composeSlotClassName(SLOTS.value, cls)} data-slot="chart-tooltip-value" {...rest}>
      {children}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ChartTooltip Content (auto rows)
 * -----------------------------------------------------------------------------------------------*/
interface ChartTooltipPayloadEntry {
  /** Series name. */
  name: string;
  value: number | string;
  /** Any CSS colour. */
  color?: string;
}

interface ChartTooltipContentProps extends Omit<ChartTooltipRootProps, "children"> {
  /** The header (the index value of the point). */
  label?: string | number;
  /** One entry per series. */
  payload?: ChartTooltipPayloadEntry[];
  /** No header row. */
  hideHeader?: boolean;
  labelFormatter?: (label: string | number) => Content;
  valueFormatter?: (value: number | string) => Content;
}

const ChartTooltipContent = (props: ChartTooltipContentProps): JSX.Element => {
  const { label, payload, hideHeader, labelFormatter, valueFormatter, ...rest } = props;
  const rows = payload ?? [];
  return (
    <ChartTooltipRoot {...rest}>
      {hideHeader || label == null ? null : <ChartTooltipHeader>{labelFormatter ? labelFormatter(label) : String(label)}</ChartTooltipHeader>}
      {rows.map((entry) => (
        <ChartTooltipItem>
          <ChartTooltipIndicator color={entry.color} />
          <ChartTooltipLabel>{entry.name}</ChartTooltipLabel>
          <ChartTooltipValue>{valueFormatter ? valueFormatter(entry.value) : String(entry.value)}</ChartTooltipValue>
        </ChartTooltipItem>
      ))}
    </ChartTooltipRoot>
  );
};

export {
  ChartTooltipRoot,
  ChartTooltipHeader,
  ChartTooltipItem,
  ChartTooltipIndicator,
  ChartTooltipLabel,
  ChartTooltipValue,
  ChartTooltipContent,
  ChartTooltipContext,
};
export type { ChartTooltipRootProps, ChartTooltipIndicatorProps, ChartTooltipContentProps, ChartTooltipPayloadEntry };
