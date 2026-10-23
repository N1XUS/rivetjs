// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no navbar). Feature set (parts, props, defaults, data attributes,
// CSS variables) inspired by HeroUI Pro's public Navbar docs; independent implementation.
// - Root = `nav` landmark in a `NavbarContext` provider (`{ state, size }`: `./navbar-state.ts` state).
//   Everything is server markup + delegated handlers: no client effect, so a resumed page boots no runtime at load.
// - Hide on scroll: CSS scroll-state container query (zero JS). JS fallback (`parentRef`, browsers without scroll-state
//   queries) = a capture `scroll` listener on the document, `when` / `preload` `"interaction"` (attached on the first
//   pointerdown / keydown after resume, never at load); it writes `data-hide-mode="js"` + `data-hidden`.
// - Mobile menu: server-rendered `div` shown by `data-open` (CSS display + `@starting-style`); the toggle is a plain
//   `button` (`aria-expanded` / `aria-controls`, `data-selected`; default icon = the morph burger, CSS bars keyed on its `data-open`); Escape on
//   the root closes it; a pressed `Navbar.MenuItem` closes it; `shouldBlockScroll` = CSS `html:has(…)` overflow lock.
// - Items: cdk `Link` (`href`) or cdk `Button`; `isCurrent` → `aria-current="page"` + `data-current="true"`;
//   `forceReload` → `data-rivet-reload` + the native router; external http(s) → new tab; `navigate` → cdk `RouterContext`.
// - `preload="visible"` on the root + toggle: their handler chunks prefetch once the bar is in view, so the first press is
//   not a network round trip (slow networks).
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps } from "@rivetjs/cdk/button";
import { controlledValue } from "@rivetjs/cdk/interactions";
import { createId } from "@rivetjs/cdk/id";
import { Link as LinkPrimitive } from "@rivetjs/cdk/link";
import type { LinkProps as LinkPrimitiveProps } from "@rivetjs/cdk/link";
import { RouterContext, createRouter } from "@rivetjs/cdk/links";
import type { Href, RouterOptions } from "@rivetjs/cdk/links";
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { Provider, clientEvent, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { NavbarVariants } from "../../../styles/src/components/navbar/index.ts";
import { navbarVariants } from "../../../styles/src/components/navbar/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";
import { Separator } from "../separator/index.ts";
import type { SeparatorRootProps } from "../separator/index.ts";

import { createNavbarState, navbarScrolled, setNavbarMenuOpen, toggleNavbarMenu } from "./navbar-state.ts";
import type { NavbarOptions, NavbarState } from "./navbar-state.ts";

type NavbarSize = NonNullable<NavbarVariants["size"]>;

/* -------------------------------------------------------------------------------------------------
 * Navbar Context
 * -----------------------------------------------------------------------------------------------*/
type NavbarContext = {
  /** `undefined` outside a `Navbar` (parts get only their `class`). */
  state?: NavbarState;
  size?: NavbarSize;
  maxWidth?: NavbarVariants["maxWidth"];
  position?: NavbarVariants["position"];
  navigate?: (path: Href, options: RouterOptions) => void;
};

const NavbarContext = createContext<NavbarContext>({});

type NavbarSlots = ReturnType<typeof navbarVariants>;
const SLOTS = new Map<string, NavbarSlots>();
const variantSlots = (v: { size?: NavbarSize; maxWidth?: NavbarVariants["maxWidth"]; position?: NavbarVariants["position"] }): NavbarSlots => {
  const key = `${v.size}|${v.maxWidth}|${v.position}`;
  let slots = SLOTS.get(key);
  if (!slots) SLOTS.set(key, (slots = navbarVariants(v)));
  return slots;
};
const slotsOf = (context: NavbarContext): NavbarSlots | undefined =>
  context.state ? variantSlots({ size: context.size, maxWidth: context.maxWidth, position: context.position }) : undefined;

const NATIVE_ROUTER = { isNative: true };
const EXTERNAL_HREF = /^https?:\/\//i;

/* -------------------------------------------------------------------------------------------------
 * useNavbar
 * -----------------------------------------------------------------------------------------------*/
export interface UseNavbarReturn {
  /** The bar height (`height` prop). */
  readonly height: string;
  /** Hidden by hide-on-scroll (JS fallback only; the CSS scroll-state path is not observable: `false`). */
  readonly isHidden: () => boolean;
  readonly isMenuOpen: () => boolean;
  setMenuOpen(open: boolean): void;
  /** The root's `navigate` (client routing), if any. */
  readonly navigate: ((path: Href, options: RouterOptions) => void) | undefined;
}

/** The nearest `Navbar`'s state (accessors + methods; resumable object-literal functions). */
export function useNavbar(): UseNavbarReturn {
  const context = useContext(NavbarContext);
  const state = context.state;
  if (!state) throw new Error("useNavbar must be used within a Navbar");
  return {
    height: state.height,
    isHidden: () => !!state.hidden(),
    isMenuOpen: () => state.menu.value(),
    setMenuOpen: (open: boolean) => setNavbarMenuOpen(state, open),
    navigate: context.navigate,
  };
}

/* -------------------------------------------------------------------------------------------------
 * Navbar Root
 * -----------------------------------------------------------------------------------------------*/
interface NavbarRootProps extends NavbarOptions, Omit<JSX.IntrinsicElements["nav"], "children" | "class"> {
  children?: Content;
  class?: string;
  /** @default "sticky" */
  position?: NavbarVariants["position"];
  /** @default "md" */
  size?: NavbarSize;
  /** Max width of the header content. @default "lg" */
  maxWidth?: NavbarVariants["maxWidth"];
  /** Client-side routing for every item link (cdk `RouterProvider`). */
  navigate?: (path: Href, options: RouterOptions) => void;
  /** Maps router hrefs to DOM hrefs (with `navigate`). */
  useHref?: (href: Href) => string;
}

const STATE_KEYS = ["hideOnScroll", "parentRef", "isMenuOpen", "defaultMenuOpen", "onMenuOpenChange", "shouldBlockScroll", "height"] as const;

const NavbarRoot = (props: NavbarRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "position", "size", "maxWidth", "navigate", "useHref", "style", ...STATE_KEYS]);
  const state = createNavbarState(local, createId());
  const position = local.position ?? "sticky";
  const size = local.size ?? "md";
  const maxWidth = local.maxWidth ?? "lg";
  const navigate = local.navigate;
  const value: NavbarContext = { state, size, maxWidth, position, navigate };
  const router = navigate ? createRouter(navigate, local.useHref) : undefined;
  const navRef = createRef<HTMLElement>();
  // Hide-on-scroll JS path: attached when the runtime starts (first interaction), never at load; until then (and on a page
  // nobody touched) the CSS scroll-state query hides the bar. Once active it owns `data-hidden` (`data-hide-mode="js"`).
  if (state.hideOnScroll)
    clientEvent(document, "scroll", (event: Event) => navbarScrolled(state, navRef() ?? null, event), {
      capture: true,
      when: "interaction",
      preload: "interaction",
    });
  const style = local.style;
  const children = local.children;
  const content = () => (
    <nav
      ref={navRef}
      class={variantSlots({ position, size, maxWidth }).base({ class: local.class })}
      data-slot="navbar"
      data-position={position}
      preload="visible"
      data-hide-on-scroll={state.hideOnScroll ? "true" : undefined}
      data-hide-mode={() => (state.hidden() === null ? undefined : "js")}
      data-hidden={() => (state.hidden() ? "true" : undefined)}
      data-menu-open={() => (state.menu.value() ? "true" : undefined)}
      data-block-scroll={state.shouldBlockScroll ? "true" : undefined}
      style={{ "--navbar-height": state.height, ...(typeof style === "object" && style ? style : {}) } as never}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === "Escape" && untrack(() => controlledValue(state.menu))) {
          setNavbarMenuOpen(state, false);
          (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-slot="navbar-menu-toggle"]')?.focus();
        }
      }}
      {...rest}
    >
      {router ? (
        <Provider token={RouterContext} value={router}>
          {children}
        </Provider>
      ) : (
        children
      )}
    </nav>
  );

  return (
    <Provider token={NavbarContext} value={value}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Header / Brand / Content / Spacer / Label
 * -----------------------------------------------------------------------------------------------*/
interface NavbarPartProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** Part props for the default element (`div`). */
type NavbarPartDivProps = NavbarPartProps & Omit<JSX.IntrinsicElements["div"], keyof NavbarPartProps>;
type NavbarBrandProps<E extends keyof JSX.IntrinsicElements = "div"> = NavbarPartProps<E>;
type NavbarContentProps<E extends keyof JSX.IntrinsicElements = "div"> = NavbarPartProps<E>;
type NavbarSpacerProps<E extends keyof JSX.IntrinsicElements = "div"> = NavbarPartProps<E>;
type NavbarMenuProps<E extends keyof JSX.IntrinsicElements = "div"> = NavbarPartProps<E>;
type NavbarHeaderProps = { children?: Content; class?: string } & Omit<JSX.IntrinsicElements["header"], "children" | "class">;
type NavbarLabelProps = { children?: Content; class?: string } & Omit<JSX.IntrinsicElements["span"], "children" | "class">;

const NavbarHeader = (props: NavbarHeaderProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(NavbarContext);
  return (
    <header class={composeSlotClassName(slotsOf(context)?.header, local.class)} data-slot="navbar-header" {...rest}>
      {local.children}
    </header>
  );
};

const NavbarBrand = <E extends keyof JSX.IntrinsicElements = "div">(props: NavbarBrandProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as NavbarPartDivProps, ["children", "class"]);
  const context = useContext(NavbarContext);
  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.brand, local.class)} data-slot="navbar-brand" {...rest}>
      {local.children}
    </dom.div>
  );
};

const NavbarContent = <E extends keyof JSX.IntrinsicElements = "div">(props: NavbarContentProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as NavbarPartDivProps, ["children", "class"]);
  const context = useContext(NavbarContext);
  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.content, local.class)} data-slot="navbar-content" {...rest}>
      {local.children}
    </dom.div>
  );
};

const NavbarSpacer = <E extends keyof JSX.IntrinsicElements = "div">(props: NavbarSpacerProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as NavbarPartDivProps, ["children", "class"]);
  const context = useContext(NavbarContext);
  return (
    <dom.div aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.spacer, local.class)} data-slot="navbar-spacer" {...rest}>
      {local.children}
    </dom.div>
  );
};

const NavbarLabel = (props: NavbarLabelProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(NavbarContext);
  return (
    <span class={composeSlotClassName(slotsOf(context)?.label, local.class)} data-slot="navbar-label" {...rest}>
      {local.children}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Separator
 * -----------------------------------------------------------------------------------------------*/
type NavbarSeparatorProps = Omit<SeparatorRootProps, "orientation">;

const NavbarSeparator = (props: NavbarSeparatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(NavbarContext);
  return <Separator class={composeSlotClassName(slotsOf(context)?.separator, local.class as string | undefined)} orientation="vertical" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Item / MenuItem
 * -----------------------------------------------------------------------------------------------*/
interface NavbarItemExtras {
  /** Marks the current page (`aria-current="page"`, `data-current="true"`); a value or an accessor. @default false */
  isCurrent?: boolean | (() => boolean);
  /** With `href`: a full document load instead of client routing (`data-rivet-reload`, native router). @default false */
  forceReload?: boolean;
  class?: string;
  children?: Content;
}

type NavbarItemProps = NavbarItemExtras &
  ((Omit<ButtonPrimitiveProps, "class" | "children"> & { href?: undefined }) | (Omit<LinkPrimitiveProps, "class" | "children"> & { href: string }));
type NavbarMenuItemProps = NavbarItemProps;

/** Shared body of `Navbar.Item` / `Navbar.MenuItem` (`menu`: closes the menu on press). */
function NavbarAction(props: NavbarItemProps & { part: "item" | "menuItem"; slot: string }) {
  const [local, rest] = splitLive(
    props as NavbarItemExtras & { part: "item" | "menuItem"; slot: string; href?: string; onPress?: (e: unknown) => void; target?: string; rel?: string },
    ["isCurrent", "forceReload", "class", "children", "part", "slot", "onPress"],
  );
  const context = useContext(NavbarContext);
  const state = context.state;
  const isMenu = local.part === "menuItem";
  const userPress = local.onPress;
  const onPress = (event: unknown) => {
    userPress?.(event);
    if (isMenu && state) setNavbarMenuOpen(state, false);
  };
  const isCurrent = local.isCurrent;
  // In the body (not a helper): the accessors close over component locals, so they resume.
  const current = typeof isCurrent === "function" ? () => (isCurrent() ? "page" : undefined) : isCurrent ? "page" : undefined;
  const dataCurrent = typeof isCurrent === "function" ? () => (isCurrent() ? "true" : undefined) : isCurrent ? "true" : undefined;
  const cls = composeSlotClassName(slotsOf(context)?.[local.part], local.class) ?? "";
  const href = rest.href;
  const external = typeof href === "string" && EXTERNAL_HREF.test(href) && rest.target === undefined;
  const linkExtras = {
    ...(external ? { target: "_blank", rel: rest.rel ?? "noopener noreferrer" } : {}),
    ...(local.forceReload ? { "data-rivet-reload": "" } : {}),
  };
  const slot = local.slot;
  const children = local.children;
  if (href === undefined)
    return (
      <ButtonPrimitive {...(rest as ButtonPrimitiveProps)} class={cls} data-slot={slot} data-current={dataCurrent as never} onPress={onPress}>
        {children}
      </ButtonPrimitive>
    );
  const link = () => (
    <LinkPrimitive
      {...(rest as LinkPrimitiveProps)}
      {...linkExtras}
      aria-current={current as never}
      class={cls}
      data-slot={slot}
      data-current={dataCurrent as never}
      onPress={onPress}
    >
      {children}
    </LinkPrimitive>
  );
  return local.forceReload ? (
    <Provider token={RouterContext} value={NATIVE_ROUTER}>
      {link()}
    </Provider>
  ) : (
    link()
  );
}

const NavbarItem = (props: NavbarItemProps): JSX.Element => <NavbarAction {...props} part="item" slot="navbar-item" />;

/** A mobile-menu link / button; pressing it closes the menu. */
const NavbarMenuItem = (props: NavbarMenuItemProps): JSX.Element => <NavbarAction {...props} part="menuItem" slot="navbar-menu-item" />;

/* -------------------------------------------------------------------------------------------------
 * MenuToggle / Menu
 * -----------------------------------------------------------------------------------------------*/
type NavbarMenuToggleProps = {
  /** Accessible label. @default "Toggle navigation menu" */
  srLabel?: string;
  /** Replaces the default morph burger (CSS bars, `morph-icon.css`: Menu → X). Your own children keep their own look, e.g. lucide
   * `Menu` / `X` swapped by the toggle's `aria-expanded`. */
  children?: Content;
  class?: string;
} & Omit<JSX.IntrinsicElements["button"], "children" | "class">;

const NavbarMenuToggle = (props: NavbarMenuToggleProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "srLabel"]);
  const context = useContext(NavbarContext);
  const state = context.state;
  const children = local.children;
  return (
    <button
      type="button"
      aria-label={local.srLabel ?? "Toggle navigation menu"}
      aria-controls={state?.menuId}
      aria-expanded={() => (state?.menu.value() ? "true" : "false")}
      class={composeSlotClassName(slotsOf(context)?.menuToggle, local.class)}
      data-slot="navbar-menu-toggle"
      preload="visible"
      data-selected={() => (state?.menu.value() ? "true" : undefined)}
      onClick={() => {
        if (state) toggleNavbarMenu(state);
      }}
      {...rest}
    >
      {children ?? (
        // Default = morph burger (CSS bars, `morph-icon.css`, TW-149): lucide Menu at rest, slides + rotates into lucide X.
        <span aria-hidden="true" class="morph-burger" data-open={state?.menu.value() ? "true" : undefined} data-slot="navbar-menu-toggle-icon">
          <span />
        </span>
      )}
    </button>
  );
};

const NavbarMenu = <E extends keyof JSX.IntrinsicElements = "div">(props: NavbarMenuProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as NavbarPartDivProps, ["children", "class"]);
  const context = useContext(NavbarContext);
  const state = context.state;
  return (
    <dom.div
      {...rest}
      // The toggle's `aria-controls` target: the navbar's id wins over a passed `id`.
      id={state?.menuId ?? (rest as { id?: string }).id}
      class={composeSlotClassName(slotsOf(context)?.menu, local.class)}
      data-slot="navbar-menu"
      data-open={() => (state?.menu.value() ? "true" : undefined)}
    >
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  NavbarRoot,
  NavbarHeader,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarLabel,
  NavbarSeparator,
  NavbarSpacer,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
};

export type {
  NavbarRootProps,
  NavbarHeaderProps,
  NavbarBrandProps,
  NavbarContentProps,
  NavbarItemProps,
  NavbarLabelProps,
  NavbarSeparatorProps,
  NavbarSpacerProps,
  NavbarMenuToggleProps,
  NavbarMenuProps,
  NavbarMenuItemProps,
  NavbarPartDivProps,
  NavbarSize,
};
