// Ported from HeroUI v3.2.6 packages/react/src/components/button-group/button-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `className` → `class`; `react-aria-components/Group` → `@rivetjs/cdk/group` (accessor `isDisabled`, function `class`);
//   `useSlottedContext(RACToggleButtonGroupContext)` → cdk `slottedContext(ToggleButtonGroupContext)`; `@heroui/styles` → vendored `styles/`.
// - `ButtonGroupContext` / `BUTTON_GROUP_CHILD` live in `./button-group-context.ts` (data context, no tv `slots`: functions do not
//   serialize on resume). Parts look the slots up in a module-level memo (`slotsFor(fullWidth, orientation)`).
// - `Children.map` + `cloneElement({ [BUTTON_GROUP_CHILD]: true })` → the context reaches every `Button` under the group (Rivet JSX
//   has no element clone); `Button` opts out with `{ [BUTTON_GROUP_CHILD]: false }`. Nested (non-direct) Buttons inherit too.
// - Live props (`splitLive` = runtime `splitProps`): `React.useMemo` context → getter fields over the props when one of them is live
//   (else plain values, the static path), so a live `isDisabled` / `size` / `variant` / `fullWidth` updates every Button in place.
//   the composed class is a local (a plain value for cdk `Group`): a live `class` / `fullWidth` / `orientation` passes a render-prop function (`renderClass`), a
//   live `isDisabled` an inline accessor (resumable; `accessorIfLive` would be a `.ts`-module function captured by Group's handlers).
// - The root is created by a function called inside the provider (Rivet JSX creates nodes eagerly).
import { Group } from "@rivetjs/cdk/group";
import type { GroupProps, GroupRenderProps } from "@rivetjs/cdk/group";
import { slottedContext } from "@rivetjs/cdk/slots";
import { ToggleButtonGroupContext as CdkToggleButtonGroupContext } from "@rivetjs/cdk/toggle-button-group";
import { useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ButtonVariants } from "../../../styles/src/components/button/index.ts";
import type { ButtonGroupVariants } from "../../../styles/src/components/button-group/index.ts";
import { buttonGroupVariants } from "../../../styles/src/components/button-group/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

import { BUTTON_GROUP_CHILD, ButtonGroupContext } from "./button-group-context.ts";

type Orientation = "horizontal" | "vertical";
type ButtonGroupSlots = ReturnType<typeof buttonGroupVariants>;

/** Module-level memo (upstream `useMemo` per root): tv slot functions are pure, one slots object per variant pair. */
const SLOTS: Record<string, ButtonGroupSlots> = {};
const slotsFor = (fullWidth: boolean | undefined, orientation: Orientation): ButtonGroupSlots =>
  (SLOTS[`${!!fullWidth}|${orientation}`] ??= buttonGroupVariants({ fullWidth, orientation }));

/** Upstream `use(ButtonGroupContext).slots`: `undefined` outside a `ButtonGroup` (no `orientation`). */
const slotsOf = (context: ButtonGroupContext): ButtonGroupSlots | undefined =>
  context.orientation === undefined ? undefined : slotsFor(context.fullWidth, context.orientation);

/* -------------------------------------------------------------------------------------------------
 * ButtonGroup Root
 * -----------------------------------------------------------------------------------------------*/
interface ButtonGroupRootProps extends Omit<GroupProps, "isDisabled">, Pick<ButtonVariants, "size" | "variant">, ButtonGroupVariants {
  /** Whether every Button in the group is disabled. */
  isDisabled?: boolean;
  /** The orientation of the button group */
  orientation?: Orientation;
  children?: Content;
}

const CONTEXT_PROPS = ["size", "variant", "isDisabled", "fullWidth", "orientation"] as const;
const STYLE_PROPS = ["class", "fullWidth", "orientation"] as const;

const ButtonGroupRoot = (props: ButtonGroupRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "fullWidth", "isDisabled", "orientation", "size", "variant"]);
  const racContext = slottedContext(CdkToggleButtonGroupContext) as { orientation?: Orientation } | null | undefined;
  const orientation = (): Orientation => local.orientation ?? racContext?.orientation ?? "horizontal";

  // Getter fields over the props when a context prop is live (the compiler registers the getter object in a conditional initializer).
  const context: ButtonGroupContext = hasLiveProp(props, CONTEXT_PROPS)
    ? {
        get size() {
          return local.size;
        },
        get variant() {
          return local.variant;
        },
        get isDisabled() {
          return local.isDisabled;
        },
        get fullWidth() {
          return local.fullWidth;
        },
        get orientation() {
          return orientation();
        },
      }
    : { size: local.size, variant: local.variant, isDisabled: local.isDisabled, fullWidth: local.fullWidth, orientation: orientation() };

  // An inline arrow (compiler-captured, resumable), not `accessorIfLive`: cdk `Group`'s hover handlers capture it, and a function
  // created in a `.ts` module does not serialize on resume.
  const isDisabled = hasLiveProp(props, ["isDisabled"]) ? () => local.isDisabled : local.isDisabled;

  // A body const, not inline in the JSX: the compiler registers a const initializer holding a function as a resumable symbol
  // (re-evaluated on resume with its captures); a call inside the JSX getter would hand cdk an unregistered closure.
  const classOf = (): string | ((values: GroupRenderProps) => string) =>
    composeTwRenderProps(local.class as never, slotsFor(local.fullWidth, orientation()).base());
  const cls = hasLiveProp(props, STYLE_PROPS) ? (values: GroupRenderProps) => renderClass(classOf(), values) : classOf();

  const content = () => (
    <Group class={cls} data-slot="button-group" isDisabled={isDisabled as never} {...rest}>
      {local.children}
    </Group>
  );

  return (
    <Provider token={ButtonGroupContext} value={context}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ButtonGroup Separator
 * -----------------------------------------------------------------------------------------------*/
interface ButtonGroupSeparatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `ButtonGroupSeparator` props for the default element (`span`). */
type ButtonGroupSeparatorSpanProps = ButtonGroupSeparatorProps & Omit<JSX.IntrinsicElements["span"], keyof ButtonGroupSeparatorProps>;

const ButtonGroupSeparator = <E extends keyof JSX.IntrinsicElements = "span">(props: ButtonGroupSeparatorProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as ButtonGroupSeparatorSpanProps, ["class"]);
  const context = useContext(ButtonGroupContext);

  return <dom.span aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.separator, local.class)} data-slot="button-group-separator" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ButtonGroupRoot, ButtonGroupSeparator, ButtonGroupContext, BUTTON_GROUP_CHILD };

export type { ButtonGroupRootProps, ButtonGroupSeparatorProps, ButtonGroupSeparatorSpanProps };
