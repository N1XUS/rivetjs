// Ported from HeroUI v3.2.6 packages/react/src/components/radio-group/radio-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/RadioGroup` → `@rivetjs/cdk/radio-group` `RadioGroup`
//   (compound form, accessor render props); `@heroui/styles` → vendored `styles/`.
// - Live `class` / `variant` → render-prop class function (the composed class is a local: it reaches cdk `RadioGroup` as a plain value).
// - Children: upstream's `(values) => typeof children === "function" ? children(values) : children` = what the cdk group does
//   with `children` itself (passed through).
// - Rivet addition (identity spec §4.2): shorthand `label` / `description` / `errorMessage` (Label + Description before the
//   children, FieldError after) and `items` (one `<Radio value label description isDisabled />` each, a keyed `<For>` by
//   `value`: live). Explicit `children` win: the shorthand props are ignored (dev warning, `utils/shorthand.ts`).
import { RadioGroup as RadioGroupPrimitive } from "@rivetjs/cdk/radio-group";
import type { RadioGroupPartsProps as RadioGroupPrimitiveProps, RadioGroupRenderProps } from "@rivetjs/cdk/radio-group";
import { For } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { RadioGroupVariants } from "../../../styles/src/components/radio-group/index.ts";
import { radioGroupVariants } from "../../../styles/src/components/radio-group/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { FieldErrorRoot, type FieldErrorRootProps } from "../field-error/field-error.tsx";
import { LabelRoot } from "../label/label.tsx";
import { RadioRoot } from "../radio/radio.tsx";
import { DEV } from "#dev";

/* -------------------------------------------------------------------------------------------------
 * Radio Group Root
 * -----------------------------------------------------------------------------------------------*/
/** One radio of the `items` shorthand. */
interface RadioGroupItem {
  value: string;
  label: Content;
  description?: Content;
  isDisabled?: boolean;
}

interface RadioGroupRootProps extends RadioGroupPrimitiveProps, RadioGroupVariants {
  /** Shorthand: the group's Label (rendered before the children). */
  label?: Content;
  /** Shorthand: the group's Description (after the Label). */
  description?: Content;
  /** Shorthand: a FieldError after the radios (shown while the group is invalid). */
  errorMessage?: FieldErrorRootProps["children"];
  /** Shorthand: one Radio per item instead of children (live, keyed by `value`). Ignored when children are given. */
  items?: readonly RadioGroupItem[];
}

const RadioGroupRoot = (props: RadioGroupRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "errorMessage", "items", "label", "variant"]);
  if (DEV && local.children !== undefined) DEV.shorthandIgnored("RadioGroup", local, ["label", "description", "errorMessage", "items"]);
  const classOf = (): string | ((values: RadioGroupRenderProps) => string) =>
    composeTwRenderProps(local.class as never, radioGroupVariants({ variant: local.variant }));
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: RadioGroupRenderProps) => renderClass(classOf(), values) : classOf();

  const shorthand = local.children === undefined;
  return (
    <RadioGroupPrimitive data-slot="radio-group" {...(rest as Omit<RadioGroupPrimitiveProps, "children" | "class">)} class={cls as never}>
      {shorthand ? (
        <>
          {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
          {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
          <For each={() => local.items ?? []} by={(item: RadioGroupItem) => item.value}>
            {(item: () => RadioGroupItem) => (
              <RadioRoot value={item().value} isDisabled={item().isDisabled} label={item().label} description={item().description} />
            )}
          </For>
          {local.errorMessage !== undefined && <FieldErrorRoot>{local.errorMessage}</FieldErrorRoot>}
        </>
      ) : (
        (local.children as Content)
      )}
    </RadioGroupPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { RadioGroupRoot };
export type { RadioGroupItem, RadioGroupRootProps };
