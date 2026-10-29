// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no compare / image-compare component). Before /
// after comparison in the HeroUI visual language: two overlapped layers (images or any content), a divider line and a
// round surface handle with a lucide grip icon, optional "Before" / "After" label badges; Rivet-authored styles on HeroUI
// tokens (`styles/components/compare.css`).
// - Behaviour + motion = `@rivetjs/cdk/compare` (headless parts; house motion for keyed / jump settles, 1:1 drag): every
//   part here is the cdk part with the BEM class of its slot, so state / ARIA / resumability are the cdk's (nothing runs
//   before the first pointer / key event; the root carries `preload="visible"`).
// - `Compare.Handle` without children renders `Compare.Divider` + `Compare.Thumb` (lucide `ChevronsLeftRight`, vertical
//   `ChevronsUpDown`); any children replace them (custom handles).
import {
  Compare as CdkCompare,
  CompareAfter as CdkCompareAfter,
  CompareBefore as CdkCompareBefore,
  CompareContext,
  CompareDivider as CdkCompareDivider,
  CompareHandle as CdkCompareHandle,
} from "@rivetjs/cdk/compare";
import type {
  CompareDividerProps as CdkCompareDividerProps,
  CompareHandleProps as CdkCompareHandleProps,
  CompareLayerProps,
  CompareProps,
} from "@rivetjs/cdk/compare";
import { Icon } from "@rivetjs/kit/icon";
import { useContext } from "@rivetjs/reactivity";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { ChevronsLeftRight, ChevronsUpDown } from "lucide";

import { compareVariants } from "../../../styles/src/components/compare/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

/** Module-level slots (tv slot functions are pure; no variants). */
const slots = compareVariants();

/* -------------------------------------------------------------------------------------------------
 * Compare Root
 * -----------------------------------------------------------------------------------------------*/
type CompareRootProps = CompareProps;

const CompareRoot = (props: CompareRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <CdkCompare data-slot="compare" {...(rest as CompareProps)} class={composeSlotClassName(slots.base, local.class)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Before / After
 * -----------------------------------------------------------------------------------------------*/
type CompareBeforeProps = CompareLayerProps;
type CompareAfterProps = CompareLayerProps;

const CompareBefore = (props: CompareBeforeProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <CdkCompareBefore data-slot="compare-before" {...(rest as CompareLayerProps)} class={composeSlotClassName(slots.before, local.class)} />;
};

const CompareAfter = (props: CompareAfterProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <CdkCompareAfter data-slot="compare-after" {...(rest as CompareLayerProps)} class={composeSlotClassName(slots.after, local.class)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Handle (+ default divider + thumb)
 * -----------------------------------------------------------------------------------------------*/
type CompareHandleProps = CdkCompareHandleProps;

const CompareHandle = (props: CompareHandleProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <CdkCompareHandle data-slot="compare-handle" {...(rest as CdkCompareHandleProps)} class={composeSlotClassName(slots.handle, local.class)}>
      {local.children ?? (
        <>
          <CompareDivider />
          <CompareThumb />
        </>
      )}
    </CdkCompareHandle>
  );
};

type CompareDividerProps = CdkCompareDividerProps;

const CompareDivider = (props: CompareDividerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <CdkCompareDivider data-slot="compare-divider" {...(rest as CdkCompareDividerProps)} class={composeSlotClassName(slots.divider, local.class)} />;
};

interface CompareThumbProps extends Omit<JSX.IntrinsicElements["span"], "children" | "class"> {
  class?: string;
  /** Replaces the default lucide grip icon. */
  children?: Content;
}

/** The round surface button on the divider (decorative: the handle is the slider). */
const CompareThumb = (props: CompareThumbProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  const vertical = useContext(CompareContext)?.orientation === "vertical";
  return (
    <span data-slot="compare-thumb" aria-hidden="true" class={composeSlotClassName(slots.thumb, local.class)} {...rest}>
      {local.children ?? <Icon icon={vertical ? ChevronsUpDown : ChevronsLeftRight} size={20} />}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Label
 * -----------------------------------------------------------------------------------------------*/
interface CompareLabelProps extends Omit<JSX.IntrinsicElements["span"], "children" | "class"> {
  /**
   * Corner of the layer: `start` (top start) or `end` (top end; vertical: bottom start). Put the "before" label in
   * `Compare.Before` with `start` and the "after" label in `Compare.After` with `end`: each is clipped with its layer.
   *
   * @default "start"
   */
  placement?: "start" | "end";
  class?: string;
  children?: Content;
}

const CompareLabel = (props: CompareLabelProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "placement"]);
  const orientation = useContext(CompareContext)?.orientation;
  const placement = local.placement ?? "start";
  return (
    <span data-slot="compare-label" data-placement={placement} data-orientation={orientation} class={composeSlotClassName(slots.label, local.class)} {...rest}>
      {local.children}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { CompareRoot, CompareBefore, CompareAfter, CompareHandle, CompareDivider, CompareThumb, CompareLabel };
export type { CompareRootProps, CompareBeforeProps, CompareAfterProps, CompareHandleProps, CompareDividerProps, CompareThumbProps, CompareLabelProps };
