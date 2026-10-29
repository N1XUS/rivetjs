// Rivet addition (no HeroUI v3.2.6 counterpart): a radio group drawn as selectable cards. Feature set inspired by commercial UI kits'
// public docs (RadioButtonGroup: `layout` flex / grid; parts `.Item` (Radio props), `.Indicator`, `.ItemContent`, `.ItemIcon`;
// render-prop item children); independent implementation, Rivet-authored styles on HeroUI tokens.
// - Root = cdk `RadioGroup` (compound form: `role="radiogroup"`, native radios sharing a `name` = arrow keys, one tab stop and
//   form submission without JS; value / defaultValue / two-way Signal / onChange, isRequired / isInvalid / validate, Label /
//   Description / FieldError children). Context `rv-ui-radio-button-group` `{ inGroup, layout }`.
// - Item = cdk `RadioField` (`div.radio-button-group__field`, item description slot) + `RadioButton` (the card: `label` with the
//   visually hidden native radio, `data-selected` / `data-hovered` / `data-pressed` / `data-focus-visible` / `data-disabled`).
//   Labels inside render as `span` (`LabelContext`). A function child gets the RadioButton render props (accessors).
// - Indicator: decorative radio mark in the card corner (CSS-only state from the card's `data-selected`); children replace it,
//   a function child gets the item render props. Omit it for cards without a mark.
// - Shorthand (identity spec §4.2): `label` / `description` / `errorMessage` (Label + Description before the cards, FieldError
//   after) and `items` (one card each: Indicator, optional ItemIcon, ItemContent with Label + Description), a
//   keyed `<For>` by `value` (live). Explicit `children` win: the shorthand props are ignored (dev warning, `utils/shorthand.ts`).
import { RadioButton as RadioButtonPrimitive, RadioField as RadioFieldPrimitive, RadioGroup as RadioGroupPrimitive } from "@rivetjs/cdk/radio-group";
import type {
  RadioButtonRenderProps,
  RadioFieldProps as RadioFieldPrimitiveProps,
  RadioGroupPartsProps as RadioGroupPrimitiveProps,
  RadioGroupRenderProps,
} from "@rivetjs/cdk/radio-group";
import { LabelContext } from "@rivetjs/cdk/label";
import { createContext, useContext } from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";

import type { RadioButtonGroupVariants } from "../../../styles/src/components/radio-button-group/index.ts";
import { radioButtonGroupVariants } from "../../../styles/src/components/radio-button-group/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive, renderChildren } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { FieldErrorRoot, type FieldErrorRootProps } from "../field-error/field-error.tsx";
import { LabelRoot } from "../label/label.tsx";
import { DEV } from "#dev";

const LABEL_SPAN_CONTEXT = { elementType: "span" as const };

/* -------------------------------------------------------------------------------------------------
 * Contexts
 * -----------------------------------------------------------------------------------------------*/
interface RadioButtonGroupContext {
  /** Set inside a RadioButtonGroup. */
  inGroup?: true;
  layout?: RadioButtonGroupVariants["layout"];
}

const RadioButtonGroupContext = createContext<RadioButtonGroupContext>({});

/** The enclosing item's render props (accessors), for Indicator function children. */
const RadioButtonGroupItemContext = createContext<{ state?: RadioButtonRenderProps }>({});

type Slots = ReturnType<typeof radioButtonGroupVariants>;

/** Module-level memo per `layout` (tv slot functions are pure). */
const SLOTS: Record<string, Slots> = {};
const slotsFor = (layout: RadioButtonGroupVariants["layout"]): Slots => (SLOTS[String(layout)] ??= radioButtonGroupVariants({ layout }));
const slotsOf = (context: RadioButtonGroupContext): Slots => slotsFor(context.layout);

/* -------------------------------------------------------------------------------------------------
 * RadioButtonGroup Root
 * -----------------------------------------------------------------------------------------------*/
/** One card of the `items` shorthand. */
interface RadioButtonGroupItemData {
  value: string;
  label: Content;
  description?: Content;
  /** Content of an ItemIcon before the text (e.g. `<Icon icon={Cloud} />`). */
  icon?: Content;
  isDisabled?: boolean;
}

interface RadioButtonGroupRootProps extends RadioGroupPrimitiveProps, RadioButtonGroupVariants {
  /** Shorthand: the group's Label (before the cards). */
  label?: Content;
  /** Shorthand: the group's Description (after the Label). */
  description?: Content;
  /** Shorthand: a FieldError after the cards (shown while the group is invalid). */
  errorMessage?: FieldErrorRootProps["children"];
  /** Shorthand: one card (Indicator, ItemIcon, ItemContent with Label + Description) per item instead of children (live, keyed by `value`). Ignored when children are given. */
  items?: readonly RadioButtonGroupItemData[];
}

const RadioButtonGroupRoot = (props: RadioButtonGroupRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "description", "errorMessage", "items", "label", "layout"]);
  if (DEV && local.children !== undefined) DEV.shorthandIgnored("RadioButtonGroup", local, ["label", "description", "errorMessage", "items"]);
  const contextValue: RadioButtonGroupContext = hasLiveProp(local, ["layout"])
    ? {
        inGroup: true,
        get layout() {
          return local.layout;
        },
      }
    : { inGroup: true, layout: local.layout };
  const classOf = (): string | ((values: RadioGroupRenderProps) => string) => composeTwRenderProps(local.class as never, slotsFor(local.layout).base());
  const cls = hasLiveProp(local, ["class", "layout"]) ? (values: RadioGroupRenderProps) => renderClass(classOf(), values) : classOf();

  const shorthand = local.children === undefined;
  // A function: Rivet JSX builds nodes eagerly, so the group is created inside the provider.
  const content = () => (
    <RadioGroupPrimitive data-slot="radio-button-group" {...(rest as Omit<RadioGroupPrimitiveProps, "children" | "class">)} class={cls as never}>
      {shorthand ? (
        <>
          {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
          {local.description !== undefined && <DescriptionRoot>{local.description}</DescriptionRoot>}
          <For each={() => local.items ?? []} by={(item: RadioButtonGroupItemData) => item.value}>
            {(item: () => RadioButtonGroupItemData) => (
              <RadioButtonGroupItem value={item().value} isDisabled={item().isDisabled}>
                <RadioButtonGroupIndicator />
                {item().icon !== undefined && <RadioButtonGroupItemIcon>{item().icon}</RadioButtonGroupItemIcon>}
                <RadioButtonGroupItemContent>
                  <LabelRoot>{item().label}</LabelRoot>
                  {item().description !== undefined && <DescriptionRoot>{item().description}</DescriptionRoot>}
                </RadioButtonGroupItemContent>
              </RadioButtonGroupItem>
            )}
          </For>
          {local.errorMessage !== undefined && <FieldErrorRoot>{local.errorMessage}</FieldErrorRoot>}
        </>
      ) : (
        (local.children as Content)
      )}
    </RadioGroupPrimitive>
  );
  return (
    <Provider token={RadioButtonGroupContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * RadioButtonGroup Item
 * -----------------------------------------------------------------------------------------------*/
interface RadioButtonGroupItemProps extends Omit<RadioFieldPrimitiveProps, "children" | "class"> {
  /** Indicator / ItemIcon / ItemContent, or a function of the item render props (accessors). */
  children?: Content | ((values: RadioButtonRenderProps) => Content);
  /** Classes of the card (the `label`); a function of the item render props may be given. */
  class?: string | ((values: RadioButtonRenderProps) => string);
  /** Classes of the field wrapper (`div`). */
  fieldClass?: string;
}

const RadioButtonGroupItem = (props: RadioButtonGroupItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "fieldClass"]);
  const context = useContext(RadioButtonGroupContext);
  const classOf = (): string | ((values: RadioButtonRenderProps) => string) => composeTwRenderProps(local.class as never, slotsOf(context).item());
  const cls =
    hasLiveProp(local, ["class"]) || hasLiveProp(context, ["layout"]) ? (values: RadioButtonRenderProps) => renderClass(classOf(), values) : classOf();
  const children = local.children;

  return (
    <RadioFieldPrimitive
      data-slot="radio-button-group-field"
      {...(rest as RadioFieldPrimitiveProps)}
      class={composeSlotClassName(slotsOf(context).field, local.fieldClass)}
    >
      <RadioButtonPrimitive data-slot="radio-button-group-item" class={cls as never}>
        {(state: RadioButtonRenderProps) => (
          <Provider token={RadioButtonGroupItemContext} value={{ state }}>
            <Provider token={LabelContext} value={LABEL_SPAN_CONTEXT}>
              {renderChildren(children, state)}
            </Provider>
          </Provider>
        )}
      </RadioButtonPrimitive>
    </RadioFieldPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * RadioButtonGroup Indicator / ItemContent / ItemIcon
 * -----------------------------------------------------------------------------------------------*/
interface RadioButtonGroupIndicatorProps {
  /** Replaces the default radio mark; a function gets the item render props (accessors). */
  children?: Content | ((values: RadioButtonRenderProps) => Content);
  class?: string;
}

type RadioButtonGroupIndicatorSpanProps = RadioButtonGroupIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof RadioButtonGroupIndicatorProps>;

const RadioButtonGroupIndicator = (props: RadioButtonGroupIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(RadioButtonGroupContext);
  const item = useContext(RadioButtonGroupItemContext);
  const children = local.children;
  const content = () =>
    typeof children === "function" && !isSlot(children)
      ? (children as (v: RadioButtonRenderProps) => Content)(item.state ?? ({} as RadioButtonRenderProps))
      : (children as Content);

  return (
    <dom.span
      aria-hidden="true"
      {...(rest as {})}
      class={composeSlotClassName(slotsOf(context).indicator, local.class)}
      data-slot="radio-button-group-indicator"
      data-custom={children != null || undefined}
    >
      {content()}
    </dom.span>
  );
};

interface RadioButtonGroupPartProps {
  children?: Content;
  class?: string;
}

type RadioButtonGroupPartSpanProps = RadioButtonGroupPartProps & Omit<JSX.IntrinsicElements["span"], keyof RadioButtonGroupPartProps>;

const RadioButtonGroupItemContent = (props: RadioButtonGroupPartSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(RadioButtonGroupContext);
  return (
    <dom.span {...(rest as {})} class={composeSlotClassName(slotsOf(context).itemContent, local.class)} data-slot="radio-button-group-item-content">
      {local.children}
    </dom.span>
  );
};

const RadioButtonGroupItemIcon = (props: RadioButtonGroupPartSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(RadioButtonGroupContext);
  return (
    <dom.span
      aria-hidden="true"
      {...(rest as {})}
      class={composeSlotClassName(slotsOf(context).itemIcon, local.class)}
      data-slot="radio-button-group-item-icon"
    >
      {local.children}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  RadioButtonGroupRoot,
  RadioButtonGroupItem,
  RadioButtonGroupIndicator,
  RadioButtonGroupItemContent,
  RadioButtonGroupItemIcon,
  RadioButtonGroupContext,
  RadioButtonGroupItemContext,
};
export type {
  RadioButtonGroupItemData,
  RadioButtonGroupRootProps,
  RadioButtonGroupItemProps,
  RadioButtonGroupIndicatorProps,
  RadioButtonGroupIndicatorSpanProps,
  RadioButtonGroupPartProps,
  RadioButtonGroupPartSpanProps,
  RadioButtonRenderProps as RadioButtonGroupItemRenderProps,
};
