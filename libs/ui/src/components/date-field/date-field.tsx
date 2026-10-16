// Ported from HeroUI v3.2.6 packages/react/src/components/date-field/date-field.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/DateField` → `@rivetjs/cdk/date-field` (accessor render
//   props); `@heroui/styles` → vendored `styles/`.
// - `data-required`: set by the cdk field root itself (RAC sets it too; upstream adds it again from `isRequired`).
// - Children: upstream's `(values) => typeof children === "function" ? children(values) : children` = what the cdk field does with
//   `children` itself (passed through).
// - Date props (`value`, `defaultValue`, `minValue`, `maxValue`, `placeholderValue`) reach the cdk field in their string form
//   (`../../utils/date-value.ts`: date / time instances are not serializable resume captures); a controlled `value` is a Signal of the
//   string form (cdk). Live `class` / `fullWidth` → render-prop class function (`hasLiveProp`).
import { DateField as DateFieldPrimitive } from "@rivetjs/cdk/date-field";
import type { DateFieldProps as DateFieldPrimitiveProps, DateFieldRenderProps } from "@rivetjs/cdk/date-field";
import type { DateValue } from "@rivetjs/cdk/date";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { DateFieldVariants } from "../../../styles/src/components/date-field/index.ts";
import { dateFieldVariants } from "../../../styles/src/components/date-field/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { dateProps } from "../../utils/date-value.ts";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

const DATE_KEYS = ["value", "defaultValue", "minValue", "maxValue", "placeholderValue"] as const;

/* -------------------------------------------------------------------------------------------------
 * DateField Root
 * -----------------------------------------------------------------------------------------------*/
interface DateFieldRootProps<T extends DateValue = DateValue> extends DateFieldPrimitiveProps<T>, DateFieldVariants {}

function DateFieldRoot<T extends DateValue = DateValue>(props: DateFieldRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as DateFieldRootProps, ["children", "class", "fullWidth", ...DATE_KEYS]);
  const classOf = () => composeTwRenderProps(local.class as never, dateFieldVariants({ fullWidth: local.fullWidth }));
  const cls = hasLiveProp(local, ["class", "fullWidth"]) ? (values: DateFieldRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <DateFieldPrimitive data-slot="date-field" {...(rest as object)} {...dateProps(local, DATE_KEYS)} class={cls as never}>
      {local.children as Content}
    </DateFieldPrimitive>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { DateFieldRoot };

export type { DateFieldRootProps };
