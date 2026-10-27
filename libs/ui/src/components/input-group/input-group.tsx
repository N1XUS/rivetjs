// Ported from HeroUI v3.2.6 packages/react/src/components/input-group/input-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{Group,Input,TextArea}` → `@rivetjs/cdk/{group,input,text-area}`
//   (accessor render props); `@heroui/styles` → vendored `styles/`.
// - `InputGroupContext` carries plain data (`{ fullWidth, variant }`, getters when the root's props are live; resumable token
//   `rv-ui-input-group`, `{}` default) instead of the tv `slots`; parts look the slots up in a module-level memo per
//   `fullWidth|variant` (`slotsFor`), `undefined` outside an InputGroup (= upstream `slots?.x`). Variant = prop ?? `TextFieldContext.variant`.
// - Click-to-focus: upstream's `groupRef` + `querySelector("input")` → the click's `currentTarget` (the group element; same lookup).
// - Live props (`splitLive`): a live `class` / `fullWidth` / `variant` (or a live TextField `variant`) makes the cdk `class` a render-prop
//   function (`renderClass`); static props keep the string path.
// - Prefix / Suffix: `dom.div` (forwards `ref`; upstream plain `div` with `ComponentPropsWithRef<"div">`).
// - Children: upstream's `(renderProps) => typeof children === "function" ? children(renderProps) : children` = what the cdk Group does
//   with `children` itself (passed through).
import { Group as GroupPrimitive } from "@rivetjs/cdk/group";
import type { GroupProps as GroupPrimitiveProps, GroupRenderProps } from "@rivetjs/cdk/group";
import { Input as InputPrimitive } from "@rivetjs/cdk/input";
import type { InputProps as InputPrimitiveProps, InputRenderProps } from "@rivetjs/cdk/input";
import { TextArea as TextAreaPrimitive } from "@rivetjs/cdk/text-area";
import type { TextAreaProps as TextAreaPrimitiveProps } from "@rivetjs/cdk/text-area";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { InputGroupVariants } from "../../../styles/src/components/input-group/index.ts";
import { inputGroupVariants } from "../../../styles/src/components/input-group/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { TextFieldContext } from "../textfield/textfield-context.ts";
import { slotProbing } from "@rivetjs/cdk/slot-probe";

/* -------------------------------------------------------------------------------------------------
 * InputGroup Context
 * -----------------------------------------------------------------------------------------------*/
type InputGroupContext = {
  /** Set inside an InputGroup (upstream: `slots`). */
  inGroup?: true;
  fullWidth?: boolean;
  variant?: InputGroupVariants["variant"];
};

const InputGroupContext = createContext<InputGroupContext>({});

type InputGroupSlots = ReturnType<typeof inputGroupVariants>;

/** Module-level memo per `fullWidth|variant` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, InputGroupSlots> = {};
const slotsFor = (fullWidth: boolean | undefined, variant: InputGroupVariants["variant"]): InputGroupSlots =>
  (SLOTS[`${!!fullWidth}|${variant}`] ??= inputGroupVariants({ fullWidth, variant }));

/** Upstream `use(InputGroupContext).slots`: `undefined` outside an InputGroup. */
const slotsOf = (context: InputGroupContext): InputGroupSlots | undefined => (context.inGroup ? slotsFor(context.fullWidth, context.variant) : undefined);

/* -------------------------------------------------------------------------------------------------
 * InputGroup Root
 * -----------------------------------------------------------------------------------------------*/
interface InputGroupRootProps extends GroupPrimitiveProps, InputGroupVariants {
  onClick?: (event: MouseEvent) => void;
}

const InputGroupRoot = (props: InputGroupRootProps): JSX.Element => {
  // Server slot probe of the enclosing field (`@rivetjs/cdk/slot-probe`; browser: the constant `false`, folded away): its children only.
  if (slotProbing) return props.children as JSX.Element;
  const [local, rest] = splitLive(props, ["children", "class", "fullWidth", "onClick", "variant"]);
  const textFieldContext = useContext(TextFieldContext);
  const resolvedVariant = () => local.variant ?? textFieldContext.variant;

  const isLive = hasLiveProp(local, ["fullWidth", "variant"]) || hasLiveProp(textFieldContext, ["variant"]);
  // Getters only when a field is live (readers then take the render-prop class path), plain data otherwise.
  const contextValue: InputGroupContext = isLive
    ? {
        inGroup: true,
        get fullWidth() {
          return local.fullWidth;
        },
        get variant() {
          return resolvedVariant();
        },
      }
    : { inGroup: true, fullWidth: local.fullWidth, variant: resolvedVariant() };

  const classOf = (): string | ((values: GroupRenderProps) => string) =>
    composeTwRenderProps(local.class as never, slotsFor(local.fullWidth, resolvedVariant()).base());
  const cls = isLive || hasLiveProp(local, ["class"]) ? (values: GroupRenderProps) => renderClass(classOf(), values) : classOf();

  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const input = (e.currentTarget as HTMLElement | null)?.querySelector("input");

    if (input && target !== input && !input.contains(target)) {
      input.focus();
    }

    local.onClick?.(e);
  };

  // A function: Rivet JSX builds nodes eagerly, so the group is created inside the provider.
  const content = () => (
    <GroupPrimitive {...(rest as object)} class={cls as never} data-slot="input-group" onClick={handleClick}>
      {local.children as Content}
    </GroupPrimitive>
  );

  return (
    <Provider token={InputGroupContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * InputGroup Input
 * -----------------------------------------------------------------------------------------------*/
interface InputGroupInputProps extends InputPrimitiveProps {}

const InputGroupInput = (props: InputGroupInputProps): JSX.Element => {
  // Field slot probe: forward `{ id, slot }` to the cdk Input, which merges an own `id` into the field's input id (the
  // Label's `for`, RA mergeIds) and renders nothing (as ui `Input`).
  if (slotProbing) return InputPrimitive({ id: props.id, slot: props.slot } as InputPrimitiveProps) as never;
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(InputGroupContext);
  const classOf = (): string | ((values: InputRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.input());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["fullWidth", "variant"]) ? (values: InputRenderProps) => renderClass(classOf(), values) : classOf();

  return <InputPrimitive class={cls as never} data-slot="input-group-input" {...(rest as object)} />;
};

/* -------------------------------------------------------------------------------------------------
 * InputGroup Prefix
 * -----------------------------------------------------------------------------------------------*/
interface InputGroupPrefixProps extends Omit<JSX.IntrinsicElements["div"], "class"> {
  children?: Content;
  class?: string;
}

const InputGroupPrefix = (props: InputGroupPrefixProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(InputGroupContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.prefix, local.class)} data-slot="input-group-prefix" {...rest}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * InputGroup TextArea
 * -----------------------------------------------------------------------------------------------*/
interface InputGroupTextAreaProps extends TextAreaPrimitiveProps {}

const InputGroupTextArea = (props: InputGroupTextAreaProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(InputGroupContext);
  const classOf = (): string | ((values: InputRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.input());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["fullWidth", "variant"]) ? (values: InputRenderProps) => renderClass(classOf(), values) : classOf();

  return <TextAreaPrimitive class={cls as never} data-slot="input-group-textarea" {...(rest as object)} />;
};

/* -------------------------------------------------------------------------------------------------
 * InputGroup Suffix
 * -----------------------------------------------------------------------------------------------*/
interface InputGroupSuffixProps extends Omit<JSX.IntrinsicElements["div"], "class"> {
  children?: Content;
  class?: string;
}

const InputGroupSuffix = (props: InputGroupSuffixProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(InputGroupContext);

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.suffix, local.class)} data-slot="input-group-suffix" {...rest}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { InputGroupRoot, InputGroupInput, InputGroupTextArea, InputGroupPrefix, InputGroupSuffix, InputGroupContext };

export type { InputGroupRootProps, InputGroupInputProps, InputGroupTextAreaProps, InputGroupPrefixProps, InputGroupSuffixProps };
