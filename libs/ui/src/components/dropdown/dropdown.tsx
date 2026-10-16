// Ported from HeroUI v3.2.6 packages/react/src/components/dropdown/dropdown.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/{Button,Menu}` → `@rivetjs/cdk/{button,menu,popover}`
//   (render props are accessors); `@heroui/styles` → vendored `styles/`.
// - `DropdownContext` carries `{ inDropdown: true }` instead of `{ slots }` (tv slot functions do not serialize; the slots are one
//   module-level memo: `dropdownVariants()` takes no variants). Resumable token `rv-ui-dropdown`; default `{}` → parts outside a
//   Dropdown get only the caller's `class` (= upstream `slots?.x()` undefined).
// - Rivet JSX is eager: the root builds the trigger inside the provider (`content()`), as `popover.tsx` does.
// - `Dropdown.Trigger` children: upstream wraps them in a render-prop fragment; the cdk Button takes the same children (value or
//   render function) directly.
// - `Dropdown.SubmenuTrigger`: upstream passes `data-slot="dropdown-submenu-trigger"` to RAC `SubmenuTrigger`, which renders no
//   element (attribute dropped); the cdk `SubmenuTrigger` takes `children` / `delay` only, so it is not passed.
// - Live `class` on Trigger / Popover / Menu → render-prop function (the composed class is a local: it reaches the cdk parts as a plain value).
// - Rivet (identity spec §4.2, T18): `Dropdown.Menu` outside a `Dropdown.Popover` renders its own popover (`placement`,
//   `offset`, `crossOffset`, `shouldFlip` go to it); `DropdownContext.inPopover` is set by `Dropdown.Popover` and reset by
//   `Dropdown.SubmenuTrigger` (so a submenu's Menu without a Popover wraps itself too); the context is resumable, so a
//   resumed popover's Menu sees it. Outside a Dropdown a Menu never wraps. `Dropdown.Item` sugar: `icon` (lucide icon
//   data), `description`, `shortcut` (`"command+shift+D"`: Kbd abbreviations for the known keys, the rest as content),
//   string children → `Label` + `textValue`; the parts are built in the item's render function (inside its Text / Keyboard
//   slot providers). Function children and other content without sugar pass straight through.
import { Button } from "@rivetjs/cdk/button";
import type { ButtonProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { Menu as MenuPrimitive, MenuTrigger as MenuTriggerPrimitive, SubmenuTrigger as SubmenuTriggerPrimitive } from "@rivetjs/cdk/menu";
import type { MenuProps as MenuPrimitiveProps, MenuRenderProps, MenuTriggerProps, SubmenuTriggerProps } from "@rivetjs/cdk/menu";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { Icon } from "@rivetjs/kit/icon";
import type { IconNode } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { isSlot } from "@rivetjs/runtime/slot";

import type { DropdownVariants } from "../../../styles/src/components/dropdown/index.ts";
import { dropdownVariants } from "../../../styles/src/components/dropdown/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { menuItemVariants } from "../../../styles/src/components/menu-item/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DescriptionRoot } from "../description/description.tsx";
import { KbdAbbr, KbdContent, KbdRoot } from "../kbd/kbd.tsx";
import { kbdKeysMap } from "../kbd/kbd.constants.ts";
import type { KbdKey } from "../kbd/kbd.constants.ts";
import { LabelRoot } from "../label/label.tsx";
import { MenuItemIndicator, MenuItemRoot, MenuItemSubmenuIndicator } from "../menu-item/index.ts";
import type { MenuItemIndicatorSpanProps, MenuItemRootProps, MenuItemSubmenuIndicatorSpanProps } from "../menu-item/menu-item.tsx";
import { MenuSectionRoot } from "../menu-section/index.ts";
import type { MenuSectionRootProps } from "../menu-section/index.ts";
import { SurfaceContext } from "../surface/index.ts";

/* -------------------------------------------------------------------------------------------------
 * Dropdown Context
 * -----------------------------------------------------------------------------------------------*/
type DropdownContext = {
  /** Rivet: inside a Dropdown (upstream: `slots`). */
  inDropdown?: boolean;
  /** Rivet: directly inside a `Dropdown.Popover` (its Menu renders no popover of its own); a SubmenuTrigger resets it. */
  inPopover?: boolean;
};

const DropdownContext = resumableContext(createContext<DropdownContext>({}, { id: "rv-ui-dropdown" }));

const ROOT_CONTEXT: DropdownContext = { inDropdown: true };
const POPOVER_CONTEXT: DropdownContext = { inDropdown: true, inPopover: true };
const LONE_POPOVER_CONTEXT: DropdownContext = { inPopover: true };
const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

type DropdownSlots = ReturnType<typeof dropdownVariants>;
let SLOTS: DropdownSlots | undefined;
/** Upstream `use(DropdownContext).slots`: `undefined` outside a Dropdown. */
const slotsOf = (context: DropdownContext): DropdownSlots | undefined => (context.inDropdown ? (SLOTS ??= dropdownVariants()) : undefined);

/* -------------------------------------------------------------------------------------------------
 * Dropdown Root (MenuTrigger wrapper)
 * -----------------------------------------------------------------------------------------------*/
interface DropdownRootProps extends MenuTriggerProps, DropdownVariants {
  class?: string;
}

const DropdownRoot = (props: DropdownRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children"]);
  const content = () => <MenuTriggerPrimitive {...(rest as MenuTriggerProps)}>{local.children}</MenuTriggerPrimitive>;

  return (
    <Provider token={DropdownContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Dropdown Trigger (Button wrapper)
 * -----------------------------------------------------------------------------------------------*/
interface DropdownTriggerProps extends ButtonProps {}

const DropdownTrigger = (props: DropdownTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(DropdownContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.trigger()) as string | ((v: ButtonRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return <Button class={cls as never} data-slot="dropdown-trigger" {...(rest as ButtonProps)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Dropdown Popover (Popover wrapper)
 * -----------------------------------------------------------------------------------------------*/
interface DropdownPopoverProps extends Omit<PopoverPrimitiveProps, "children">, DropdownVariants {
  children: Content;
}

const DropdownPopover = (props: DropdownPopoverProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(DropdownContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.popover()) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <PopoverPrimitive {...(rest as PopoverPrimitiveProps)} class={cls as never} data-slot="dropdown-popover">
      {local.children}
    </PopoverPrimitive>
  );

  return (
    <Provider token={SurfaceContext} value={DEFAULT_SURFACE_CONTEXT}>
      <Provider token={DropdownContext} value={context.inDropdown ? POPOVER_CONTEXT : LONE_POPOVER_CONTEXT}>
        {content()}
      </Provider>
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Dropdown Menu (Menu wrapper)
 * -----------------------------------------------------------------------------------------------*/
interface DropdownMenuProps<T extends object = object>
  extends MenuPrimitiveProps<T>, DropdownVariants, Pick<DropdownPopoverProps, "placement" | "offset" | "crossOffset" | "shouldFlip"> {}

function DropdownMenu<T extends object = object>(props: DropdownMenuProps<T>): JSX.Element {
  const [local, others] = splitLive(props as DropdownMenuProps<object>, ["class"]);
  const [popover, rest] = splitLive(others, ["placement", "offset", "crossOffset", "shouldFlip"]);
  const context = useContext(DropdownContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.menu()) as string | ((v: MenuRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: MenuRenderProps) => renderClass(classOf(), values) : classOf();
  const menu = () => (
    <MenuPrimitive
      class={cls as never}
      data-selection-mode={(rest as MenuPrimitiveProps<object>).selectionMode}
      data-slot="dropdown-menu"
      {...(rest as MenuPrimitiveProps<object>)}
    />
  );

  return context.inPopover || !context.inDropdown ? (
    menu()
  ) : (
    <DropdownPopover {...(popover as Omit<DropdownPopoverProps, "children">)}>{menu()}</DropdownPopover>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Dropdown Item (MenuItem wrapper)
 * -----------------------------------------------------------------------------------------------*/
interface DropdownItemProps extends MenuItemRootProps {
  /** Rivet: leading icon (lucide icon data). */
  icon?: IconNode;
  /** Rivet: second line under the label. */
  description?: Content;
  /** Rivet: keyboard shortcut, `"command+N"` (Kbd abbreviations for the known keys) or Kbd content. */
  shortcut?: string | Content;
}

let ITEM_SLOTS: ReturnType<typeof menuItemVariants> | undefined;

/** `"command+shift+D"` → Kbd.Abbr for the known keys, Kbd.Content for the rest. */
const shortcutParts = (text: string): Content =>
  text.split("+").map((key) => (key in kbdKeysMap ? <KbdAbbr keyValue={key as KbdKey} /> : <KbdContent>{key}</KbdContent>));

const DropdownItem = (props: DropdownItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "description", "icon", "shortcut", "textValue"]);
  const children = local.children;
  const text = typeof children === "string" ? children : undefined;
  // Which parts exist is read once (structure); their contents stay live through the JSX expressions.
  const hasIcon = local.icon !== undefined;
  const hasDescription = local.description !== undefined;
  const hasShortcut = local.shortcut !== undefined;
  if (text === undefined && !hasIcon && !hasDescription && !hasShortcut) return <MenuItemRoot {...rest} children={children} textValue={local.textValue} />;
  const slots = (ITEM_SLOTS ??= menuItemVariants());
  // Built inside the item's render (its Text / Keyboard slot providers), never before it.
  const content = (): Content => {
    const label = text !== undefined ? <LabelRoot>{text}</LabelRoot> : (children as Content);
    const parts: Content[] = [];
    if (hasIcon) parts.push(<Icon class={slots.icon()} icon={local.icon!} size={16} />);
    parts.push(
      hasDescription ? (
        <div class={slots.text()}>
          {label}
          <DescriptionRoot>{local.description}</DescriptionRoot>
        </div>
      ) : (
        label
      ),
    );
    if (hasShortcut) {
      const shortcut = local.shortcut;
      parts.push(
        <KbdRoot class={slots.shortcut()} slot="keyboard" variant="light">
          {typeof shortcut === "string" ? shortcutParts(shortcut) : shortcut}
        </KbdRoot>,
      );
    }
    return parts;
  };

  return <MenuItemRoot {...rest} children={content} textValue={local.textValue ?? text} />;
};

/* -------------------------------------------------------------------------------------------------
 * Dropdown Submenu Indicator (MenuItemSubmenuIndicator wrapper)
 * -----------------------------------------------------------------------------------------------*/
type DropdownSubmenuIndicatorProps = MenuItemSubmenuIndicatorSpanProps;

const DropdownSubmenuIndicator = (props: DropdownSubmenuIndicatorProps): JSX.Element => <MenuItemSubmenuIndicator {...props} />;

/* -------------------------------------------------------------------------------------------------
 * Dropdown Submenu Trigger
 * -----------------------------------------------------------------------------------------------*/
type DropdownSubmenuTriggerProps = SubmenuTriggerProps;

// A submenu's Menu is outside any Dropdown.Popover again (it folds into its own unless one is written).
const DropdownSubmenuTrigger = (props: DropdownSubmenuTriggerProps): JSX.Element => (
  <Provider token={DropdownContext} value={ROOT_CONTEXT}>
    {(<SubmenuTriggerPrimitive {...props} />) as JSX.Element}
  </Provider>
);

/* -------------------------------------------------------------------------------------------------
 * Dropdown Item Indicator (MenuItemIndicator wrapper)
 * -----------------------------------------------------------------------------------------------*/
type DropdownItemIndicatorProps = MenuItemIndicatorSpanProps;

const DropdownItemIndicator = (props: DropdownItemIndicatorProps): JSX.Element => <MenuItemIndicator {...props} />;

/* -------------------------------------------------------------------------------------------------
 * Dropdown Section (MenuSection wrapper)
 * -----------------------------------------------------------------------------------------------*/
type DropdownSectionProps = MenuSectionRootProps;

const DropdownSection = (props: DropdownSectionProps): JSX.Element => <MenuSectionRoot {...props} />;

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  DropdownItem,
  DropdownItemIndicator,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
  DropdownSection,
  DropdownSubmenuIndicator,
  DropdownSubmenuTrigger,
  DropdownTrigger,
};

export type {
  DropdownItemIndicatorProps,
  DropdownItemProps,
  DropdownMenuProps,
  DropdownPopoverProps,
  DropdownRootProps,
  DropdownSectionProps,
  DropdownSubmenuIndicatorProps,
  DropdownSubmenuTriggerProps,
  DropdownTriggerProps,
};
