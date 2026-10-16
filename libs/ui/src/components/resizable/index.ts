// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no resizable panels). shadcn/ui Resizable API (MIT) over
// react-resizable-panels 4.14.3 behaviour (@rivetjs/cdk/resizable), HeroUI look.
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable.tsx";
import type { ResizableHandleProps, ResizablePanelGroupProps, ResizablePanelProps } from "./resizable.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Resizable = Object.assign(ResizablePanelGroup, {
  Group: ResizablePanelGroup,
  Panel: ResizablePanel,
  Handle: ResizableHandle,
});

export type Resizable = {
  Props: ResizablePanelGroupProps;
  GroupProps: ResizablePanelGroupProps;
  PanelProps: ResizablePanelProps;
  HandleProps: ResizableHandleProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Components
 * -----------------------------------------------------------------------------------------------*/
export { ResizableHandle, ResizablePanel, ResizablePanelGroup };

export type { ResizableHandleProps, ResizablePanelGroupProps, ResizablePanelProps };

// Behaviour helpers re-exported from the cdk (persistence + imperative handles).
export { cookieStorage, useDefaultLayout, useGroupRef, usePanelRef } from "@rivetjs/cdk/resizable";
export type { GroupImperativeHandle, Layout, PanelImperativeHandle, PanelSize } from "@rivetjs/cdk/resizable";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { resizableVariants } from "../../../styles/src/components/resizable/index.ts";

export type { ResizableVariants } from "../../../styles/src/components/resizable/index.ts";
