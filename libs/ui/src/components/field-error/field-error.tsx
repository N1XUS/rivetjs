// Ported from HeroUI v3.2.6 packages/react/src/components/field-error/field-error.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `className` → `class`; `react-aria-components/FieldError` → `@rivetjs/cdk/form` `FieldError`; `@heroui/styles` →
//   vendored `styles/`. cdk render props are accessors (`({ isInvalid }) => isInvalid()`); the upstream
//   `(renderProps) => typeof children === "function" ? children(renderProps) : children` wrapper is not needed, the cdk part
//   resolves function / plain children itself.
// Live props: `class` is read lazily (`splitLive`); the composed class is a local (a plain value for cdk `FieldError`), so a live `class` goes in
//   as a render-prop function (`renderClass`); static props keep the `composeTwRenderProps` result as is.
import { FieldError as FieldErrorPrimitive } from "@rivetjs/cdk/form";
import type { FieldErrorProps as FieldErrorPrimitiveProps } from "@rivetjs/cdk/form";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { FieldErrorVariants } from "../../../styles/src/components/field-error/index.ts";
import { fieldErrorVariants } from "../../../styles/src/components/field-error/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";
import { slotProbing } from "@rivetjs/cdk/slot-probe";

/* -------------------------------------------------------------------------------------------------
 * Field Error Root
 * -----------------------------------------------------------------------------------------------*/
interface FieldErrorRootProps extends FieldErrorPrimitiveProps, FieldErrorVariants {}

const FieldErrorRoot = (props: FieldErrorRootProps): JSX.Element => {
  // Server slot probe of the enclosing field (`@rivetjs/cdk/slot-probe`; browser: the constant `false`, folded away): no classes.
  if (slotProbing) return null as never;
  const [local, rest] = splitLive(props, ["children", "class"]);
  const classOf = (): string | ((values: never) => string) => composeTwRenderProps(local.class, fieldErrorVariants());
  const cls = hasLiveProp(local, ["class"]) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return (
    <FieldErrorPrimitive data-visible class={cls as never} data-slot="field-error" {...rest}>
      {local.children}
    </FieldErrorPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { FieldErrorRoot };

export type { FieldErrorRootProps };
