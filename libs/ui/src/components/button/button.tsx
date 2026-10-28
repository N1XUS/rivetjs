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
import { Button as ButtonPrimitive, ButtonContext } from "@rivetjs/cdk/button";
import { isHiddenPart } from "@rivetjs/cdk/collections/hidden";
import { FocusableContext } from "@rivetjs/cdk/interactions/focus";
import { PressResponderContext } from "@rivetjs/cdk/interactions/press";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { useContext } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";
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

/* -------------------------------------------------------------------------------------------------
 * State-space path (ZERO JSLEAK, the STATESPACE mechanism: `docs/guides/resumability.md` "Native automata"). A Button
 * with no behaviour (no handler, no pending / render-prop state, no trigger / group / form context above) is a native
 * `<button>`: the browser owns press / hover / focus, and `button.css` derives every visual state from `:active` /
 * `@media (hover: hover) :hover` / `:focus-visible` / `:disabled` (the twins of `data-pressed` / `data-hovered` /
 * `data-focus-visible`). At a call site the build proved closed (`$native`, `libs/compiler/facts-native.ts`) the root
 * renders the same markup as the cdk part (same attributes and id sequence): no handler, no record, no JavaScript.
 * Server and browser take the same branch (an ancestor's adopt run renders it over the server nodes). Helpers are
 * file-local (a shared module became its own chunk: +1 request on Button pages, measured).
 * -----------------------------------------------------------------------------------------------*/
// @rivet-native ButtonRoot(children,class,variant,size,fullWidth,isIconOnly,isDisabled,type,id,radius)

/** A context value that hands a button props or behaviour (a provider above). */
const given = (value: unknown): boolean => value != null && (typeof value !== "object" || Object.keys(value).length > 0);

/**
 * The call site is proven (`$native: 1`: declared keys only, plain data values, no handler / spread / function child —
 * `libs/compiler/facts-native.ts` checks it, so no props re-scan here), the type is not `submit` / `reset`, and nothing
 * above gives the button props or behaviour: no cdk `ButtonContext` value (slots: DialogTrigger, Select, …), no
 * `PressResponder` (triggers), no `FocusableContext` (TooltipTrigger), not the collection build pass. Same answer on the
 * server and in the browser (an ancestor's adopt run renders this branch over the server's `<button>`: the cdk part, a
 * boundary without a server record, would replace the nodes).
 */
function inertButton(props: object): boolean {
  const p = props as { $native?: unknown; type?: unknown };
  // A submit / reset button belongs to its form: the cdk Form adopts on its press (constraint validation fires
  // non-bubbling `invalid` events at the fields before any submit handler; a native press would leave them cold).
  return (
    p.$native === 1 &&
    (p.type === undefined || p.type === "button") &&
    !isHiddenPart() &&
    !given(useContext(ButtonContext)) &&
    !given(useContext(PressResponderContext)) &&
    !given(useContext(FocusableContext))
  );
}

// @rivet-class-join inertAttrs(2)
/** What the cdk part renders for static data props without behaviour (same attributes, same id sequence). */
function inertAttrs(props: object, slot: string, cls: string): Record<string, unknown> {
  const p = props as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key in p) if (key.startsWith("data-") || key.startsWith("aria-")) out[key] = p[key];
  out["data-slot"] = slot;
  out.type = p.type ?? "button";
  out.id = p.id ?? createId(); // the cdk Button's `aria.id ?? createId()`: same ids as the cdk path
  out.class = cls;
  // The cdk path spreads the caller's attributes after `data-radius={radius}`: an own `data-radius="concentric"` wins there.
  if (!("data-radius" in p)) out["data-radius"] = p.radius;
  if (p.isDisabled) ((out.disabled = true), (out["data-disabled"] = "true"));
  return out;
}

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
  // A live getter may yield an accessor itself (`isDisabled={nav.isNextDisabled}`: a member read of a non-props object is
  // a getter whose value is the function): called here, else the cdk read the function as truthy (always disabled).
  const liveIsDisabled = (): boolean | undefined => {
    const value = finalIsDisabled() as boolean | (() => boolean) | undefined;
    return typeof value === "function" ? value() : value;
  };
  const isDisabled =
    hasLiveProp(props, ["isDisabled"]) || (buttonGroupContext !== undefined && hasLiveProp(buttonGroupContext, ["isDisabled"]))
      ? liveIsDisabled
      : finalIsDisabled();

  // Inside a `<Form form>` (T20): a submit button without `isPending` is pending while the store's submit runs.
  const fields = useContext(FormFieldsContext);
  const pending = fields && rest.type === "submit" && rest.isPending === undefined ? { isPending: fields.submitting } : undefined;
  // Native path: the compiler proved this call's props (`$native`: declared keys, plain data, no handler / spread /
  // render function); no provider above adds behaviour (a trigger, a tooltip, a group, a form).
  if (!fields && !(buttonGroupContext && Object.keys(buttonGroupContext).length) && inertButton(props))
    return <button {...inertAttrs(props, "button", cls as string)}>{local.children as never}</button>;

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
