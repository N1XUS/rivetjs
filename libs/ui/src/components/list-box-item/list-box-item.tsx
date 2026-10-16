// Ported from HeroUI v3.2.6 packages/react/src/components/list-box-item/list-box-item.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/ListBox` → `@rivetjs/cdk/listbox` (render props are
//   accessors: `state.isSelected()`); `@heroui/styles` → vendored `styles/`.
// - `ListBoxItemContext` carries `{ variant, state }` instead of `{ slots, state }` (tv slot functions do not serialize; slots from a
//   module-level memo per variant); `state` = the cdk render props (accessors). Resumable token `rv-ui-list-box-item`, default `{}`
//   → an Indicator outside an item gets only the caller's `class` (= upstream `slots?.indicator`).
// - Function children (`typeof children === "function"`) → `!isSlot(children)` (Rivet JSX children are compiler slots).
// - `ListBoxItemIndicator` default checkmark: upstream inline `<svg><polyline/></svg>` (dash-offset draw 44 / 66 over a 22 dash) →
//   lucide `Check` (icon rule) with the same `data-slot="list-box-item-indicator--checkmark"` and the draw animation on its path
//   (`stroke-dasharray` 24, offset 48 selected / 72 not: lucide's path is ~22.6 units long).
// - Rivet addition (identity spec §4.2): `ListBoxItemWithIndicator` = Item + Indicator, `textValue` from string children; the
//   `.Item` part of Select / ComboBox / Autocomplete / CellSelect / InlineSelect (not a ListBox.Item part: plain list items
//   carry no check mark).
// - Live `variant` / `class` → render-prop function (the composed class is a local: it reaches cdk `ListBoxItem` as a plain value).
import { ListBoxItem as ListBoxItemPrimitive } from "@rivetjs/cdk/listbox";
import type { ListBoxItemProps as ListBoxItemPrimitiveProps, ListBoxItemRenderProps } from "@rivetjs/cdk/listbox";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { isSlot, slotText } from "@rivetjs/runtime/slot";
import { Check } from "lucide";

import type { ListBoxItemVariants } from "../../../styles/src/components/list-box-item/index.ts";
import { listboxItemVariants } from "../../../styles/src/components/list-box-item/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * ListBox Item Context
 * -----------------------------------------------------------------------------------------------*/
interface ListBoxItemContext {
  /** Rivet: the item variant (upstream: `slots`). */
  variant?: ListBoxItemVariants["variant"];
  state?: ListBoxItemRenderProps;
}

const ListBoxItemContext = resumableContext(createContext<ListBoxItemContext>({}, { id: "rv-ui-list-box-item" }));

type ListBoxItemSlots = ReturnType<typeof listboxItemVariants>;
const SLOTS: Record<string, ListBoxItemSlots> = {};
const slotsFor = (variant: ListBoxItemVariants["variant"]): ListBoxItemSlots => (SLOTS[variant ?? "default"] ??= listboxItemVariants({ variant }));
/** Upstream `use(ListBoxItemContext).slots`: `undefined` outside a ListBox item. */
const slotsOf = (context: ListBoxItemContext): ListBoxItemSlots | undefined => (context.state ? slotsFor(context.variant) : undefined);

/* -------------------------------------------------------------------------------------------------
 * ListBox Item Root
 * -----------------------------------------------------------------------------------------------*/
interface ListBoxItemRootProps<T = object> extends ListBoxItemPrimitiveProps<T>, ListBoxItemVariants {}

const ListBoxItemRoot = <T extends object = object>(props: ListBoxItemRootProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as ListBoxItemRootProps, ["children", "class", "variant"]);
  const classOf = () => composeTwRenderProps(local.class as never, slotsFor(local.variant).item()) as string | ((v: ListBoxItemRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: ListBoxItemRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ListBoxItemPrimitive class={cls as never} data-slot="list-box-item" {...(rest as ListBoxItemPrimitiveProps)}>
      {(values: ListBoxItemRenderProps) => {
        const context = {
          get variant() {
            return local.variant;
          },
          state: values,
        };
        return (
          <Provider token={ListBoxItemContext} value={context}>
            {typeof local.children === "function" && !isSlot(local.children)
              ? (local.children as (v: ListBoxItemRenderProps) => Content)(values)
              : (local.children as Content)}
          </Provider>
        );
      }}
    </ListBoxItemPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ListBox Item Indicator
 * -----------------------------------------------------------------------------------------------*/
interface ListBoxItemIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content | ((props: ListBoxItemRenderProps) => Content);
  class?: string;
}

/** `ListBoxItemIndicator` props for the default element (`span`). */
type ListBoxItemIndicatorSpanProps = ListBoxItemIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof ListBoxItemIndicatorProps>;

// Upstream is generic over the element (`<E>` + `Omit<JSX.IntrinsicElements[E], …>`): the generic `Omit` is TS2590 at JSX sites
// (see `surface.tsx`) and an intersection would narrow the function `children` away, so the part takes the `span` props (`render`
// must render a `span` anyway).
const ListBoxItemIndicator = (props: ListBoxItemIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(ListBoxItemContext);
  const isSelected = (): boolean => context.state?.isSelected() ?? false;

  const content = () =>
    typeof local.children === "function" && !isSlot(local.children) ? (
      (local.children as (v: ListBoxItemRenderProps) => Content)(context.state ?? ({} as ListBoxItemRenderProps))
    ) : local.children ? (
      (local.children as Content)
    ) : (
      <Icon icon={Check} data-slot="list-box-item-indicator--checkmark" role="presentation" stroke-dasharray={24} stroke-dashoffset={isSelected() ? 48 : 72} />
    );

  return (
    <dom.span
      aria-hidden="true"
      class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
      data-slot="list-box-item-indicator"
      data-visible={isSelected() || undefined}
      {...rest}
    >
      {content()}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Item with indicator (Rivet)
 * -----------------------------------------------------------------------------------------------*/
/**
 * `ListBox.Item` + `ListBox.ItemIndicator`; `textValue` defaults to string / number children. A `{expr}` child stays live (its
 * text re-renders when its signals change); the derivation reads it untracked and is re-run on every `textValue` read (the cdk
 * collection reads it once per item build). Element children render once (their own bindings stay live). The `.Item` part of
 * the select-like pickers.
 */
const ListBoxItemWithIndicator = <T extends object = object>(props: ListBoxItemRootProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as ListBoxItemRootProps, ["children", "textValue"]);
  const children = local.children as unknown;
  let content = children;
  let derive = false;
  let first: string | undefined;
  if (isSlot(children) && local.textValue === undefined) {
    // Decided once: a text slot keeps rendering live, other content is the evaluated value (no second build).
    const value = untrack(children as () => unknown);
    const text = slotText(value);
    if (typeof text === "string" || typeof text === "number") {
      derive = true;
      first = String(text);
      // Server: the evaluated text binding record is the child (it resumes live; a second call would record a second binding).
      if (typeof document === "undefined") content = value;
    } else content = value;
  }
  return (
    <ListBoxItemRoot
      {...(rest as ListBoxItemRootProps)}
      textValue={local.textValue ?? (derive ? (typeof document === "undefined" ? first : slotTextValue(children)) : staticTextValue(children))}
    >
      {content as Content}
      <ListBoxItemIndicator />
    </ListBoxItemRoot>
  );
};

/** The text of a text slot, read untracked (the item's `textValue` derivation never subscribes the item). */
function slotTextValue(children: unknown): string | undefined {
  const text = slotText(untrack(children as () => unknown));
  return typeof text === "string" || typeof text === "number" ? String(text) : undefined;
}

function staticTextValue(children: unknown): string | undefined {
  return typeof children === "string" || typeof children === "number" ? String(children) : undefined;
}

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { ListBoxItemRoot, ListBoxItemIndicator, ListBoxItemWithIndicator };

export type { ListBoxItemRootProps, ListBoxItemIndicatorProps, ListBoxItemIndicatorSpanProps };
