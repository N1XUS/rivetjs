// Ported from HeroUI v3.2.6 packages/react/src/components/kbd/kbd.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; React types → Rivet JSX types.
// - `KbdContext` carries plain data `{ variant }` instead of the tv `slots` object (functions do not serialize on resume):
//   resumable token `rv-ui-kbd`, default `{}`; `variant: null` = inside a `Kbd` without a variant (kbdVariants has no default
//   variant), `undefined` (the `{}` default) = outside a `Kbd`. Parts look the slots up in a module-level memo (`slotsFor`).
//   The root's element is built inside the provider (Rivet JSX is eager).
// - Live props: parts read props lazily (`splitLive` = runtime `splitProps`, never a destructure); the context value's `variant` is a
//   getter over the root's prop and parts read it inside their class binding, so a changed prop updates the classes in place.
// - Bodies cast `props` to the default-element shape before splitting (generic intersection = TS2590).
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { KbdVariants } from "../../../styles/src/components/kbd/index.ts";
import { kbdVariants } from "../../../styles/src/components/kbd/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

import type { KbdKey } from "./kbd.constants.ts";
import { kbdKeysLabelMap, kbdKeysMap } from "./kbd.constants.ts";

/* -------------------------------------------------------------------------------------------------
 * Kbd Context
 * -----------------------------------------------------------------------------------------------*/
type KbdVariant = NonNullable<KbdVariants["variant"]>;

interface KbdContext {
  /** `null`: inside a `Kbd` without a variant; `undefined`: outside a `Kbd`. */
  variant?: KbdVariant | null;
}

const KbdContext = createContext<KbdContext>({});

type KbdSlots = ReturnType<typeof kbdVariants>;

/** Module-level memo per variant (`"none"` = no variant): tv slot functions are pure. */
const SLOTS: Record<string, KbdSlots> = {};
const slotsFor = (variant: KbdVariant | null | undefined): KbdSlots => (SLOTS[variant ?? "none"] ??= kbdVariants({ variant: variant ?? undefined }));

/** Upstream `use(KbdContext).slots`: `undefined` outside a `Kbd`. Read inside the part's class binding (live getters). */
const slotsOf = (context: KbdContext): KbdSlots | undefined => {
  const variant = context.variant;
  return variant === undefined ? undefined : slotsFor(variant);
};

/* -------------------------------------------------------------------------------------------------
 * Kbd Root
 * -----------------------------------------------------------------------------------------------*/
interface KbdRootProps<E extends keyof JSX.IntrinsicElements = "kbd"> extends DOMRenderProps<E, undefined> {
  children: Content;
  class?: string;
  /** Visual variant. */
  variant?: KbdVariants["variant"];
}

/** `KbdRoot` props for the default element (`kbd`); `index.ts` types `Kbd["Props"]` with it. */
type KbdRootKbdProps = KbdRootProps & Omit<JSX.IntrinsicElements["kbd"], keyof KbdRootProps>;

const KbdRoot = <E extends keyof JSX.IntrinsicElements = "kbd">(props: KbdRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as KbdRootKbdProps, ["children", "class", "variant"]);
  const contextValue: KbdContext = {
    get variant() {
      return local.variant ?? null;
    },
  };

  const content = () => (
    <dom.kbd {...rest} class={slotsFor(contextValue.variant).base({ class: local.class })}>
      {local.children}
    </dom.kbd>
  );

  return (
    <Provider token={KbdContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Kbd Abbr
 * -----------------------------------------------------------------------------------------------*/
interface KbdAbbrProps<E extends keyof JSX.IntrinsicElements = "abbr"> extends DOMRenderProps<E, undefined> {
  class?: string;
  /** The keyboard key to display */
  keyValue: KbdKey;
}

/** `KbdAbbr` props for the default element (`abbr`). */
type KbdAbbrAbbrProps = KbdAbbrProps & Omit<JSX.IntrinsicElements["abbr"], keyof KbdAbbrProps>;

const KbdAbbr = <E extends keyof JSX.IntrinsicElements = "abbr">(props: KbdAbbrProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as KbdAbbrAbbrProps, ["class", "keyValue"]);
  const context = useContext(KbdContext);

  return (
    <dom.abbr class={composeSlotClassName(slotsOf(context)?.abbr, local.class)} title={kbdKeysLabelMap[local.keyValue]} {...rest}>
      {kbdKeysMap[local.keyValue]}
    </dom.abbr>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Kbd Content
 * -----------------------------------------------------------------------------------------------*/
interface KbdContentProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children: Content;
  class?: string;
}

/** `KbdContent` props for the default element (`span`). */
type KbdContentSpanProps = KbdContentProps & Omit<JSX.IntrinsicElements["span"], keyof KbdContentProps>;

const KbdContent = <E extends keyof JSX.IntrinsicElements = "span">(props: KbdContentProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as KbdContentSpanProps, ["class"]);
  const context = useContext(KbdContext);

  return <dom.span class={composeSlotClassName(slotsOf(context)?.content, local.class)} {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { KbdRoot, KbdAbbr, KbdContent };

export type { KbdRootProps, KbdAbbrProps, KbdContentProps, KbdRootKbdProps, KbdAbbrAbbrProps, KbdContentSpanProps };
