// Ported from HeroUI v3.2.6 packages/react/src/components/color-input-group/color-input-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{Group,Input}` → `@rivetjs/cdk/{group,input}` (accessor render
//   props); `@heroui/styles` → vendored `styles/`.
// - `ColorInputGroupContext` carries plain data (`{ inGroup, fullWidth, variant }`, getters when the root's props are live; resumable
//   token `rv-ui-color-input-group`, `{}` default) instead of the tv `slots`; parts look the slots up in a module-level memo per
//   `fullWidth|variant` (`slotsFor`), `undefined` outside a ColorInputGroup (= upstream `slots?.x`).
// - Live props (`splitLive`): a live `class` / `fullWidth` / `variant` makes the cdk `class` a render-prop function (`renderClass`).
// - Children: upstream's `(values) => typeof children === "function" ? children(values) : children` = what the cdk Group does with
//   `children` itself (passed through).
import { Group as GroupPrimitive } from "@rivetjs/cdk/group";
import type { GroupProps as GroupPrimitiveProps, GroupRenderProps } from "@rivetjs/cdk/group";
import { Input as InputPrimitive } from "@rivetjs/cdk/input";
import type { InputProps as InputPrimitiveProps, InputRenderProps } from "@rivetjs/cdk/input";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ColorInputGroupVariants } from "../../../styles/src/components/color-input-group/index.ts";
import { colorInputGroupVariants } from "../../../styles/src/components/color-input-group/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * ColorInputGroup Context
 * -----------------------------------------------------------------------------------------------*/
type ColorInputGroupContext = {
  /** Set inside a ColorInputGroup (upstream: `slots`). */
  inGroup?: true;
  fullWidth?: boolean;
  variant?: ColorInputGroupVariants["variant"];
};

const ColorInputGroupContext = createContext<ColorInputGroupContext>({});

type ColorInputGroupSlots = ReturnType<typeof colorInputGroupVariants>;

/** Module-level memo per `fullWidth|variant` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, ColorInputGroupSlots> = {};
const slotsFor = (fullWidth: boolean | undefined, variant: ColorInputGroupVariants["variant"]): ColorInputGroupSlots =>
  (SLOTS[`${!!fullWidth}|${variant}`] ??= colorInputGroupVariants({ fullWidth, variant }));

/** Upstream `use(ColorInputGroupContext).slots`: `undefined` outside a ColorInputGroup. */
const slotsOf = (context: ColorInputGroupContext): ColorInputGroupSlots | undefined =>
  context.inGroup ? slotsFor(context.fullWidth, context.variant) : undefined;

/* -------------------------------------------------------------------------------------------------
 * ColorInputGroup Root
 * -----------------------------------------------------------------------------------------------*/
interface ColorInputGroupRootProps extends GroupPrimitiveProps, ColorInputGroupVariants {}

const ColorInputGroupRoot = (props: ColorInputGroupRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "fullWidth", "variant"]);
  const isLive = hasLiveProp(local, ["fullWidth", "variant"]);
  const contextValue: ColorInputGroupContext = isLive
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
    <GroupPrimitive class={cls as never} data-slot="color-input-group" {...(rest as object)}>
      {local.children as Content}
    </GroupPrimitive>
  );

  return (
    <Provider token={ColorInputGroupContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ColorInputGroup Prefix
 * -----------------------------------------------------------------------------------------------*/
interface ColorInputGroupPrefixProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type DivPartProps = ColorInputGroupPrefixProps & Omit<JSX.IntrinsicElements["div"], "children" | "class">;

const ColorInputGroupPrefix = <E extends keyof JSX.IntrinsicElements = "div">(props: ColorInputGroupPrefixProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as DivPartProps, ["children", "class"]);
  const context = useContext(ColorInputGroupContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.prefix, local.class)} data-slot="color-input-group-prefix" {...(rest as object)}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ColorInputGroup Input
 * -----------------------------------------------------------------------------------------------*/
interface ColorInputGroupInputProps extends InputPrimitiveProps {
  class?: string;
}

const ColorInputGroupInput = (props: ColorInputGroupInputProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(ColorInputGroupContext);
  const classOf = (): string | ((values: InputRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.input());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["fullWidth", "variant"]) ? (values: InputRenderProps) => renderClass(classOf(), values) : classOf();

  return <InputPrimitive class={cls as never} data-slot="color-input-group-input" {...(rest as object)} />;
};

/* -------------------------------------------------------------------------------------------------
 * ColorInputGroup Suffix
 * -----------------------------------------------------------------------------------------------*/
interface ColorInputGroupSuffixProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

const ColorInputGroupSuffix = <E extends keyof JSX.IntrinsicElements = "div">(props: ColorInputGroupSuffixProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as DivPartProps, ["children", "class"]);
  const context = useContext(ColorInputGroupContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.suffix, local.class)} data-slot="color-input-group-suffix" {...(rest as object)}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ColorInputGroupContext, ColorInputGroupRoot, ColorInputGroupInput, ColorInputGroupPrefix, ColorInputGroupSuffix };

export type { ColorInputGroupRootProps, ColorInputGroupInputProps, ColorInputGroupPrefixProps, ColorInputGroupSuffixProps };
