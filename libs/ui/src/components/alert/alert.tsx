// Ported from HeroUI v3.2.6 packages/react/src/components/alert/alert.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; React types → Rivet JSX types.
// - `AlertContext` carries plain data `{ status }` (defaulted) instead of `{ slots, status }`: resumable token `rv-ui-alert`, default
//   `{}` (= outside an `Alert`); parts look the slots up in a module-level memo (`slotsFor`). `SurfaceContext` is provided as upstream;
//   the root's element is built inside the providers (Rivet JSX is eager).
// - Default indicator icons: upstream's four inline 16px svgs (`InfoIcon` / `SuccessIcon` / `WarningIcon` / `DangerIcon`) → lucide via
//   `@rivetjs/kit/icon`: default + accent `Info`, success `CircleCheck`, warning `TriangleAlert`, danger `CircleAlert` (size 16,
//   `data-slot="alert-default-icon"`). Visual diff (stroked lucide vs filled glyphs); listed in libs/ui/CLAUDE.md Known diffs.
// - Live props: parts read props lazily (`splitLive` = runtime `splitProps`, never a destructure); the context value's `status` is a
//   getter over the root's prop, parts read it inside their class / child bindings (a changed status updates classes + the default
//   indicator icon without re-creating the parts).
// - Bodies cast `props` to the default-element shape before splitting (generic intersection = TS2590).
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide";

import type { AlertVariants } from "../../../styles/src/components/alert/index.ts";
import { alertVariants } from "../../../styles/src/components/alert/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";
import { SurfaceContext } from "../surface/index.ts";

/* ------------------------------------------------------------------------------------------------
 * Alert Context
 * --------------------------------------------------------------------------------------------- */
interface AlertContext {
  status?: "default" | "accent" | "success" | "warning" | "danger";
}

const AlertContext = resumableContext(createContext<AlertContext>({}, { id: "rv-ui-alert" }));

type AlertSlots = ReturnType<typeof alertVariants>;
type AlertStatus = NonNullable<AlertVariants["status"]>;

/** Module-level memo per status (tv slot functions are pure). */
const SLOTS: Partial<Record<AlertStatus, AlertSlots>> = {};
const slotsFor = (status: AlertStatus): AlertSlots => (SLOTS[status] ??= alertVariants({ status }));

/** Upstream `use(AlertContext).slots`: `undefined` outside an `Alert`. Read inside the part's class binding (live getters). */
const slotsOf = (context: AlertContext): AlertSlots | undefined => {
  const status = context.status;
  return status === undefined ? undefined : slotsFor(status);
};

const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* ------------------------------------------------------------------------------------------------
 * Alert Root
 * --------------------------------------------------------------------------------------------- */
interface AlertRootProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children: Content;
  class?: string;
  /** Alert status. */
  status?: AlertVariants["status"];
}

/** `AlertRoot` props for the default element (`div`). */
type AlertRootDivProps = AlertRootProps & Omit<JSX.IntrinsicElements["div"], keyof AlertRootProps>;

const AlertRoot = <E extends keyof JSX.IntrinsicElements = "div">(props: AlertRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as AlertRootDivProps, ["children", "class", "status"]);
  const contextValue: AlertContext = {
    get status() {
      return local.status === undefined ? "default" : local.status;
    },
  };

  const content = () => (
    <dom.div class={slotsFor(contextValue.status!).base({ class: local.class })} data-slot="alert-root" {...rest}>
      {local.children}
    </dom.div>
  );

  return (
    <Provider token={AlertContext} value={contextValue}>
      <Provider token={SurfaceContext} value={DEFAULT_SURFACE_CONTEXT}>
        {content()}
      </Provider>
    </Provider>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Alert Indicator
 * --------------------------------------------------------------------------------------------- */
interface AlertIndicatorProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `AlertIndicator` props for the default element (`div`). */
type AlertIndicatorDivProps = AlertIndicatorProps & Omit<JSX.IntrinsicElements["div"], keyof AlertIndicatorProps>;

const AlertIndicator = <E extends keyof JSX.IntrinsicElements = "div">(props: AlertIndicatorProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as AlertIndicatorDivProps, ["children", "class"]);
  const context = useContext(AlertContext);

  // Map status to default icons (read in the child binding: a live status swaps the icon)
  const getDefaultIcon = () => {
    switch (context.status) {
      case "success":
        return <Icon icon={CircleCheck} size={16} data-slot="alert-default-icon" />;
      case "warning":
        return <Icon icon={TriangleAlert} size={16} data-slot="alert-default-icon" />;
      case "danger":
        return <Icon icon={CircleAlert} size={16} data-slot="alert-default-icon" />;
      default:
        // "accent", "default" and outside an Alert
        return <Icon icon={Info} size={16} data-slot="alert-default-icon" />;
    }
  };

  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.indicator, local.class)} data-slot="alert-indicator" {...rest}>
      {local.children ?? getDefaultIcon()}
    </dom.div>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Alert Content
 * --------------------------------------------------------------------------------------------- */
interface AlertContentProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `AlertContent` props for the default element (`div`). */
type AlertContentDivProps = AlertContentProps & Omit<JSX.IntrinsicElements["div"], keyof AlertContentProps>;

const AlertContent = <E extends keyof JSX.IntrinsicElements = "div">(props: AlertContentProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as AlertContentDivProps, ["class"]);
  const context = useContext(AlertContext);

  return <dom.div class={composeSlotClassName(slotsOf(context)?.content, local.class)} data-slot="alert-content" {...rest} />;
};

/* ------------------------------------------------------------------------------------------------
 * Alert Title
 * --------------------------------------------------------------------------------------------- */
interface AlertTitleProps<E extends keyof JSX.IntrinsicElements = "p"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `AlertTitle` props for the default element (`p`). */
type AlertTitlePProps = AlertTitleProps & Omit<JSX.IntrinsicElements["p"], keyof AlertTitleProps>;

const AlertTitle = <E extends keyof JSX.IntrinsicElements = "p">(props: AlertTitleProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as AlertTitlePProps, ["class"]);
  const context = useContext(AlertContext);

  return <dom.p class={composeSlotClassName(slotsOf(context)?.title, local.class)} data-slot="alert-title" {...rest} />;
};

/* ------------------------------------------------------------------------------------------------
 * Alert Description
 * --------------------------------------------------------------------------------------------- */
interface AlertDescriptionProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `AlertDescription` props for the default element (`span`). */
type AlertDescriptionSpanProps = AlertDescriptionProps & Omit<JSX.IntrinsicElements["span"], keyof AlertDescriptionProps>;

const AlertDescription = <E extends keyof JSX.IntrinsicElements = "span">(props: AlertDescriptionProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as AlertDescriptionSpanProps, ["class"]);
  const context = useContext(AlertContext);

  return <dom.span class={composeSlotClassName(slotsOf(context)?.description, local.class)} data-slot="alert-description" {...rest} />;
};

/* ------------------------------------------------------------------------------------------------
 * Exports
 * --------------------------------------------------------------------------------------------- */
export { AlertRoot, AlertIndicator, AlertContent, AlertTitle, AlertDescription };

export type {
  AlertRootProps,
  AlertIndicatorProps,
  AlertContentProps,
  AlertTitleProps,
  AlertDescriptionProps,
  AlertRootDivProps,
  AlertIndicatorDivProps,
  AlertContentDivProps,
  AlertTitlePProps,
  AlertDescriptionSpanProps,
};
