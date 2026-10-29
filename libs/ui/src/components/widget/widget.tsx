// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no dashboard widget). Feature set inspired by commercial UI kits' public
// Widget docs (a tinted shell around a raised content area for charts, tables or KPIs; header with title, description and
// an inline legend; footer); independent implementation, Rivet-authored styles on HeroUI tokens.
// - `Widget` takes `render` (the `dom.div` contract) for another root element; parts are plain elements.
// - `Widget.LegendItem` `color` = any CSS colour (`var(--chart-2)`), set as `--widget-legend-color` on the item.
// - Pure markup: no state, no script.
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { widgetVariants } from "../../../styles/src/components/widget/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = widgetVariants();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class"> & { class?: string };
type SpanProps = Omit<JSX.IntrinsicElements["span"], "class"> & { class?: string };

interface WidgetRootProps extends DivProps, DOMRenderProps<"div", undefined> {}

const WidgetRoot = (props: WidgetRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <dom.div class={composeSlotClassName(SLOTS.base, local.class)} data-slot="widget" {...rest} />;
};

const divPart =
  (slot: "header" | "content" | "footer" | "legend", dataSlot: string) =>
  (props: DivProps): JSX.Element => {
    const [local, rest] = splitLive(props, ["children", "class"]);
    return (
      <div class={composeSlotClassName(SLOTS[slot], local.class)} data-slot={dataSlot} {...rest}>
        {local.children}
      </div>
    );
  };

const spanPart =
  (slot: "title" | "description", dataSlot: string) =>
  (props: SpanProps): JSX.Element => {
    const [local, rest] = splitLive(props, ["children", "class"]);
    return (
      <span class={composeSlotClassName(SLOTS[slot], local.class)} data-slot={dataSlot} {...rest}>
        {local.children}
      </span>
    );
  };

const WidgetHeader = divPart("header", "widget-header");
const WidgetContent = divPart("content", "widget-content");
const WidgetFooter = divPart("footer", "widget-footer");
const WidgetLegend = divPart("legend", "widget-legend");
const WidgetTitle = spanPart("title", "widget-title");
const WidgetDescription = spanPart("description", "widget-description");

interface WidgetLegendItemProps extends SpanProps {
  /** CSS colour of the dot (`var(--chart-1)`, `#0485f7` …). */
  color: string;
  children?: Content;
}

const WidgetLegendItem = (props: WidgetLegendItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "color"]);
  return (
    <span class={composeSlotClassName(SLOTS.legendItem, local.class)} data-slot="widget-legend-item" style={{ "--widget-legend-color": local.color }} {...rest}>
      <span aria-hidden="true" class={SLOTS.legendItemDot()} data-slot="widget-legend-item-dot" />
      <span class={SLOTS.legendItemLabel()} data-slot="widget-legend-item-label">
        {local.children}
      </span>
    </span>
  );
};

export { WidgetRoot, WidgetHeader, WidgetTitle, WidgetDescription, WidgetContent, WidgetFooter, WidgetLegend, WidgetLegendItem };
export type { WidgetRootProps, DivProps as WidgetPartProps, SpanProps as WidgetTextProps, WidgetLegendItemProps };
