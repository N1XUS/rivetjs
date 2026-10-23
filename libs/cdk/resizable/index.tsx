// Ported from react-resizable-panels (lib/components/group/Group.tsx, lib/components/group/useDefaultLayout.ts,
// lib/components/group/useGroupRef.ts, lib/components/group/useGroupCallbackRef.ts, lib/components/panel/Panel.tsx,
// lib/components/panel/usePanelRef.ts, lib/components/panel/usePanelCallbackRef.ts, lib/components/separator/Separator.tsx,
// lib/components/separator/SeparatorOverlay.tsx, lib/components/shared/ResizeSeparator.tsx, lib/index.ts, v4.14.3), MIT,
// © Brian Vaughn.
// Resizable panel groups (WAI-ARIA window splitter): `Group` (flex container, horizontal / vertical) > `Panel`s with
// percentage / pixel / font / viewport size constraints, collapsible panels, `Separator`s (keyboard: arrows ±5 %,
// Home / End, Enter collapses / expands, F6 cycles; pointer drag, double click resets to `defaultSize`), nested groups,
// imperative handles, `useDefaultLayout` persistence, `resizePreviewMode="separator"` previews.
// Rivet:
// - the engine (`./engine/`, upstream `lib/global` + helpers) is unchanged; the components render the same markup /
//   inline styles / `data-*` attributes and record their props in a serializable `GroupState` (`./mount.ts`).
// - SSR: the server renders the default layout — `defaultLayout` (e.g. from `useDefaultLayout` with a cookie
//   storage) as `flex-grow`, else each panel's `defaultSize` as `flex-basis` (unitless strings → `%`) — no layout shift.
// - resumed pages mount nothing until a separator is hovered / focused / gets a key, the group gets a pointer down,
//   or an imperative method is called (`preload="visible"`: handler chunks fetched + evaluated when visible).
//   The first key / pointer down is replayed to the engine. Client renders mount after insertion (upstream).
// - React refs → `elementRef` (Rivet ref value); `groupRef` / `panelRef` take a `{ current }` object (`useGroupRef()` /
//   `usePanelRef()`) or a function (`useGroupCallbackRef()` / `usePanelCallbackRef()` setters); the handle is set during
//   render (also on the server) and boots the engine on demand.
// - `disabled` / `disableCursor` / `defaultLayout` accept accessors; `orientation`, `resizePreviewMode`, sizes, `id`
//   are read once (upstream re-registers on change).
// - `className` → `class` (Panel: inner element, upstream), defaults `rv-ResizableGroup` / `rv-ResizablePanel` /
//   `rv-ResizableSeparator` when omitted; user `onPointerDown` / `onFocus` / `onBlur` / `onKeyDown` / `onPointerOver`
//   are chained (upstream overrides `onFocus` / `onBlur`).
// - Separator `preview`: a function returning content (or `<SeparatorOverlay/>`), called when the preview shows.
// - `cookieStorage` (Rivet; upstream documents a cookie storage as an example): server-readable (`ssr: true`), so the
//   stored layout is server-rendered and `useDefaultLayout` registers no client restore effect.
// - Separator `tabindex` is a lowercase spread key (a resumed spread diffs server attribute names against the keys).
import { createContext, signal, untrack, useContext } from "@rivetjs/reactivity";
import { Provider, clientEffect } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { splitProps } from "@rivetjs/runtime/props";
import { createId } from "../utils/id.ts";
import type { StyleObject } from "../utils/types.ts";
import type { RefValue } from "../slots/index.tsx";
import {
  activateGroup,
  currentPreview,
  ensureGroup,
  groupMethods,
  groupPointerDown,
  panelMethods,
  read,
  requestMount,
  separatorKeyDown,
  unmountGroup,
  type GroupState,
  type MaybeAccessor,
  type PanelRecord,
  type SeparatorAria,
  type SeparatorOverlayAttributes,
  type SeparatorRecord,
} from "./mount.ts";
import { parseSizeAndUnit } from "./engine/global/styles/parseSizeAndUnit.ts";
import { getStorageKey } from "./engine/components/group/auto-save/getStorageKey.ts";
import { readLegacyLayout } from "./engine/components/group/readLegacyLayout.ts";
import type { InteractionState } from "./engine/global/mutable-state/types.ts";
import type { Layout, Orientation, ResizePreviewMode, ResizeTargetMinimumSize } from "./engine/global/types.ts";
import type { GroupImperativeHandle, LayoutChangedMeta, LayoutStorage } from "./engine/components/group/types.ts";
import type { OnPanelResize, PanelImperativeHandle, PanelSize, SizeUnit, GroupResizeBehavior } from "./engine/components/panel/types.ts";

export { isCoarsePointer } from "./engine/global/utils/isCoarsePointer.ts";
export type { Layout, LayoutChangedMeta, LayoutStorage, Orientation, ResizePreviewMode, ResizeTargetMinimumSize };
export type { GroupImperativeHandle, OnPanelResize, PanelImperativeHandle, PanelSize, SizeUnit, GroupResizeBehavior };
export type { GroupState };

type DivAttributes = Omit<JSX.IntrinsicElements["div"], "children" | "style" | "ref" | "class" | "id">;

/** A ref object (`useGroupRef()` / `usePanelRef()`) or a function receiving the handle. */
export type ImperativeRef<T> = { current: T | null } | ((handle: T | null) => void);

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/

/** The nearest Group's state (upstream `GroupContext`). */
export const GroupContext = createContext<GroupState | null>(null);

function useGroupContext(): GroupState {
  const context = useContext(GroupContext);
  if (!context) throw new Error("Group Context not found; did you render a Panel or Separator outside of a Group?");
  return context;
}

const isClient = (): boolean => (globalThis as { document?: unknown }).document !== undefined;

function assignRef<T>(ref: ImperativeRef<T> | undefined, handle: T): void {
  if (!ref) return;
  if (typeof ref === "function") ref(handle);
  else ref.current = handle;
}

/* -------------------------------------------------------------------------------------------------
 * Group
 * -----------------------------------------------------------------------------------------------*/

export interface GroupProps extends DivAttributes {
  /** Panel and Separator components that comprise this group. */
  children?: Content;
  /** CSS class name (default `rv-ResizableGroup`). */
  class?: string;
  /**
   * Default layout for the Group (map of Panel id to percentage).
   *
   * ℹ️ This value allows layouts to be remembered between page reloads (`useDefaultLayout`); rendered by the server.
   */
  defaultLayout?: MaybeAccessor<Layout | undefined>;
  /**
   * This library sets custom mouse cursor styles to indicate drag state.
   * Use this prop to disable that behavior for Panels and Separators in this group.
   */
  disableCursor?: MaybeAccessor<boolean | undefined>;
  /** Disable resize functionality. */
  disabled?: MaybeAccessor<boolean | undefined>;
  /** Ref attached to the root `HTMLDivElement`. */
  elementRef?: RefValue<HTMLDivElement>;
  /**
   * Exposes the following imperative API:
   * - `getLayout(): Layout`
   * - `setLayout(layout: Layout): void`
   */
  groupRef?: ImperativeRef<GroupImperativeHandle>;
  /**
   * Uniquely identifies this group within an application (falls back to a generated id).
   *
   * ℹ️ This value will also be assigned to the `id` and `data-testid` attributes.
   */
  id?: string | number;
  /**
   * Called when the Group's layout is changing.
   *
   * ⚠️ For layout changes caused by pointer events, this method is called each time the pointer is moved.
   * For most cases, it is recommended to use the `onLayoutChanged` callback instead.
   */
  onLayoutChange?: (layout: Layout) => void;
  /**
   * Called after the Group's layout has been changed (pointer: once released). Recommended for persisting layouts;
   * `meta.isUserInteraction` is true for pointer / keyboard input, `meta.requestedLayout` is the layout before
   * size-dependent constraints (prefer it when persisting).
   */
  onLayoutChanged?: (layout: Layout, meta: LayoutChangedMeta) => void;
  /**
   * Whether pointer dragging resizes `Panel`s immediately (`"panel"`, default) or renders separator previews until
   * the pointer is released (`"separator"`; customize with `SeparatorOverlay`).
   */
  resizePreviewMode?: ResizePreviewMode;
  /**
   * Minimum size of the resizable hit target area (either `Separator` or `Panel` edge), for coarse (touch) and fine
   * (mouse) pointers. @default { coarse: 20, fine: 10 }
   */
  resizeTargetMinimumSize?: ResizeTargetMinimumSize;
  /** Specifies the resizable orientation. @default "horizontal" */
  orientation?: Orientation;
  /** CSS properties (the layout styles cannot be overridden, except for `overflow`). */
  style?: StyleObject;
}

const GROUP_KEYS = [
  "children",
  "class",
  "defaultLayout",
  "disableCursor",
  "disabled",
  "elementRef",
  "groupRef",
  "id",
  "onLayoutChange",
  "onLayoutChanged",
  "orientation",
  "resizePreviewMode",
  "resizeTargetMinimumSize",
  "style",
  "onPointerDown",
] as const;

/**
 * A Group wraps a set of resizable Panel components. Group content can be resized _horizontally_ or _vertically_.
 *
 * Group elements always include the following attributes:
 *
 * ```html
 * <div data-group data-testid="group-id-prop" id="group-id-prop">
 * ```
 */
export function Group(props: GroupProps): JSX.Element {
  const [local, rest] = splitProps(props as Record<string, unknown>, GROUP_KEYS) as unknown as [GroupProps, DivAttributes];
  const orientation: Orientation = local.orientation ?? "horizontal";
  const resizePreviewMode: ResizePreviewMode = local.resizePreviewMode ?? "panel";
  const idProp = local.id;
  const disabled = local.disabled;
  const disableCursor = local.disableCursor;
  const defaultLayout = local.defaultLayout;
  const minimum = local.resizeTargetMinimumSize;
  const onLayoutChange = local.onLayoutChange;
  const onLayoutChanged = local.onLayoutChanged;
  const state: GroupState = {
    id: idProp != null ? String(idProp) : createId(),
    orientation,
    disabled,
    disableCursor,
    defaultLayout,
    resizePreviewMode,
    resizeTargetMinimumSize: minimum ?? { coarse: 20, fine: 10 },
    onLayoutChange,
    onLayoutChanged,
    layout: signal<Layout | undefined>(undefined),
    panels: {},
    separators: {},
    overlay: undefined,
    memory: { lastExpandedPanelSizes: {}, layouts: {} },
  };
  const id = state.id;
  assignRef(local.groupRef, {
    getLayout: () => groupMethods(state).getLayout(),
    setLayout: (layout: Layout) => groupMethods(state).setLayout(layout),
  } satisfies GroupImperativeHandle);
  // Client render: register with the engine after insertion (upstream layout effect); a resumed group waits for input.
  if (isClient())
    clientEffect(() => {
      untrack(() => ensureGroup(state));
      return () => unmountGroup(state);
    });
  const cls = local.class ?? "rv-ResizableGroup";
  const userStyle = local.style;
  const elementRef = local.elementRef as never;
  const children = local.children;
  const onPointerDown = local.onPointerDown as ((event: PointerEvent) => void) | undefined;
  return (
    <div
      {...rest}
      class={cls}
      data-group="true"
      data-testid={id}
      id={id}
      ref={elementRef}
      preload="visible"
      onPointerDown={(event: PointerEvent) => {
        onPointerDown?.(event);
        groupPointerDown(state, event);
      }}
      style={{
        height: "100%",
        width: "100%",
        overflow: "hidden",
        position: resizePreviewMode === "separator" ? "relative" : undefined,
        ...userStyle,
        display: "flex",
        flexDirection: orientation === "horizontal" ? "row" : "column",
        flexWrap: "nowrap",
        // Inform the browser that the library is handling touch events for this element
        // but still allow users to scroll content within panels in the non-resizing direction
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: orientation === "horizontal" ? "pan-y" : "pan-x",
      }}
    >
      <Provider token={GroupContext} value={state}>
        {children}
      </Provider>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Panel
 * -----------------------------------------------------------------------------------------------*/

export interface PanelProps extends Omit<DivAttributes, "onResize"> {
  children?: Content;
  /** CSS class name of the inner element (upstream: avoids styles that interfere with the flex layout). */
  class?: string;
  /** Panel size when collapsed. @default "0%" */
  collapsedSize?: number | string;
  /**
   * Distance a collapsible panel must be resized past its `minSize` to collapse, or past its `collapsedSize` to
   * expand. Defaults to half the distance between `collapsedSize` and `minSize`.
   */
  collapsedThreshold?: number | string;
  /** This panel can be collapsed (when resized below its `minSize`). */
  collapsible?: boolean;
  /**
   * Default size of Panel within its parent group; default is auto-assigned based on the total number of Panels.
   *
   * ℹ️ Numbers are pixels, strings without units percentages; explicit units: "px", "%", "em", "rem", "vh", "vw".
   */
  defaultSize?: number | string;
  /** When disabled, a panel cannot be resized either directly or indirectly (by resizing another panel). */
  disabled?: MaybeAccessor<boolean | undefined>;
  /** Ref attached to the root `HTMLDivElement`. */
  elementRef?: RefValue<HTMLDivElement>;
  /**
   * How should this Panel behave if the parent Group is resized? `preserve-relative-size` (percentage) or
   * `preserve-pixel-size`. ⚠️ A Group must contain at least one Panel with `preserve-relative-size`.
   * @default "preserve-relative-size"
   */
  groupResizeBehavior?: GroupResizeBehavior;
  /**
   * Uniquely identifies this panel within the parent group (falls back to a generated id); persisted layouts key on it.
   * Also assigned to the `id` and `data-testid` attributes.
   */
  id?: string | number;
  /** Maximum size of Panel within its parent group. @default "100%" */
  maxSize?: number | string;
  /** Minimum size of Panel within its parent group. @default "0%" */
  minSize?: number | string;
  /** Called when panel sizes change (size as a percentage and in pixels, the `id` prop, the previous size). */
  onResize?: OnPanelResize;
  /**
   * Exposes the following imperative API: `collapse()`, `expand()`, `getSize()`, `isCollapsed()`, `resize(size)`.
   */
  panelRef?: ImperativeRef<PanelImperativeHandle>;
  /** CSS properties of the inner element. */
  style?: StyleObject;
}

const PANEL_KEYS = [
  "children",
  "class",
  "collapsedSize",
  "collapsedThreshold",
  "collapsible",
  "defaultSize",
  "disabled",
  "elementRef",
  "groupResizeBehavior",
  "id",
  "maxSize",
  "minSize",
  "onResize",
  "panelRef",
  "style",
] as const;

const PROHIBITED_CSS_PROPERTIES: StyleObject = {
  minHeight: 0,
  maxHeight: "100%",
  height: "auto",
  minWidth: 0,
  maxWidth: "100%",
  width: "auto",
  border: "none",
  borderWidth: 0,
  padding: 0,
  margin: 0,
};

/** A size prop as CSS (`flex-basis` before the layout is known): numbers px, unitless strings %. */
function cssSize(size: number | string): string {
  const [value, unit] = parseSizeAndUnit(size);
  return `${value}${unit}`;
}

/** Upstream Panel `panelStyles` (mounted layout → default layout → default size → equal share). */
function panelStyles(group: GroupState, id: string, defaultSize: number | string | undefined): StyleObject {
  const layout = group.layout();
  if (layout) return { flexGrow: layout[id] ?? 1 };
  const defaults = read(group.defaultLayout);
  if (defaults?.[id]) return { flexGrow: defaults[id] };
  if (defaultSize !== undefined) return { flexGrow: undefined, flexShrink: undefined, flexBasis: cssSize(defaultSize) };
  return { flexGrow: 1 };
}

/**
 * A Panel wraps resizable content and can be configured with min/max size constraints and collapsible behavior.
 *
 * Panel elements always include the following attributes:
 *
 * ```html
 * <div data-panel data-testid="panel-id-prop" id="panel-id-prop">
 * ```
 *
 * ⚠️ Panel elements must be direct DOM children of their parent Group elements.
 */
export function Panel(props: PanelProps): JSX.Element {
  const [local, rest] = splitProps(props as Record<string, unknown>, PANEL_KEYS) as unknown as [PanelProps, DivAttributes];
  const group = useGroupContext();
  const idProp = local.id;
  const disabled = local.disabled;
  const defaultSize = local.defaultSize;
  const record: PanelRecord = {
    id: idProp != null ? String(idProp) : createId(),
    idProp,
    idIsStable: idProp != null,
    collapsedSize: local.collapsedSize ?? "0%",
    collapsedThreshold: local.collapsedThreshold,
    collapsible: local.collapsible ?? false,
    defaultSize,
    disabled,
    groupResizeBehavior: local.groupResizeBehavior ?? "preserve-relative-size",
    maxSize: local.maxSize ?? "100%",
    minSize: local.minSize ?? "0%",
    onResize: local.onResize,
  };
  const id = record.id;
  group.panels[id] = record;
  assignRef(local.panelRef, {
    collapse: () => panelMethods(group, id).collapse(),
    expand: () => panelMethods(group, id).expand(),
    getSize: () => panelMethods(group, id).getSize(),
    isCollapsed: () => panelMethods(group, id).isCollapsed(),
    resize: (size: number | string) => panelMethods(group, id).resize(size),
  } satisfies PanelImperativeHandle);
  // Client render: the group re-registers its panels (upstream registerPanel / unregister → forceUpdate).
  if (isClient())
    clientEffect(() => {
      untrack(() => requestMount(group));
      return () => requestMount(group);
    });
  const orientation = group.orientation;
  const cls = local.class ?? "rv-ResizablePanel";
  const userStyle = local.style;
  const elementRef = local.elementRef as never;
  const children = local.children;
  return (
    <div
      {...rest}
      data-disabled={read(disabled) ? "true" : undefined}
      data-panel="true"
      data-testid={id}
      id={id}
      ref={elementRef}
      style={{
        ...PROHIBITED_CSS_PROPERTIES,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...panelStyles(group, id, defaultSize),
      }}
    >
      <div
        class={cls}
        style={{
          maxHeight: "100%",
          maxWidth: "100%",
          flexGrow: 1,
          overflow: "auto",
          ...userStyle,
          // Inform the browser that the library is handling touch events for this element
          // but still allow users to scroll content within panels in the non-resizing direction
          // See github.com/bvaughn/react-resizable-panels/issues/662
          touchAction: orientation === "horizontal" ? "pan-y" : "pan-x",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Separator
 * -----------------------------------------------------------------------------------------------*/

export interface SeparatorProps extends Omit<DivAttributes, "role" | "tabIndex"> {
  children?: Content;
  /**
   * CSS class name (default `rv-ResizableSeparator`).
   *
   * ℹ️ Use the `data-separator` attribute for custom _hover_ and _active_ styles
   */
  class?: string;
  /**
   * When disabled, the separator cannot be used to resize its neighboring panels (they may still resize indirectly).
   */
  disabled?: MaybeAccessor<boolean | undefined>;
  /** When true, double-clicking this `Separator` will not reset its `Panel` to its default size. */
  disableDoubleClick?: boolean;
  /** Ref attached to the root `HTMLDivElement`. */
  elementRef?: RefValue<HTMLDivElement>;
  /** Uniquely identifies the separator within the parent group (falls back to a generated id). */
  id?: string | number;
  /**
   * Overrides the `Group` default preview for this `Separator` when `resizePreviewMode` is "separator": a function
   * returning the preview content (or `<SeparatorOverlay … />`).
   */
  preview?: () => unknown;
  /** CSS properties (`flex-grow` / `flex-shrink` cannot be overridden). */
  style?: StyleObject;
}

const SEPARATOR_KEYS = [
  "children",
  "class",
  "disabled",
  "disableDoubleClick",
  "elementRef",
  "id",
  "preview",
  "style",
  "onFocus",
  "onBlur",
  "onKeyDown",
  "onPointerOver",
] as const;

/** Upstream ResizeSeparator `data-separator` value. */
function separatorState(disabled: boolean | undefined, drag: InteractionState["state"], focused: boolean): string {
  if (disabled) return "disabled";
  if (drag === "active") return "active";
  return focused ? "focus" : drag;
}

/**
 * Separators are not _required_ but they are _recommended_ as they improve keyboard accessibility.
 *
 * ⚠️ Separator elements must be direct DOM children of their parent Group elements.
 *
 * ```html
 * <div data-separator data-testid="separator-id-prop" id="separator-id-prop" role="separator">
 * ```
 */
export function Separator(props: SeparatorProps): JSX.Element {
  const [local, rest] = splitProps(props as Record<string, unknown>, SEPARATOR_KEYS) as unknown as [SeparatorProps, DivAttributes];
  const group = useGroupContext();
  const idProp = local.id;
  const disabled = local.disabled;
  const record: SeparatorRecord = {
    id: idProp != null ? String(idProp) : createId(),
    disabled,
    disableDoubleClick: local.disableDoubleClick,
    preview: local.preview,
    drag: signal<InteractionState["state"]>("inactive"),
    focused: signal(false),
    aria: signal<SeparatorAria>({}),
  };
  const id = record.id;
  group.separators[id] = record;
  if (isClient())
    clientEffect(() => {
      untrack(() => requestMount(group));
      return () => requestMount(group);
    });
  // The separator's orientation is the opposite of the group's (`aria-orientation`).
  const orientation = group.orientation === "horizontal" ? "vertical" : "horizontal";
  const disableCursor = group.disableCursor;
  const aria = record.aria;
  const drag = record.drag;
  const focused = record.focused;
  const cls = local.class ?? "rv-ResizableSeparator";
  const userStyle = local.style;
  const elementRef = local.elementRef as never;
  const children = local.children;
  const onFocus = local.onFocus as ((event: FocusEvent) => void) | undefined;
  const onBlur = local.onBlur as ((event: FocusEvent) => void) | undefined;
  const onKeyDown = local.onKeyDown as ((event: KeyboardEvent) => void) | undefined;
  const onPointerOver = local.onPointerOver as ((event: PointerEvent) => void) | undefined;
  return (
    <div
      {...rest}
      aria-controls={aria().valueControls}
      aria-disabled={read(disabled) ? "true" : undefined}
      aria-orientation={orientation}
      aria-valuemax={aria().valueMax}
      aria-valuemin={aria().valueMin}
      aria-valuenow={aria().valueNow}
      class={cls}
      data-separator={separatorState(read(disabled), drag(), focused())}
      data-testid={id}
      id={id}
      ref={elementRef}
      role="separator"
      // lowercase key: a resumed spread diffs the server's attribute names against the keys (a `tabIndex` key drops
      // `tabindex` for a moment on the first re-run: Chrome blurs the separator and releases its pointer capture)
      {...({ tabindex: read(disabled) ? undefined : 0 } as {})}
      preload="visible"
      onPointerOver={(event: PointerEvent) => {
        onPointerOver?.(event);
        activateGroup(group);
      }}
      onFocus={(event: FocusEvent) => {
        onFocus?.(event);
        activateGroup(group);
        focused.set(true);
      }}
      onBlur={(event: FocusEvent) => {
        onBlur?.(event);
        focused.set(false);
      }}
      onKeyDown={(event: KeyboardEvent) => {
        onKeyDown?.(event);
        separatorKeyDown(group, event);
      }}
      style={{
        flexBasis: "auto",
        cursor: read(disabled) && !read(disableCursor) ? "not-allowed" : undefined,
        ...userStyle,
        flexGrow: 0,
        flexShrink: 0,
        // Inform the browser that the library is handling touch events for this element
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: "none",
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * SeparatorOverlay
 * -----------------------------------------------------------------------------------------------*/

export interface SeparatorOverlayProps extends DivAttributes {
  class?: string;
  style?: StyleObject;
}

/**
 * Customizes separator previews when resizePreviewMode is "separator".
 * Render within a `Group` to style all overlay previews, or return it from an individual `Separator`'s `preview`
 * function to style its overlay preview.
 *
 * Use `data-separator-overlay="active"` to style the separator being dragged,
 * or `data-separator-overlay="inactive"` for separators moved indirectly.
 *
 * Set `width` (horizontal groups) or `height` (vertical groups) using `style` or `class`.
 */
export function SeparatorOverlay(props: SeparatorOverlayProps): JSX.Element {
  const attributes = { ...(props as Record<string, unknown>) } as SeparatorOverlayAttributes;
  // Inside a separator `preview` function: a marker the preview renderer turns into the overlay element.
  if (currentPreview()) return { __rvSeparatorOverlay: attributes } as unknown as JSX.Element;
  const group = useGroupContext();
  group.overlay = attributes;
  return null as unknown as JSX.Element;
}

/* -------------------------------------------------------------------------------------------------
 * Refs
 * -----------------------------------------------------------------------------------------------*/

/** Convenience hook to return a properly typed ref for the Group component. */
export function useGroupRef(): { current: GroupImperativeHandle | null } {
  return { current: null as GroupImperativeHandle | null };
}

/** Convenience hook to return a properly typed ref for the Panel component. */
export function usePanelRef(): { current: PanelImperativeHandle | null } {
  return { current: null as PanelImperativeHandle | null };
}

/**
 * Convenience hook to return a properly typed ref callback for the Group component: `[handle, setHandle]` (Rivet:
 * `handle` is an accessor, upstream React state).
 */
export function useGroupCallbackRef(): [() => GroupImperativeHandle | null, (handle: GroupImperativeHandle | null) => void] {
  const handle = signal<GroupImperativeHandle | null>(null);
  return [handle, (value: GroupImperativeHandle | null) => handle.set(value)];
}

/**
 * Convenience hook to return a properly typed ref callback for the Panel component: `[handle, setHandle]` (Rivet:
 * `handle` is an accessor, upstream React state).
 */
export function usePanelCallbackRef(): [() => PanelImperativeHandle | null, (handle: PanelImperativeHandle | null) => void] {
  const handle = signal<PanelImperativeHandle | null>(null);
  return [handle, (value: PanelImperativeHandle | null) => handle.set(value)];
}

/* -------------------------------------------------------------------------------------------------
 * useDefaultLayout
 * -----------------------------------------------------------------------------------------------*/

export interface UseDefaultLayoutOptions {
  /**
   * Debounce save operation by the specified number of milliseconds; defaults to 100ms
   * @deprecated Use the `onLayoutChanged` callback instead; it does not require debouncing
   */
  debounceSaveMs?: number;
  /** Only auto-save layouts that were directly caused by user input (keyboard or pointer). */
  onlySaveAfterUserInteractions?: boolean;
  /**
   * For Groups that contain conditionally-rendered Panels: save and restore one layout per set of panel ids.
   * ⚠️ Panel ids must match the Panels rendered within the Group during mount or the initial layout will be incorrect.
   */
  panelIds?: string[];
  /**
   * Storage implementation; supports localStorage (default, browser only), sessionStorage, cookies
   * (`cookieStorage(...)`: also read by the server, no layout shift) and custom implementations.
   */
  storage?: LayoutStorage;
  /** Uniquely identifies a specific group/layout. */
  id?: string;
  /** @deprecated Use the `id` param instead */
  groupId?: string;
}

const defaultStorage = (): LayoutStorage | undefined => {
  try {
    return (globalThis as { document?: unknown }).document === undefined
      ? undefined
      : ((globalThis as { localStorage?: LayoutStorage }).localStorage ?? undefined);
  } catch {
    return undefined;
  }
};

/** Upstream `useDefaultLayout` read: modern (v4) layout, else the legacy (v3) record. */
function readLayout(storage: LayoutStorage | undefined, id: string, panelIds: string[] | undefined): Layout | undefined {
  if (!storage) return undefined;
  let value: string | null = null;
  try {
    value = storage.getItem(getStorageKey(id, panelIds ?? []));
  } catch {
    return undefined;
  }
  if (value) {
    try {
      // Rule out false positive for legacy layout format
      const parsed = JSON.parse(value);
      if (Object.values(parsed).every((v) => typeof v === "number")) return parsed as Layout;
    } catch {
      // unreadable entry
    }
  }
  return readLegacyLayout({ id, panelIds, storage });
}

/**
 * Saves and restores group layouts between page loads (localStorage, sessionStorage, cookies or any other storage).
 *
 * Rivet: `defaultLayout` is an accessor (pass it to `Group` as is). The server renders the stored layout when its
 * storage is readable there (`cookieStorage(request cookie header)`); when the server could not read one (browser-only
 * storage, static prerender) the stored layout is applied at idle on the client.
 */
export function useDefaultLayout(options: UseDefaultLayoutOptions): {
  defaultLayout: () => Layout | undefined;
  onLayoutChange: (layout: Layout) => void;
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void;
} {
  const id = (options.id ?? options.groupId)!;
  const panelIds = options.panelIds;
  const hasPanelIds = panelIds !== undefined;
  const storage = options.storage;
  const debounceSaveMs = options.debounceSaveMs ?? 100;
  const onlySaveAfterUserInteractions = !!options.onlySaveAfterUserInteractions;
  const state = {
    layout: signal<Layout | undefined>(readLayout(storage ?? defaultStorage(), id, panelIds)),
    timeout: { current: 0 as unknown },
  };
  // The server had no stored layout (browser-only storage, e.g. localStorage): restore it on the client once idle.
  // A server-readable storage (`cookieStorage`, `ssr: true`) already rendered the truth: nothing boots at load.
  if (!isClient() && state.layout() === undefined && !(storage as { ssr?: boolean } | undefined)?.ssr)
    clientEffect(
      () => {
        const stored = readLayout(storage ?? defaultStorage(), id, panelIds);
        if (stored) state.layout.set(stored);
      },
      { when: "idle" },
    );
  const layout = state.layout;
  const timeout = state.timeout;
  const save = {
    // The hook persists every layout commit -- including library-driven ones -- because it owns its own storage.
    changed: (next: Layout, meta: LayoutChangedMeta) => {
      if (onlySaveAfterUserInteractions && !meta.isUserInteraction) return;
      clearTimeout(timeout.current as number);
      // Save the requested layout so size-dependent constraints aren't persisted (see #720)
      const layoutToSave = meta.requestedLayout ?? next;
      const writeStorageKey = hasPanelIds ? getStorageKey(id, Object.keys(layoutToSave)) : getStorageKey(id, []);
      try {
        (storage ?? defaultStorage())?.setItem(writeStorageKey, JSON.stringify(layoutToSave));
      } catch (error) {
        console.error(error);
      }
    },
  };
  return {
    /** Pass this value to `Group` as the `defaultLayout` prop. */
    defaultLayout: () => layout(),
    /** @deprecated Use `onLayoutChanged` instead. */
    onLayoutChange: (next: Layout) => {
      clearTimeout(timeout.current as number);
      if (debounceSaveMs === 0) save.changed(next, { isUserInteraction: false });
      else timeout.current = setTimeout(() => save.changed(next, { isUserInteraction: false }), debounceSaveMs);
    },
    /** Attach this callback on the `Group` as the `onLayoutChanged` prop. */
    onLayoutChanged: (next: Layout, meta: LayoutChangedMeta) => save.changed(next, meta),
  };
}

/**
 * Rivet addition (upstream documents it as an example): a cookie `LayoutStorage`. Pass the request's `Cookie` header
 * (or a cookie map) on the server so the stored layout is server-rendered; in the browser it reads `document.cookie`.
 */
export function cookieStorage(
  source?: string | { get(name: string): string | undefined } | null,
  options?: { maxAge?: number; path?: string },
): LayoutStorage & { readonly ssr: true } {
  const maxAge = options?.maxAge ?? 60 * 60 * 24 * 365;
  const path = options?.path ?? "/";
  const header = typeof source === "string" ? source : undefined;
  const map = source && typeof source === "object" ? source : undefined;
  return {
    ssr: true,
    getItem: (key: string) => {
      const name = encodeURIComponent(key);
      const fromMap = map?.get(name) ?? map?.get(key);
      if (fromMap != null) return decodeURIComponent(fromMap);
      const doc = (globalThis as { document?: Document }).document;
      const cookies = doc ? doc.cookie : (header ?? "");
      for (const cookie of cookies.split(";")) {
        const [cookieName, ...value] = cookie.trim().split("=");
        if (cookieName === name || cookieName === key) return decodeURIComponent(value.join("="));
      }
      return null;
    },
    setItem: (key: string, value: string) => {
      const doc = (globalThis as { document?: Document }).document;
      if (doc) doc.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=${path}; max-age=${maxAge}; samesite=lax`;
    },
  };
}
