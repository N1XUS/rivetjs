// Ported from HeroUI v3.2.6 packages/react/src/components/textarea/textarea.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/TextArea` → `@rivetjs/cdk/text-area` (accessor render props);
//   `@heroui/styles` → vendored `styles/`.
// - Variant: prop ?? `TextFieldContext.variant`, read lazily inside the class binding (the context field is a getter over the live prop).
// - Live props (`splitLive`): a live `class` / `fullWidth` / `variant` (or context `variant`) makes the cdk `class` a render-prop function
//   (`renderClass`); static props keep the string path.
import { TextArea as TextAreaPrimitive } from "@rivetjs/cdk/text-area";
import type { InputRenderProps, TextAreaProps as TextAreaPrimitiveProps } from "@rivetjs/cdk/text-area";
import { useContext } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { TextAreaVariants } from "../../../styles/src/components/textarea/index.ts";
import { textAreaVariants } from "../../../styles/src/components/textarea/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { TextFieldContext } from "../textfield/textfield.tsx";
import { slotProbing } from "@rivetjs/cdk/slot-probe";

/* -------------------------------------------------------------------------------------------------
 * TextArea Root
 * -----------------------------------------------------------------------------------------------*/
interface TextAreaRootProps extends TextAreaPrimitiveProps, TextAreaVariants {}

const STYLE_PROPS = ["class", "fullWidth", "variant"] as const;

const TextAreaRoot = (props: TextAreaRootProps): JSX.Element => {
  // Server slot probe of the enclosing field (`@rivetjs/cdk/slot-probe`; browser: the constant `false`, folded away): no
  // classes; the cdk TextArea merges an own `id` into the field's input id (the Label's `for`) and renders nothing.
  if (slotProbing) return TextAreaPrimitive({ id: props.id, slot: props.slot } as TextAreaPrimitiveProps) as never;
  const [local, rest] = splitLive(props, STYLE_PROPS);
  const textFieldContext = useContext(TextFieldContext);
  const resolvedVariant = () => local.variant ?? textFieldContext?.variant;

  const classOf = (): string | ((values: InputRenderProps) => string) =>
    composeTwRenderProps(local.class as never, textAreaVariants({ fullWidth: local.fullWidth, variant: resolvedVariant() }));
  const cls =
    hasLiveProp(local, STYLE_PROPS) || hasLiveProp(textFieldContext, ["variant"]) ? (values: InputRenderProps) => renderClass(classOf(), values) : classOf();

  // `rest` as `object`: cdk `AccessorProps` maps the compiler-only `r:slot` attribute to an accessor, which `IntrinsicAttributes` rejects.
  return <TextAreaPrimitive data-slot="textarea" class={cls as never} {...(rest as object)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { TextAreaRoot };

export type { TextAreaRootProps };
