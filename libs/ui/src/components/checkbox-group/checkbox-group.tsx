// Ported from HeroUI v3.2.6 packages/react/src/components/checkbox-group/checkbox-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/CheckboxGroup` → `@rivetjs/cdk/checkbox` `CheckboxGroup`
//   (accessor render props); `@heroui/styles` → vendored `styles/`.
// - `CheckboxGroupContext` (resumable `rv-ui-checkbox-group`, `{}` default) carries `{ variant }`, a getter when `variant` is live.
// - Live `class` / `variant` → render-prop class function (the composed class is a local: it reaches cdk `CheckboxGroup` as a plain value).
// - Children: upstream's `(values) => typeof children === "function" ? children(values) : children` = what the cdk group does
//   with `children` itself (passed through).
// - Rivet addition (identity spec §4.2): shorthand `label` / `description` / `errorMessage` (Label + Description before the
//   children, FieldError after) and `items` (one `<Checkbox value label description isDisabled />` each, a keyed `<For>` by
//   `value`: live). Explicit `children` win: the shorthand props are ignored (dev warning, `utils/shorthand.ts`).
import { CheckboxGroup as CheckboxGroupPrimitive } from "@rivetjs/cdk/checkbox";
import type { CheckboxGroupProps as CheckboxGroupPrimitiveProps, CheckboxGroupRenderProps } from "@rivetjs/cdk/checkbox";
import { For, Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { CheckboxGroupVariants } from "../../../styles/src/components/checkbox-group/index.ts";
import { checkboxGroupVariants } from "../../../styles/src/components/checkbox-group/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { CheckboxRoot } from "../checkbox/checkbox.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { FieldErrorRoot, type FieldErrorRootProps } from "../field-error/field-error.tsx";
import { LabelRoot } from "../label/label.tsx";
import { CheckboxGroupContext, type CheckboxGroupContextValue } from "./context.ts";
import { DEV } from "#dev";
import { warnShorthandIgnored } from "../../utils/shorthand.ts";

/* -------------------------------------------------------------------------------------------------
 * CheckboxGroup Context
 * -----------------------------------------------------------------------------------------------*/
/** One checkbox of the `items` shorthand. */
interface CheckboxGroupItem {
  value: string;
  label: Content;
  description?: Content;
  isDisabled?: boolean;
}

interface CheckboxGroupProps extends CheckboxGroupPrimitiveProps, CheckboxGroupVariants {
  /** Shorthand: the group's Label (rendered before the children). */
  label?: Content;
  /** Shorthand: the group's Description (after the Label). */
  description?: Content;
  /** Shorthand: a FieldError after the checkboxes (shown while the group is invalid). */
  errorMessage?: FieldErrorRootProps["children"];
  /** Shorthand: one Checkbox per item instead of children (live, keyed by `value`). Ignored when children are given. */
  items?: readonly CheckboxGroupItem[];
}

const CheckboxGroup = (props: CheckboxGroupProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "errorMessage", "items", "label", "variant"]);
  if (DEV && local.children !== undefined) warnShorthandIgnored("CheckboxGroup", local, ["label", "description", "errorMessage", "items"]);
  const contextValue: CheckboxGroupContextValue = hasLiveProp(local, ["variant"])
    ? {
        get variant() {
          return local.variant;
        },
      }
    : { variant: local.variant };
  const classOf = (): string | ((values: CheckboxGroupRenderProps) => string) =>
    composeTwRenderProps(local.class as never, checkboxGroupVariants({ variant: local.variant }));
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: CheckboxGroupRenderProps) => renderClass(classOf(), values) : classOf();

  // A function: Rivet JSX builds nodes eagerly, so the group is created inside the provider.
  const shorthand = local.children === undefined;
  const content = () => (
    <CheckboxGroupPrimitive class={cls as never} data-slot="checkbox-group" {...(rest as object)}>
      {shorthand ? (
        <>
          {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
          {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
          <For each={() => local.items ?? []} by={(item: CheckboxGroupItem) => item.value}>
            {(item: () => CheckboxGroupItem) => (
              <CheckboxRoot value={item().value} isDisabled={item().isDisabled} label={item().label} description={item().description} />
            )}
          </For>
          {local.errorMessage !== undefined && <FieldErrorRoot>{local.errorMessage}</FieldErrorRoot>}
        </>
      ) : (
        (local.children as Content)
      )}
    </CheckboxGroupPrimitive>
  );

  return (
    <Provider token={CheckboxGroupContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

export { CheckboxGroup, CheckboxGroupContext };
export type { CheckboxGroupItem, CheckboxGroupProps };
