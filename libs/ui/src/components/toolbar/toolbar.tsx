// Ported from HeroUI v3.2.6 packages/react/src/components/toolbar/toolbar.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` / `displayName` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk` (`toolbar`,
//   `separator` `SeparatorContext`, `toggle-button-group` `ToggleButtonGroupContext`); `@heroui/styles` → vendored `styles/`.
// - `React.useMemo` → the class computed in the cdk `class` value; live `isAttached` / `class` → render-prop function (the
//   composed class is a local: it reaches cdk `Toolbar` as a plain value). `orientation` is read once (cdk picks `aria-orientation` / arrow keys from it).
// - Children are built inside the two providers (Rivet JSX is eager: `content` thunk).
import { SeparatorContext } from "@rivetjs/cdk/separator";
import { ToggleButtonGroupContext } from "@rivetjs/cdk/toggle-button-group";
import { Toolbar as ToolbarPrimitive } from "@rivetjs/cdk/toolbar";
import type { ToolbarProps as ToolbarPrimitiveProps, ToolbarRenderProps } from "@rivetjs/cdk/toolbar";
import { Provider } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ToolbarVariants } from "../../../styles/src/components/toolbar/index.ts";
import { toolbarVariants } from "../../../styles/src/components/toolbar/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Toolbar Root
 * -----------------------------------------------------------------------------------------------*/
interface ToolbarRootProps extends ToolbarPrimitiveProps, ToolbarVariants {}

const ToolbarRoot = (props: ToolbarRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "isAttached", "orientation"]);
  const orientation = local.orientation ?? "horizontal";
  const classOf = () =>
    composeTwRenderProps(local.class as never, toolbarVariants({ isAttached: local.isAttached, orientation })) as string | ((v: ToolbarRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "isAttached"]) ? (values: ToolbarRenderProps) => renderClass(classOf(), values) : classOf();
  const toggleContext = { orientation };
  const separatorContext = { orientation: orientation === "horizontal" ? ("vertical" as const) : ("horizontal" as const) };
  const content = () => (
    <ToolbarPrimitive class={cls as never} data-slot="toolbar" orientation={orientation} {...rest}>
      {local.children}
    </ToolbarPrimitive>
  );

  return (
    <Provider token={ToggleButtonGroupContext} value={toggleContext as never}>
      <Provider token={SeparatorContext} value={separatorContext as never}>
        {content()}
      </Provider>
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ToolbarRoot };
export type { ToolbarRootProps };
