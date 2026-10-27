// Ported from HeroUI v3.2.6 packages/react/src/components/textfield/textfield.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/TextField` → `@rivetjs/cdk/text-field` (RAC parts, accessor render
//   props); `@heroui/styles` → vendored `styles/`.
// - `TextFieldContext` is a resumable token (`rv-ui-textfield`, same `{}` default); its `variant` is a getter over a live prop, plain data otherwise (upstream:
//   `useMemo({ variant })`), so `Input` / `TextArea` / `InputGroup` readers follow a changed `variant` in place.
// - Live props (`splitLive`): `class` / `fullWidth` live → the cdk `class` is a render-prop function (`renderClass`); static props keep the
//   string path. Function children: `typeof children === "function"` → `!isSlot(children)` (Rivet JSX children are compiler slots).
// - Rivet addition (identity spec §4.2): shorthand `label` / `description` / `errorMessage` / `placeholder` when no children are
//   given → Label + Input (placeholder) + Description + FieldError, the same parts as the compound form (live, like any prop).
// - Rivet (T20): inside a `<Form form>` (`@rivetjs/forms`, `FormFieldsContext`) a named field without `value` / `defaultValue`
//   starts from the store's echoed / initial value, and the shorthand form always has a FieldError (the store's issues reach
//   it through the cdk Form's `validationErrors`).
import { TextField as TextFieldPrimitive } from "@rivetjs/cdk/text-field";
import type { TextFieldProps as TextFieldPrimitiveProps, TextFieldRenderProps } from "@rivetjs/cdk/text-field";
import { useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";

import type { TextFieldVariants } from "../../../styles/src/components/textfield/index.ts";
import { textFieldVariants } from "../../../styles/src/components/textfield/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { FieldErrorRoot, type FieldErrorRootProps } from "../field-error/field-error.tsx";
import { InputRoot } from "../input/input.tsx";
import { LabelRoot } from "../label/label.tsx";
import { FormFieldsContext } from "../../utils/form-fields.ts";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DEV } from "#dev";
import { TextFieldContext, type TextFieldContextValue } from "./textfield-context.ts";

/* -------------------------------------------------------------------------------------------------
 * TextField Root
 * -----------------------------------------------------------------------------------------------*/
interface TextFieldRootProps extends TextFieldPrimitiveProps, TextFieldVariants {
  /**
   * The variant of the text field.
   * @default "primary"
   */
  variant?: "primary" | "secondary";
  /** Shorthand (no children): the field's Label content. */
  label?: Content;
  /** Shorthand (no children): a Description under the input. */
  description?: Content;
  /** Shorthand (no children): the FieldError content (text, or a function of the validation result); shown while invalid. */
  errorMessage?: FieldErrorRootProps["children"];
  /** Shorthand (no children): the Input's placeholder. */
  placeholder?: string;
}

const STYLE_PROPS = ["class", "fullWidth"] as const;

const TextFieldRoot = (props: TextFieldRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "errorMessage", "fullWidth", "label", "placeholder", "variant"]);
  if (DEV && local.children !== undefined) DEV.shorthandIgnored("TextField", local, ["label", "description", "errorMessage", "placeholder"]);
  // A body const (compiler-registered resumable symbol), see `../../../CLAUDE.md` Gotchas.
  const classOf = (): string | ((values: TextFieldRenderProps) => string) =>
    composeTwRenderProps(local.class as never, textFieldVariants({ fullWidth: local.fullWidth }));
  const cls = hasLiveProp(local, STYLE_PROPS) ? (values: TextFieldRenderProps) => renderClass(classOf(), values) : classOf();
  const fields = useContext(FormFieldsContext);
  const name = fields && rest.value === undefined && rest.defaultValue === undefined ? rest.name : undefined;
  const echo = name !== undefined ? { defaultValue: fields!.defaultValue(name) } : undefined;

  return (
    <TextFieldPrimitive data-slot="textfield" {...rest} {...echo} class={cls as never}>
      {(values: TextFieldRenderProps) => {
        // Getter only when `variant` is live (readers then take the render-prop class path), plain data otherwise.
        const contextValue: TextFieldContextValue = hasLiveProp(local, ["variant"])
          ? {
              get variant() {
                return local.variant;
              },
            }
          : { variant: local.variant };
        return (
          <Provider token={TextFieldContext} value={contextValue}>
            {local.children === undefined ? (
              <>
                {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
                <InputRoot placeholder={local.placeholder} />
                {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
                {(local.errorMessage !== undefined || fields !== undefined) && <FieldErrorRoot>{local.errorMessage}</FieldErrorRoot>}
              </>
            ) : typeof local.children === "function" && !isSlot(local.children) ? (
              (local.children as (v: TextFieldRenderProps) => Content)(values)
            ) : (
              (local.children as Content)
            )}
          </Provider>
        );
      }}
    </TextFieldPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { TextFieldRoot, TextFieldContext };

export type { TextFieldRootProps };
