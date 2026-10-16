// Ported from HeroUI v3.2.6 packages/react/src/components/tabs/tabs.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk` (`tabs` Tabs / TabList / Tab /
//   TabPanel, `selection-indicator`); `@heroui/styles` → vendored `styles/`.
// - `TabsContext` carries plain data `{ orientation, align, variant }` (getters over the root's live props) instead of the tv
//   `slots` object: resumable token `rv-ui-tabs`, slots = module-level memo per `align|variant`; default `{}` → parts outside
//   a `Tabs` get only the caller's `class` (= upstream `slots?.x`).
// - `createCollectionSlot("tabs.listContainer")` → a resumable context `rv-ui-tabs-list-container` (Rivet children are lazy
//   slots rendered inside the provider, so no `cloneElement` channel is needed); `Tabs.List` reads it like `useSlot`. The
//   children render synchronously inside the provider (`renderSlot`): the cdk Tabs default-selection build pass must see
//   the tabs (a slot left for the server serializer registers nothing).
// - Scroll buttons: upstream's `scrollerRef` → the scroller is the button's container's first element child (no ref, so
//   nothing binds at load on a resumed page); inline `IconChevron*` svgs → lucide `ChevronLeft` / `ChevronRight` /
//   `ChevronUp` / `ChevronDown` (16px) via `@rivetjs/kit/icon`.
// - Live `class` / `align` / `variant` → a render-prop function for the cdk part (the composed class is a local: it reaches the cdk part as a plain value); static ones
//   stay strings. `orientation` is read once here (Tabs.List builds its scroll buttons / ScrollShadow axis at mount; the cdk
//   `Tabs` itself takes a live one).
// - Panels: the content of an unselected `Tabs.Panel` is created in the browser on a resumed page — pass a render function
//   (`{() => …}`) there (cdk rule), plain JSX for panels the server renders.
// - `TabsRootProps` omits the cdk `items` / `tab` / `panel` preset (Rivet extension, renders unstyled cdk parts).
// - Rivet (identity spec §4.2): `Tabs.List` renders the list container (scroller + scroll buttons) itself, as if wrapped in
//   `Tabs.ListContainer` (still exported: its props style the container); `container={false}` keeps the thin cdk TabList.
//   `Tabs.Tab` appends a `Tabs.Indicator` after its children unless one renders inside it (a per-tab flag the explicit
//   indicator sets while the children render, before the automatic one is decided: `TabBody`, no accessor child, which
//   stayed a static branch on resumed pages) or `indicator={false}` is set on the Tab or the root. An explicit indicator that
//   mounts later (`<Show>`, lazy children) sets the flag's `late` signal: the automatic one hides (never two indicators).
import { SelectionIndicator as SelectionIndicatorPrimitive, SelectionIndicatorContext } from "@rivetjs/cdk/selection-indicator";
import type { SelectionIndicatorProps as SelectionIndicatorPrimitiveProps } from "@rivetjs/cdk/selection-indicator";
import { Tab as TabPrimitive, TabList as TabListPrimitive, TabPanel as TabPanelPrimitive, Tabs as TabsPrimitive } from "@rivetjs/cdk/tabs";
import type {
  TabListProps as TabListPrimitiveProps,
  TabListRenderProps,
  TabPanelProps as TabPanelPrimitiveProps,
  TabPanelRenderProps,
  TabProps as TabPrimitiveProps,
  TabRenderProps,
  TabsProps as TabsPrimitiveProps,
  TabsRenderProps,
} from "@rivetjs/cdk/tabs";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, signal, useContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide";

import type { TabsVariants } from "../../../styles/src/components/tabs/index.ts";
import { tabsVariants } from "../../../styles/src/components/tabs/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderFunction, DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { ScrollShadow } from "../scroll-shadow/index.ts";

type Orientation = "horizontal" | "vertical";

/* -------------------------------------------------------------------------------------------------
 * Tabs Context
 * -----------------------------------------------------------------------------------------------*/
type TabsContext = {
  orientation?: Orientation;
  /** Rivet: the root's variants (upstream: `slots`); both `undefined` outside a `Tabs`. */
  align?: TabsVariants["align"];
  variant?: TabsVariants["variant"];
  inTabs?: boolean;
  /** Rivet: the root's `indicator` (`false` turns the automatic tab indicators off). */
  indicator?: boolean;
};

const TabsContext = resumableContext(createContext<TabsContext>({}, { id: "rv-ui-tabs" }));

type TabsSlots = ReturnType<typeof tabsVariants>;
/** Module-level memo per variant combination (upstream `useMemo([align, variant])`): tv slot functions are pure. */
const SLOTS: Record<string, TabsSlots> = {};
const slotsFor = (align: TabsVariants["align"], variant: TabsVariants["variant"]): TabsSlots =>
  (SLOTS[`${align}|${variant}`] ??= tabsVariants({ align, variant }));
/** Upstream `use(TabsContext).slots`: `undefined` outside a `Tabs`. */
const slotsOf = (context: TabsContext): TabsSlots | undefined => (context.inTabs ? slotsFor(context.align, context.variant) : undefined);

/* -------------------------------------------------------------------------------------------------
 * Tabs Collection Slot
 * -----------------------------------------------------------------------------------------------*/
type ListContainerInjectedProps = {
  class?: string;
  render?: DOMRenderFunction<"div", undefined>;
} & Record<string, unknown>;

/** Upstream `createCollectionSlot("tabs.listContainer")`: the `Tabs.ListContainer` props for the `Tabs.List` inside it. */
const ListContainerContext = resumableContext(createContext<ListContainerInjectedProps | null>(null, { id: "rv-ui-tabs-list-container" }));

/* -------------------------------------------------------------------------------------------------
 * Tabs Root
 * -----------------------------------------------------------------------------------------------*/
interface TabsRootProps extends Omit<TabsPrimitiveProps, "items" | "tab" | "panel">, TabsVariants {
  /** Rivet: `false` turns off the indicator every `Tabs.Tab` appends. @default true */
  indicator?: boolean;
}

const TabsRoot = (props: TabsRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["align", "children", "class", "indicator", "orientation", "variant"]);
  const orientation: Orientation = local.orientation ?? "horizontal";
  const contextValue: TabsContext = {
    orientation,
    inTabs: true,
    get align() {
      return local.align;
    },
    get variant() {
      return local.variant;
    },
    get indicator() {
      return local.indicator;
    },
  };
  const classOf = () => composeTwRenderProps(local.class as never, slotsFor(local.align, local.variant).base()) as string | ((v: TabsRenderProps) => string);
  const cls = hasLiveProp(local, ["align", "class", "variant"]) ? (values: TabsRenderProps) => renderClass(classOf(), values) : classOf();
  // A function: Rivet JSX builds nodes eagerly, the tabs must be created inside the provider.
  const content = () => (
    <TabsPrimitive {...rest} class={cls as never} data-slot="tabs" orientation={orientation}>
      {local.children as never}
    </TabsPrimitive>
  );

  return (
    <Provider token={TabsContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tabs List Container
 * -----------------------------------------------------------------------------------------------*/
interface TabListContainerProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `TabListContainer` props for the default element (`div`). */
type TabListContainerDivProps = TabListContainerProps & Omit<JSX.IntrinsicElements["div"], keyof TabListContainerProps>;

const TabListContainer = <E extends keyof JSX.IntrinsicElements = "div">(props: TabListContainerProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as TabListContainerDivProps, ["children"]);

  return (
    <Provider token={ListContainerContext} value={rest as ListContainerInjectedProps}>
      {renderSlot(local.children) as never}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tabs List
 * -----------------------------------------------------------------------------------------------*/
interface TabListProps<T = object> extends TabListPrimitiveProps<T> {
  class?: string | ((values: TabListRenderProps) => string);
  /** Rivet: render the list container (scroller + scroll buttons) around the list; read once. @default true */
  container?: boolean;
}

const NO_CONTAINER_PROPS: ListContainerInjectedProps = {};

const TabList = <T extends object>(props: TabListProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "container"]);
  const context = useContext(TabsContext);
  // Rivet: the container is on by default (upstream: only inside `Tabs.ListContainer`).
  const listContainer = useContext(ListContainerContext) ?? (local.container === false ? null : NO_CONTAINER_PROPS);
  const isVertical = context.orientation === "vertical";
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.tabList()) as string | ((v: TabListRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: TabListRenderProps) => renderClass(classOf(), values) : classOf();

  // `container={false}`: a thin cdk TabList
  if (!listContainer) {
    return (
      <TabListPrimitive {...(rest as {})} class={cls as never} data-slot="tabs-list">
        {local.children as never}
      </TabListPrimitive>
    );
  }

  const { class: containerClass, render: containerRender, ...containerRest } = listContainer;
  const slots = slotsOf(context);
  const scrollerClass = composeSlotClassName(slots?.scroller);
  const prevClass = composeSlotClassName(slots?.scrollPrev);
  const nextClass = composeSlotClassName(slots?.scrollNext);
  const containerCls = composeSlotClassName(slots?.tabListContainer, containerClass);
  const scrollBy = (button: HTMLElement, direction: 1 | -1) => {
    // Rivet: the scroller is the container's first element child (upstream: `scrollerRef`).
    const el = button.parentElement?.firstElementChild as HTMLElement | null | undefined;

    if (!el) return;
    const size = isVertical ? el.clientHeight : el.clientWidth;
    const scrollSize = isVertical ? el.scrollHeight : el.scrollWidth;
    const maxScroll = Math.max(0, scrollSize - size);

    // In RTL, the horizontal scroll range runs from 0 (start, on the right) to negative,
    // so the delta sign must be flipped for `scrollLeft` to move toward the intended edge.
    const isRTL = !isVertical && getComputedStyle(el).direction === "rtl";
    const delta = direction * size * 0.8 * (isRTL ? -1 : 1);
    const current = isVertical ? el.scrollTop : el.scrollLeft;

    // Clamp the target to the scrollable range so a press near the edge lands
    // flush on it instead of requesting a position past the content, which can
    // cut the smooth scroll short of the edge (e.g. iOS Safari) or leave the
    // strip visually stranded. RTL ranges run [-maxScroll, 0].
    const next = Math.min(isRTL ? 0 : maxScroll, Math.max(isRTL ? -maxScroll : 0, current + delta));

    if (next === current) return;

    el.scrollTo({
      behavior: "smooth",
      [isVertical ? "top" : "left"]: next,
    });
  };

  return (
    <TabListPrimitive
      {...(rest as {})}
      class={cls as never}
      data-slot="tabs-list"
      render={(listProps: Record<string, any>) => (
        <dom.div class={containerCls} data-slot="tabs-list-container" render={containerRender as never} {...(containerRest as {})}>
          <ScrollShadow hideScrollBar class={scrollerClass} orientation={isVertical ? "vertical" : "horizontal"} size={64}>
            <div {...listProps} />
          </ScrollShadow>

          <button
            aria-label={isVertical ? "Scroll tabs up" : "Scroll tabs left"}
            class={prevClass}
            tabIndex={-1}
            type="button"
            onClick={(event: MouseEvent) => scrollBy(event.currentTarget as HTMLElement, -1)}
          >
            {isVertical ? <Icon icon={ChevronUp} size={16} /> : <Icon icon={ChevronLeft} size={16} />}
          </button>

          <button
            aria-label={isVertical ? "Scroll tabs down" : "Scroll tabs right"}
            class={nextClass}
            tabIndex={-1}
            type="button"
            onClick={(event: MouseEvent) => scrollBy(event.currentTarget as HTMLElement, 1)}
          >
            {isVertical ? <Icon icon={ChevronDown} size={16} /> : <Icon icon={ChevronRight} size={16} />}
          </button>
        </dom.div>
      )}
    >
      {local.children as never}
    </TabListPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tab
 * -----------------------------------------------------------------------------------------------*/
interface TabProps extends TabPrimitiveProps {
  class?: string | ((values: TabRenderProps) => string);
  /** Rivet: append a `Tabs.Indicator` (skipped when one renders inside the tab); read once. @default the root's, else true */
  indicator?: boolean;
}

/** Rivet: per-tab flag an explicit `Tabs.Indicator` sets while the tab's children render (no automatic one then); `late` is
 *  set by one that mounts after the automatic one was created (lazy children: `<Show>`, render function), which hides it. */
type IndicatorFlag = { explicit: boolean; late: Signal<boolean> | null };
// Resumable: an explicit indicator a resumed page mounts later (`<Show>`) reads the same flag (its `late` signal hides the automatic one).
const IndicatorFlagContext = resumableContext(createContext<IndicatorFlag | null>(null, { id: "rv-ui-tabs-indicator-flag" }));

const Tab = (props: TabProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "indicator"]);
  const context = useContext(TabsContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.tab()) as string | ((v: TabRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: TabRenderProps) => renderClass(classOf(), values) : classOf();
  const auto = (local.indicator ?? context.indicator) !== false;
  const children = local.children;
  if (!auto) {
    return (
      <TabPrimitive {...(rest as {})} class={cls as never} data-slot="tabs-tab">
        {children as never}
      </TabPrimitive>
    );
  }
  const flag: IndicatorFlag = { explicit: false, late: null };
  // A user render function stays one (called with the cdk Tab's render props); plain children render in the flag provider.
  const body =
    typeof children === "function" && !isSlot(children)
      ? (values: TabRenderProps) => {
          flag.explicit = false;
          return (
            <Provider token={IndicatorFlagContext} value={flag}>
              <TabBody children={children} values={values} />
            </Provider>
          );
        }
      : null;
  if (body) {
    return (
      <TabPrimitive {...(rest as {})} class={cls as never} data-slot="tabs-tab">
        {body as never}
      </TabPrimitive>
    );
  }

  return (
    <TabPrimitive {...(rest as {})} class={cls as never} data-slot="tabs-tab">
      <Provider token={IndicatorFlagContext} value={flag}>
        <TabBody children={children} />
      </Provider>
    </TabPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tab Indicator
 * -----------------------------------------------------------------------------------------------*/
interface TabIndicatorProps extends SelectionIndicatorPrimitiveProps {
  class?: string;
}

const TabIndicator = (props: TabIndicatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(TabsContext);
  const flag = useContext(IndicatorFlagContext);
  if (flag) {
    flag.explicit = true;
    flag.late?.set(true);
  }

  return <SelectionIndicatorPrimitive class={composeSlotClassName(slotsOf(context)?.tabIndicator, local.class)} data-slot="tabs-indicator" {...(rest as {})} />;
};

/**
 * Rivet: a Tab's children + the indicator it appends. The children render first (here, in the flag provider), so an
 * explicit `Tabs.Indicator` among them has set the flag before the automatic one is decided; both are plain values in the
 * output, not an accessor child (an accessor's output stays a static server branch on a resumed page: its SharedElement
 * never followed the selection, 2026-10-12 showcase-settings bug).
 */
const TabBody = (props: { children: unknown; values?: TabRenderProps }): JSX.Element => {
  const context = useContext(TabsContext);
  const flag = useContext(IndicatorFlagContext)!;
  const content = renderSlot(props.children as Content | ((v?: TabRenderProps) => Content), props.values) as Content;
  let auto: JSX.Element | null = null;
  if (!flag.explicit) {
    // Visible while selected and no explicit indicator mounted later (one Tabs.Indicator per tab, never two).
    const late = (flag.late = signal(false));
    const selected = useContext(SelectionIndicatorContext).isSelected;
    const isSelected = () => !late() && (typeof selected === "function" ? selected() : !!selected);
    auto = <SelectionIndicatorPrimitive class={slotsOf(context)?.tabIndicator()} data-slot="tabs-indicator" isSelected={isSelected} />;
  }
  return (
    <>
      {content}
      {auto}
    </>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tab Panel
 * -----------------------------------------------------------------------------------------------*/
interface TabPanelProps extends TabPanelPrimitiveProps {
  class?: string | ((values: TabPanelRenderProps) => string);
}

const TabPanel = (props: TabPanelProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(TabsContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.tabPanel()) as string | ((v: TabPanelRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: TabPanelRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <TabPanelPrimitive {...(rest as {})} class={cls as never} data-slot="tabs-panel">
      {local.children as never}
    </TabPanelPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Tab Separator
 * -----------------------------------------------------------------------------------------------*/
interface TabSeparatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  class?: string;
}

/** `TabSeparator` props for the default element (`span`). */
type TabSeparatorSpanProps = TabSeparatorProps & Omit<JSX.IntrinsicElements["span"], keyof TabSeparatorProps>;

const TabSeparator = <E extends keyof JSX.IntrinsicElements = "span">(props: TabSeparatorProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as TabSeparatorSpanProps, ["class"]);
  const context = useContext(TabsContext);

  return <dom.span aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.separator, local.class)} data-slot="tabs-separator" {...(rest as {})} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { TabsRoot, TabListContainer, TabList, Tab, TabIndicator, TabPanel, TabSeparator };

export type {
  TabsRootProps,
  TabListContainerProps,
  TabListContainerDivProps,
  TabListProps,
  TabProps,
  TabIndicatorProps,
  TabPanelProps,
  TabSeparatorProps,
  TabSeparatorSpanProps,
};
