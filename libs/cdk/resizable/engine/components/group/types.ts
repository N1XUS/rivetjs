// Ported from react-resizable-panels (lib/components/group/types.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: the framework-free part the engine needs (layout, storage, meta, imperative handle); the component props live in
// `../../../index.tsx` (`GroupProps`).
import type { Layout } from "../../global/types.ts";

export type { Layout, Orientation, ResizePreviewMode, ResizeTargetMinimumSize } from "../../global/types.ts";

export type LayoutStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Metadata describing a completed layout change, passed as the second argument to the `onLayoutChanged` callback.
 * See #716.
 */
export type LayoutChangedMeta<RequestedLayout = Layout> = {
  /**
   * `true` when the change was caused by the user directly manipulating a separator (keyboard or pointer)
   * `false` for every other source (imperative API calls, constraint recompute, default-size change, initial mount),
   * because the library cannot attribute the caller's intent there.
   */
  isUserInteraction: boolean;

  /**
   * Layout most recently requested by the user or application (e.g. pointer or keyboard input, imperative API, default layout)
   * before constraints were applied for the current size.
   *
   * This will differ from the validated layout when constraints temporarily override the requested layout,
   * e.g. a panel with a pixel-based `minSize` taking up a larger percentage of a small Group.
   * The requested layout is restored if the Group grows back to a size where it satisfies all constraints.
   *
   * ℹ️ When saving layouts to storage, prefer this value to the validated layout.
   */
  requestedLayout?: RequestedLayout | undefined;
};

/**
 * Imperative Group API.
 *
 * ℹ️ The `useGroupRef` and `useGroupCallbackRef` hooks are exported for convenience use in TypeScript projects.
 */
export interface GroupImperativeHandle {
  /**
   * Get the Group's current layout as a map of Panel id to percentage (0..100)
   *
   * @return Map of Panel id to percentages (specified as numbers ranging between 0..100)
   */
  getLayout: () => { [panelId: string]: number };

  /**
   * Set a new layout for the Group
   *
   * @param layout Map of Panel id to percentage (a number between 0..100)
   * @return Applied layout (after validation)
   */
  setLayout: (layout: { [panelId: string]: number }) => Layout;
}
