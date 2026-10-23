// Rivet addition (no HeroUI v3.2.6 counterpart): a checkbox group drawn as selectable cards. Feature set inspired by HeroUI
// Pro's public docs (CheckboxButtonGroup: `layout` flex / grid; parts `.Item` (Checkbox props), `.Indicator`, `.ItemContent`,
// `.ItemIcon`; render-prop item children); independent implementation, Rivet-authored styles on HeroUI tokens.
// - Root = cdk `CheckboxGroup` (`role="group"`, native checkboxes sharing a `name`: Tab per item, Space toggles, form submission
//   without JS; value / defaultValue (string[]) / two-way Signal / onChange, isRequired / isInvalid / validate, Label /
//   Description / FieldError children). Context `rv-ui-checkbox-button-group` `{ inGroup, layout }`.
// - Item = cdk `CheckboxField` (`div.checkbox-button-group__field`, item description slot) + `CheckboxButton` (the card: `label`
//   with the visually hidden native checkbox, `data-selected` / `data-hovered` / `data-pressed` / `data-focus-visible` /
//   `data-disabled`). Labels inside render as `span` (`LabelContext`). A function child gets the CheckboxButton render props.
// - Indicator: decorative check box in the card corner (lucide `Check`, shown by CSS from the card's `data-selected`); children
//   replace it, a function child gets the item render props. Omit it for cards without a mark.
// - Shorthand (identity spec §4.2): `label` / `description` / `errorMessage` (Label + Description before the cards, FieldError
//   after) and `items` (one card each: Indicator, optional ItemIcon, ItemContent with Label + Description), a
//   keyed `<For>` by `value` (live). Explicit `children` win: the shorthand props are ignored (dev warning, `utils/shorthand.ts`).
import {
  CheckboxButton as CheckboxButtonPrimitive,
  CheckboxField as CheckboxFieldPrimitive,
  CheckboxGroup as CheckboxGroupPrimitive,
} from "@rivetjs/cdk/checkbox";
import type {
  CheckboxButtonRenderProps,
  CheckboxFieldProps as CheckboxFieldPrimitiveProps,
  CheckboxGroupProps as CheckboxGroupPrimitiveProps,
  CheckboxGroupRenderProps,
} from "@rivetjs/cdk/checkbox";
import { LabelContext } from "@rivetjs/cdk/label";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { Check } from "lucide";

import type { CheckboxButtonGroupVariants } from "../../../styles/src/components/checkbox-button-group/index.ts";
import { checkboxButtonGroupVariants } from "../../../styles/src/components/checkbox-button-group/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { FieldErrorRoot, type FieldErrorRootProps } from "../field-error/field-error.tsx";
import { LabelRoot } from "../label/label.tsx";
import { DEV } from "#dev";

const LABEL_SPAN_CONTEXT = { elementType: "span" as const };

/* -------------------------------------------------------------------------------------------------
 * Contexts
 * -----------------------------------------------------------------------------------------------*/
interface CheckboxButtonGroupContext {
  /** Set inside a CheckboxButtonGroup. */
  inGroup?: true;
  layout?: CheckboxButtonGroupVariants["layout"];
}

const CheckboxButtonGroupContext = createContext<CheckboxButtonGroupContext>({});

/** The enclosing item's render props (accessors), for Indicator function children. */
const CheckboxButtonGroupItemContext = createContext<{ state?: CheckboxButtonRenderProps }>({});

type Slots = ReturnType<typeof checkboxButtonGroupVariants>;

/** Module-level memo per `layout` (tv slot functions are pure). */
const SLOTS: Record<string, Slots> = {};
const slotsFor = (layout: CheckboxButtonGroupVariants["layout"]): Slots => (SLOTS[String(layout)] ??= checkboxButtonGroupVariants({ layout }));
const slotsOf = (context: CheckboxButtonGroupContext): Slots => slotsFor(context.layout);

/* -------------------------------------------------------------------------------------------------
 * CheckboxButtonGroup Root
 * -----------------------------------------------------------------------------------------------*/
/** One card of the `items` shorthand. */
interface CheckboxButtonGroupItemData {
  value: string;
  label: Content;
  description?: Content;
  /** Content of an ItemIcon before the text (e.g. `<Icon icon={Cloud} />`). */
  icon?: Content;
  isDisabled?: boolean;
}

interface CheckboxButtonGroupRootProps extends CheckboxGroupPrimitiveProps, CheckboxButtonGroupVariants {
  /** Shorthand: the group's Label (before the cards). */
  label?: Content;
  /** Shorthand: the group's Description (after the Label). */
  description?: Content;
  /** Shorthand: a FieldError after the cards (shown while the group is invalid). */
  errorMessage?: FieldErrorRootProps["children"];
  /** Shorthand: one card (Indicator, ItemIcon, ItemContent with Label + Description) per item instead of children (live, keyed by `value`). Ignored when children are given. */
  items?: readonly CheckboxButtonGroupItemData[];
}

const CheckboxButtonGroupRoot = (props: CheckboxButtonGroupRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "errorMessage", "items", "label", "layout"]);
  if (DEV && local.children !== undefined) DEV.shorthandIgnored("CheckboxButtonGroup", local, ["label", "description", "errorMessage", "items"]);
  const contextValue: CheckboxButtonGroupContext = hasLiveProp(local, ["layout"])
    ? {
        inGroup: true,
        get layout() {
          return local.layout;
        },
      }
    : { inGroup: true, layout: local.layout };
  const classOf = (): string | ((values: CheckboxGroupRenderProps) => string) => composeTwRenderProps(local.class as never, slotsFor(local.layout).base());
  const cls = hasLiveProp(local, ["class", "layout"]) ? (values: CheckboxGroupRenderProps) => renderClass(classOf(), values) : classOf();

  const shorthand = local.children === undefined;
  // A function: Rivet JSX builds nodes eagerly, so the group is created inside the provider.
  const content = () => (
    <CheckboxGroupPrimitive data-slot="checkbox-button-group" {...(rest as Omit<CheckboxGroupPrimitiveProps, "children" | "class">)} class={cls as never}>
      {shorthand ? (
        <>
          {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
          {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
          <For each={() => local.items ?? []} by={(item: CheckboxButtonGroupItemData) => item.value}>
            {(item: () => CheckboxButtonGroupItemData) => (
              <CheckboxButtonGroupItem value={item().value} isDisabled={item().isDisabled}>
                <CheckboxButtonGroupIndicator />
                {item().icon !== undefined && <CheckboxButtonGroupItemIcon>{item().icon}</CheckboxButtonGroupItemIcon>}
                <CheckboxButtonGroupItemContent>
                  <LabelRoot>{item().label}</LabelRoot>
                  {item().description !== undefined && <DescriptionRoot>{item().description}</DescriptionRoot>}
                </CheckboxButtonGroupItemContent>
              </CheckboxButtonGroupItem>
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
    <Provider token={CheckboxButtonGroupContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CheckboxButtonGroup Item
 * -----------------------------------------------------------------------------------------------*/
interface CheckboxButtonGroupItemProps extends Omit<CheckboxFieldPrimitiveProps, "children" | "class" | "value"> {
  /** The item's value in the group selection (submitted with the form). */
  value: string;
  /** Indicator / ItemIcon / ItemContent, or a function of the item render props (accessors). */
  children?: Content | ((values: CheckboxButtonRenderProps) => Content);
  /** Classes of the card (the `label`); a function of the item render props may be given. */
  class?: string | ((values: CheckboxButtonRenderProps) => string);
  /** Classes of the field wrapper (`div`). */
  fieldClass?: string;
}

const CheckboxButtonGroupItem = (props: CheckboxButtonGroupItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "fieldClass"]);
  const context = useContext(CheckboxButtonGroupContext);
  const classOf = (): string | ((values: CheckboxButtonRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).item());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["layout"]) ? (values: CheckboxButtonRenderProps) => renderClass(classOf(), values) : classOf();
  const children = local.children;

  return (
    <CheckboxFieldPrimitive
      data-slot="checkbox-button-group-field"
      {...(rest as CheckboxFieldPrimitiveProps)}
      class={composeSlotClassName(slotsOf(context).field, local.fieldClass)}
    >
      <CheckboxButtonPrimitive data-slot="checkbox-button-group-item" class={cls as never}>
        {(state: CheckboxButtonRenderProps) => (
          <Provider token={CheckboxButtonGroupItemContext} value={{ state }}>
            <Provider token={LabelContext} value={LABEL_SPAN_CONTEXT}>
              {typeof children === "function" && !isSlot(children) ? (children as (v: CheckboxButtonRenderProps) => Content)(state) : (children as Content)}
            </Provider>
          </Provider>
        )}
      </CheckboxButtonPrimitive>
    </CheckboxFieldPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CheckboxButtonGroup Indicator / ItemContent / ItemIcon
 * -----------------------------------------------------------------------------------------------*/
interface CheckboxButtonGroupIndicatorProps {
  /** Replaces the default check mark; a function gets the item render props (accessors). */
  children?: Content | ((values: CheckboxButtonRenderProps) => Content);
  class?: string;
}

type CheckboxButtonGroupIndicatorSpanProps = CheckboxButtonGroupIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof CheckboxButtonGroupIndicatorProps>;

const CheckboxButtonGroupIndicator = (props: CheckboxButtonGroupIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CheckboxButtonGroupContext);
  const item = useContext(CheckboxButtonGroupItemContext);
  const children = local.children;
  const content = () =>
    typeof children === "function" && !isSlot(children)
      ? (children as (v: CheckboxButtonRenderProps) => Content)(item.state ?? ({} as CheckboxButtonRenderProps))
      : (children as Content);

  return (
    <dom.span
      aria-hidden="true"
      {...(rest as {})}
      class={composeSlotClassName(slotsOf(context).indicator, local.class)}
      data-slot="checkbox-button-group-indicator"
      data-custom={children != null || undefined}
    >
      {children != null ? content() : <Icon icon={Check} data-slot="checkbox-button-group-default-indicator" />}
    </dom.span>
  );
};

interface CheckboxButtonGroupPartProps {
  children?: Content;
  class?: string;
}

type CheckboxButtonGroupPartSpanProps = CheckboxButtonGroupPartProps & Omit<JSX.IntrinsicElements["span"], keyof CheckboxButtonGroupPartProps>;

const CheckboxButtonGroupItemContent = (props: CheckboxButtonGroupPartSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CheckboxButtonGroupContext);
  return (
    <dom.span {...(rest as {})} class={composeSlotClassName(slotsOf(context).itemContent, local.class)} data-slot="checkbox-button-group-item-content">
      {local.children}
    </dom.span>
  );
};

const CheckboxButtonGroupItemIcon = (props: CheckboxButtonGroupPartSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CheckboxButtonGroupContext);
  return (
    <dom.span
      aria-hidden="true"
      {...(rest as {})}
      class={composeSlotClassName(slotsOf(context).itemIcon, local.class)}
      data-slot="checkbox-button-group-item-icon"
    >
      {local.children}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  CheckboxButtonGroupRoot,
  CheckboxButtonGroupItem,
  CheckboxButtonGroupIndicator,
  CheckboxButtonGroupItemContent,
  CheckboxButtonGroupItemIcon,
  CheckboxButtonGroupContext,
  CheckboxButtonGroupItemContext,
};
export type {
  CheckboxButtonGroupItemData,
  CheckboxButtonGroupRootProps,
  CheckboxButtonGroupItemProps,
  CheckboxButtonGroupIndicatorProps,
  CheckboxButtonGroupIndicatorSpanProps,
  CheckboxButtonGroupPartProps,
  CheckboxButtonGroupPartSpanProps,
  CheckboxButtonRenderProps as CheckboxButtonGroupItemRenderProps,
};
