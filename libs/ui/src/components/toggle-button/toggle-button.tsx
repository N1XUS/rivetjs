// Ported from HeroUI v3.2.6 packages/react/src/components/toggle-button/toggle-button.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `className` → `class`; `react-aria-components/ToggleButton` → `@rivetjs/cdk/toggle-button` (`render`, two-way `isSelected` signal,
//   function `class` / `children` with accessor render props); `@heroui/styles` → vendored `styles/`.
// - `ToggleButtonGroupContext` comes from `../toggle-button-group/toggle-button-group-context.ts` (no cdk `ToggleButtonGroup` import).
// - Upstream's `(renderProps) => typeof children === "function" ? children(renderProps) : children` wrapper is not needed: the cdk part
//   resolves function / plain children itself.
// - Live props (`splitLive` = runtime `splitProps`): `isIconOnly` / `size` / `variant` / `class` and the group's `size` (getter
//   context field) are read lazily; the composed class is a local (a plain value for cdk `ToggleButton`), so a live one makes the class a render-prop function
//   (`renderClass`, bound by the cdk element); static props keep the string path.
import { ToggleButton as ToggleButtonPrimitive } from "@rivetjs/cdk/toggle-button";
import type { ToggleButtonProps as ToggleButtonPrimitiveProps, ToggleButtonRenderProps } from "@rivetjs/cdk/toggle-button";
import { useContext } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ToggleButtonVariants } from "../../../styles/src/components/toggle-button/index.ts";
import { toggleButtonVariants } from "../../../styles/src/components/toggle-button/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";
import { ToggleButtonGroupContext } from "../toggle-button-group/toggle-button-group-context.ts";

/* -------------------------------------------------------------------------------------------------
 * ToggleButton Root
 * -----------------------------------------------------------------------------------------------*/
interface ToggleButtonRootProps extends ToggleButtonPrimitiveProps, ToggleButtonVariants {}

/** Props that pick the classes; a live one makes the cdk `class` a render-prop function. */
const STYLE_PROPS = ["class", "isIconOnly", "size", "variant"] as const;

const ToggleButtonRoot = (props: ToggleButtonRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "isIconOnly", "size", "style", "variant"]);
  const groupContext = useContext(ToggleButtonGroupContext);

  // Merge props with precedence: direct props > context props
  const finalSize = () => local.size ?? groupContext?.size;

  const styles = () =>
    toggleButtonVariants({
      isIconOnly: local.isIconOnly,
      size: finalSize(),
      variant: local.variant,
    });

  // A body const, not inline in the JSX: the compiler registers a const initializer holding a function as a resumable symbol
  // (re-evaluated on resume with its captures); a call inside the JSX getter would hand cdk an unregistered closure.
  const classOf = (): string | ((values: ToggleButtonRenderProps) => string) => composeTwRenderProps(local.class as never, styles());
  const cls =
    hasLiveProp(props, STYLE_PROPS) || hasLiveProp(groupContext, ["size"]) ? (values: ToggleButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ToggleButtonPrimitive class={cls} data-slot="toggle-button" style={local.style} {...rest}>
      {local.children}
    </ToggleButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ToggleButtonRoot };

export type { ToggleButtonRootProps };
