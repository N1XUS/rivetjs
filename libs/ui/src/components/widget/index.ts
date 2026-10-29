// Rivet addition (no HeroUI v3.2.6 counterpart): dashboard widget shell; feature set inspired by commercial UI kits' public Widget
// docs, independent implementation (see `widget.tsx`).
import { WidgetContent, WidgetDescription, WidgetFooter, WidgetHeader, WidgetLegend, WidgetLegendItem, WidgetRoot, WidgetTitle } from "./widget.tsx";
import type { WidgetLegendItemProps, WidgetPartProps, WidgetRootProps, WidgetTextProps } from "./widget.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Widget = Object.assign(WidgetRoot, {
  Root: WidgetRoot,
  Header: WidgetHeader,
  Title: WidgetTitle,
  Description: WidgetDescription,
  Content: WidgetContent,
  Footer: WidgetFooter,
  Legend: WidgetLegend,
  LegendItem: WidgetLegendItem,
});

export type Widget = {
  Props: WidgetRootProps;
  RootProps: WidgetRootProps;
  PartProps: WidgetPartProps;
  TextProps: WidgetTextProps;
  LegendItemProps: WidgetLegendItemProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { WidgetRoot, WidgetHeader, WidgetTitle, WidgetDescription, WidgetContent, WidgetFooter, WidgetLegend, WidgetLegendItem } from "./widget.tsx";
export type { WidgetRootProps, WidgetRootProps as WidgetProps, WidgetPartProps, WidgetTextProps, WidgetLegendItemProps } from "./widget.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { widgetVariants } from "../../../styles/src/components/widget/index.ts";

export type { WidgetVariants } from "../../../styles/src/components/widget/index.ts";
