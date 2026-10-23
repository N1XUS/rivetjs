// Ported from HeroUI v3.2.6 packages/react/src/components/date-input-group/date-input-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{DateField,Group}` → `@rivetjs/cdk/{date-field,group}`
//   (accessor render props); `@heroui/styles` → vendored `styles/`.
// - `DateInputGroupContext` carries plain data (`{ inGroup, fullWidth, variant }`, getters when the root's props are live; resumable
//   token `rv-ui-date-input-group`, `{}` default) instead of the tv `slots`; parts look the slots up in a module-level memo per
//   `fullWidth|variant` (`slotsFor`), `undefined` outside a DateInputGroup (= upstream `slots?.x`).
// - Live props (`splitLive`): a live `class` / `fullWidth` / `variant` makes the cdk `class` a render-prop function (`renderClass`).
// - Children: upstream's `(values) => typeof children === "function" ? children(values) : children` = what the cdk Group does with
//   `children` itself (passed through). `Input` = cdk `DateInput` (it reads the DateField or the TimeField state, as upstream's note).
import { DateInput as DateInputPrimitive, DateSegment as DateSegmentPrimitive } from "@rivetjs/cdk/date-field";
import type {
  DateInputProps as DateInputPrimitiveProps,
  DateInputRenderProps,
  DateSegmentProps as DateSegmentPrimitiveProps,
  DateSegmentRenderProps,
} from "@rivetjs/cdk/date-field";
import { Group as GroupPrimitive } from "@rivetjs/cdk/group";
import type { GroupProps as GroupPrimitiveProps, GroupRenderProps } from "@rivetjs/cdk/group";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { DateInputGroupVariants } from "../../../styles/src/components/date-input-group/index.ts";
import { dateInputGroupVariants } from "../../../styles/src/components/date-input-group/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * DateInputGroup Context
 * -----------------------------------------------------------------------------------------------*/
type DateInputGroupContext = {
  /** Set inside a DateInputGroup (upstream: `slots`). */
  inGroup?: true;
  fullWidth?: boolean;
  variant?: DateInputGroupVariants["variant"];
};

const DateInputGroupContext = createContext<DateInputGroupContext>({});

type DateInputGroupSlots = ReturnType<typeof dateInputGroupVariants>;

/** Module-level memo per `fullWidth|variant` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, DateInputGroupSlots> = {};
const slotsFor = (fullWidth: boolean | undefined, variant: DateInputGroupVariants["variant"]): DateInputGroupSlots =>
  (SLOTS[`${!!fullWidth}|${variant}`] ??= dateInputGroupVariants({ fullWidth, variant }));

/** Upstream `use(DateInputGroupContext).slots`: `undefined` outside a DateInputGroup. */
const slotsOf = (context: DateInputGroupContext): DateInputGroupSlots | undefined =>
  context.inGroup ? slotsFor(context.fullWidth, context.variant) : undefined;

/* -------------------------------------------------------------------------------------------------
 * DateInputGroup Root
 * -----------------------------------------------------------------------------------------------*/
interface DateInputGroupRootProps extends GroupPrimitiveProps, DateInputGroupVariants {}

const DateInputGroupRoot = (props: DateInputGroupRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "fullWidth", "variant"]);
  const isLive = hasLiveProp(local, ["fullWidth", "variant"]);
  const contextValue: DateInputGroupContext = isLive
    ? {
        inGroup: true,
        get fullWidth() {
          return local.fullWidth;
        },
        get variant() {
          return local.variant;
        },
      }
    : { inGroup: true, fullWidth: local.fullWidth, variant: local.variant };
  const classOf = (): string | ((values: GroupRenderProps) => string) =>
    composeTwRenderProps(local.class as never, slotsFor(local.fullWidth, local.variant).base());
  const cls = isLive || hasLiveProp(local, ["class"]) ? (values: GroupRenderProps) => renderClass(classOf(), values) : classOf();
  // A function: Rivet JSX builds nodes eagerly, so the group is created inside the provider.
  const content = () => (
    <GroupPrimitive class={cls as never} data-slot="date-input-group" {...(rest as object)}>
      {local.children as Content}
    </GroupPrimitive>
  );

  return (
    <Provider token={DateInputGroupContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DateInputGroup Prefix
 * -----------------------------------------------------------------------------------------------*/
interface DateInputGroupPrefixProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type DivPartProps = DateInputGroupPrefixProps & Omit<JSX.IntrinsicElements["div"], "children" | "class">;

const DateInputGroupPrefix = <E extends keyof JSX.IntrinsicElements = "div">(props: DateInputGroupPrefixProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as DivPartProps, ["children", "class"]);
  const context = useContext(DateInputGroupContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.prefix, local.class)} data-slot="date-input-group-prefix" {...(rest as object)}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DateInputGroup Input
 * -----------------------------------------------------------------------------------------------*/
interface DateInputGroupInputProps extends DateInputPrimitiveProps {}

const DateInputGroupInput = (props: DateInputGroupInputProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(DateInputGroupContext);
  const classOf = (): string | ((values: DateInputRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.input());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["fullWidth", "variant"])
      ? (values: DateInputRenderProps) => renderClass(classOf(), values)
      : classOf();

  // TimeInput and DateInput share the cdk DateInput (it reads the DateField or the TimeField state).
  return <DateInputPrimitive class={cls as never} data-slot="date-input-group-input" {...(rest as DateInputPrimitiveProps)} />;
};

/* -------------------------------------------------------------------------------------------------
 * DateInputGroup Segment
 * -----------------------------------------------------------------------------------------------*/
interface DateInputGroupSegmentProps extends DateSegmentPrimitiveProps {}

const DateInputGroupSegment = (props: DateInputGroupSegmentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(DateInputGroupContext);
  const classOf = (): string | ((values: DateSegmentRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.segment());
  const cls = hasLiveProp(local, ["class"]) ? (values: DateSegmentRenderProps) => renderClass(classOf(), values) : classOf();

  return <DateSegmentPrimitive class={cls as never} data-slot="date-input-group-segment" {...(rest as DateSegmentPrimitiveProps)} />;
};

/* -------------------------------------------------------------------------------------------------
 * DateInputGroup InputContainer
 * -----------------------------------------------------------------------------------------------*/
interface DateInputGroupInputContainerProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

const DateInputGroupInputContainer = <E extends keyof JSX.IntrinsicElements = "div">(
  props: DateInputGroupInputContainerProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as DivPartProps, ["children", "class"]);
  const context = useContext(DateInputGroupContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.inputContainer, local.class)} data-slot="date-input-group-input-container" {...(rest as object)}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DateInputGroup Suffix
 * -----------------------------------------------------------------------------------------------*/
interface DateInputGroupSuffixProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

const DateInputGroupSuffix = <E extends keyof JSX.IntrinsicElements = "div">(props: DateInputGroupSuffixProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as DivPartProps, ["children", "class"]);
  const context = useContext(DateInputGroupContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.suffix, local.class)} data-slot="date-input-group-suffix" {...(rest as object)}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  DateInputGroupContext,
  DateInputGroupRoot,
  DateInputGroupInput,
  DateInputGroupInputContainer,
  DateInputGroupSegment,
  DateInputGroupPrefix,
  DateInputGroupSuffix,
};

export type {
  DateInputGroupRootProps,
  DateInputGroupInputProps,
  DateInputGroupInputContainerProps,
  DateInputGroupSegmentProps,
  DateInputGroupPrefixProps,
  DateInputGroupSuffixProps,
};
