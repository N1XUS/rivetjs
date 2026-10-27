// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no resizable panels). shadcn/ui Resizable API (MIT) over
// react-resizable-panels 4.14.3 behaviour (@rivetjs/cdk/resizable), HeroUI look.
import { ResizableHandle, ResizableIndicator, ResizablePanel, ResizablePanelGroup } from "./resizable.tsx";
import type { ResizableHandleProps, ResizableIndicatorProps, ResizablePanelGroupProps, ResizablePanelProps } from "./resizable.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Resizable = Object.assign(ResizablePanelGroup, {
  Group: ResizablePanelGroup,
  Panel: ResizablePanel,
  Handle: ResizableHandle,
  Indicator: ResizableIndicator,
});

export type Resizable = {
  Props: ResizablePanelGroupProps;
  GroupProps: ResizablePanelGroupProps;
  PanelProps: ResizablePanelProps;
  HandleProps: ResizableHandleProps;
  IndicatorProps: ResizableIndicatorProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Components
 * -----------------------------------------------------------------------------------------------*/
export { ResizableHandle, ResizableIndicator, ResizablePanel, ResizablePanelGroup };

export type { ResizableHandleProps, ResizableIndicatorProps, ResizablePanelGroupProps, ResizablePanelProps };

// Behaviour helpers re-exported from the cdk (persistence + imperative handles).
export { cookieStorage, useDefaultLayout, useGroupRef, usePanelRef } from "@rivetjs/cdk/resizable";
export type { GroupImperativeHandle, Layout, PanelImperativeHandle, PanelSize } from "@rivetjs/cdk/resizable";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { resizableVariants } from "../../../styles/src/components/resizable/index.ts";

export type { ResizableVariants } from "../../../styles/src/components/resizable/index.ts";
