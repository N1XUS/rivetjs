// Ported from HeroUI v3.2.6 packages/react/src/components/breadcrumbs/breadcrumbs.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/Breadcrumbs` → `@rivetjs/cdk/breadcrumbs` (render props are
//   accessors: `isCurrent()`); `@heroui/styles` → vendored `styles/`.
// - `BreadcrumbsContext` carries plain data `{ inBreadcrumbs, separator }` instead of `{ slots, separator }` (`breadcrumbsVariants` has
//   no variants: one module-level slots object); resumable token `rv-ui-breadcrumbs`, default `{}` → an Item outside Breadcrumbs gets
//   only the caller's `class` (= upstream `slots?.x`).
// - Default separator: upstream inline `IconChevronRight` svg → lucide `ChevronRight` (16px, `data-slot="breadcrumbs-separator"`).
// - Custom `separator`: Rivet JSX has no `cloneElement`; the separator renders inside a `span` carrying the slot class +
//   `data-slot="breadcrumbs-separator"` (upstream sets both on the cloned element). A function `separator={() => <…/>}` is called per
//   item; a DOM node value is cloned per item (an element can only be in one place).
// - Function children (`typeof children === "function"`, upstream: called with `{}`) → `!isSlot(children)`. Rivet extension: they
//   get `{ isCurrent, separator }` (`isCurrent` accessor, `separator()` renders the item's separator) so a custom item (e.g. an
//   `@rivetjs/ui/inline-select` switcher) keeps the separator; upstream's `{}` call ignores both.
// - Item: `class` → render-prop function (the composed class is a local, a plain value for cdk; also defers the context read to render time, see Item). Root `class` is composed into a local string (a plain value for cdk `Breadcrumbs`, which reads a live `class` in place): not re-composed.
// - Rivet addition (no HeroUI counterpart): `overflowMode="collapse"` + `showRoot` / `maxVisibleItems` / `defaultVisibleItems` /
//   `renderOverflow` from the cdk Breadcrumbs (React Spectrum collapsing, `@rivetjs/cdk/overflow`); the overflow `<li>` gets the
//   `breadcrumbs__item` class and the item separator after `renderOverflow(items)`. An Item with string / number children
//   passes them as `textValue` (the overflow menu label).
// - Rivet addition (identity spec §4.2, plan T22): `items` without children renders one `Breadcrumbs.Item` per
//   `BreadcrumbsItemData` (`{ id?, label, href?, isDisabled? }`; key = `id`, else the entry's index); `items` + a render function = cdk.
import { Breadcrumb as BreadcrumbPrimitive, Breadcrumbs as BreadcrumbsPrimitive } from "@rivetjs/cdk/breadcrumbs";
import type {
  BreadcrumbProps as BreadcrumbPrimitiveProps,
  BreadcrumbRenderProps,
  BreadcrumbsOverflowItem,
  BreadcrumbsProps as BreadcrumbsPrimitiveProps,
} from "@rivetjs/cdk/breadcrumbs";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { ChevronRight } from "lucide";

import type { BreadcrumbsVariants } from "../../../styles/src/components/breadcrumbs/index.ts";
import { breadcrumbsVariants } from "../../../styles/src/components/breadcrumbs/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import type { LinkRootProps } from "../link/link.tsx";
import { LinkRoot as Link } from "../link/link.tsx";

/* -------------------------------------------------------------------------------------------------
 * Breadcrumbs Context
 * -----------------------------------------------------------------------------------------------*/
type BreadcrumbsSeparator = Content | (() => Content);

/** Rivet extension: what a `Breadcrumbs.Item` function child gets (upstream: `{}`). */
interface BreadcrumbsItemRenderProps extends BreadcrumbRenderProps {
  /** Renders the item separator (default chevron or the root's `separator`). */
  separator: () => Content;
}

type BreadcrumbsContext = {
  /** Rivet: set by `Breadcrumbs` (upstream: `slots`). */
  inBreadcrumbs?: boolean;
  separator?: BreadcrumbsSeparator;
};

const BreadcrumbsContext = createContext<BreadcrumbsContext>({});

type BreadcrumbsSlots = ReturnType<typeof breadcrumbsVariants>;
let SLOTS: BreadcrumbsSlots | undefined;
const breadcrumbsSlots = (): BreadcrumbsSlots => (SLOTS ??= breadcrumbsVariants({}));
/** Upstream `use(BreadcrumbsContext).slots`: `undefined` outside a `Breadcrumbs`. */
const slotsOf = (context: BreadcrumbsContext): BreadcrumbsSlots | undefined => (context.inBreadcrumbs ? breadcrumbsSlots() : undefined);

/** The item separator: the default chevron or the root's `separator` (wrapped in the separator slot). */
function separatorOf(context: BreadcrumbsContext): Content {
  const separator = context.separator;
  if (!separator) return <Icon icon={ChevronRight} size={16} class={slotsOf(context)?.separator()} data-slot="breadcrumbs-separator" />;
  const node =
    typeof separator === "function"
      ? (separator as () => Content)()
      : typeof Node !== "undefined" && separator instanceof Node
        ? separator.cloneNode(true)
        : separator;
  return (
    <span class={slotsOf(context)?.separator()} data-slot="breadcrumbs-separator">
      {node as never}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Breadcrumbs Root
 * -----------------------------------------------------------------------------------------------*/
interface BreadcrumbsRootProps<T = object> extends BreadcrumbsPrimitiveProps<T>, BreadcrumbsVariants {
  separator?: BreadcrumbsSeparator;
}

/** Rivet: an `items` entry rendered without a render function (`<Breadcrumbs items={[…]} />`). */
interface BreadcrumbsItemData {
  /** Collection key; without it the entry's index (stable across label edits, not across reorders). */
  id?: string | number;
  label: string;
  href?: string;
  isDisabled?: boolean;
}

/** Rivet: `items` without a render function — an entry without `id` is keyed by its index (stable across label / href edits;
 *  a reorder of id-less entries moves keys with positions: give `id` for reorderable lists). */
const keyedItems = (items: Iterable<BreadcrumbsItemData> | undefined): BreadcrumbsItemData[] | undefined =>
  items === undefined ? undefined : Array.from(items, (item, index) => (item.id == null ? { ...item, id: index } : item));

const BreadcrumbsRoot = <T extends object = object>(props: BreadcrumbsRootProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as BreadcrumbsRootProps<object>, ["children", "class", "separator", "renderOverflow"]);
  const context: BreadcrumbsContext = hasLiveProp(local, ["separator"])
    ? {
        inBreadcrumbs: true,
        get separator() {
          return local.separator;
        },
      }
    : { inBreadcrumbs: true, separator: local.separator };
  // the composed root class is a local string, a plain value for cdk Breadcrumbs (RAC: `className` string on the list).
  const cls = composeSlotClassName(breadcrumbsSlots().base, local.class);
  // Rivet addition (overflowMode="collapse"): the overflow item is an item (class + separator after it).
  const userOverflow = local.renderOverflow;
  const renderOverflow = (items: BreadcrumbsOverflowItem[]): Content => (
    <>
      {userOverflow?.(items) as never}
      {separatorOf(context) as never}
    </>
  );
  const overflowClass = breadcrumbsSlots().item();
  // Rivet: `items` without a render function (a local const: the collection build captures it on resumed pages).
  const renderItem = (item: BreadcrumbsItemData): Content => (
    <BreadcrumbsItem href={item.href} isDisabled={item.isDisabled}>
      {item.label}
    </BreadcrumbsItem>
  );
  // id-less entries keyed by index; a live `items` reaches the cdk as an accessor (the cdk reads a plain value once).
  const itemsOf = () => keyedItems(rest.items as Iterable<BreadcrumbsItemData> | undefined);
  const content = () => (
    <BreadcrumbsPrimitive
      data-slot="breadcrumbs"
      renderOverflow={renderOverflow}
      overflowClass={overflowClass}
      {...(rest as BreadcrumbsPrimitiveProps<object>)}
      class={cls}
      items={(local.children === undefined ? (hasLiveProp(rest, ["items"]) ? itemsOf : itemsOf()) : rest.items) as never}
      children={(local.children ?? (rest.items !== undefined ? renderItem : undefined)) as never}
    />
  );

  return (
    <Provider token={BreadcrumbsContext} value={context}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Breadcrumbs Item
 * -----------------------------------------------------------------------------------------------*/
interface BreadcrumbsItemProps extends Omit<BreadcrumbPrimitiveProps, "children"> {
  /** Link content, or a function replacing the link + separator (Rivet: gets `{ isCurrent, isDisabled, separator }`). */
  children?: Content | ((values: BreadcrumbsItemRenderProps) => Content);
}

type BreadcrumbsItemAllProps = BreadcrumbsItemProps & Omit<LinkRootProps, "class" | "children" | "render" | "style">;

const BreadcrumbsItem = (props: BreadcrumbsItemAllProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  // Rivet: the context is read where the item renders (class / children render props), not in this body, which a
  // collection build pass runs (on a resumed page: the captured collection computed, re-created under the providers it
  // was created in — runtime `v` entries — when the overflow (`overflowMode="collapse"`) re-creates a row).
  // Rivet: plain text children name the item in the Breadcrumbs overflow menu.
  const children = local.children;
  const textValue = typeof children === "string" || typeof children === "number" ? String(children) : undefined;

  const cls = (values: BreadcrumbRenderProps): string =>
    renderClass(
      composeTwRenderProps(local.class as never, slotsOf(useContext(BreadcrumbsContext))?.item()) as string | ((v: BreadcrumbRenderProps) => string),
      values,
    );

  return (
    <BreadcrumbPrimitive class={cls as never} data-slot="breadcrumbs-item" textValue={textValue} {...(rest as BreadcrumbPrimitiveProps)}>
      {(values: BreadcrumbRenderProps) => {
        const context = useContext(BreadcrumbsContext);
        const renderSeparator = (): Content => separatorOf(context);
        if (typeof local.children === "function" && !isSlot(local.children)) {
          return (local.children as (v: BreadcrumbsItemRenderProps) => Content)({
            isCurrent: values.isCurrent,
            isDisabled: values.isDisabled,
            separator: renderSeparator,
          });
        }

        return (
          <>
            <Link class={slotsOf(context)?.link()} {...(rest as LinkRootProps)}>
              {local.children as never}
            </Link>
            {() => (!values.isCurrent() ? renderSeparator() : null)}
          </>
        );
      }}
    </BreadcrumbPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { BreadcrumbsRoot, BreadcrumbsItem };

export type {
  BreadcrumbsRootProps,
  BreadcrumbsItemData,
  BreadcrumbsItemProps,
  BreadcrumbsItemAllProps,
  BreadcrumbsItemRenderProps,
  BreadcrumbsSeparator,
  BreadcrumbsOverflowItem,
};
