// Ported from HeroUI v3.2.6 packages/react/src/components/accordion/accordion.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk` (`disclosure` DisclosureGroup /
//   Disclosure / DisclosurePanel / DisclosureStateContext, `button`, `heading`); `@heroui/styles` → vendored `styles/`.
// - `AccordionContext` carries plain data `{ variant, hideSeparator }` (getters over the root's live props) instead of the tv
//   `slots` object: resumable token `rv-ui-accordion`, slots = module-level memo per variant; default `{}` → parts outside an
//   `Accordion` get only the caller's `class` (= upstream `slots?.x`).
// - `SurfaceContext` is always provided: `{ variant: "default" }` for `variant="surface"`, else the outer surface's variant
//   (= upstream's no-provider read).
// - Root / Trigger function children: the cdk parts take render-function children themselves (upstream wraps them).
// - `data-expanded` on Panel / Indicator: an accessor over `DisclosureStateContext.isExpanded()` (signal state).
// - `Accordion.Indicator`: upstream's inline `IconChevronDown` svg → lucide `ChevronDown` (16px) via `@rivetjs/kit/icon`.
//   Custom children are not cloned (Rivet JSX has no element clone): they render inside a `span` carrying the indicator
//   class, `data-slot` and `data-expanded`.
// - Live `class` / `variant` → a render-prop function for the cdk part (the composed class is a local: it reaches the cdk part as a plain value); static ones stay strings.
import { Button } from "@rivetjs/cdk/button";
import type { ButtonProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { Disclosure, DisclosureGroup, DisclosurePanel, DisclosureStateContext } from "@rivetjs/cdk/disclosure";
import type {
  DisclosureGroupProps,
  DisclosureGroupRenderProps,
  DisclosurePanelProps,
  DisclosurePanelRenderProps,
  DisclosureProps,
  DisclosureRenderProps,
} from "@rivetjs/cdk/disclosure";
import { Heading as DisclosureHeading } from "@rivetjs/cdk/heading";
import type { HeadingProps as DisclosureHeadingProps } from "@rivetjs/cdk/heading";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { ChevronDown } from "lucide";

import type { AccordionVariants } from "../../../styles/src/components/accordion/index.ts";
import { accordionVariants } from "../../../styles/src/components/accordion/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { SurfaceContext } from "../surface/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { nativeAttrs, nativeProps } from "../../utils/native.ts";
import { createId } from "@rivetjs/runtime/id";

type AccordionVariant = NonNullable<AccordionVariants["variant"]> | "__none";

type AccordionContext = {
  /** Rivet: the root's variant (upstream: `slots`); `undefined` outside an `Accordion`. */
  variant?: AccordionVariant;
  hideSeparator?: boolean;
  /** State-space path (ZERO STATESPACE): the items are `<details>`; the browser owns which are open. */
  native?: NativeAccordion;
};

/**
 * A native (zero-JS) accordion: exclusive items share `name`. Every item starts closed: an `open` attribute would be a
 * binding an ancestor's adopt run rewrites over the browser's state (the user's toggles), so default expansion keeps
 * today's path (`defaultExpandedKeys` / `defaultExpanded` are not native props).
 */
interface NativeAccordion {
  name?: string;
  disabled: boolean;
}

/** A native item's ids (its trigger labels the panel) and disabled flag, for its heading / trigger / panel. */
interface NativeItem {
  id: string;
  disabled: boolean;
}

const NativeItemContext = createContext<NativeItem | null>(null);

/*
 * State-space path (ZERO STATESPACE). An accordion's states (which items are open; hover / focus-visible) are native:
 * `<details>` items (exclusive ones share `name`), `<summary>` holding the heading, `[open]` / `:hover` /
 * `:focus-visible` in `styles/components/accordion.css` (`[data-native]` rules). Browsers expose the summary as an
 * expandable control (expanded state), toggle it with Enter / Space and open a closed item for find-in-page. The build
 * marks the call sites where every part passes declared data props only (`$native`, `../../utils/native.ts`); the parts
 * render static markup: no record, no JavaScript before or after a toggle.
 */
// @rivet-native AccordionRoot(children,class,variant,hideSeparator,allowsMultipleExpanded,isDisabled,id) AccordionItem(children,class,id,isDisabled) AccordionHeading(children,class,level) AccordionTrigger(children,class) AccordionPanel(children,class) AccordionIndicator(children,class) AccordionBody(children,class)
const NATIVE_ROOT = new Set(["children", "class", "variant", "hideSeparator", "allowsMultipleExpanded", "isDisabled", "id"]);

const nativeAccordion = (props: AccordionRootProps): NativeAccordion | null => {
  if (!nativeProps(props, NATIVE_ROOT)) return null;
  const multiple = !!props.allowsMultipleExpanded;
  return { name: multiple ? undefined : props.id != null ? String(props.id) + "-group" : createId(), disabled: !!props.isDisabled };
};

const AccordionContext = createContext<AccordionContext>({});

type AccordionSlots = ReturnType<typeof accordionVariants>;
/** Module-level memo per variant (upstream `useMemo([variant])`): tv slot functions are pure, one slots object per variant. */
const SLOTS: Partial<Record<AccordionVariant, AccordionSlots>> = {};
const slotsFor = (variant: AccordionVariant): AccordionSlots =>
  (SLOTS[variant] ??= accordionVariants({ variant: variant === "__none" ? undefined : (variant as AccordionVariants["variant"]) }));
/** Upstream `use(AccordionContext).slots`: `undefined` outside an `Accordion`. */
const slotsOf = (context: AccordionContext): AccordionSlots | undefined => (context.variant === undefined ? undefined : slotsFor(context.variant));

const DEFAULT_SURFACE_VARIANT = "default" as SurfaceVariants["variant"];

const dataAttr = (condition: boolean | undefined): "true" | undefined => (condition ? "true" : undefined);

/* -------------------------------------------------------------------------------------------------
 * Accordion Root
 * -----------------------------------------------------------------------------------------------*/
interface AccordionRootProps extends DisclosureGroupProps, AccordionVariants {
  hideSeparator?: boolean;
}

const AccordionRoot = (props: AccordionRootProps): JSX.Element => {
  const native = nativeAccordion(props);
  if (native) {
    const variant = (props.variant ?? "__none") as AccordionVariant;
    const outer = useContext(SurfaceContext);
    return (
      <Provider token={AccordionContext} value={{ variant, hideSeparator: props.hideSeparator ?? false, native }}>
        <Provider token={SurfaceContext} value={{ variant: variant === "surface" ? DEFAULT_SURFACE_VARIANT : outer.variant }}>
          <div
            {...nativeAttrs(props)}
            data-slot="accordion"
            id={props.id != null ? String(props.id) : undefined}
            class={composeTwRenderProps(props.class as never, slotsFor(variant).base()) as string}
            data-disabled={native.disabled ? "true" : undefined}
            data-native=""
          >
            {props.children as Content}
          </div>
        </Provider>
      </Provider>
    );
  }
  const [local, rest] = splitLive(props, ["children", "class", "hideSeparator", "variant", "$native" as never]);
  const variant = (): AccordionVariant => (local.variant ?? "__none") as AccordionVariant;
  const outerSurface = useContext(SurfaceContext);
  const contextValue: AccordionContext = {
    get variant() {
      return variant();
    },
    get hideSeparator() {
      return local.hideSeparator ?? false;
    },
  };
  // Allows inner components to apply "on-surface" colors for proper contrast.
  const surfaceContextValue: { variant?: SurfaceVariants["variant"] } = {
    get variant() {
      return variant() === "surface" ? DEFAULT_SURFACE_VARIANT : outerSurface.variant;
    },
  };
  const classOf = () => composeTwRenderProps(local.class as never, slotsFor(variant()).base()) as string | ((v: DisclosureGroupRenderProps) => string);
  const cls = hasLiveProp(local, ["class", "variant"]) ? (values: DisclosureGroupRenderProps) => renderClass(classOf(), values) : classOf();
  // A function: Rivet JSX builds nodes eagerly, the group must be created inside the providers.
  const content = () => (
    <DisclosureGroup class={cls as never} data-slot="accordion" {...rest}>
      {local.children}
    </DisclosureGroup>
  );

  return (
    <Provider token={AccordionContext} value={contextValue}>
      <Provider token={SurfaceContext} value={surfaceContextValue}>
        {content()}
      </Provider>
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AccordionItem
 * -----------------------------------------------------------------------------------------------*/
interface AccordionItemProps extends DisclosureProps {}

const AccordionItem = (props: AccordionItemProps): JSX.Element => {
  const context = useContext(AccordionContext);
  const native = context.native;
  if (native) {
    const id = createId();
    const item: NativeItem = { id, disabled: native.disabled || !!props.isDisabled };
    return (
      <details
        {...nativeAttrs(props)}
        class={composeTwRenderProps(props.class as never, slotsOf(context)?.item()) as string}
        data-hide-separator={context.hideSeparator ? "true" : undefined}
        data-slot="accordion-item"
        id={props.id != null ? String(props.id) : undefined}
        name={native.name}
        data-disabled={item.disabled ? "true" : undefined}
      >
        <Provider token={NativeItemContext} value={item}>
          {props.children as Content}
        </Provider>
      </details>
    );
  }
  const [local, rest] = splitLive(props, ["children", "class"]);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.item()) as string | ((v: DisclosureRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: DisclosureRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <Disclosure
      class={cls as never}
      {...({ "data-hide-separator": () => (context.hideSeparator ? "true" : undefined) } as {})}
      data-slot="accordion-item"
      {...rest}
    >
      {local.children}
    </Disclosure>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AccordionIndicator
 * -----------------------------------------------------------------------------------------------*/
interface AccordionIndicatorProps<E extends keyof JSX.IntrinsicElements = "svg"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `AccordionIndicator` props for the default element (`svg`). */
type AccordionIndicatorSvgProps = AccordionIndicatorProps & Omit<JSX.IntrinsicElements["svg"], keyof AccordionIndicatorProps>;

const AccordionIndicator = <E extends keyof JSX.IntrinsicElements = "svg">(props: AccordionIndicatorProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as AccordionIndicatorSvgProps, ["children", "class"]);
  const context = useContext(AccordionContext);
  if (context.native) {
    // `[open]` rotates it (accordion.css): no `data-expanded`.
    if (local.children)
      return (
        <span {...(rest as {})} class={composeSlotClassName(slotsOf(context)?.indicator, local.class)} data-slot="accordion-indicator">
          {local.children}
        </span>
      );
    return (
      <Icon
        icon={ChevronDown}
        size={16}
        class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
        data-slot="accordion-indicator"
        {...(rest as {})}
      />
    );
  }
  const state = useContext(DisclosureStateContext)!;
  const expanded = () => dataAttr(state.isExpanded());

  if (local.children) {
    return (
      <span {...(rest as {})} data-expanded={expanded()} class={composeSlotClassName(slotsOf(context)?.indicator, local.class)} data-slot="accordion-indicator">
        {local.children}
      </span>
    );
  }

  return (
    <Icon
      icon={ChevronDown}
      size={16}
      class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
      {...({ "data-expanded": expanded } as {})}
      data-slot="accordion-indicator"
      {...(rest as {})}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * AccordionHeading
 * -----------------------------------------------------------------------------------------------*/
interface AccordionHeadingProps extends DisclosureHeadingProps {
  class?: string;
}

const AccordionHeading = (props: AccordionHeadingProps): JSX.Element => {
  const context = useContext(AccordionContext);
  if (context.native) {
    // The item's `<summary>` (first child of its `<details>`) holds the heading: the browser's toggle.
    const item = useContext(NativeItemContext);
    const level = props.level ?? 3;
    const cls = composeSlotClassName(slotsOf(context)?.heading, props.class as string | undefined);
    const children = props.children as Content;
    return (
      <summary class="accordion__summary" data-nc="" tabIndex={item?.disabled ? -1 : undefined} aria-disabled={item?.disabled ? "true" : undefined}>
        {level === 1 ? (
          <h1 class={cls} data-slot="accordion-heading">
            {children}
          </h1>
        ) : level === 2 ? (
          <h2 class={cls} data-slot="accordion-heading">
            {children}
          </h2>
        ) : level === 4 ? (
          <h4 class={cls} data-slot="accordion-heading">
            {children}
          </h4>
        ) : level === 5 ? (
          <h5 class={cls} data-slot="accordion-heading">
            {children}
          </h5>
        ) : level === 6 ? (
          <h6 class={cls} data-slot="accordion-heading">
            {children}
          </h6>
        ) : (
          <h3 class={cls} data-slot="accordion-heading">
            {children}
          </h3>
        )}
      </summary>
    );
  }
  const [local, rest] = splitLive(props, ["class"]);

  return <DisclosureHeading class={composeSlotClassName(slotsOf(context)?.heading, local.class)} data-slot="accordion-heading" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * AccordionTrigger
 * -----------------------------------------------------------------------------------------------*/
interface AccordionTriggerProps extends ButtonProps {}

const AccordionTrigger = (props: AccordionTriggerProps): JSX.Element => {
  const context = useContext(AccordionContext);
  if (context.native) {
    const item = useContext(NativeItemContext);
    return (
      <span
        class={composeTwRenderProps(props.class as never, slotsOf(context)?.trigger()) as string}
        data-slot="accordion-trigger"
        id={item ? item.id + "-trigger" : undefined}
        data-disabled={item?.disabled ? "true" : undefined}
      >
        {props.children as Content}
      </span>
    );
  }
  const [local, rest] = splitLive(props, ["children", "class"]);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.trigger()) as string | ((v: ButtonRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <Button class={cls as never} data-slot="accordion-trigger" slot="trigger" {...rest}>
      {local.children}
    </Button>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AccordionBody
 * -----------------------------------------------------------------------------------------------*/
interface AccordionBodyProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `AccordionBody` props for the default element (`div`). */
type AccordionBodyDivProps = AccordionBodyProps & Omit<JSX.IntrinsicElements["div"], keyof AccordionBodyProps>;

const AccordionBody = <E extends keyof JSX.IntrinsicElements = "div">(props: AccordionBodyProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as AccordionBodyDivProps, ["children", "class"]);
  const context = useContext(AccordionContext);

  return (
    <dom.div class={slotsOf(context)?.body({})} data-slot="accordion-body" {...rest}>
      <div class={composeSlotClassName(slotsOf(context)?.bodyInner, local.class)}>{local.children}</div>
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AccordionPanel
 * -----------------------------------------------------------------------------------------------*/
interface AccordionPanelProps extends DisclosurePanelProps {}

const AccordionPanel = (props: AccordionPanelProps): JSX.Element => {
  const context = useContext(AccordionContext);
  if (context.native) {
    const item = useContext(NativeItemContext);
    return (
      <div
        class={composeTwRenderProps(props.class as never, slotsOf(context)?.panel()) as string}
        data-slot="accordion-panel"
        id={item ? item.id + "-panel" : undefined}
        role="group"
        aria-labelledby={item ? item.id + "-trigger" : undefined}
      >
        {props.children as Content}
      </div>
    );
  }
  const [local, rest] = splitLive(props, ["children", "class"]);
  const state = useContext(DisclosureStateContext)!;
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.panel()) as string | ((v: DisclosurePanelRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: DisclosurePanelRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <DisclosurePanel class={cls as never} {...({ "data-expanded": () => dataAttr(state.isExpanded()) } as {})} data-slot="accordion-panel" {...rest}>
      {local.children}
    </DisclosurePanel>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { AccordionRoot, AccordionItem, AccordionTrigger, AccordionPanel, AccordionIndicator, AccordionBody, AccordionHeading };

export type {
  AccordionRootProps,
  AccordionItemProps,
  AccordionTriggerProps,
  AccordionPanelProps,
  AccordionIndicatorProps,
  AccordionBodyProps,
  AccordionHeadingProps,
  AccordionBodyDivProps,
  AccordionIndicatorSvgProps,
};
