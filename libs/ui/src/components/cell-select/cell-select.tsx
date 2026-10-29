// Rivet addition (no HeroUI v3.2.6 counterpart): a settings-row select, the whole cell is the trigger with the label on the left
// and the selected value + chevron on the right. Feature set scoped from public docs of commercial UI kits (CellSelect: `variant` default /
// secondary; parts `.Trigger`, `.Label`, `.Value`, `.Indicator`, `.Popover` with `placement` default "bottom end"); independent
// implementation, Rivet-authored styles on HeroUI tokens.
// - Root = the cdk Select parts form (`@rivetjs/cdk/select/parts`): selection (single / multiple), value / two-way
//   Signal, `onChange`, `isDisabled`, `name` (hidden select), keyboard + typeahead on the trigger. Context `rv-ui-cell-select`
//   `{ inCell, variant }` (plain data; slots = module memo per variant).
// - Trigger = cdk `Button` (the cdk Select's trigger context); Label = cdk `Label` (the Select provides `elementType: "span"`, so a
//   Label inside the trigger button stays valid HTML and names the trigger); Value = cdk `SelectValue`; Indicator = the morph
//   chevron (CSS bars, `morph-icon.css`, `data-open`) or a custom child in a span; Popover = cdk `Popover` with the vendored `select__popover` look.
// - Auto form (identity spec §4.2, plan T22): a root with `label` or `items` renders Trigger (Label + Value + Indicator) +
//   Popover + ListBox around its children (`CellSelect.Item`s, or a render function of `items`); `CellSelect.Item` = ListBox.Item
//   + ItemIndicator, `textValue` from string children. Decided once at render; the compound form is unchanged.
import { Button } from "@rivetjs/cdk/button";
import type { ButtonProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { Label as LabelPrimitive } from "@rivetjs/cdk/label";
import type { LabelProps as LabelPrimitiveProps } from "@rivetjs/cdk/label";
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
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { CellSelectVariants } from "../../../styles/src/components/cell-select/index.ts";
import { cellSelectVariants } from "../../../styles/src/components/cell-select/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { dom } from "../../utils/dom.tsx";
import { accessorIfLive, hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { ListBoxRoot } from "../list-box/list-box.tsx";
import { ListBoxItemWithIndicator, type ListBoxItemRootProps } from "../list-box-item/list-box-item.tsx";
import { SurfaceContext } from "../surface/index.ts";
import { isSlot } from "@rivetjs/runtime/slot";
import { DEV } from "#dev";
import { portalTheme } from "../../utils/portal-theme.ts";

/* -------------------------------------------------------------------------------------------------
 * CellSelect Context
 * -----------------------------------------------------------------------------------------------*/
interface CellSelectContext {
  /** Set inside a CellSelect. */
  inCell?: true;
  variant?: CellSelectVariants["variant"];
}

const CellSelectContext = createContext<CellSelectContext>({});

type Slots = ReturnType<typeof cellSelectVariants>;

/** Module-level memo per `variant` (tv slot functions are pure). */
const SLOTS: Record<string, Slots> = {};
const slotsFor = (variant: CellSelectVariants["variant"]): Slots => (SLOTS[String(variant)] ??= cellSelectVariants({ variant }));
/** `undefined` outside a CellSelect (only the caller's `class`). */
const slotsOf = (context: CellSelectContext): Slots | undefined => (context.inCell ? slotsFor(context.variant) : undefined);

const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* -------------------------------------------------------------------------------------------------
 * CellSelect Root
 * -----------------------------------------------------------------------------------------------*/
type CellSelectRootProps<M extends "single" | "multiple" = "single", T extends object = object> = Omit<SelectPartsProps<M>, "children"> &
  CellSelectVariants & {
    /** Auto form: the label on the left of the cell (with `label` or `items`, the root renders Trigger + Popover + ListBox). */
    label?: Content;
  } & (
    | { items?: undefined; children?: SelectPartsProps<M>["children"] }
    | {
        /** Auto form: the ListBox items; `children` is then a render function of one item. */
        items: Iterable<T>;
        children?: (item: T) => Content;
      }
  );

function CellSelectRoot<M extends "single" | "multiple" = "single", T extends object = object>(props: CellSelectRootProps<M, T>): JSX.Element {
  const [local, rest] = splitLive(props as CellSelectRootProps, ["children", "class", "items", "label", "variant"]);
  const contextValue: CellSelectContext = hasLiveProp(local, ["variant"])
    ? {
        inCell: true,
        get variant() {
          return local.variant;
        },
      }
    : { inCell: true, variant: local.variant };
  const classOf = () => composeTwRenderProps(local.class as never, slotsFor(local.variant).base()) as string | ((v: SelectPartsRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: SelectPartsRenderProps) => renderClass(classOf(), values) : classOf();
  // A function: Rivet JSX builds nodes eagerly, so the select is created inside the provider.
  // `items` next to compound (slot) children: the children win, `items` is ignored (dev warning). Decided once.
  const compound = local.items !== undefined && isSlot(local.children);
  if (DEV && compound) DEV.itemsIgnored("CellSelect");
  const auto = !compound && (local.label !== undefined || local.items !== undefined);
  const content = () => (
    <SelectPrimitive data-slot="cell-select" {...(rest as SelectPartsProps)} class={cls as never}>
      {auto ? (
        <>
          <CellSelectTrigger>
            {local.label !== undefined && <CellSelectLabel>{local.label}</CellSelectLabel>}
            <CellSelectValue />
            <CellSelectIndicator />
          </CellSelectTrigger>
          <CellSelectPopover>
            <ListBoxRoot items={accessorIfLive(local, "items") as Iterable<object> | undefined}>{local.children as never}</ListBoxRoot>
          </CellSelectPopover>
        </>
      ) : (
        (local.children as SelectPartsProps["children"])
      )}
    </SelectPrimitive>
  );

  return (
    <Provider token={CellSelectContext} value={contextValue}>
      {content()}
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * CellSelect Trigger
 * -----------------------------------------------------------------------------------------------*/
interface CellSelectTriggerProps extends ButtonProps {}

const CellSelectTrigger = (props: CellSelectTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(CellSelectContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.trigger()) as string | ((v: ButtonRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) || hasLiveProp(context, ["variant"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();
  return <Button class={cls as never} data-slot="cell-select-trigger" {...(rest as ButtonProps)} />;
};

/* -------------------------------------------------------------------------------------------------
 * CellSelect Label
 * -----------------------------------------------------------------------------------------------*/
interface CellSelectLabelProps extends LabelPrimitiveProps {}

const CellSelectLabel = (props: CellSelectLabelProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(CellSelectContext);
  return (
    <LabelPrimitive
      data-slot="cell-select-label"
      {...(rest as object)}
      class={composeSlotClassName(slotsOf(context)?.label, local.class as string | undefined)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * CellSelect Value
 * -----------------------------------------------------------------------------------------------*/
interface CellSelectValueProps extends SelectValuePrimitiveProps {}

const CellSelectValue = (props: CellSelectValueProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CellSelectContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.value()) as string | ((v: SelectValueRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: SelectValueRenderProps) => renderClass(classOf(), values) : classOf();
  return (
    <SelectValuePrimitive class={cls as never} data-slot="cell-select-value" {...(rest as SelectValuePrimitiveProps)}>
      {local.children as never}
    </SelectValuePrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * CellSelect Indicator
 * -----------------------------------------------------------------------------------------------*/
interface CellSelectIndicatorProps {
  children?: Content;
  class?: string;
}

const CellSelectIndicator = (props: CellSelectIndicatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CellSelectContext);
  const state = useContext(SelectStateContext) as SelectState<any> | null;
  const isOpen = (): boolean => state?.isOpen() ?? false;
  if (local.children) {
    return (
      <dom.span
        {...(rest as {})}
        aria-hidden="true"
        class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
        data-slot="cell-select-indicator"
        data-open={isOpen() || undefined}
      >
        {local.children}
      </dom.span>
    );
  }
  // Default = morph chevron (CSS bars, `morph-icon.css`, TW-149).
  return (
    <dom.span
      aria-hidden="true"
      class={[composeSlotClassName(slotsOf(context)?.indicator, local.class), "morph-chevron"].join(" ").trim()}
      data-open={isOpen() || undefined}
      data-slot="cell-select-default-indicator"
      {...(rest as {})}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * CellSelect Popover
 * -----------------------------------------------------------------------------------------------*/
interface CellSelectPopoverProps extends Omit<PopoverPrimitiveProps, "children"> {
  children: Content;
}

const CellSelectPopover = (props: CellSelectPopoverProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "placement"]);
  const context = useContext(CellSelectContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.popover()) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <PopoverPrimitive {...(rest as PopoverPrimitiveProps)} class={cls as never} data-slot="cell-select-popover" placement={local.placement ?? "bottom end"}>
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
 * CellSelect Item
 * -----------------------------------------------------------------------------------------------*/
interface CellSelectItemProps<T extends object = object> extends ListBoxItemRootProps<T> {}

/** `ListBox.Item` + `ListBox.ItemIndicator`; `textValue` defaults to string / number children. */
const CellSelectItem = ListBoxItemWithIndicator as <T extends object = object>(props: CellSelectItemProps<T>) => JSX.Element;

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { CellSelectRoot, CellSelectTrigger, CellSelectLabel, CellSelectValue, CellSelectIndicator, CellSelectPopover, CellSelectItem, CellSelectContext };

export type {
  CellSelectRootProps,
  CellSelectTriggerProps,
  CellSelectLabelProps,
  CellSelectValueProps,
  CellSelectIndicatorProps,
  CellSelectPopoverProps,
  CellSelectItemProps,
  SelectValueRenderProps as CellSelectValueRenderProps,
};
