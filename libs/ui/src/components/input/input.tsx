// Ported from HeroUI v3.2.6 packages/react/src/components/input/input.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/Input` → `@rivetjs/cdk/input` (accessor render props);
//   `@heroui/styles` → vendored `styles/`.
// - Variant: prop ?? `TextFieldContext.variant` ?? `ComboBoxContext.variant`, read lazily inside the class binding (context fields are
//   getters over the field's / combo box's live props). `ComboBoxContext` from `combo-box/combo-box-context.ts` (no cdk ComboBox import).
// - Live props (`splitLive`): a live `class` / `fullWidth` / `variant` (or a live context `variant`) makes the cdk `class` a render-prop
//   function (`renderClass`); static props keep the string path.
import { Input as InputPrimitive } from "@rivetjs/cdk/input";
import type { InputProps as InputPrimitiveProps, InputRenderProps } from "@rivetjs/cdk/input";
import { useContext } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { InputVariants } from "../../../styles/src/components/input/index.ts";
import { inputVariants } from "../../../styles/src/components/input/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { ComboBoxContext } from "../combo-box/combo-box-context.ts";
import { TextFieldContext } from "../textfield/textfield.tsx";
import { slotProbing } from "@rivetjs/cdk/slot-probe";

/* -------------------------------------------------------------------------------------------------
 * Input Root
 * -----------------------------------------------------------------------------------------------*/
interface InputRootProps extends InputPrimitiveProps, InputVariants {}

const STYLE_PROPS = ["class", "fullWidth", "variant"] as const;

const InputRoot = (props: InputRootProps): JSX.Element => {
  // Server slot probe of the enclosing field (`@rivetjs/cdk/slot-probe`; browser: the constant `false`, folded away): no
  // classes; the cdk Input merges an own `id` into the field's input id (the Label's `for`) and renders nothing.
  if (slotProbing) return InputPrimitive({ id: props.id, slot: props.slot } as InputPrimitiveProps) as never;
  const [local, rest] = splitLive(props, STYLE_PROPS);
  const textFieldContext = useContext(TextFieldContext);
  const comboBoxContext = useContext(ComboBoxContext);

  // Use variant from context if not explicitly provided
  const variant = () => local.variant ?? textFieldContext.variant ?? comboBoxContext.variant;

  const classOf = (): string | ((values: InputRenderProps) => string) =>
    composeTwRenderProps(local.class as never, inputVariants({ fullWidth: local.fullWidth, variant: variant() }));
  const cls =
    hasLiveProp(local, STYLE_PROPS) || hasLiveProp(textFieldContext, ["variant"]) || hasLiveProp(comboBoxContext, ["variant"])
      ? (values: InputRenderProps) => renderClass(classOf(), values)
      : classOf();

  // `rest` as `object`: cdk `AccessorProps` maps the compiler-only `r:slot` attribute to an accessor, which `IntrinsicAttributes` rejects.
  return <InputPrimitive class={cls as never} data-slot="input" {...(rest as object)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { InputRoot };

export type { InputRootProps };
