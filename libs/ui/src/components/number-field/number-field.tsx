// Ported from HeroUI v3.2.6 packages/react/src/components/number-field/number-field.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{NumberField,Group,Input,Button}` →
//   `@rivetjs/cdk/{number-field,group,input,button}` (accessor render props); `@heroui/styles` → vendored `styles/`.
// - `NumberFieldContext` carries plain data (`{ fullWidth, variant }`, getters when the root's props are live; resumable token
//   `rv-ui-number-field`, `{}` default) instead of the tv `slots`; parts look the slots up in a module-level memo per `fullWidth|variant`
//   (`slotsFor`), `undefined` outside a NumberField (= upstream `slots?.x`).
// - Stepper defaults: upstream's inline `IconPlus` / `IconMinus` svgs (16px) → lucide `Plus` / `Minus` via `@rivetjs/kit/icon` (16px,
//   `data-slot="number-field-{increment,decrement}-button-icon"`). Upstream keeps `children` only when it is a valid element
//   (`React.isValidElement`); Rivet JSX children are slots: any `children` replace the default icon (omit them for the default).
// - Live props (`splitLive`): a live `class` / `fullWidth` / `variant` makes the cdk `class` a render-prop function (`renderClass`).
// - Children: upstream's `(values) => typeof children === "function" ? children(values) : children` = what the cdk parts do with
//   `children` themselves (passed through).
// - Rivet addition (identity spec §4.2): shorthand `label` / `description` / `errorMessage` / `placeholder` when no children are
//   given: Label + Group(DecrementButton, Input, IncrementButton) + Description + FieldError (the compound form's markup). Read once at mount: whether
//   the shorthand form renders.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { Group as GroupPrimitive } from "@rivetjs/cdk/group";
import type { GroupProps as GroupPrimitiveProps, GroupRenderProps } from "@rivetjs/cdk/group";
import { Input as InputPrimitive } from "@rivetjs/cdk/input";
import type { InputProps as InputPrimitiveProps, InputRenderProps } from "@rivetjs/cdk/input";
import { NumberField as NumberFieldPrimitive } from "@rivetjs/cdk/number-field";
import type { NumberFieldProps as NumberFieldPrimitiveProps, NumberFieldRenderProps } from "@rivetjs/cdk/number-field";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { Minus, Plus } from "lucide";

import type { NumberFieldVariants } from "../../../styles/src/components/number-field/index.ts";
import { numberFieldVariants } from "../../../styles/src/components/number-field/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { FieldErrorRoot, type FieldErrorRootProps } from "../field-error/field-error.tsx";
import { LabelRoot } from "../label/label.tsx";
import { DEV } from "#dev";

/* -------------------------------------------------------------------------------------------------
 * NumberField Context
 * -----------------------------------------------------------------------------------------------*/
type NumberFieldContext = {
  /** Set inside a NumberField (upstream: `slots`). */
  inField?: true;
  fullWidth?: boolean;
  variant?: NumberFieldVariants["variant"];
};

const NumberFieldContext = createContext<NumberFieldContext>({});

type NumberFieldSlots = ReturnType<typeof numberFieldVariants>;

/** Module-level memo per `fullWidth|variant` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, NumberFieldSlots> = {};
const slotsFor = (fullWidth: boolean | undefined, variant: NumberFieldVariants["variant"]): NumberFieldSlots =>
  (SLOTS[`${!!fullWidth}|${variant}`] ??= numberFieldVariants({ fullWidth, variant }));

/** Upstream `use(NumberFieldContext).slots`: `undefined` outside a NumberField. */
const slotsOf = (context: NumberFieldContext): NumberFieldSlots | undefined => (context.inField ? slotsFor(context.fullWidth, context.variant) : undefined);

const CONTEXT_KEYS = ["fullWidth", "variant"] as const;

/* -------------------------------------------------------------------------------------------------
 * NumberField Root
 * -----------------------------------------------------------------------------------------------*/
interface NumberFieldRootProps extends NumberFieldPrimitiveProps, NumberFieldVariants {
  /** Shorthand (no children): the field's Label. */
  label?: Content;
  /** Shorthand (no children): a Description under the group. */
  description?: Content;
  /** Shorthand (no children): the FieldError text (shown while the field is invalid). */
  errorMessage?: FieldErrorRootProps["children"];
  /** Shorthand (no children): the input's placeholder. */
  placeholder?: string;
}

const NumberFieldRoot = (props: NumberFieldRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "errorMessage", "fullWidth", "label", "placeholder", "variant"]);
  if (DEV && local.children !== undefined) DEV.shorthandIgnored("NumberField", local, ["label", "description", "errorMessage", "placeholder"]);
  // Getters only when a field is live (readers then take the render-prop class path), plain data otherwise.
  const contextValue: NumberFieldContext = hasLiveProp(local, CONTEXT_KEYS)
    ? {
        inField: true,
        get fullWidth() {
          return local.fullWidth;
        },
        get variant() {
          return local.variant;
        },
      }
    : { inField: true, fullWidth: local.fullWidth, variant: local.variant };

  const classOf = (): string | ((values: NumberFieldRenderProps) => string) =>
    composeTwRenderProps(local.class as never, slotsFor(local.fullWidth, local.variant).base());
  const cls = hasLiveProp(local, ["class", "fullWidth", "variant"]) ? (values: NumberFieldRenderProps) => renderClass(classOf(), values) : classOf();

  // A function: Rivet JSX builds nodes eagerly, so the field is created inside the provider.
  const content = () => (
    <NumberFieldPrimitive data-slot="number-field" {...(rest as object)} class={cls as never}>
      {local.children === undefined ? (
        <>
          {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
          <NumberFieldGroup>
            <NumberFieldDecrementButton />
            <NumberFieldInput placeholder={local.placeholder} />
            <NumberFieldIncrementButton />
          </NumberFieldGroup>
          {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
          {local.errorMessage !== undefined && <FieldErrorRoot>{local.errorMessage}</FieldErrorRoot>}
        </>
      ) : (
        (local.children as Content)
      )}
    </NumberFieldPrimitive>
  );

  return (
    <Provider token={NumberFieldContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * NumberField Group
 * -----------------------------------------------------------------------------------------------*/
interface NumberFieldGroupProps extends GroupPrimitiveProps {}

const NumberFieldGroup = (props: NumberFieldGroupProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(NumberFieldContext);
  const classOf = (): string | ((values: GroupRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.group());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, CONTEXT_KEYS) ? (values: GroupRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <GroupPrimitive class={cls as never} data-slot="number-field-group" {...(rest as object)}>
      {local.children as Content}
    </GroupPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * NumberField Input
 * -----------------------------------------------------------------------------------------------*/
interface NumberFieldInputProps extends InputPrimitiveProps {}

const NumberFieldInput = (props: NumberFieldInputProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(NumberFieldContext);
  const classOf = (): string | ((values: InputRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.input());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, CONTEXT_KEYS) ? (values: InputRenderProps) => renderClass(classOf(), values) : classOf();

  return <InputPrimitive class={cls as never} data-slot="number-field-input" {...(rest as object)} />;
};

/* -------------------------------------------------------------------------------------------------
 * NumberField Increment Button
 * -----------------------------------------------------------------------------------------------*/
interface NumberFieldIncrementButtonProps extends ButtonPrimitiveProps {}

const NumberFieldIncrementButton = (props: NumberFieldIncrementButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(NumberFieldContext);
  const classOf = (): string | ((values: ButtonRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.incrementButton());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, CONTEXT_KEYS) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive class={cls as never} data-slot="number-field-increment-button" slot="increment" {...(rest as object)}>
      {(local.children as Content) ?? <Icon data-slot="number-field-increment-button-icon" icon={Plus} size={16} />}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * NumberField Decrement Button
 * -----------------------------------------------------------------------------------------------*/
interface NumberFieldDecrementButtonProps extends ButtonPrimitiveProps {}

const NumberFieldDecrementButton = (props: NumberFieldDecrementButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(NumberFieldContext);
  const classOf = (): string | ((values: ButtonRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context)?.decrementButton());
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, CONTEXT_KEYS) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive class={cls as never} data-slot="number-field-decrement-button" slot="decrement" {...(rest as object)}>
      {(local.children as Content) ?? <Icon data-slot="number-field-decrement-button-icon" icon={Minus} size={16} />}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { NumberFieldRoot, NumberFieldGroup, NumberFieldInput, NumberFieldIncrementButton, NumberFieldDecrementButton, NumberFieldContext };

export type { NumberFieldRootProps, NumberFieldGroupProps, NumberFieldInputProps, NumberFieldIncrementButtonProps, NumberFieldDecrementButtonProps };
