// Ported from HeroUI v3.2.6 packages/react/src/components/button/button.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `className` → `class`; `react-aria-components/Button` → `@rivetjs/cdk/button` (`render` prop, accessor state props
//   `isDisabled` / `isPending`, function `class` / `children` with accessor render props); `@heroui/styles` → vendored `styles/`.
// - `ButtonGroupContext` / `BUTTON_GROUP_CHILD` come from `../button-group/button-group-context.ts` (no cdk `Group` import).
//   Upstream reads the context only when `ButtonGroup` cloned the button with `BUTTON_GROUP_CHILD: true` (direct children);
//   Rivet has no clone: every Button under a `ButtonGroup` reads it, `{ [BUTTON_GROUP_CHILD]: false }` opts out.
//   A live group prop (getter context field) makes the class a render-prop function / `isDisabled` an accessor, as a live own prop.
// - Upstream's `(renderProps) => typeof children === "function" ? children(renderProps) : children` wrapper is not needed: the cdk part
//   resolves function / plain children itself.
// - Live props: `fullWidth` / `isIconOnly` / `size` / `variant` / `class` / `isDisabled` are read lazily (`splitLive` = runtime `splitProps`).
//   cdk `Button` keeps its own `class` / `isDisabled` live (P5), but the class here is composed from several props, so when
//   one of them is a live getter (`hasLiveProp`) the class goes in as a render-prop function (re-run by the cdk part) and
//   `isDisabled` as an accessor; static props keep the string / value path (no render-prop state signals in cdk).
// - Rivet (T20): in a `<Form form>` (`@rivetjs/forms`) a `type="submit"` Button without `isPending` takes it from the store's
//   `submitting` (`FormFieldsContext`, `../../utils/form-fields.ts`).
// - No built-in pending spinner (as upstream): compose `<Spinner/>` in a render-prop child (`({ isPending }) => …`).
// - Rivet additions: `variant="brand"` (logo gradient, `button.css`), `radius="concentric"` → `data-radius` (the padded
//   parent's inner radius instead of the pill, identity spec R5; live like the other props).
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { useContext } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ButtonVariants } from "../../../styles/src/components/button/index.ts";
import { buttonVariants } from "../../../styles/src/components/button/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { FormFieldsContext } from "../../utils/form-fields.ts";
import { hasLiveProp, splitLive } from "../../utils/live.tsx";

import { BUTTON_GROUP_CHILD, ButtonGroupContext } from "../button-group/button-group-context.ts";

/* -------------------------------------------------------------------------------------------------
 * Button Root
 * -----------------------------------------------------------------------------------------------*/
interface ButtonRootProps extends ButtonPrimitiveProps, ButtonVariants {
  [BUTTON_GROUP_CHILD]?: boolean;
  /** `"concentric"`: the padded parent's inner radius (`--r-inner`) instead of the pill, e.g. a Button in a Card corner. */
  radius?: "concentric";
}

/** Props that pick the classes; a live one makes the cdk `class` a render-prop function. */
const STYLE_PROPS = ["class", "fullWidth", "isIconOnly", "size", "variant"] as const;
/** Group context fields that pick the classes (getters when the group's prop is live). */
const GROUP_STYLE_PROPS = ["fullWidth", "size", "variant"] as const;
const OWN_PROPS = ["children", ...STYLE_PROPS, "isDisabled", "radius", "slot", "style", BUTTON_GROUP_CHILD] as const;

const ButtonRoot = (props: ButtonRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, OWN_PROPS);
  // Upstream: `isButtonGroupChild` (set by the group's clone). Rivet: in a group unless opted out (header).
  const shouldUseContext = local[BUTTON_GROUP_CHILD] !== false;
  const buttonGroupContext = shouldUseContext ? useContext(ButtonGroupContext) : undefined;

  const finalSize = () => local.size ?? (shouldUseContext ? buttonGroupContext?.size : undefined);
  const finalVariant = () => local.variant ?? (shouldUseContext ? buttonGroupContext?.variant : undefined);
  const finalIsDisabled = () => local.isDisabled ?? (shouldUseContext ? buttonGroupContext?.isDisabled : undefined);
  const finalFullWidth = () => local.fullWidth ?? (shouldUseContext ? buttonGroupContext?.fullWidth : undefined);

  const styles = () =>
    buttonVariants({
      fullWidth: finalFullWidth(),
      isIconOnly: local.isIconOnly,
      size: finalSize(),
      variant: finalVariant(),
    });

  const liveGroup = buttonGroupContext !== undefined && hasLiveProp(buttonGroupContext, GROUP_STYLE_PROPS);
  const cls =
    liveGroup || hasLiveProp(props, STYLE_PROPS)
      ? (renderProps: ButtonRenderProps) => {
          const c = composeTwRenderProps(local.class as never, styles()) as string | ((v: ButtonRenderProps) => string);
          return typeof c === "function" ? c(renderProps) : c;
        }
      : composeTwRenderProps(local.class as never, styles());
  // cdk Button's press handlers capture the accessor: the compiler registers a const arrow used as a value (resumable).
  const isDisabled =
    hasLiveProp(props, ["isDisabled"]) || (buttonGroupContext !== undefined && hasLiveProp(buttonGroupContext, ["isDisabled"]))
      ? finalIsDisabled
      : finalIsDisabled();

  // Inside a `<Form form>` (T20): a submit button without `isPending` is pending while the store's submit runs.
  const fields = useContext(FormFieldsContext);
  const pending = fields && rest.type === "submit" && rest.isPending === undefined ? { isPending: fields.submitting } : undefined;

  return (
    <ButtonPrimitive
      class={cls}
      data-radius={local.radius}
      data-slot="button"
      isDisabled={isDisabled as never}
      slot={local.slot}
      style={local.style}
      {...rest}
      {...pending}
    >
      {local.children}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ButtonRoot };

export type { ButtonRootProps };
