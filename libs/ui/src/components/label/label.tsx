// Ported from HeroUI v3.2.6 packages/react/src/components/label/label.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `className` → `class` (string); `react-aria-components/Label` → `@rivetjs/cdk/label`; `@heroui/styles` → vendored `styles/`.
//   `isDisabled` / `isInvalid` / `isRequired` only choose the BEM modifiers (as upstream: they are not forwarded to the element).
// Live props: `class` / `isDisabled` / `isInvalid` / `isRequired` are read lazily (`splitLive`); the composed class is a local (a plain value for cdk `Label`), so when one of them is a live
//   getter (`hasLiveProp`) the class goes in as a function (`renderClass`, bound by the cdk element); static props keep the string path.
import { Label as LabelPrimitive } from "@rivetjs/cdk/label";
import type { LabelProps as LabelPrimitiveProps } from "@rivetjs/cdk/label";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { LabelVariants } from "../../../styles/src/components/label/index.ts";
import { labelVariants } from "../../../styles/src/components/label/index.ts";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";
import { slotProbing } from "@rivetjs/cdk/slot-probe";

/* -------------------------------------------------------------------------------------------------
 * Label Root
 * -----------------------------------------------------------------------------------------------*/
interface LabelRootProps extends LabelPrimitiveProps, LabelVariants {}

const STYLE_PROPS = ["class", "isDisabled", "isInvalid", "isRequired"] as const;

const LabelRoot = (props: LabelRootProps): JSX.Element => {
  // Server slot probe of the enclosing field (`@rivetjs/cdk/slot-probe`; browser: the constant `false`, folded away): no classes.
  if (slotProbing) return null as never;
  const [local, rest] = splitLive(props, ["children", ...STYLE_PROPS]);
  const classOf = (): string | ((values: never) => string) =>
    labelVariants({ isRequired: local.isRequired, isDisabled: local.isDisabled, isInvalid: local.isInvalid, class: local.class });
  const cls = hasLiveProp(local, STYLE_PROPS) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return (
    <LabelPrimitive class={cls as string} data-slot="label" {...rest}>
      {local.children}
    </LabelPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { LabelRoot };

export type { LabelRootProps };
