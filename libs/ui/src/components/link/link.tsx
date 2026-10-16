// Ported from HeroUI v3.2.6 packages/react/src/components/link/link.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/Link` → `@rivetjs/cdk/link` (`render` prop, function `class` /
//   `children` with accessor render props); React types → Rivet JSX types.
// - `LinkContext` carries plain data `{ inLink: true }` instead of the tv `slots` object (no variants: one memoized `linkVariants()`);
//   resumable token `rv-ui-link`, default `{}` (= outside a `Link`: `LinkIcon` gets only its class). The root element is built inside
//   the provider (Rivet JSX is eager).
// - `LinkIcon`: upstream's inline `ExternalLinkIcon` svg (9px) → lucide `ArrowUpRight` via `@rivetjs/kit/icon` (9px,
//   `data-slot="link-default-icon"`); visual diff in `libs/ui/CLAUDE.md` Known diffs. `dataAttr(!children)` inlined.
// - Live props: parts read props lazily (`splitLive` = runtime `splitProps`, never a destructure); the composed class is a local (a plain value for cdk `Link`), so a live `class` goes in as a render-prop function (`renderClass`); static props keep the `composeTwRenderProps` result.
// - Bodies cast `props` to the default-element shape before splitting (generic intersection = TS2590).
import { Link as LinkPrimitive } from "@rivetjs/cdk/link";
import type { LinkProps as LinkPrimitiveProps } from "@rivetjs/cdk/link";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { ArrowUpRight } from "lucide";

import type { LinkVariants } from "../../../styles/src/components/link/index.ts";
import { linkVariants } from "../../../styles/src/components/link/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

/* ------------------------------------------------------------------------------------------------
 * Link Context
 * --------------------------------------------------------------------------------------------- */
interface LinkContext {
  /** `true` inside a `Link`; `undefined` (the `{}` default) outside. */
  inLink?: boolean;
}

const LinkContext = resumableContext(createContext<LinkContext>({}, { id: "rv-ui-link" }));

const LINK_CONTEXT_VALUE: LinkContext = { inLink: true };

/** `linkVariants()` has no variants: one slots object for every Link (tv slot functions are pure). */
let SLOTS: ReturnType<typeof linkVariants> | undefined;
const linkSlots = (): ReturnType<typeof linkVariants> => (SLOTS ??= linkVariants());

/** Upstream `use(LinkContext).slots`: `undefined` outside a `Link`. */
const useSlots = (): ReturnType<typeof linkVariants> | undefined => (useContext(LinkContext).inLink ? linkSlots() : undefined);

/* ------------------------------------------------------------------------------------------------
 * Link Root
 * --------------------------------------------------------------------------------------------- */
interface LinkRootProps extends LinkPrimitiveProps, LinkVariants {}

const LinkRoot = (props: LinkRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const classOf = (): string | ((values: never) => string) => composeTwRenderProps(local.class as never, linkSlots().base());
  const cls = hasLiveProp(local, ["class"]) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  const content = () => (
    <LinkPrimitive data-slot="link" {...rest} class={cls as never}>
      {local.children}
    </LinkPrimitive>
  );

  return (
    <Provider token={LinkContext} value={LINK_CONTEXT_VALUE}>
      {content()}
    </Provider>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Link Icon
 * --------------------------------------------------------------------------------------------- */
interface LinkIconProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `LinkIcon` props for the default element (`span`). */
type LinkIconSpanProps = LinkIconProps & Omit<JSX.IntrinsicElements["span"], keyof LinkIconProps>;

const LinkIcon = <E extends keyof JSX.IntrinsicElements = "span">(props: LinkIconProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as LinkIconSpanProps, ["children", "class"]);
  const slots = useSlots();

  return (
    <dom.span class={composeSlotClassName(slots?.icon, local.class)} data-default-icon={!local.children ? "true" : undefined} data-slot="link-icon" {...rest}>
      {local.children ?? <Icon icon={ArrowUpRight} size={9} data-slot="link-default-icon" />}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { LinkRoot, LinkIcon };

export type { LinkRootProps, LinkIconProps, LinkIconSpanProps };
