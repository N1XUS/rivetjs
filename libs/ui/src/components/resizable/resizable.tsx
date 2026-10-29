// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no resizable panels). API = shadcn/ui Resizable
// (`apps/v4/registry/new-york-v4/ui/resizable.tsx`, MIT, © shadcn): `ResizablePanelGroup` / `ResizablePanel` /
// `ResizableHandle withHandle`; behaviour = react-resizable-panels 4.14.3 (MIT, © Brian Vaughn) through
// `@rivetjs/cdk/resizable`; look = HeroUI separator line, accent on hover / drag, focus ring, surface grip (Rivet-authored
// `styles/components/resizable.css`).
// Rivet:
// - Every part is the cdk part with its `resizable*` slot class + `data-slot` (shadcn names); props pass through
//   (`orientation`, `defaultLayout`, `onLayoutChange(d)`, `groupRef`, `defaultSize` / `minSize` / `maxSize`, `collapsible`,
//   `collapsedSize`, `panelRef`, `disabled`, …).
// - Handle `type` (`line` / `drag` / `pill` / `handle`), `variant` (`primary` / `secondary` / `tertiary` = separator
//   tokens), `withIndicator` and the `ResizableIndicator` part (`pill` / `drag`): names from commercial UI kits' public Resizable
//   docs, independent implementation (UI-PORT-C, TWEAKS TW-166). `withHandle` (shadcn) = the `drag` grip chip.
// - Grip / drag dots = lucide `GripVertical` (horizontal group) / `GripHorizontal` (vertical group) via `@rivetjs/kit/icon`
//   (shadcn rotates one `GripVertical`); the handle shows `col-resize` / `row-resize` before the engine boots.
// - Panel `class` lands on the cdk panel's inner element (upstream), so `class="p-4"` pads the content.
// - Read once at mount (`class` included), as the cdk parts read them.
import { Group as GroupPrimitive, GroupContext, Panel as PanelPrimitive, Separator as SeparatorPrimitive } from "@rivetjs/cdk/resizable";
import type { GroupProps as GroupPrimitiveProps, PanelProps as PanelPrimitiveProps, SeparatorProps as SeparatorPrimitiveProps } from "@rivetjs/cdk/resizable";
import { Icon } from "@rivetjs/kit/icon";
import { useContext } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { GripHorizontal, GripVertical } from "lucide";

import { resizableVariants } from "../../../styles/src/components/resizable/index.ts";

/* -------------------------------------------------------------------------------------------------
 * ResizablePanelGroup
 * -----------------------------------------------------------------------------------------------*/
interface ResizablePanelGroupProps extends GroupPrimitiveProps {}

const ResizablePanelGroup = (props: ResizablePanelGroupProps): JSX.Element => {
  const cls = resizableVariants().group({ class: props.class as string | undefined });
  return <GroupPrimitive data-slot="resizable-panel-group" {...props} class={cls} />;
};

/* -------------------------------------------------------------------------------------------------
 * ResizablePanel
 * -----------------------------------------------------------------------------------------------*/
interface ResizablePanelProps extends PanelPrimitiveProps {}

const ResizablePanel = (props: ResizablePanelProps): JSX.Element => {
  const cls = resizableVariants().panel({ class: props.class as string | undefined });
  return <PanelPrimitive data-slot="resizable-panel" {...props} class={cls} />;
};

/* -------------------------------------------------------------------------------------------------
 * ResizableIndicator
 * -----------------------------------------------------------------------------------------------*/
interface ResizableIndicatorProps {
  /** Affordance when no children are given: a rounded `pill` (default) or the `drag` dots. */
  type?: "pill" | "drag";
  /** Custom content; replaces the default affordance. */
  children?: JSX.Element;
  class?: string;
}

/** The inner affordance of a handle (pill or drag dots); compose it inside `ResizableHandle` for full control. */
const ResizableIndicator = (props: ResizableIndicatorProps): JSX.Element => {
  const type = props.type ?? "pill";
  const cls = resizableVariants({ indicator: type }).indicator({ class: props.class });
  const group = useContext(GroupContext);
  const grip = group?.orientation === "vertical" ? GripHorizontal : GripVertical;
  const children = props.children;
  return (
    <div class={cls} data-slot="resizable-indicator" data-type={type} aria-hidden="true">
      {children ?? (type === "drag" ? <Icon icon={grip} /> : null)}
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ResizableHandle
 * -----------------------------------------------------------------------------------------------*/
interface ResizableHandleProps extends SeparatorPrimitiveProps {
  /**
   * Affordance: `line` (1px separator, default), `drag` (line + grip chip), `pill` (line + rounded pill) or `handle`
   * (a standalone pill, no line).
   */
  type?: "line" | "drag" | "pill" | "handle";
  /** Line colour: the `separator` (default), `separator-secondary` or `separator-tertiary` token. */
  variant?: "primary" | "secondary" | "tertiary";
  /** Shows the drag dots inline on the line (`ResizableIndicator type="drag"`). */
  withIndicator?: boolean;
  /** Shows the grip chip on the line (shadcn `withHandle`; the same chip as `type="drag"`). */
  withHandle?: boolean;
}

const ResizableHandle = (props: ResizableHandleProps): JSX.Element => {
  const type = props.type ?? (props.withHandle ? "drag" : "line");
  const slots = resizableVariants({ type, variant: props.variant ?? "primary" });
  const cls = slots.handle({ class: props.class as string | undefined });
  const withIndicator = props.withIndicator;
  const group = useContext(GroupContext);
  const grip = group?.orientation === "vertical" ? GripHorizontal : GripVertical;
  const gripClass = slots.handleGrip();
  const children = props.children;
  const { withHandle: _withHandle, withIndicator: _withIndicator, type: _type, variant: _variant, ...rest } = props;
  return (
    <SeparatorPrimitive data-slot="resizable-handle" data-type={type} {...rest} class={cls}>
      {children ??
        (type === "drag" ? (
          <div class={gripClass} data-slot="resizable-handle-grip">
            <Icon icon={grip} />
          </div>
        ) : type === "pill" || type === "handle" ? (
          <ResizableIndicator type="pill" />
        ) : withIndicator ? (
          <ResizableIndicator type="drag" />
        ) : null)}
    </SeparatorPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ResizableHandle, ResizableIndicator, ResizablePanel, ResizablePanelGroup };

export type { ResizableHandleProps, ResizableIndicatorProps, ResizablePanelGroupProps, ResizablePanelProps };
