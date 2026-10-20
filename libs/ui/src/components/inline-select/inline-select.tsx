// Rivet addition (no HeroUI v3.2.6 counterpart): a minimal inline dropdown that flows with the surrounding text (team / project
// switchers, sentence pickers, breadcrumb item switchers). Feature set inspired by HeroUI Pro's public docs (InlineSelect: parts
// `.Trigger`, `.Value`, `.Indicator`, `.Popover` with `placement` default "bottom end"; CSS variables
// `--inline-select-value-max-width` / `--inline-select-indicator-size`); independent implementation, Rivet-authored styles.
// - Root = the cdk Select parts form (`@rivetjs/cdk/select/parts`): single / multiple selection, value / two-way Signal,
//   `onChange`, `isDisabled`, `name`, keyboard + typeahead. Context `rv-ui-inline-select` `{ inInline }` (plain data). The root
//   is a `span` (cdk `render`; the cdk hidden select container is a `span` too), so it is valid inside a `<p>`.
// - Trigger = cdk `Button` (ghost, inherits the font); Value = cdk `SelectValue` (truncated); Indicator = lucide `ChevronsUpDown`
//   or a custom child in a span; Popover = cdk `Popover` with the vendored `select__popover` look.
// - Auto form (identity spec §4.2, plan T22): a root with `items` renders Trigger (Value + Indicator) + Popover + ListBox around
//   its render-function children; `InlineSelect.Item` = ListBox.Item + ItemIndicator, `textValue` from string children.
// - In `@rivetjs/ui/breadcrumbs`: a function child of `Breadcrumbs.Item` gets `{ isCurrent, separator }`; render the InlineSelect
//   and `separator()` there (the item's Link would otherwise wrap the trigger button).
import { Button } from "@rivetjs/cdk/button";
import type { ButtonProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { Select as SelectPrimitive, SelectStateContext, SelectValue as SelectValuePrimitive } from "@rivetjs/cdk/select/parts";
import type {
  SelectPartsProps,
  SelectPartsRenderProps,
  SelectState,
  SelectValueProps as SelectValuePrimitiveProps,
  SelectValueRenderProps,
} from "@rivetjs/cdk/select/parts";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { ChevronsUpDown } from "lucide";

import { inlineSelectVariants } from "../../../styles/src/components/inline-select/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { dom } from "../../utils/dom.tsx";
import { accessorIfLive, hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { ListBoxRoot } from "../list-box/list-box.tsx";
import { ListBoxItemWithIndicator, type ListBoxItemRootProps } from "../list-box-item/list-box-item.tsx";
import { SurfaceContext } from "../surface/index.ts";
import { isSlot } from "@rivetjs/runtime/slot";
import { DEV } from "#dev";
import { warnItemsIgnored } from "../../utils/shorthand.ts";
import { portalTheme } from "../../utils/portal-theme.ts";

/* -------------------------------------------------------------------------------------------------
 * InlineSelect Context
 * -----------------------------------------------------------------------------------------------*/
interface InlineSelectContext {
  /** Set inside an InlineSelect. */
  inInline?: true;
}

const InlineSelectContext = resumableContext(createContext<InlineSelectContext>({}, { id: "rv-ui-inline-select" }));

type Slots = ReturnType<typeof inlineSelectVariants>;

/** One module-level slots object (no variants; tv slot functions are pure). */
let SLOTS: Slots | undefined;
const slots = (): Slots => (SLOTS ??= inlineSelectVariants());
/** `undefined` outside an InlineSelect (only the caller's `class`). */
const slotsOf = (context: InlineSelectContext): Slots | undefined => (context.inInline ? slots() : undefined);

const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* -------------------------------------------------------------------------------------------------
 * InlineSelect Root
 * -----------------------------------------------------------------------------------------------*/
type InlineSelectRootProps<M extends "single" | "multiple" = "single", T extends object = object> = Omit<SelectPartsProps<M>, "children"> &
  (
    | { items?: undefined; children?: SelectPartsProps<M>["children"] }
    | {
        /** Auto form: the ListBox items; `children` is then a render function of one item. */
        items: Iterable<T>;
        children?: (item: T) => Content;
      }
  );

const CONTEXT_VALUE: InlineSelectContext = { inInline: true };

function InlineSelectRoot<M extends "single" | "multiple" = "single", T extends object = object>(props: InlineSelectRootProps<M, T>): JSX.Element {
  const [local, rest] = splitLive(props as InlineSelectRootProps, ["children", "class", "items"]);
  const classOf = () => composeTwRenderProps(local.class as never, slots().base()) as string | ((v: SelectPartsRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: SelectPartsRenderProps) => renderClass(classOf(), values) : classOf();
  // `items` next to compound (slot) children: the children win, `items` is ignored (dev warning). Decided once.
  const compound = local.items !== undefined && isSlot(local.children);
  if (DEV && compound) warnItemsIgnored("InlineSelect");
  const auto = !compound && local.items !== undefined;
  // A function: Rivet JSX builds nodes eagerly, so the select is created inside the provider.
  const content = () => (
    <SelectPrimitive
      data-slot="inline-select"
      {...(rest as SelectPartsProps)}
      class={cls as never}
      // A `span` root (cdk `render`): an InlineSelect sits inside phrasing content (`<p>`), where a `<div>` would close the paragraph.
      render={(attrs: object) => <span {...attrs} />}
    >
      {auto ? (
        <>
          <InlineSelectTrigger>
            <InlineSelectValue />
            <InlineSelectIndicator />
          </InlineSelectTrigger>
          <InlineSelectPopover>
            <ListBoxRoot items={accessorIfLive(local, "items") as Iterable<object> | undefined}>{local.children as never}</ListBoxRoot>
          </InlineSelectPopover>
        </>
      ) : (
        (local.children as SelectPartsProps["children"])
      )}
    </SelectPrimitive>
  );

  return (
    <Provider token={InlineSelectContext} value={CONTEXT_VALUE}>
      {content()}
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * InlineSelect Trigger
 * -----------------------------------------------------------------------------------------------*/
interface InlineSelectTriggerProps extends ButtonProps {}

const InlineSelectTrigger = (props: InlineSelectTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(InlineSelectContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.trigger()) as string | ((v: ButtonRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();
  return <Button class={cls as never} data-slot="inline-select-trigger" {...(rest as ButtonProps)} />;
};

/* -------------------------------------------------------------------------------------------------
 * InlineSelect Value
 * -----------------------------------------------------------------------------------------------*/
interface InlineSelectValueProps extends SelectValuePrimitiveProps {}

const InlineSelectValue = (props: InlineSelectValueProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(InlineSelectContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.value()) as string | ((v: SelectValueRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: SelectValueRenderProps) => renderClass(classOf(), values) : classOf();
  return (
    <SelectValuePrimitive class={cls as never} data-slot="inline-select-value" {...(rest as SelectValuePrimitiveProps)}>
      {local.children as never}
    </SelectValuePrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * InlineSelect Indicator
 * -----------------------------------------------------------------------------------------------*/
interface InlineSelectIndicatorProps {
  children?: Content;
  class?: string;
}

const InlineSelectIndicator = (props: InlineSelectIndicatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(InlineSelectContext);
  const state = useContext(SelectStateContext) as SelectState<any> | null;
  const isOpen = (): boolean => state?.isOpen() ?? false;
  if (local.children) {
    return (
      <dom.span
        {...(rest as {})}
        aria-hidden="true"
        class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
        data-slot="inline-select-indicator"
        data-open={isOpen() || undefined}
      >
        {local.children}
      </dom.span>
    );
  }
  return (
    <Icon
      icon={ChevronsUpDown}
      class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
      data-open={isOpen() || undefined}
      data-slot="inline-select-default-indicator"
      {...(rest as {})}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * InlineSelect Popover
 * -----------------------------------------------------------------------------------------------*/
interface InlineSelectPopoverProps extends Omit<PopoverPrimitiveProps, "children"> {
  children: Content;
}

const InlineSelectPopover = (props: InlineSelectPopoverProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "placement"]);
  const context = useContext(InlineSelectContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.popover()) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <PopoverPrimitive {...(rest as PopoverPrimitiveProps)} class={cls as never} data-slot="inline-select-popover" placement={local.placement ?? "bottom end"}>
      {local.children}
    </PopoverPrimitive>
  );
  return (
    <Provider token={SurfaceContext} value={DEFAULT_SURFACE_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * InlineSelect Item
 * -----------------------------------------------------------------------------------------------*/
interface InlineSelectItemProps<T extends object = object> extends ListBoxItemRootProps<T> {}

/** `ListBox.Item` + `ListBox.ItemIndicator`; `textValue` defaults to string / number children. */
const InlineSelectItem = ListBoxItemWithIndicator as <T extends object = object>(props: InlineSelectItemProps<T>) => JSX.Element;

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { InlineSelectRoot, InlineSelectTrigger, InlineSelectValue, InlineSelectIndicator, InlineSelectPopover, InlineSelectItem, InlineSelectContext };

export type {
  InlineSelectRootProps,
  InlineSelectTriggerProps,
  InlineSelectValueProps,
  InlineSelectIndicatorProps,
  InlineSelectPopoverProps,
  InlineSelectItemProps,
  SelectValueRenderProps as InlineSelectValueRenderProps,
};
