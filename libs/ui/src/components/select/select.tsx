// Ported from HeroUI v3.2.6 packages/react/src/components/select/select.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{Button,Popover,Select}` → `@rivetjs/cdk/{button,popover,select/parts}` (the parts-only subpath: no preset Select code in the module graph)
//   (the cdk Select parts form: render props are accessors); `@heroui/styles` → vendored `styles/`.
// - `SelectContext` carries plain data `{ inSelect, fullWidth, variant, isDisabled, onClear }` instead of `{ slots, … }` (tv slot
//   functions do not serialize; slots = a module-level memo per variant pair). Resumable token `rv-ui-select`, default `{}`.
// - Clear button registration (`registerClearButton` / `hasClearButton` ref counter): the trigger checks at event time whether a
//   `[data-slot="select-clear-button"]` renders inside the Select root (DOM query instead of a mount counter: resumed pages run
//   no mount effects). `SelectTriggerContext` (the trigger's resolved `isDisabled`) → the ClearButton reads the trigger
//   element's `disabled` at click time, the root's `isDisabled` otherwise.
// - `Select.Indicator` custom child: Rivet JSX has no `cloneElement`; the child renders inside
//   `span.select__indicator[data-slot="select-indicator"][data-open]` (upstream: the child itself gets them). Default icon =
//   the morph chevron (CSS bars, `morph-icon.css`, TW-149; upstream inline svg that rotates); ClearButton default = lucide `X` (upstream `CloseIcon` svg).
// - Root children: upstream wraps them in a render-prop fragment; the cdk Select takes the same children (value or function).
// - `isDisabled` / `fullWidth` / `variant` read lazily by the parts; the cdk Select reads `isDisabled` once (state).
// - `FieldSlotsGate` is not ported (`libs/ui/CLAUDE.md` Known diffs: cdk `Text` hides itself in a collection build pass).
// - Rivet additions (identity spec §4.2): `Select.Item` (= ListBox.Item + ItemIndicator, `textValue` from string children) and
//   the auto form: a root with `label` or `items` renders Label + Trigger (Value + Indicator) + Popover + ListBox around its
//   children (items, or a render function of `items`). Decided once at render; the compound form is unchanged.
import { Button } from "@rivetjs/cdk/button";
import type { ButtonProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import {
  Select as SelectPrimitive,
  SelectStateContext,
  SelectValue as SelectValuePrimitive,
  clearSelection as clearSelectValue,
  selectedKeys,
} from "@rivetjs/cdk/select/parts";
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
import { X } from "lucide";

import type { SelectVariants } from "../../../styles/src/components/select/index.ts";
import { selectVariants } from "../../../styles/src/components/select/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { dom } from "../../utils/dom.tsx";
import { accessorIfLive, hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { LabelRoot } from "../label/label.tsx";
import { ListBoxRoot } from "../list-box/list-box.tsx";
import { ListBoxItemWithIndicator, type ListBoxItemRootProps } from "../list-box-item/list-box-item.tsx";
import { SurfaceContext } from "../surface/index.ts";
import { isSlot } from "@rivetjs/runtime/slot";
import { DEV } from "#dev";
import { warnItemsIgnored } from "../../utils/shorthand.ts";
import { portalTheme } from "../../utils/portal-theme.ts";

/* -------------------------------------------------------------------------------------------------
 * Select Context
 * -----------------------------------------------------------------------------------------------*/
type SelectContext = {
  /** Rivet: set by `Select` (upstream: `slots`). */
  inSelect?: boolean;
  fullWidth?: SelectVariants["fullWidth"];
  variant?: SelectVariants["variant"];
  /** Handler that is called when the selection is cleared. */
  onClear?: (() => void) | undefined;
  isDisabled?: boolean | undefined;
};

const SelectContext = resumableContext(createContext<SelectContext>({}, { id: "rv-ui-select" }));

type SelectSlots = ReturnType<typeof selectVariants>;
const SLOTS = new Map<string, SelectSlots>();
/** Upstream `use(SelectContext).slots`: `undefined` outside a Select. */
const slotsOf = (context: SelectContext): SelectSlots | undefined => {
  if (!context.inSelect) return undefined;
  const fullWidth = context.fullWidth,
    variant = context.variant;
  const key = `${fullWidth}|${variant}`;
  let slots = SLOTS.get(key);
  if (!slots) SLOTS.set(key, (slots = selectVariants({ fullWidth, variant })));
  return slots;
};

const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

const isSelectionEmpty = (state: SelectState<any> | null): boolean => (state ? selectedKeys(state).length === 0 : true);

/** Whether a `Select.ClearButton` renders inside the Select root of `el` (upstream: a mounted-clear-button counter). */
const hasClearButton = (el: Element): boolean => !!el.closest('[data-slot="select"]')?.querySelector('[data-slot="select-clear-button"]');

/* -------------------------------------------------------------------------------------------------
 * Select Root
 * -----------------------------------------------------------------------------------------------*/
type SelectRootProps<M extends "single" | "multiple" = "single", T extends object = object> = Omit<SelectPartsProps<M>, "children"> &
  SelectVariants & {
    /** Handler that is called when the selection is cleared. */
    onClear?: () => void;
    /** Auto form: the visible Label content (with `items` or `label`, the root renders Trigger + Popover + ListBox). */
    label?: Content;
  } & (
    | { items?: undefined; children?: SelectPartsProps<M>["children"] }
    | {
        /** Auto form: the ListBox items; `children` is then a render function of one item. */
        items: Iterable<T>;
        children?: (item: T) => Content;
      }
  );

function SelectRoot<M extends "single" | "multiple" = "single", T extends object = object>(props: SelectRootProps<M, T>): JSX.Element {
  const [local, rest] = splitLive(props as SelectRootProps, ["children", "class", "fullWidth", "isDisabled", "items", "label", "onClear", "variant"]);
  const contextValue: SelectContext = hasLiveProp(local, ["fullWidth", "variant", "isDisabled"])
    ? {
        inSelect: true,
        get fullWidth() {
          return local.fullWidth;
        },
        get variant() {
          return local.variant;
        },
        get isDisabled() {
          return local.isDisabled;
        },
        onClear: local.onClear,
      }
    : { inSelect: true, fullWidth: local.fullWidth, variant: local.variant, isDisabled: local.isDisabled, onClear: local.onClear };
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(contextValue)?.base()) as string | ((v: SelectPartsRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "fullWidth", "variant"]) ? (values: SelectPartsRenderProps) => renderClass(classOf(), values) : classOf();
  // `items` next to compound (slot) children: the children win, `items` is ignored (dev warning). Decided once.
  const compound = local.items !== undefined && isSlot(local.children);
  if (DEV && compound) warnItemsIgnored("Select");
  const auto = !compound && (local.label !== undefined || local.items !== undefined);
  const content = () => (
    <SelectPrimitive data-slot="select" {...(rest as SelectPartsProps)} class={cls as never} isDisabled={local.isDisabled}>
      {auto ? (
        <>
          {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
          <SelectTrigger>
            <SelectValue />
            <SelectIndicator />
          </SelectTrigger>
          <SelectPopover>
            <ListBoxRoot items={accessorIfLive(local, "items") as Iterable<object> | undefined}>{local.children as never}</ListBoxRoot>
          </SelectPopover>
        </>
      ) : (
        (local.children as SelectPartsProps["children"])
      )}
    </SelectPrimitive>
  );

  return (
    <Provider token={SelectContext} value={contextValue}>
      {content()}
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Select Trigger
 * -----------------------------------------------------------------------------------------------*/
interface SelectTriggerProps extends ButtonProps {}

const SelectTrigger = (props: SelectTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "onKeyDown"]);
  const context = useContext(SelectContext);
  const state = useContext(SelectStateContext) as SelectState<any> | null;
  const userKeyDown = local.onKeyDown;
  const onClear = context.onClear;
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.trigger()) as string | ((v: ButtonRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <Button
      class={cls as never}
      data-slot="select-trigger"
      {...(rest as ButtonProps)}
      // ARIA treats the children of a button as presentational, so Select.ClearButton can never take focus. This shortcut is
      // the only pointer-free way to clear, and it is gated on a clear button being composed so a plain Select stays
      // non-clearable.
      onKeyDown={(e: KeyboardEvent & { continuePropagation(): void }) => {
        userKeyDown?.(e as never);
        const isClearKey = e.key === "Backspace" || e.key === "Delete";
        const canClear = hasClearButton(e.currentTarget as Element) && !isSelectionEmpty(state);
        if (!isClearKey || !canClear || !state || state.isOpen()) {
          // useKeyboard swallows propagation unless a handler opts back in.
          e.continuePropagation();
          return;
        }
        e.preventDefault();
        clearSelectValue(state, e);
        onClear?.();
      }}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Select Value
 * -----------------------------------------------------------------------------------------------*/
interface SelectValueProps extends SelectValuePrimitiveProps {}

const SelectValue = (props: SelectValueProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(SelectContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.value()) as string | ((v: SelectValueRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: SelectValueRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <SelectValuePrimitive class={cls as never} data-slot="select-value" {...(rest as SelectValuePrimitiveProps)}>
      {local.children as never}
    </SelectValuePrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Select Indicator
 * -----------------------------------------------------------------------------------------------*/
interface SelectIndicatorProps {
  children?: Content;
  class?: string;
}

/** `Select.Indicator` props: span props (upstream generic `<E = "svg">`, the default icon's svg; Rivet's default is a CSS morph chevron span). */
type SelectIndicatorSpanProps = SelectIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof SelectIndicatorProps>;

const SelectIndicator = (props: SelectIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(SelectContext);
  const state = useContext(SelectStateContext) as SelectState<any> | null;
  const isOpen = (): boolean => state?.isOpen() ?? false;

  if (local.children) {
    return (
      <dom.span
        {...(rest as {})}
        class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
        data-slot="select-indicator"
        data-open={isOpen() || undefined}
      >
        {local.children}
      </dom.span>
    );
  }

  // Default = morph chevron (CSS bars, `morph-icon.css`, TW-149): flattens and folds up on `data-open`; no icon, no JS.
  return (
    <dom.span
      aria-hidden="true"
      class={[composeSlotClassName(slotsOf(context)?.indicator, local.class), "morph-chevron"].join(" ").trim()}
      data-open={isOpen() || undefined}
      data-slot="select-default-indicator"
      {...(rest as {})}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Select Clear Button
 * -----------------------------------------------------------------------------------------------*/
interface SelectClearButtonProps {
  children?: Content;
  class?: string;
}

/** `Select.ClearButton` props for the default element (`span`; upstream generic `<E>`: TS2590, see `list-box-item.tsx`). */
type SelectClearButtonSpanProps = SelectClearButtonProps & Omit<JSX.IntrinsicElements["span"], keyof SelectClearButtonProps>;

const SelectClearButton = (props: SelectClearButtonSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "onClick", "onPointerDown"]);
  const context = useContext(SelectContext);
  const state = useContext(SelectStateContext) as SelectState<any> | null;
  const rootDisabled = context.isDisabled;
  const onClear = context.onClear;
  const userClick = local.onClick as ((e: MouseEvent) => void) | undefined;
  const userPointerDown = local.onPointerDown as ((e: PointerEvent) => void) | undefined;

  return (
    <dom.span
      aria-hidden
      class={slotsOf(context)?.clearButton({ class: local.class }) ?? local.class}
      data-empty={isSelectionEmpty(state) || undefined}
      data-slot="select-clear-button"
      {...(rest as {})}
      onClick={(e: MouseEvent & { currentTarget: HTMLElement }) => {
        e.preventDefault();
        e.stopPropagation();
        // Clearing happens here rather than on pointer down so that only a primary-button click clears; `pointerdown` also
        // fires for secondary and middle buttons.
        const trigger = e.currentTarget.closest("button");
        const isDisabled = trigger ? trigger.disabled : (rootDisabled ?? false);
        if (!isDisabled && state && !isSelectionEmpty(state)) {
          clearSelectValue(state, e);
          onClear?.();
        }
        userClick?.(e);
      }}
      onPointerDown={(e: PointerEvent) => {
        // Select.Trigger is a <button>, and nesting a <button> in one is invalid HTML, so this control is a span. Keep the
        // press off the trigger so the menu stays closed. The default is left intact so focus still lands on the trigger,
        // which is where the clear shortcut lives.
        e.stopPropagation();
        userPointerDown?.(e);
      }}
    >
      {local.children ?? <Icon icon={X} data-slot="select-clear-button-icon" />}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Select Popover
 * -----------------------------------------------------------------------------------------------*/
interface SelectPopoverProps extends Omit<PopoverPrimitiveProps, "children"> {
  children: Content;
}

const SelectPopover = (props: SelectPopoverProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "placement"]);
  const context = useContext(SelectContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.popover()) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <PopoverPrimitive {...(rest as PopoverPrimitiveProps)} class={cls as never} data-slot="select-popover" placement={local.placement ?? "bottom"}>
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
 * Select Item (Rivet)
 * -----------------------------------------------------------------------------------------------*/
interface SelectItemProps<T extends object = object> extends ListBoxItemRootProps<T> {}

/** `ListBox.Item` + `ListBox.ItemIndicator`; `textValue` defaults to string / number children. */
const SelectItem = ListBoxItemWithIndicator as <T extends object = object>(props: SelectItemProps<T>) => JSX.Element;

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { SelectRoot, SelectTrigger, SelectValue, SelectIndicator, SelectClearButton, SelectPopover, SelectItem, SelectContext };

export type {
  SelectRootProps,
  SelectTriggerProps,
  SelectValueProps,
  SelectIndicatorProps,
  SelectIndicatorSpanProps,
  SelectClearButtonProps,
  SelectClearButtonSpanProps,
  SelectPopoverProps,
  SelectItemProps,
};
