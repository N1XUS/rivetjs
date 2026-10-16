// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no resizable panels). API = shadcn/ui Resizable
// (`apps/v4/registry/new-york-v4/ui/resizable.tsx`, MIT, © shadcn): `ResizablePanelGroup` / `ResizablePanel` /
// `ResizableHandle withHandle`; behaviour = react-resizable-panels 4.14.3 (MIT, © Brian Vaughn) through
// `@rivetjs/cdk/resizable`; look = HeroUI separator line, accent on hover / drag, focus ring, surface grip (Rivet-authored
// `styles/components/resizable.css`).
// Rivet:
// - Every part is the cdk part with its `resizable*` slot class + `data-slot` (shadcn names); props pass through
//   (`orientation`, `defaultLayout`, `onLayoutChange(d)`, `groupRef`, `defaultSize` / `minSize` / `maxSize`, `collapsible`,
//   `collapsedSize`, `panelRef`, `disabled`, …).
// - Handle grip = lucide `GripVertical` (horizontal group) / `GripHorizontal` (vertical group) via `@rivetjs/kit/icon`
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
 * ResizableHandle
 * -----------------------------------------------------------------------------------------------*/
interface ResizableHandleProps extends SeparatorPrimitiveProps {
  /** Shows the grip knob on the line (shadcn `withHandle`). */
  withHandle?: boolean;
}

const ResizableHandle = (props: ResizableHandleProps): JSX.Element => {
  const slots = resizableVariants();
  const cls = slots.handle({ class: props.class as string | undefined });
  const withHandle = props.withHandle;
  const group = useContext(GroupContext);
  const grip = group?.orientation === "vertical" ? GripHorizontal : GripVertical;
  const gripClass = slots.handleGrip();
  const children = props.children;
  const { withHandle: _withHandle, ...rest } = props;
  return (
    <SeparatorPrimitive data-slot="resizable-handle" {...rest} class={cls}>
      {withHandle ? (
        <div class={gripClass} data-slot="resizable-handle-grip">
          <Icon icon={grip} />
        </div>
      ) : (
        children
      )}
    </SeparatorPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ResizableHandle, ResizablePanel, ResizablePanelGroup };

export type { ResizableHandleProps, ResizablePanelGroupProps, ResizablePanelProps };
