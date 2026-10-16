// Ported from react-resizable-panels (lib/components/panel/types.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: the framework-free part the engine needs (sizes, constraints, imperative handle); the component props live in
// `../../../index.tsx` (`PanelProps`).

export type PanelSize = {
  asPercentage: number;
  inPixels: number;
};

export type GroupResizeBehavior = "preserve-relative-size" | "preserve-pixel-size";

export type SizeUnit = "px" | "%" | "em" | "rem" | "vh" | "vw";

/**
 * Imperative Panel API
 *
 * ℹ️ The `usePanelRef` and `usePanelCallbackRef` hooks are exported for convenience use in TypeScript projects.
 */
export interface PanelImperativeHandle {
  /**
   * Collapse the Panel to it's `collapsedSize`.
   *
   * ⚠️ This method will do nothing if the Panel is not `collapsible` or if it is already collapsed.
   */
  collapse: () => void;

  /**
   * Expand a collapsed Panel to its most recent size.
   *
   * ⚠️ This method will do nothing if the Panel is not currently collapsed.
   */
  expand: () => void;

  /**
   * Get the current size of the Panel in pixels as well as a percentage of the parent group (0..100).
   *
   * @return Panel size (in pixels and as a percentage of the parent group)
   */
  getSize: () => {
    asPercentage: number;
    inPixels: number;
  };

  /**
   * The Panel is currently collapsed.
   */
  isCollapsed: () => boolean;

  /**
   * Update the Panel's size.
   *
   * Size can be in the following formats:
   * - Percentage of the parent Group (0..100)
   * - Pixels
   * - Relative font units (em, rem)
   * - Viewport relative units (vh, vw)
   *
   * ℹ️ Numeric values are assumed to be pixels.
   * Strings without explicit units are assumed to be percentages (0%..100%).
   * Percentages may also be specified as strings ending with "%" (e.g. "33%")
   * Pixels may also be specified as strings ending with the unit "px".
   * Other units should be specified as strings ending with their CSS property units (e.g. 1rem, 50vh)
   *
   * @param size New panel size
   * @return Applied size (after validation)
   */
  resize: (size: number | string) => void;
}

/**
 * Called when panel sizes change.
 *
 * @param panelSize Panel size (both as a percentage of the parent Group and in pixels)
 * @param id Panel id (if one was provided as a prop)
 * @param prevPanelSize Previous panel size (will be undefined on mount)
 */
export type OnPanelResize = ((panelSize: PanelSize, id: string | number | undefined, prevPanelSize: PanelSize | undefined) => void) | undefined;

/**
 * Size constraints may be specified in a variety of ways:
 * - Percentage of the parent Group (0..100)
 * - Pixels
 * - Relative font units (em, rem)
 * - Viewport relative units (vh, vw)
 *
 * Numeric values are assumed to be pixels.
 * Strings without explicit units are assumed to be percentages (0%..100%).
 *
 * Percentages may also be specified as strings ending with "%" (e.g. "33%")
 * Pixels may also be specified as strings ending with the unit "px".
 *
 * Other units should be specified as strings ending with their CSS property units (e.g. 1rem, 50vh)
 */
export type PanelConstraintProps = {
  collapsedSize?: number | string | undefined;
  collapsedThreshold?: number | string | undefined;
  collapsible?: boolean | undefined;
  defaultSize?: number | string | undefined;
  disabled?: boolean | undefined;
  groupResizeBehavior?: GroupResizeBehavior | undefined;
  maxSize?: number | string | undefined;
  minSize?: number | string | undefined;
};
