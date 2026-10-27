// Ported from HeroUI v3.2.6 packages/react/src/components/empty-state/empty-state.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `className` → `class`; React types → Rivet JSX types. `children || "No results found"`: no children (or a falsy
//   string) renders the default text; Rivet JSX children are lazy slots (always truthy), so an element child renders as given.
//   Live props: `children` / `class` / `size` are read lazily (`splitLive`), so a changed `class` / `size` updates in place.
// - `size` sm / md / lg (Rivet addition: HeroUI v3.2.6 EmptyState has one size; identity spec §3.6).
// - Rivet addition (UI-PORT S7; feature set inspired by HeroUI Pro's public Empty State docs, independent implementation):
//   parts `.Header` / `.Media` (`variant` default / icon) / `.Title` (h3) / `.Description` (p) / `.Content` (actions); with
//   a header or content part the root becomes a centred column (CSS `:has()`, no prop); `variant="outline"` = dashed
//   border. A root with plain text keeps the HeroUI look (collection empty states).
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { EmptyStateVariants } from "../../../styles/src/components/empty-state/index.ts";
import { emptyStateVariants } from "../../../styles/src/components/empty-state/index.ts";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * EmptyState Root
 * -----------------------------------------------------------------------------------------------*/
interface EmptyStateRootProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
  /** Padding and text size: `sm` (4 px, 12 px text), `md` (default: 8 px, 14 px), `lg` (24 px, 16 px). */
  size?: EmptyStateVariants["size"];
  /** `outline`: a dashed, rounded border around the state. @default "default" */
  variant?: EmptyStateVariants["variant"];
}

/** `EmptyStateRoot` props for the default element (`div`). */
type EmptyStateRootDivProps = EmptyStateRootProps & Omit<JSX.IntrinsicElements["div"], keyof EmptyStateRootProps>;

const EmptyStateRoot = <E extends keyof JSX.IntrinsicElements = "div">(props: EmptyStateRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as EmptyStateRootDivProps, ["children", "class", "size", "variant"]);

  return (
    <dom.div class={emptyStateVariants({ class: local.class, size: local.size, variant: local.variant })} data-slot="empty-state" {...rest}>
      {local.children || "No results found"}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Parts (Rivet addition)
 * -----------------------------------------------------------------------------------------------*/
const partClass = (cls: string, extra: string | undefined): string => (extra ? `${cls} ${extra}` : cls);

type EmptyStatePartProps = Omit<JSX.IntrinsicElements["div"], "class"> & { children?: Content; class?: string };

const part =
  (cls: string, dataSlot: string) =>
  (props: EmptyStatePartProps): JSX.Element => {
    const [local, rest] = splitLive(props, ["children", "class"]);
    return (
      <div class={partClass(cls, local.class)} data-slot={dataSlot} {...rest}>
        {local.children}
      </div>
    );
  };

/** Groups the media, title and description. */
const EmptyStateHeader = part("empty-state__header", "empty-state-header");
/** Actions: buttons, links, an input. */
const EmptyStateContent = part("empty-state__content", "empty-state-content");

interface EmptyStateMediaProps extends EmptyStatePartProps {
  /** `icon`: a round muted background for an icon. @default "default" */
  variant?: "default" | "icon";
}

/** Icon, avatar(s) or an image above the title. */
const EmptyStateMedia = (props: EmptyStateMediaProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "variant"]);
  return (
    <div class={partClass("empty-state__media", local.class)} data-slot="empty-state-media" data-variant={local.variant ?? "default"} {...rest}>
      {local.children}
    </div>
  );
};

type EmptyStateTitleProps = Omit<JSX.IntrinsicElements["h3"], "class"> & { children?: Content; class?: string };

const EmptyStateTitle = (props: EmptyStateTitleProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <h3 class={partClass("empty-state__title", local.class)} data-slot="empty-state-title" {...rest}>
      {local.children}
    </h3>
  );
};

type EmptyStateDescriptionProps = Omit<JSX.IntrinsicElements["p"], "class"> & { children?: Content; class?: string };

const EmptyStateDescription = (props: EmptyStateDescriptionProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <p class={partClass("empty-state__description", local.class)} data-slot="empty-state-description" {...rest}>
      {local.children}
    </p>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { EmptyStateRoot, EmptyStateHeader, EmptyStateMedia, EmptyStateTitle, EmptyStateDescription, EmptyStateContent };

export type { EmptyStateRootProps, EmptyStateRootDivProps, EmptyStatePartProps, EmptyStateMediaProps, EmptyStateTitleProps, EmptyStateDescriptionProps };
