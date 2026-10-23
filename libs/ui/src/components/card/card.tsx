// Ported from HeroUI v3.2.6 packages/react/src/components/card/card.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped (resume, no hydration pass); `className` → `class`; React types → Rivet JSX types.
// - `CardContext` carries plain data `{ variant }` instead of the tv `slots` object (functions do not serialize on
//   resume; spec §2): a context token (same `{}` default) + `Provider`. Each
//   part looks up the slots for the context variant (`slotsFor` memo, never from context); outside a `Card` the
//   context is `{}` → slots `undefined` → the part gets only the caller's `class` (= upstream). `React.useMemo` →
//   context values whose `variant` is a getter over the live prop (props are live getters, spec
//   docs/design/specs/2026-10-07-live-props-design.md): readers see plain data (resume encodes the value read), the
//   body never re-runs, and only the class bindings reading `variant` update. `React.useMemo` → that getter object.
//   The root's `content` element is a function called inside the providers (Rivet JSX creates nodes eagerly).
// - `SurfaceContext` is always provided: for `transparent` its `variant` reads the outer surface (upstream skips the
//   provider), so readers see the same value and a live `variant` switching to / from `transparent` keeps the nodes.
// - Props are read lazily (`splitLive` = runtime `splitProps`, `@rivetjs/runtime/props`) instead of destructured: a destructure would
//   snapshot the live getters. Bodies cast `props` to the default-element shape (upstream casts `props as any`): a
//   split of the generic intersection is TS2590.
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { CardVariants } from "../../../styles/src/components/card/index.ts";
import { cardVariants } from "../../../styles/src/components/card/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";
import { SurfaceContext } from "../surface/index.ts";

/* -------------------------------------------------------------------------------------------------
 * Card Context
 * -----------------------------------------------------------------------------------------------*/
interface CardContext {
  variant?: CardVariants["variant"];
}

const CardContext = createContext<CardContext>({});

/** The tv slot functions of one `cardVariants` variant (`base`, `header`, `title`, …). */
type CardSlots = ReturnType<typeof cardVariants>;
type CardVariant = NonNullable<CardVariants["variant"]>;

/** Module-level memo per variant (upstream `useMemo` per root): tv slot functions are pure (same props → same string), so one
 *  slots object per variant is shared by every Card; the context keeps carrying `{ variant }` (resumable data). */
const SLOTS: Partial<Record<CardVariant, CardSlots>> = {};
const slotsFor = (variant: CardVariant): CardSlots => (SLOTS[variant] ??= cardVariants({ variant }));

/** Upstream `use(CardContext).slots`: the slots for the nearest `Card`'s variant, `undefined` outside a `Card`. Read
 *  inside the part's class binding (`variant` is a live getter of the root's prop). */
const slotsOf = (context: CardContext): CardSlots | undefined => {
  const variant = context.variant;
  return variant === undefined ? undefined : slotsFor(variant);
};

/* -------------------------------------------------------------------------------------------------
 * Card Root
 * -----------------------------------------------------------------------------------------------*/
interface CardRootProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children: Content;
  class?: string;
  /** Visual variant. @default "default" */
  variant?: CardVariants["variant"];
}

/** `CardRoot` props for the default element (`div`); `index.ts` types `Card["Props"]` with it. */
type CardRootDivProps = CardRootProps & Omit<JSX.IntrinsicElements["div"], keyof CardRootProps>;

const CardRoot = <E extends keyof JSX.IntrinsicElements = "div">(props: CardRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as CardRootDivProps, ["children", "class", "variant"]);
  const variant = (): CardVariant => (local.variant === undefined ? "default" : local.variant) as CardVariant;
  const outerSurface = useContext(SurfaceContext);
  const contextValue: CardContext = {
    get variant() {
      return variant();
    },
  };
  // Allows inner components to apply "on-surface" colors for proper contrast (transparent: the outer surface).
  const surfaceContextValue: { variant?: SurfaceVariants["variant"] } = {
    get variant() {
      const v = variant();
      return v === "transparent" ? outerSurface.variant : (v as SurfaceVariants["variant"]);
    },
  };

  // A function, not an element: Rivet JSX builds nodes eagerly (React elements are descriptions), so the root must
  // be created inside the providers for its children to see them.
  const content = () => (
    <dom.div class={slotsFor(variant()).base({ class: local.class })} data-slot="card" {...rest}>
      {local.children}
    </dom.div>
  );

  return (
    <Provider token={CardContext} value={contextValue}>
      <Provider token={SurfaceContext} value={surfaceContextValue}>
        {content()}
      </Provider>
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Card Header
 * -----------------------------------------------------------------------------------------------*/
interface CardHeaderProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `CardHeader` props for the default element (`div`). */
type CardHeaderDivProps = CardHeaderProps & Omit<JSX.IntrinsicElements["div"], keyof CardHeaderProps>;

const CardHeader = <E extends keyof JSX.IntrinsicElements = "div">(props: CardHeaderProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as CardHeaderDivProps, ["class"]);
  const context = useContext(CardContext);

  return <dom.div class={composeSlotClassName(slotsOf(context)?.header, local.class)} data-slot="card-header" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Card Title
 * -----------------------------------------------------------------------------------------------*/
interface CardTitleProps<E extends keyof JSX.IntrinsicElements = "h3"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `CardTitle` props for the default element (`h3`). */
type CardTitleH3Props = CardTitleProps & Omit<JSX.IntrinsicElements["h3"], keyof CardTitleProps>;

const CardTitle = <E extends keyof JSX.IntrinsicElements = "h3">(props: CardTitleProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as CardTitleH3Props, ["class"]);
  const context = useContext(CardContext);

  return <dom.h3 class={composeSlotClassName(slotsOf(context)?.title, local.class)} data-slot="card-title" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Card Description
 * -----------------------------------------------------------------------------------------------*/
interface CardDescriptionProps<E extends keyof JSX.IntrinsicElements = "p"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `CardDescription` props for the default element (`p`). */
type CardDescriptionPProps = CardDescriptionProps & Omit<JSX.IntrinsicElements["p"], keyof CardDescriptionProps>;

const CardDescription = <E extends keyof JSX.IntrinsicElements = "p">(props: CardDescriptionProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as CardDescriptionPProps, ["class"]);
  const context = useContext(CardContext);

  return <dom.p class={composeSlotClassName(slotsOf(context)?.description, local.class)} data-slot="card-description" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Card Content
 * -----------------------------------------------------------------------------------------------*/
interface CardContentProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `CardContent` props for the default element (`div`). */
type CardContentDivProps = CardContentProps & Omit<JSX.IntrinsicElements["div"], keyof CardContentProps>;

const CardContent = <E extends keyof JSX.IntrinsicElements = "div">(props: CardContentProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as CardContentDivProps, ["class"]);
  const context = useContext(CardContext);

  return <dom.div class={composeSlotClassName(slotsOf(context)?.content, local.class)} data-slot="card-content" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Card Footer
 * -----------------------------------------------------------------------------------------------*/
interface CardFooterProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `CardFooter` props for the default element (`div`). */
type CardFooterDivProps = CardFooterProps & Omit<JSX.IntrinsicElements["div"], keyof CardFooterProps>;

const CardFooter = <E extends keyof JSX.IntrinsicElements = "div">(props: CardFooterProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as CardFooterDivProps, ["class"]);
  const context = useContext(CardContext);

  return <dom.div class={composeSlotClassName(slotsOf(context)?.footer, local.class)} data-slot="card-footer" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { CardRoot, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

export type {
  CardRootProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
  CardRootDivProps,
  CardHeaderDivProps,
  CardTitleH3Props,
  CardDescriptionPProps,
  CardContentDivProps,
  CardFooterDivProps,
};
