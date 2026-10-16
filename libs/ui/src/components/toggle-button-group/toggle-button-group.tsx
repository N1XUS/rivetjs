// Ported from HeroUI v3.2.6 packages/react/src/components/toggle-button-group/toggle-button-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `className` → `class`; `react-aria-components/ToggleButtonGroup` → `@rivetjs/cdk/toggle-button-group` (selection state, toolbar
//   keys, function `class`); `useSlottedContext(RACToggleButtonGroupContext)` → cdk `slottedContext(ToggleButtonGroupContext)`;
//   `@heroui/styles` → vendored `styles/`.
// - `ToggleButtonGroupContext` / `TOGGLE_BUTTON_GROUP_CHILD` live in `./toggle-button-group-context.ts` (data context, no tv `slots`:
//   functions do not serialize on resume; + `fullWidth` / `isDetached` / `orientation` for the separator slots, module-level memo).
// - Live props (`splitLive` = runtime `splitProps`): `React.useMemo` context → getter fields over the props when one of them is live,
//   so a live group `size` restyles every ToggleButton in place; the composed class is a local (a plain value for cdk `ToggleButtonGroup`) → a live `class` /
//   `fullWidth` / `isDetached` / `orientation` passes a render-prop function (`renderClass`). cdk reads `isDisabled` / `orientation`
//   lazily (group state, `aria-disabled` / `data-disabled`, `data-orientation` / `aria-orientation`, arrow keys, every ToggleButton's
//   disabled state), so a live group `isDisabled` / `orientation` updates the group and its buttons in place.
// - The root is created by a function called inside the provider (Rivet JSX creates nodes eagerly).
import { slottedContext } from "@rivetjs/cdk/slots";
import { ToggleButtonGroupContext as CdkToggleButtonGroupContext, ToggleButtonGroup as ToggleButtonGroupPrimitive } from "@rivetjs/cdk/toggle-button-group";
import type { ToggleButtonGroupProps as ToggleButtonGroupPrimitiveProps, ToggleButtonGroupRenderProps } from "@rivetjs/cdk/toggle-button-group";
import { useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ToggleButtonVariants } from "../../../styles/src/components/toggle-button/index.ts";
import type { ToggleButtonGroupVariants } from "../../../styles/src/components/toggle-button-group/index.ts";
import { toggleButtonGroupVariants } from "../../../styles/src/components/toggle-button-group/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

import { TOGGLE_BUTTON_GROUP_CHILD, ToggleButtonGroupContext } from "./toggle-button-group-context.ts";

type Orientation = "horizontal" | "vertical";
type ToggleButtonGroupSlots = ReturnType<typeof toggleButtonGroupVariants>;

/** Module-level memo (upstream `useMemo` per root): tv slot functions are pure, one slots object per variant triple. */
const SLOTS: Record<string, ToggleButtonGroupSlots> = {};
const slotsFor = (fullWidth: boolean | undefined, isDetached: boolean, orientation: Orientation): ToggleButtonGroupSlots =>
  (SLOTS[`${!!fullWidth}|${isDetached}|${orientation}`] ??= toggleButtonGroupVariants({ fullWidth, isDetached, orientation }));

/** Upstream `use(ToggleButtonGroupContext).slots`: `undefined` outside a `ToggleButtonGroup` (no `orientation`). */
const slotsOf = (context: ToggleButtonGroupContext): ToggleButtonGroupSlots | undefined =>
  context.orientation === undefined ? undefined : slotsFor(context.fullWidth, !!context.isDetached, context.orientation);

/* -------------------------------------------------------------------------------------------------
 * ToggleButtonGroup Root
 * -----------------------------------------------------------------------------------------------*/
interface ToggleButtonGroupRootProps extends ToggleButtonGroupPrimitiveProps, ToggleButtonGroupVariants {
  /** Size to propagate to all child ToggleButtons */
  size?: ToggleButtonVariants["size"];
  /** Whether the group buttons are visually separated (detached) instead of connected */
  isDetached?: boolean;
  children?: Content;
}

const CONTEXT_PROPS = ["size", "isDisabled", "fullWidth", "isDetached", "orientation"] as const;
const STYLE_PROPS = ["class", "fullWidth", "isDetached", "orientation"] as const;

const ToggleButtonGroupRoot = (props: ToggleButtonGroupRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "fullWidth", "isDetached", "isDisabled", "orientation", "size"]);
  const racContext = slottedContext(CdkToggleButtonGroupContext) as { orientation?: Orientation } | null | undefined;
  const orientation = (): Orientation => local.orientation ?? racContext?.orientation ?? "horizontal";
  const isDetached = (): boolean => local.isDetached ?? false;

  // Getter fields over the props when a context prop is live (the compiler registers the getter object in a conditional initializer).
  const contextValue: ToggleButtonGroupContext = hasLiveProp(props, CONTEXT_PROPS)
    ? {
        get size() {
          return local.size;
        },
        get isDisabled() {
          return local.isDisabled;
        },
        get fullWidth() {
          return local.fullWidth;
        },
        get isDetached() {
          return isDetached();
        },
        get orientation() {
          return orientation();
        },
      }
    : { size: local.size, isDisabled: local.isDisabled, fullWidth: local.fullWidth, isDetached: isDetached(), orientation: orientation() };

  // A body const, not inline in the JSX: the compiler registers a const initializer holding a function as a resumable symbol
  // (re-evaluated on resume with its captures); a call inside the JSX getter would hand cdk an unregistered closure.
  const classOf = (): string | ((values: ToggleButtonGroupRenderProps) => string) =>
    composeTwRenderProps(local.class as never, slotsFor(local.fullWidth, isDetached(), orientation()).base());
  const cls = hasLiveProp(props, STYLE_PROPS) ? (values: ToggleButtonGroupRenderProps) => renderClass(classOf(), values) : classOf();

  const content = () => (
    <ToggleButtonGroupPrimitive class={cls} data-slot="toggle-button-group" isDisabled={local.isDisabled} orientation={orientation()} {...rest}>
      {local.children}
    </ToggleButtonGroupPrimitive>
  );

  return (
    <Provider token={ToggleButtonGroupContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ToggleButtonGroup Separator
 * -----------------------------------------------------------------------------------------------*/
interface ToggleButtonGroupSeparatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  class?: string;
}

/** `ToggleButtonGroupSeparator` props for the default element (`span`). */
type ToggleButtonGroupSeparatorSpanProps = ToggleButtonGroupSeparatorProps & Omit<JSX.IntrinsicElements["span"], keyof ToggleButtonGroupSeparatorProps>;

const ToggleButtonGroupSeparator = <E extends keyof JSX.IntrinsicElements = "span">(
  props: ToggleButtonGroupSeparatorProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as ToggleButtonGroupSeparatorSpanProps, ["class"]);
  const context = useContext(ToggleButtonGroupContext);

  return (
    <dom.span aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.separator, local.class)} data-slot="toggle-button-group-separator" {...rest} />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ToggleButtonGroupRoot, ToggleButtonGroupSeparator, ToggleButtonGroupContext, TOGGLE_BUTTON_GROUP_CHILD };

export type { ToggleButtonGroupRootProps, ToggleButtonGroupSeparatorProps, ToggleButtonGroupSeparatorSpanProps };
