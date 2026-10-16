// Ported from HeroUI v3.2.6 packages/react/src/components/pagination/pagination.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped (resume, no hydration pass); `className` → `class`; React types → Rivet JSX types;
//   `react-aria-components/Button` → `@rivetjs/cdk/button`.
// - `PaginationContext` carries plain data `{ size }` instead of the tv `slots` (functions do not serialize on resume): a
//   resumable token (`rv-ui-pagination`, same `{}` default); each part looks the slots up in a module-level memo per size
//   (`slotsOf`), `undefined` outside a `Pagination` (the part then gets only the caller's `class`, = upstream). The size
//   field is a getter only when the root's `size` is live (`hasLiveProp`).
// - The root's element is created inside the provider (`content()` thunk: Rivet JSX builds nodes eagerly).
// - Props are read lazily (`splitLive`); bodies cast `props` to the default-element shape (a split of the generic
//   intersection is TS2590).
// - `Link` / `Previous` / `Next`: the composed class / `isDisabled` are locals, which reach cdk `Button` as plain values (no
//   getter), so a live `class` goes in as a render-prop function (`renderClass`), a live `isDisabled` as an accessor; a live
//   `isActive` reaches `aria-current` / `data-active` as accessors (the cdk spread resolves them).
// - Default icons: upstream's inline `IconChevronLeft` / `IconChevronRight` svgs → lucide `ChevronLeft` / `ChevronRight`
//   (16px) via `@rivetjs/kit/icon`. `children ?? <Icon/>`: any child replaces the icon (Rivet children are slots).
// - Rivet addition (identity spec §4.2, plan T22): auto form — a root with `total` (and no children) renders Content > Item >
//   Previous, one Link per page of `paginationRange(page, total, siblings, boundaries)` (Ellipsis in the gaps), Next.
//   `page` = number / two-way Signal / accessor (cdk `controllable`), `defaultPage`, `onPageChange`; `previousLabel` /
//   `nextLabel` (default "Previous" / "Next") next to the icons. Children win over `total`.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import { controllable, setControlledValue } from "@rivetjs/cdk/interactions";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { ChevronLeft, ChevronRight } from "lucide";

import type { PaginationVariants } from "../../../styles/src/components/pagination/index.ts";
import { paginationVariants } from "../../../styles/src/components/pagination/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { DEV } from "#dev";
import { warnShorthandIgnored } from "../../utils/shorthand.ts";

/* -------------------------------------------------------------------------------------------------
 * Pagination Context
 * -----------------------------------------------------------------------------------------------*/
interface PaginationContext {
  size?: PaginationVariants["size"];
  /** `true` inside a `Pagination` (the size may be `undefined` = default). */
  inPagination?: boolean;
}

const PaginationContext = resumableContext(createContext<PaginationContext>({}, { id: "rv-ui-pagination" }));

type PaginationSlots = ReturnType<typeof paginationVariants>;
type PaginationSize = NonNullable<PaginationVariants["size"]>;

const SLOTS: Partial<Record<PaginationSize | "default", PaginationSlots>> = {};
const slotsFor = (size: PaginationVariants["size"]): PaginationSlots => (SLOTS[size ?? "default"] ??= paginationVariants({ size }));

/** Upstream `use(PaginationContext).slots`: the nearest `Pagination`'s slots, `undefined` outside one. */
const slotsOf = (context: PaginationContext): PaginationSlots | undefined => (context.inPagination ? slotsFor(context.size) : undefined);

/* -------------------------------------------------------------------------------------------------
 * Pagination Root
 * -----------------------------------------------------------------------------------------------*/
interface PaginationRootProps<E extends keyof JSX.IntrinsicElements = "nav"> extends DOMRenderProps<E, undefined> {
  /** The compound parts (`Pagination.Content` …). Without children, `total` renders the auto form. */
  children?: Content;
  class?: string;
  /** Pagination size. */
  size?: PaginationVariants["size"];
  /** Auto form: number of pages (with no children, the root renders Previous, page links with ellipses, Next). */
  total?: number;
  /** Auto form: current page (1-based): a value (controlled, with `onPageChange`), a two-way Signal or an accessor. */
  page?: number | Signal<number> | (() => number);
  /** Auto form: uncontrolled start page. @default 1 */
  defaultPage?: number;
  /** Auto form: called with the new page. */
  onPageChange?: (page: number) => void;
  /** Auto form: pages shown on each side of the current one. @default 1 */
  siblings?: number;
  /** Auto form: pages always shown at the start and the end. @default 1 */
  boundaries?: number;
  /** Auto form: text next to the previous icon. @default "Previous" */
  previousLabel?: Content;
  /** Auto form: text next to the next icon. @default "Next" */
  nextLabel?: Content;
}

/** A page number, or a gap (`"start-ellipsis"` / `"end-ellipsis"`: unique keys for the keyed list). */
type PaginationRangeItem = number | "start-ellipsis" | "end-ellipsis";

const range = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
};

/** `page` as a whole number in 1…`total` (`NaN` → 1). */
const clampPage = (page: number, total: number): number => Math.min(Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1), Math.max(1, total));

/**
 * Rivet: the pages the auto form shows — `boundaries` pages at each end, `siblings` around `page`, an ellipsis per gap of
 * two or more pages (a gap of one shows the page). The item count is constant for a given `total` (no layout jump).
 */
function paginationRange(page: number, total: number, siblings = 1, boundaries = 1): PaginationRangeItem[] {
  // Guards: whole numbers only, `Infinity` / `NaN` totals render nothing, `page` clamped into 1…total.
  total = Number.isFinite(total) ? Math.floor(total) : 0;
  if (total <= 0) return [];
  siblings = Number.isFinite(siblings) ? Math.max(0, Math.floor(siblings)) : 1;
  boundaries = Number.isFinite(boundaries) ? Math.max(0, Math.floor(boundaries)) : 1;
  page = clampPage(page, total);
  const start = range(1, Math.min(boundaries, total));
  const end = range(Math.max(total - boundaries + 1, boundaries + 1), total);
  const siblingsStart = Math.max(Math.min(page - siblings, total - boundaries - siblings * 2 - 1), boundaries + 2);
  const siblingsEnd = Math.min(Math.max(page + siblings, boundaries + siblings * 2 + 2), end.length > 0 ? end[0]! - 2 : total - 1);
  const out: PaginationRangeItem[] = [...start];
  if (siblingsStart > boundaries + 2) out.push("start-ellipsis");
  else if (boundaries + 1 < total - boundaries) out.push(boundaries + 1);
  out.push(...range(siblingsStart, siblingsEnd));
  if (siblingsEnd < total - boundaries - 1) out.push("end-ellipsis");
  else if (total - boundaries > boundaries) out.push(total - boundaries);
  out.push(...end);
  return out;
}

type PaginationRootNavProps = PaginationRootProps & Omit<JSX.IntrinsicElements["nav"], keyof PaginationRootProps>;

const PaginationRoot = <E extends keyof JSX.IntrinsicElements = "nav">(props: PaginationRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as PaginationRootNavProps, [
    "children",
    "class",
    "size",
    "total",
    "page",
    "defaultPage",
    "onPageChange",
    "siblings",
    "boundaries",
    "previousLabel",
    "nextLabel",
  ]);
  if (DEV && local.children !== undefined) warnShorthandIgnored("Pagination", local, ["total"]);
  const auto = local.children === undefined && local.total !== undefined;
  const contextValue: PaginationContext = hasLiveProp(local, ["size"])
    ? {
        inPagination: true,
        get size() {
          return local.size;
        },
      }
    : { inPagination: true, size: local.size };

  const content = () => (
    <dom.nav aria-label="pagination" data-slot="pagination" role="navigation" {...rest} class={composeSlotClassName(slotsFor(local.size).base, local.class)}>
      {auto ? <PaginationAuto {...(local as PaginationAutoProps)} /> : local.children}
    </dom.nav>
  );

  return (
    <Provider token={PaginationContext} value={contextValue}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Pagination Auto (Rivet)
 * -----------------------------------------------------------------------------------------------*/
type PaginationAutoProps = Pick<
  PaginationRootProps,
  "total" | "page" | "defaultPage" | "onPageChange" | "siblings" | "boundaries" | "previousLabel" | "nextLabel"
>;

const PaginationAuto = (props: PaginationAutoProps): JSX.Element => {
  // A live plain `page` (`page={p()}`) reaches the state as a read-only accessor (a const arrow: resumable).
  const pageOf = (): number => props.page as number;
  const state = controllable(hasLiveProp(props, ["page"]) && typeof props.page === "number" ? pageOf : props.page, props.defaultPage ?? 1, props.onPageChange);
  const total = (): number => props.total ?? 1;
  // The shown page: a `page` outside 1…total is clamped (no page without an active link; Previous / Next step from it).
  const current = (): number => clampPage(state.value(), total());
  const pages = (): PaginationRangeItem[] => paginationRange(current(), total(), props.siblings, props.boundaries);
  return (
    <PaginationContent>
      <PaginationItem>
        <PaginationPrevious isDisabled={current() <= 1} onPress={() => setControlledValue(state, Math.max(1, current() - 1))}>
          <PaginationPreviousIcon />
          <span>{props.previousLabel ?? "Previous"}</span>
        </PaginationPrevious>
      </PaginationItem>
      <For each={pages} by={(item: PaginationRangeItem) => item}>
        {(item: () => PaginationRangeItem) => (
          <PaginationItem>
            {typeof item() === "number" ? (
              <PaginationLink isActive={item() === current()} onPress={() => setControlledValue(state, item() as number)}>
                {item()}
              </PaginationLink>
            ) : (
              <PaginationEllipsis />
            )}
          </PaginationItem>
        )}
      </For>
      <PaginationItem>
        <PaginationNext isDisabled={current() >= total()} onPress={() => setControlledValue(state, Math.min(total(), current() + 1))}>
          <span>{props.nextLabel ?? "Next"}</span>
          <PaginationNextIcon />
        </PaginationNext>
      </PaginationItem>
    </PaginationContent>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Pagination Summary
 * -----------------------------------------------------------------------------------------------*/
interface PaginationSummaryProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children: Content;
  class?: string;
}

type PaginationSummaryDivProps = PaginationSummaryProps & Omit<JSX.IntrinsicElements["div"], keyof PaginationSummaryProps>;

const PaginationSummary = <E extends keyof JSX.IntrinsicElements = "div">(props: PaginationSummaryProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as PaginationSummaryDivProps, ["children", "class"]);
  const context = useContext(PaginationContext);

  // Auto-detect base direction from the summary's own text so mixed number/word content (e.g. "1 to 5 of 10 invoices") is
  // not bidi-reordered by an RTL ancestor. User-provided `dir` still overrides via the rest props.
  return (
    <dom.div class={composeSlotClassName(slotsOf(context)?.summary, local.class)} data-slot="pagination-summary" dir="auto" {...rest}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Pagination Content
 * -----------------------------------------------------------------------------------------------*/
interface PaginationContentProps<E extends keyof JSX.IntrinsicElements = "ul"> extends DOMRenderProps<E, undefined> {
  children: Content;
  class?: string;
}

type PaginationContentUlProps = PaginationContentProps & Omit<JSX.IntrinsicElements["ul"], keyof PaginationContentProps>;

const PaginationContent = <E extends keyof JSX.IntrinsicElements = "ul">(props: PaginationContentProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as PaginationContentUlProps, ["children", "class"]);
  const context = useContext(PaginationContext);

  return (
    <dom.ul class={composeSlotClassName(slotsOf(context)?.content, local.class)} data-slot="pagination-content" {...rest}>
      {local.children}
    </dom.ul>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Pagination Item
 * -----------------------------------------------------------------------------------------------*/
interface PaginationItemProps<E extends keyof JSX.IntrinsicElements = "li"> extends DOMRenderProps<E, undefined> {
  children: Content;
  class?: string;
}

type PaginationItemLiProps = PaginationItemProps & Omit<JSX.IntrinsicElements["li"], keyof PaginationItemProps>;

const PaginationItem = <E extends keyof JSX.IntrinsicElements = "li">(props: PaginationItemProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as PaginationItemLiProps, ["children", "class"]);
  const context = useContext(PaginationContext);

  return (
    <dom.li class={composeSlotClassName(slotsOf(context)?.item, local.class)} data-slot="pagination-item" {...rest}>
      {local.children}
    </dom.li>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Pagination Link
 * -----------------------------------------------------------------------------------------------*/
interface PaginationLinkProps extends ButtonPrimitiveProps {
  class?: ButtonPrimitiveProps["class"];
  children: ButtonPrimitiveProps["children"];
  isActive?: boolean;
}

const PaginationLink = (props: PaginationLinkProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "isActive", "isDisabled"]);
  const context = useContext(PaginationContext);
  const classOf = () => composeTwRenderProps(local.class as never, slotsOf(context)?.link());
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();
  // A local reaches cdk Button as a plain value: a live `isDisabled` goes in as an accessor (a const arrow: resumable).
  const isDisabledOf = () => !!local.isDisabled;
  const isDisabled = hasLiveProp(local, ["isDisabled"]) ? isDisabledOf : local.isDisabled;
  const live = hasLiveProp(local, ["isActive"]);
  const current = live ? () => (local.isActive ? "page" : undefined) : local.isActive ? "page" : undefined;
  const active = live ? () => (local.isActive ? "true" : undefined) : local.isActive ? "true" : undefined;

  return (
    <ButtonPrimitive
      aria-current={current as never}
      class={cls as never}
      data-active={active as never}
      data-slot="pagination-link"
      isDisabled={isDisabled as never}
      {...rest}
    >
      {local.children}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Pagination Previous
 * -----------------------------------------------------------------------------------------------*/
interface PaginationPreviousProps extends ButtonPrimitiveProps {
  class?: ButtonPrimitiveProps["class"];
  children: ButtonPrimitiveProps["children"];
}

const PaginationPrevious = (props: PaginationPreviousProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "isDisabled"]);
  const context = useContext(PaginationContext);
  const classOf = () => composeTwRenderProps(local.class as never, `${slotsOf(context)?.link() ?? ""} pagination__link--nav`.trim());
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();
  // A local reaches cdk Button as a plain value: a live `isDisabled` goes in as an accessor (a const arrow: resumable).
  const isDisabledOf = () => !!local.isDisabled;
  const isDisabled = hasLiveProp(local, ["isDisabled"]) ? isDisabledOf : local.isDisabled;

  return (
    <ButtonPrimitive class={cls as never} data-slot="pagination-previous" isDisabled={isDisabled as never} {...rest}>
      {local.children}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Pagination Previous Icon
 * -----------------------------------------------------------------------------------------------*/
interface PaginationPreviousIconProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type PaginationPreviousIconSpanProps = PaginationPreviousIconProps & Omit<JSX.IntrinsicElements["span"], keyof PaginationPreviousIconProps>;

const PaginationPreviousIcon = <E extends keyof JSX.IntrinsicElements = "span">(
  props: PaginationPreviousIconProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as PaginationPreviousIconSpanProps, ["children", "class"]);

  return (
    <dom.span aria-hidden="true" class={local.class} data-slot="pagination-previous-icon" {...rest}>
      {local.children ?? <Icon icon={ChevronLeft} size={16} />}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Pagination Next
 * -----------------------------------------------------------------------------------------------*/
interface PaginationNextProps extends ButtonPrimitiveProps {
  class?: ButtonPrimitiveProps["class"];
  children: ButtonPrimitiveProps["children"];
}

const PaginationNext = (props: PaginationNextProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "isDisabled"]);
  const context = useContext(PaginationContext);
  const classOf = () => composeTwRenderProps(local.class as never, `${slotsOf(context)?.link() ?? ""} pagination__link--nav`.trim());
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();
  // A local reaches cdk Button as a plain value: a live `isDisabled` goes in as an accessor (a const arrow: resumable).
  const isDisabledOf = () => !!local.isDisabled;
  const isDisabled = hasLiveProp(local, ["isDisabled"]) ? isDisabledOf : local.isDisabled;

  return (
    <ButtonPrimitive class={cls as never} data-slot="pagination-next" isDisabled={isDisabled as never} {...rest}>
      {local.children}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Pagination Next Icon
 * -----------------------------------------------------------------------------------------------*/
interface PaginationNextIconProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type PaginationNextIconSpanProps = PaginationNextIconProps & Omit<JSX.IntrinsicElements["span"], keyof PaginationNextIconProps>;

const PaginationNextIcon = <E extends keyof JSX.IntrinsicElements = "span">(props: PaginationNextIconProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as PaginationNextIconSpanProps, ["children", "class"]);

  return (
    <dom.span aria-hidden="true" class={local.class} data-slot="pagination-next-icon" {...rest}>
      {local.children ?? <Icon icon={ChevronRight} size={16} />}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Pagination Ellipsis
 * -----------------------------------------------------------------------------------------------*/
interface PaginationEllipsisProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  class?: string;
}

type PaginationEllipsisSpanProps = PaginationEllipsisProps & Omit<JSX.IntrinsicElements["span"], keyof PaginationEllipsisProps>;

const PaginationEllipsis = <E extends keyof JSX.IntrinsicElements = "span">(props: PaginationEllipsisProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as PaginationEllipsisSpanProps, ["class"]);
  const context = useContext(PaginationContext);

  return (
    <dom.span aria-hidden="true" class={composeSlotClassName(slotsOf(context)?.ellipsis, local.class)} data-slot="pagination-ellipsis" {...rest}>
      {"\u2026"}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  paginationRange,
  PaginationRoot,
  PaginationSummary,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationPreviousIcon,
  PaginationNext,
  PaginationNextIcon,
  PaginationEllipsis,
};

export type {
  PaginationRangeItem,
  PaginationRootProps,
  PaginationRootNavProps,
  PaginationSummaryDivProps,
  PaginationContentUlProps,
  PaginationItemLiProps,
  PaginationPreviousIconSpanProps,
  PaginationNextIconSpanProps,
  PaginationEllipsisSpanProps,
  PaginationSummaryProps,
  PaginationContentProps,
  PaginationItemProps,
  PaginationLinkProps,
  PaginationPreviousProps,
  PaginationPreviousIconProps,
  PaginationNextProps,
  PaginationNextIconProps,
  PaginationEllipsisProps,
};
