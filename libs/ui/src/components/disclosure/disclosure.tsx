// Ported from HeroUI v3.2.6 packages/react/src/components/disclosure/disclosure.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk` (`disclosure` Disclosure /
//   DisclosurePanel / DisclosureStateContext, `button`, `heading`); `@heroui/styles` → vendored `styles/`.
// - `DisclosureContext` carries plain data `{ inDisclosure: true }` instead of the tv `slots` object (`disclosureVariants` has
//   no variants: one module-level slots object): resumable token `rv-ui-disclosure`, default `{}` → parts outside a
//   `Disclosure` get only the caller's `class` (= upstream `slots?.x`).
// - Root / Trigger function children: the cdk parts take render-function children themselves (upstream wraps them).
// - `data-expanded` on Content / Indicator: an accessor over `DisclosureStateContext.isExpanded()` (signal state).
// - `Disclosure.Indicator`: upstream's inline `IconChevronDown` svg → lucide `ChevronDown` (16px) via `@rivetjs/kit/icon`.
//   Custom children are not cloned (Rivet JSX has no element clone): they render inside a `span` carrying the indicator
//   class, `data-slot` and `data-expanded`.
// - Live `class` → a render-prop function for the cdk part (the composed class is a local: it reaches the cdk part as a plain value); static `class` stays a string.
import { Button } from "@rivetjs/cdk/button";
import type { ButtonProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { DisclosurePanel, Disclosure as DisclosurePrimitive, DisclosureStateContext } from "@rivetjs/cdk/disclosure";
import type { DisclosurePanelProps, DisclosurePanelRenderProps, DisclosureProps, DisclosureRenderProps } from "@rivetjs/cdk/disclosure";
import { Heading as DisclosureHeadingPrimitive } from "@rivetjs/cdk/heading";
import type { HeadingProps as DisclosureHeadingPrimitiveProps } from "@rivetjs/cdk/heading";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { ChevronDown } from "lucide";

import type { DisclosureVariants } from "../../../styles/src/components/disclosure/index.ts";
import { disclosureVariants } from "../../../styles/src/components/disclosure/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* ------------------------------------------------------------------------------------------------
 * Disclosure Context
 * --------------------------------------------------------------------------------------------- */
type DisclosureContext = {
  /** Rivet: set by `Disclosure` (upstream: `slots`). */
  inDisclosure?: boolean;
};

const DisclosureContext = resumableContext(createContext<DisclosureContext>({}, { id: "rv-ui-disclosure" }));

type DisclosureSlots = ReturnType<typeof disclosureVariants>;
let SLOTS: DisclosureSlots | undefined;
/** Upstream `use(DisclosureContext).slots`: `disclosureVariants({})` inside a `Disclosure`, `undefined` outside. */
const slotsOf = (context: DisclosureContext): DisclosureSlots | undefined => (context.inDisclosure ? (SLOTS ??= disclosureVariants({})) : undefined);

const ROOT_CONTEXT: DisclosureContext = { inDisclosure: true };

const dataAttr = (condition: boolean | undefined): "true" | undefined => (condition ? "true" : undefined);

/* -------------------------------------------------------------------------------------------------
 * Disclosure Root
 * -----------------------------------------------------------------------------------------------*/
interface DisclosureRootProps extends DisclosureProps, DisclosureVariants {}

const DisclosureRoot = (props: DisclosureRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(ROOT_CONTEXT)!.base()) as string | ((v: DisclosureRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: DisclosureRenderProps) => renderClass(classOf(), values) : classOf();
  // A function: Rivet JSX builds nodes eagerly, the parts must be created inside the provider.
  const content = () => (
    <DisclosurePrimitive data-slot="disclosure" {...rest} class={cls as never}>
      {local.children}
    </DisclosurePrimitive>
  );

  return (
    <Provider token={DisclosureContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Disclosure Heading
 * -----------------------------------------------------------------------------------------------*/
interface DisclosureHeadingProps extends DisclosureHeadingPrimitiveProps {
  class?: string;
}

const DisclosureHeading = (props: DisclosureHeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(DisclosureContext);

  return (
    <DisclosureHeadingPrimitive class={composeSlotClassName(slotsOf(context)?.heading, local.class)} data-slot="disclosure-heading" {...rest}>
      {local.children}
    </DisclosureHeadingPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Disclosure Trigger
 * -----------------------------------------------------------------------------------------------*/
interface DisclosureTriggerProps extends ButtonProps {}

const DisclosureTrigger = (props: DisclosureTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(DisclosureContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.trigger()) as string | ((v: ButtonRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <Button class={cls as never} data-slot="disclosure-trigger" slot="trigger" {...rest}>
      {local.children}
    </Button>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Disclosure Content
 * -----------------------------------------------------------------------------------------------*/
interface DisclosureContentProps extends DisclosurePanelProps {}

const DisclosureContent = (props: DisclosureContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(DisclosureContext);
  const state = useContext(DisclosureStateContext)!;
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.content()) as string | ((v: DisclosurePanelRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: DisclosurePanelRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <DisclosurePanel class={cls as never} {...({ "data-expanded": () => dataAttr(state.isExpanded()) } as {})} data-slot="disclosure-content" {...rest}>
      {local.children}
    </DisclosurePanel>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Disclosure Body
 * -----------------------------------------------------------------------------------------------*/
interface DisclosureBodyContentProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `DisclosureBody` props for the default element (`div`). */
type DisclosureBodyDivProps = DisclosureBodyContentProps & Omit<JSX.IntrinsicElements["div"], keyof DisclosureBodyContentProps>;

const DisclosureBody = <E extends keyof JSX.IntrinsicElements = "div">(props: DisclosureBodyContentProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as DisclosureBodyDivProps, ["children", "class"]);
  const context = useContext(DisclosureContext);

  return (
    <dom.div class={slotsOf(context)?.body({})} data-slot="disclosure-body" {...rest}>
      <div class={composeSlotClassName(slotsOf(context)?.bodyInner, local.class)}>{local.children}</div>
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Disclosure Indicator
 * -----------------------------------------------------------------------------------------------*/
interface DisclosureIndicatorProps<E extends keyof JSX.IntrinsicElements = "svg"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `DisclosureIndicator` props for the default element (`svg`). */
type DisclosureIndicatorSvgProps = DisclosureIndicatorProps & Omit<JSX.IntrinsicElements["svg"], keyof DisclosureIndicatorProps>;

const DisclosureIndicator = <E extends keyof JSX.IntrinsicElements = "svg">(props: DisclosureIndicatorProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as DisclosureIndicatorSvgProps, ["children", "class"]);
  const state = useContext(DisclosureStateContext)!;
  const context = useContext(DisclosureContext);
  const expanded = () => dataAttr(state.isExpanded());

  if (local.children) {
    return (
      <span
        {...(rest as {})}
        data-expanded={expanded()}
        class={composeSlotClassName(slotsOf(context)?.indicator, local.class)}
        data-slot="disclosure-indicator"
      >
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
      data-slot="disclosure-indicator"
      {...(rest as {})}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { DisclosureRoot, DisclosureHeading, DisclosureTrigger, DisclosureContent, DisclosureBody, DisclosureIndicator };

export type {
  DisclosureRootProps,
  DisclosureContentProps,
  DisclosureHeadingProps,
  DisclosureTriggerProps,
  DisclosureIndicatorProps,
  DisclosureBodyContentProps,
  DisclosureBodyDivProps,
  DisclosureIndicatorSvgProps,
};
