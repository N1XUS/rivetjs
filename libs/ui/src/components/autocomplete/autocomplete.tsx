// Ported from HeroUI v3.2.6 packages/react/src/components/autocomplete/autocomplete.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{Autocomplete,Button,Group,Popover,Select}` →
//   `@rivetjs/cdk/{autocomplete,button,group,popover,select}` (the cdk Select parts form: render props are accessors);
//   `@heroui/styles` → vendored `styles/`.
// - `AutocompleteContext` carries plain data `{ inAutocomplete, fullWidth, variant, isDisabled, onClear, triggerRef }` instead of
//   `{ slots, … }` (tv slot functions do not serialize; slots = a module-level memo per variant pair). `triggerRef` is a runtime
//   `ref()` (serializes on resume; written by the Trigger, which renders nothing in the collection build pass). Resumable token
//   `rv-ui-autocomplete`, default `{}`.
// - `clearButtonRef`: the Trigger checks at click time whether the target is inside a `[data-slot="autocomplete-clear-button"]`
//   (DOM query instead of a ref the ClearButton registers).
// - `Autocomplete.Popover`: `--trigger-width` comes from the cdk positioning (it measures `triggerRef`), so upstream's
//   `useResizeObserver` + state is not ported; `style` passes through.
// - `Autocomplete.Indicator` custom child: Rivet JSX has no `cloneElement`; the child renders inside
//   `span.autocomplete__indicator[data-slot="autocomplete-indicator"][data-open]` (upstream: the child itself gets them). Default
//   = the morph chevron (CSS bars, `morph-icon.css`, TW-149); ClearButton icon = lucide `X` (upstream inline svgs).
// - Root / Trigger children: upstream wraps them in render-prop fragments; the cdk Select / Group take the same children.
// - `FieldSlotsGate` is not ported (`libs/ui/CLAUDE.md` Known diffs: cdk `Text` hides itself in a collection build pass).
// - Rivet additions (identity spec §4.2, plan T22): `Autocomplete.Item` (= ListBox.Item + ItemIndicator, `textValue` from
//   string children) and the auto form: a root with `label` or `items` renders Label + Trigger (Value + Indicator) + Popover >
//   Filter (SearchField + ListBox) around its children (ListBox content, or a render function of `items`). The Filter matches
//   with `filter` (default: case- and accent-insensitive substring, cdk `createFilter` base sensitivity); the SearchField is
//   named by `searchLabel` (default "Search"). Decided once at render; the compound form is unchanged.
import { Autocomplete as AutocompletePrimitive } from "@rivetjs/cdk/autocomplete";
import type { AutocompleteProps as AutocompletePrimitiveProps } from "@rivetjs/cdk/autocomplete";
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import { isHidden } from "@rivetjs/cdk/collections/components";
import { Group as GroupPrimitive } from "@rivetjs/cdk/group";
import { createFilter, type Filter } from "@rivetjs/cdk/i18n/filter";
import { mergeRefs } from "@rivetjs/cdk/interactions/merge-props";
import type { GroupProps as GroupPrimitiveProps, GroupRenderProps } from "@rivetjs/cdk/group";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import {
  Select as SelectPrimitive,
  SelectStateContext,
  SelectValue as SelectValuePrimitive,
  clearSelection as clearSelectValue,
  selectedKeys,
  toggleSelect,
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
import { Provider, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content, JSX, Ref } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { X } from "lucide";

import type { AutocompleteVariants } from "../../../styles/src/components/autocomplete/index.ts";
import { autocompleteVariants } from "../../../styles/src/components/autocomplete/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { dom } from "../../utils/dom.tsx";
import { accessorIfLive, hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { LabelRoot } from "../label/label.tsx";
import { ListBoxRoot } from "../list-box/list-box.tsx";
import { ListBoxItemWithIndicator, type ListBoxItemRootProps } from "../list-box-item/list-box-item.tsx";
import { SearchFieldRoot } from "../search-field/search-field.tsx";
import { SurfaceContext } from "../surface/index.ts";
import { isSlot } from "@rivetjs/runtime/slot";
import { DEV } from "#dev";
import { warnItemsIgnored } from "../../utils/shorthand.ts";
import { portalTheme } from "../../utils/portal-theme.ts";

/* -------------------------------------------------------------------------------------------------
 * Autocomplete Context
 * -----------------------------------------------------------------------------------------------*/
type AutocompleteContext = {
  /** Rivet: set by `Autocomplete` (upstream: `slots`). */
  inAutocomplete?: boolean;
  fullWidth?: AutocompleteVariants["fullWidth"];
  variant?: AutocompleteVariants["variant"];
  onClear?: (() => void) | undefined;
  /** The trigger group element (positions the popover). */
  triggerRef?: Ref<HTMLDivElement>;
  isDisabled?: boolean | undefined;
};

const AutocompleteContext = resumableContext(createContext<AutocompleteContext>({}, { id: "rv-ui-autocomplete" }));

type AutocompleteSlots = ReturnType<typeof autocompleteVariants>;
const SLOTS = new Map<string, AutocompleteSlots>();
/** Upstream `use(AutocompleteContext).slots`: `undefined` outside an Autocomplete. */
const slotsOf = (context: AutocompleteContext): AutocompleteSlots | undefined => {
  if (!context.inAutocomplete) return undefined;
  const fullWidth = context.fullWidth,
    variant = context.variant;
  const key = `${fullWidth}|${variant}`;
  let slots = SLOTS.get(key);
  if (!slots) SLOTS.set(key, (slots = autocompleteVariants({ fullWidth, variant })));
  return slots;
};

const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

const isSelectionEmpty = (state: SelectState<any> | null): boolean => (state ? selectedKeys(state).length === 0 : true);

/* -------------------------------------------------------------------------------------------------
 * Autocomplete Root
 * -----------------------------------------------------------------------------------------------*/
type AutocompleteRootProps<M extends "single" | "multiple" = "single", T extends object = object> = Omit<SelectPartsProps<M>, "children"> &
  AutocompleteVariants & {
    // Handler that is called when the clear button is pressed.
    onClear?: () => void;
    /** Auto form: the visible Label content (with `items` or `label`, the root renders Trigger + Popover + Filter + ListBox). */
    label?: Content;
    /** Auto form: how the Filter matches an item's text value against the search text (default: case- and accent-insensitive). */
    filter?: (textValue: string, inputValue: string) => boolean;
    /** Auto form: accessible name of the SearchField in the popover. @default "Search" */
    searchLabel?: string;
  } & (
    | { items?: undefined; children?: SelectPartsProps<M>["children"] }
    | {
        /** Auto form: the ListBox items; `children` is then a render function of one item. */
        items: Iterable<T>;
        children?: (item: T) => Content;
      }
  );

let collator: Filter | undefined;
/** Auto form default filter: substring match, case- and accent-insensitive (collator created on first use). */
function containsText(textValue: string, inputValue: string): boolean {
  return (collator ??= createFilter({ sensitivity: "base" })).contains(textValue, inputValue);
}

function AutocompleteRoot<M extends "single" | "multiple" = "single", T extends object = object>(props: AutocompleteRootProps<M, T>): JSX.Element {
  const [local, rest] = splitLive(props as AutocompleteRootProps, [
    "children",
    "class",
    "filter",
    "fullWidth",
    "isDisabled",
    "items",
    "label",
    "onClear",
    "searchLabel",
    "variant",
  ]);
  const triggerRef = createRef<HTMLDivElement>();
  const contextValue: AutocompleteContext = hasLiveProp(local, ["fullWidth", "variant", "isDisabled"])
    ? {
        inAutocomplete: true,
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
        triggerRef,
      }
    : { inAutocomplete: true, fullWidth: local.fullWidth, variant: local.variant, isDisabled: local.isDisabled, onClear: local.onClear, triggerRef };
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(contextValue)?.base()) as string | ((v: SelectPartsRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "fullWidth", "variant"]) ? (values: SelectPartsRenderProps) => renderClass(classOf(), values) : classOf();
  // `items` next to compound (slot) children: the children win, `items` is ignored (dev warning). Decided once.
  const compound = local.items !== undefined && isSlot(local.children);
  if (DEV && compound) warnItemsIgnored("Autocomplete");
  const auto = !compound && (local.label !== undefined || local.items !== undefined);
  const content = () => (
    <SelectPrimitive data-slot="autocomplete" {...(rest as SelectPartsProps)} class={cls as never} isDisabled={local.isDisabled}>
      {auto ? (
        <>
          {local.label !== undefined && <LabelRoot>{local.label}</LabelRoot>}
          <AutocompleteTrigger>
            <AutocompleteValue />
            <AutocompleteIndicator />
          </AutocompleteTrigger>
          <AutocompletePopover>
            <AutocompleteFilter filter={local.filter ?? containsText}>
              <SearchFieldRoot autoFocus aria-label={local.searchLabel ?? "Search"} variant="secondary" />
              <ListBoxRoot items={accessorIfLive(local, "items") as Iterable<object> | undefined}>{local.children as never}</ListBoxRoot>
            </AutocompleteFilter>
          </AutocompletePopover>
        </>
      ) : (
        (local.children as SelectPartsProps["children"])
      )}
    </SelectPrimitive>
  );

  return (
    <Provider token={AutocompleteContext} value={contextValue}>
      {content()}
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Autocomplete Trigger
 * -----------------------------------------------------------------------------------------------*/
interface AutocompleteTriggerProps extends GroupPrimitiveProps {}

const AutocompleteTrigger = (props: AutocompleteTriggerProps): JSX.Element | null => {
  // Upstream `useIsHidden()`: nothing in the Select's collection build pass.
  if (isHidden()) return null;
  const [local, rest] = splitLive(props, ["children", "class", "isDisabled", "onClick", "ref"]);
  const context = useContext(AutocompleteContext);
  const state = useContext(SelectStateContext) as SelectState<any> | null;
  const isDisabled = local.isDisabled ?? context.isDisabled ?? false;
  const userClick = local.onClick as ((e: MouseEvent) => void) | undefined;
  // A runtime `ref()` given straight to the element resumes; a user ref is merged (callback).
  const userRef = local.ref;
  const triggerRef = context.triggerRef;
  const groupRef = userRef && triggerRef ? mergeRefs(triggerRef as never, userRef as never) : (triggerRef ?? userRef);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.trigger()) as string | ((v: GroupRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: GroupRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <GroupPrimitive
      ref={groupRef as never}
      class={cls as never}
      data-slot="autocomplete-trigger"
      isDisabled={isDisabled}
      onClick={(e: MouseEvent) => {
        // Don't toggle if clicking the clear button
        if ((e.target as Element | null)?.closest?.('[data-slot="autocomplete-clear-button"]')) return;
        userClick?.(e);
        // Rivet: a disabled trigger does not open (upstream toggles the Select state from any click on the group).
        if (state && !isDisabled) toggleSelect(state);
      }}
      {...(rest as GroupPrimitiveProps)}
    >
      {local.children}
    </GroupPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Autocomplete Value
 * -----------------------------------------------------------------------------------------------*/
interface AutocompleteValueProps extends SelectValuePrimitiveProps {}

const AutocompleteValue = (props: AutocompleteValueProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(AutocompleteContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.value()) as string | ((v: SelectValueRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: SelectValueRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <SelectValuePrimitive class={cls as never} data-slot="autocomplete-value" {...(rest as SelectValuePrimitiveProps)}>
      {local.children as never}
    </SelectValuePrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Autocomplete Indicator
 * -----------------------------------------------------------------------------------------------*/
interface AutocompleteIndicatorProps {
  children?: Content;
  class?: string;
}

/** `Autocomplete.Indicator` props: span props (upstream generic `<E = "svg">`, the default icon's svg; Rivet's default is a CSS morph chevron span). */
type AutocompleteIndicatorSpanProps = AutocompleteIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof AutocompleteIndicatorProps>;

const AutocompleteIndicator = (props: AutocompleteIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(AutocompleteContext);
  const state = useContext(SelectStateContext) as SelectState<any> | null;
  const isOpen = (): boolean => state?.isOpen() ?? false;

  return (
    <ButtonPrimitive>
      {local.children ? (
        <dom.span
          {...(rest as {})}
          class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
          data-slot="autocomplete-indicator"
          data-open={isOpen() || undefined}
        >
          {local.children}
        </dom.span>
      ) : (
        // Default = morph chevron (CSS bars, `morph-icon.css`, TW-149).
        <dom.span
          aria-hidden="true"
          class={[composeSlotClassName(slotsOf(context)?.indicator, local.class), "morph-chevron"].join(" ").trim()}
          data-open={isOpen() || undefined}
          data-slot="autocomplete-default-indicator"
          {...(rest as {})}
        />
      )}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Autocomplete Popover
 * -----------------------------------------------------------------------------------------------*/
interface AutocompletePopoverProps extends Omit<PopoverPrimitiveProps, "children"> {
  children: Content;
}

const AutocompletePopover = (props: AutocompletePopoverProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "placement"]);
  const context = useContext(AutocompleteContext);
  const triggerRef = context.triggerRef;
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.popover()) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <PopoverPrimitive
      {...(rest as PopoverPrimitiveProps)}
      class={cls as never}
      data-slot="autocomplete-popover"
      placement={local.placement ?? "bottom"}
      triggerRef={triggerRef}
    >
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
 * Autocomplete Filter
 * -----------------------------------------------------------------------------------------------*/
interface AutocompleteFilterProps<T = object> extends AutocompletePrimitiveProps<T> {}

const AutocompleteFilter = <T = object,>(props: AutocompleteFilterProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as AutocompleteFilterProps, ["children"]);
  return (
    <AutocompletePrimitive data-slot="autocomplete-filter" {...(rest as AutocompletePrimitiveProps)}>
      {local.children}
    </AutocompletePrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Autocomplete Item (Rivet)
 * -----------------------------------------------------------------------------------------------*/
interface AutocompleteItemProps<T extends object = object> extends ListBoxItemRootProps<T> {}

/** `ListBox.Item` + `ListBox.ItemIndicator`; `textValue` defaults to string / number children. */
const AutocompleteItem = ListBoxItemWithIndicator as <T extends object = object>(props: AutocompleteItemProps<T>) => JSX.Element;

/* -------------------------------------------------------------------------------------------------
 * Autocomplete Clear Button
 * -----------------------------------------------------------------------------------------------*/
interface AutocompleteClearButtonProps {
  children?: Content;
  class?: string;
}

/** `Autocomplete.ClearButton` props for the default element (`button`; upstream generic `<E>`: TS2590, see `list-box-item.tsx`). */
type AutocompleteClearButtonButtonProps = AutocompleteClearButtonProps & Omit<JSX.IntrinsicElements["button"], keyof AutocompleteClearButtonProps>;

const AutocompleteClearButton = (props: AutocompleteClearButtonButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "onClick"]);
  const context = useContext(AutocompleteContext);
  const state = useContext(SelectStateContext) as SelectState<any> | null;
  const onClear = context.onClear;
  const userClick = local.onClick as ((e: MouseEvent) => void) | undefined;

  return (
    <dom.button
      aria-hidden={isSelectionEmpty(state) || undefined}
      aria-label="Clear selection"
      class={slotsOf(context)?.clearButton({ class: local.class }) ?? local.class}
      data-empty={isSelectionEmpty(state) || undefined}
      data-slot="autocomplete-clear-button"
      disabled={context.isDisabled ?? false}
      tabIndex={-1}
      type="button"
      onClick={(e: MouseEvent) => {
        if (state) clearSelectValue(state, e);
        onClear?.();
        userClick?.(e);
      }}
      {...(rest as {})}
    >
      <Icon icon={X} data-slot="autocomplete-clear-button-icon" />
    </dom.button>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  AutocompleteRoot,
  AutocompleteTrigger,
  AutocompleteValue,
  AutocompleteIndicator,
  AutocompletePopover,
  AutocompleteFilter,
  AutocompleteClearButton,
  AutocompleteItem,
  AutocompleteContext,
};

export type {
  AutocompleteRootProps,
  AutocompleteTriggerProps,
  AutocompleteValueProps,
  AutocompleteIndicatorProps,
  AutocompleteIndicatorSpanProps,
  AutocompletePopoverProps,
  AutocompleteFilterProps,
  AutocompleteClearButtonProps,
  AutocompleteClearButtonButtonProps,
  AutocompleteItemProps,
};
