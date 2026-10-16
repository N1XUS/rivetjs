// Ported from HeroUI v3.2.6 packages/react/src/components/time-field/time-field.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/TimeField` → `@rivetjs/cdk/date-field` (accessor render
//   props); `@heroui/styles` → vendored `styles/`.
// - `data-required`: set by the cdk field root itself (RAC sets it too; upstream adds it again from `isRequired`).
// - Children: upstream's `(values) => typeof children === "function" ? children(values) : children` = what the cdk field does with
//   `children` itself (passed through).
// - Date props (`value`, `defaultValue`, `minValue`, `maxValue`, `placeholderValue`) reach the cdk field in their string form
//   (`../../utils/date-value.ts`: date / time instances are not serializable resume captures); a controlled `value` is a Signal of the
//   string form (cdk). Live `class` / `fullWidth` → render-prop class function (`hasLiveProp`).
import { TimeField as TimeFieldPrimitive } from "@rivetjs/cdk/date-field";
import type { TimeFieldProps as TimeFieldPrimitiveProps, DateFieldRenderProps } from "@rivetjs/cdk/date-field";
import type { TimeValue } from "@rivetjs/cdk/state/time-field";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { TimeFieldVariants } from "../../../styles/src/components/time-field/index.ts";
import { timeFieldVariants } from "../../../styles/src/components/time-field/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { dateProps } from "../../utils/date-value.ts";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

const DATE_KEYS = ["value", "defaultValue", "minValue", "maxValue", "placeholderValue"] as const;

/* -------------------------------------------------------------------------------------------------
 * TimeField Root
 * -----------------------------------------------------------------------------------------------*/
interface TimeFieldRootProps<T extends TimeValue = TimeValue> extends TimeFieldPrimitiveProps<T>, TimeFieldVariants {}

function TimeFieldRoot<T extends TimeValue = TimeValue>(props: TimeFieldRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as TimeFieldRootProps, ["children", "class", "fullWidth", ...DATE_KEYS]);
  const classOf = () => composeTwRenderProps(local.class as never, timeFieldVariants({ fullWidth: local.fullWidth }));
  const cls = hasLiveProp(local, ["class", "fullWidth"]) ? (values: DateFieldRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <TimeFieldPrimitive data-slot="time-field" {...(rest as object)} {...dateProps(local, DATE_KEYS)} class={cls as never}>
      {local.children as Content}
    </TimeFieldPrimitive>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { TimeFieldRoot };

export type { TimeFieldRootProps };
