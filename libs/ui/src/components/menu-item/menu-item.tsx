// Ported from HeroUI v3.2.6 packages/react/src/components/menu-item/menu-item.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/Menu` → `@rivetjs/cdk/menu` (render props are accessors:
//   `state.isSelected()`; `hasSubmenu` is a boolean); `@heroui/styles` → vendored `styles/`.
// - `MenuItemContext` carries `{ variant, state }` instead of `{ slots, state }` (tv slot functions do not serialize; slots from a
//   module-level memo per variant); `state` = the cdk render props. Resumable token `rv-ui-menu-item`, default `{}` → an indicator
//   outside an item gets only the caller's `class` (= upstream `slots?.indicator`).
// - Function children (`typeof children === "function"`) → `!isSlot(children)` (Rivet JSX children are compiler slots).
// - Indicators: upstream inline svgs → lucide (icon rule) with the same `data-slot`s: checkmark = `Check` with the draw animation
//   on its path (`stroke-dasharray` 24, offset 48 selected / 72 not; upstream polyline 22 / 44 / 66), dot = `Circle` filled,
//   submenu = `ChevronRight` (upstream `IconChevronRight`).
// - Indicators take the `span` props (upstream generic `<E>` + `Omit<JSX.IntrinsicElements[E], …>`: TS2590 at JSX sites, see
//   `surface.tsx`).
// - Live `variant` / `class` → render-prop function (the composed class is a local: it reaches cdk `MenuItem` as a plain value).
import { MenuItem as MenuItemPrimitive } from "@rivetjs/cdk/menu";
import type { MenuItemProps as MenuItemPrimitiveProps, MenuItemRenderProps } from "@rivetjs/cdk/menu";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { Check, ChevronRight, Circle } from "lucide";

import type { MenuItemVariants } from "../../../styles/src/components/menu-item/index.ts";
import { menuItemVariants } from "../../../styles/src/components/menu-item/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive, renderChildren } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Menu Item Context
 * -----------------------------------------------------------------------------------------------*/
interface MenuItemContext {
  /** Rivet: the item variant (upstream: `slots`). */
  variant?: MenuItemVariants["variant"];
  state?: MenuItemRenderProps;
}

const MenuItemContext = createContext<MenuItemContext>({});

type MenuItemSlots = ReturnType<typeof menuItemVariants>;
const SLOTS: Record<string, MenuItemSlots> = {};
const slotsFor = (variant: MenuItemVariants["variant"]): MenuItemSlots => (SLOTS[variant ?? "default"] ??= menuItemVariants({ variant }));
/** Upstream `use(MenuItemContext).slots`: `undefined` outside a menu item. */
const slotsOf = (context: MenuItemContext): MenuItemSlots | undefined => (context.state ? slotsFor(context.variant) : undefined);

/* -------------------------------------------------------------------------------------------------
 * Menu Item Root
 * -----------------------------------------------------------------------------------------------*/
interface MenuItemRootProps<T = object> extends MenuItemPrimitiveProps<T>, MenuItemVariants {}

const MenuItemRoot = <T extends object = object>(props: MenuItemRootProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as MenuItemRootProps, ["children", "class", "variant"]);
  const classOf = () => composeTwRenderProps(local.class as never, slotsFor(local.variant).item()) as string | ((v: MenuItemRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: MenuItemRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <MenuItemPrimitive class={cls as never} data-slot="menu-item" {...(rest as MenuItemPrimitiveProps)}>
      {(values: MenuItemRenderProps) => {
        const context = {
          get variant() {
            return local.variant;
          },
          state: values,
        };
        return (
          <Provider token={MenuItemContext} value={context}>
            {renderChildren(local.children, values)}
          </Provider>
        );
      }}
    </MenuItemPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Menu Item Indicator
 * -----------------------------------------------------------------------------------------------*/
interface MenuItemIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content | ((props: MenuItemRenderProps) => Content);
  class?: string;
  type?: "checkmark" | "dot";
}

/** `MenuItemIndicator` props (`span`). */
type MenuItemIndicatorSpanProps = MenuItemIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof MenuItemIndicatorProps>;

const MenuItemIndicator = (props: MenuItemIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "type"]);
  const context = useContext(MenuItemContext);
  const isSelected = (): boolean => context.state?.isSelected() ?? false;
  const type = () => local.type ?? "checkmark";

  const content = () =>
    typeof local.children === "function" && !isSlot(local.children) ? (
      (local.children as (v: MenuItemRenderProps) => Content)(context.state ?? ({} as MenuItemRenderProps))
    ) : local.children ? (
      (local.children as Content)
    ) : type() === "dot" ? (
      <Icon icon={Circle} data-slot="menu-item-indicator--dot" role="presentation" fill="currentColor" stroke="none" />
    ) : (
      <Icon icon={Check} data-slot="menu-item-indicator--checkmark" role="presentation" stroke-dasharray={24} stroke-dashoffset={isSelected() ? 48 : 72} />
    );

  return (
    <dom.span
      aria-hidden="true"
      class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
      data-slot="menu-item-indicator"
      data-type={type()}
      data-visible={isSelected() || undefined}
      {...rest}
    >
      {content()}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Menu Item Submenu Indicator
 * -----------------------------------------------------------------------------------------------*/
interface MenuItemSubmenuIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `MenuItemSubmenuIndicator` props (`span`). */
type MenuItemSubmenuIndicatorSpanProps = MenuItemSubmenuIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof MenuItemSubmenuIndicatorProps>;

const MenuItemSubmenuIndicator = (props: MenuItemSubmenuIndicatorSpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(MenuItemContext);

  if (!context.state?.hasSubmenu) {
    return null as unknown as JSX.Element;
  }

  return (
    <dom.span aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.submenuIndicator, local.class)} data-slot="submenu-indicator" {...rest}>
      {local.children ?? <Icon icon={ChevronRight} />}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { MenuItemRoot, MenuItemIndicator, MenuItemSubmenuIndicator };

export type { MenuItemRootProps, MenuItemIndicatorProps, MenuItemIndicatorSpanProps, MenuItemSubmenuIndicatorProps, MenuItemSubmenuIndicatorSpanProps };
