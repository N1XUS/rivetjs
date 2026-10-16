// Ported from react-resizable-panels (lib/components/group/Group.tsx, lib/components/panel/Panel.tsx,
// lib/components/shared/ResizeSeparator.tsx, lib/components/group/useResizePreviews.ts, lib/components/group/ResizePreview.tsx,
// lib/components/separator/SeparatorClone.tsx, lib/components/separator/SeparatorOverlayRenderer.tsx, v4.14.3), MIT,
// © Brian Vaughn — the effect bodies of the components (registration with the global engine, change subscriptions,
// previews), framework-free.
// Rivet:
// - the components (`./index.tsx`) only render markup + record their props in a serializable `GroupState`
//   (`_regionState`): panel / separator records keyed by id. `ensureGroup(state)` builds the engine's
//   `RegisteredResizeAxis` from the group element's DOM children (`data-panel` / `data-separator` with a record) — the
//   upstream Group's `useIsomorphicLayoutEffect` — and mounts it (`../engine/global/mountAxis.ts`, unchanged).
// - when: a client render mounts after the Group is inserted (its `clientEffect`); a server-rendered (resumed) group
//   stays unmounted — pure CSS flex layout from the server styles — until its first separator hover / focus / key or a
//   pointer down on it, which mount it synchronously in the handler (and replay that first event to the engine), or
//   until an imperative handle method is called.
// - React state / effects → signals: `state.layout` (panel `flex-grow`), separator `drag` / `aria` signals; one
//   reactive root per mounted group re-reads accessor props (`disabled`, `defaultLayout`, `disableCursor`).
// - re-registration: upstream re-runs the Group's layout effect when panels / separators register, unregister or move;
//   here a MutationObserver on the group element (child list) re-mounts when its panel / separator children change.
// - resize previews (`resizePreviewMode="separator"`): built as DOM (upstream renders `ResizePreview` elements); a
//   separator `preview` is a function returning DOM / content, or a `SeparatorOverlay` marker.
import { batch, createRoot, effect, untrack, type Signal } from "@rivetjs/reactivity";
import { mountAxis } from "./engine/global/mountAxis.ts";
import { getMountedAxisState, subscribeToMountedAxis } from "./engine/global/mutable-state/axes.ts";
import { getInteractionState, subscribeToInteractionState } from "./engine/global/mutable-state/interactions.ts";
import type { InteractionState, ResizePreview } from "./engine/global/mutable-state/types.ts";
import type {
  HitRegion,
  Layout,
  Orientation,
  RegisteredResizeAxis,
  RegisteredResizeItem,
  RegisteredSeparator,
  ResizePreviewMode,
} from "./engine/global/types.ts";
import { calculateItemConstraints } from "./engine/global/dom/calculateItemConstraints.ts";
import { updateMountedAxis } from "./engine/global/mutable-state/axes.ts";
import { calculateSeparatorAriaValues } from "./engine/global/utils/calculateSeparatorAriaValues.ts";
import { layoutNumbersEqual } from "./engine/global/utils/layoutNumbersEqual.ts";
import { layoutsEqual } from "./engine/global/utils/layoutsEqual.ts";
import { recordAxisLayoutChange } from "./engine/global/utils/recordAxisLayoutChange.ts";
import { getImperativeAxisMethods } from "./engine/global/utils/getImperativeAxisMethods.ts";
import { getImperativeItemMethods } from "./engine/global/utils/getImperativeItemMethods.ts";
import { onDocumentKeyDown } from "./engine/global/event-handlers/onDocumentKeyDown.ts";
import { onDocumentPointerDown } from "./engine/global/event-handlers/onDocumentPointerDown.ts";
import { sortByElementOffset } from "./engine/components/group/sortByElementOffset.ts";
import type { GroupImperativeHandle, LayoutChangedMeta } from "./engine/components/group/types.ts";
import type { OnPanelResize, PanelConstraintProps, PanelImperativeHandle } from "./engine/components/panel/types.ts";

/** A value or an accessor (Rivet accessor props). */
export type MaybeAccessor<T> = T | (() => T);

/** Reads a value or an accessor (leaf helper: handler chunks import no barrel). */
export const read = <T>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

/** Props of a `SeparatorOverlay` (the overlay preview element's attributes). */
export type SeparatorOverlayAttributes = Record<string, unknown>;

/** Marker a `SeparatorOverlay` returns inside a separator `preview` function. */
export interface SeparatorOverlayMarker {
  readonly __rvSeparatorOverlay: SeparatorOverlayAttributes;
}

/** WAI-ARIA values of a separator (upstream ResizeSeparator `aria` state). */
export interface SeparatorAria {
  valueControls?: string | undefined;
  valueMin?: number | undefined;
  valueMax?: number | undefined;
  valueNow?: number | undefined;
}

/** A Panel's registration (serializable: plain props + resumable callbacks). */
export interface PanelRecord {
  id: string;
  /** The `id` prop as given (upstream passes it to `onResize`). */
  idProp: string | number | undefined;
  idIsStable: boolean;
  collapsedSize: number | string;
  collapsedThreshold: number | string | undefined;
  collapsible: boolean;
  defaultSize: number | string | undefined;
  disabled: MaybeAccessor<boolean | undefined>;
  groupResizeBehavior: "preserve-relative-size" | "preserve-pixel-size";
  maxSize: number | string;
  minSize: number | string;
  onResize: OnPanelResize;
}

/** A Separator's registration + its reactive state (upstream ResizeSeparator `dragState` / `aria`). */
export interface SeparatorRecord {
  id: string;
  disabled: MaybeAccessor<boolean | undefined>;
  disableDoubleClick: boolean | undefined;
  /** Overrides the group's preview (`resizePreviewMode="separator"`): a function returning content. */
  preview: (() => unknown) | undefined;
  drag: Signal<InteractionState["state"]>;
  focused: Signal<boolean>;
  aria: Signal<SeparatorAria>;
}

/** A Group's serializable state (`_regionState`; resumed handlers mount the engine from it). */
export interface GroupState {
  id: string;
  orientation: Orientation;
  disabled: MaybeAccessor<boolean | undefined>;
  disableCursor: MaybeAccessor<boolean | undefined>;
  defaultLayout: MaybeAccessor<Layout | undefined>;
  resizePreviewMode: ResizePreviewMode;
  resizeTargetMinimumSize: { coarse: number; fine: number };
  onLayoutChange: ((layout: Layout) => void) | undefined;
  onLayoutChanged: ((layout: Layout, meta: LayoutChangedMeta) => void) | undefined;
  /** The mounted layout (`undefined` until the engine mounts: panels fall back to the default layout / sizes). */
  layout: Signal<Layout | undefined>;
  panels: { [id: string]: PanelRecord };
  separators: { [id: string]: SeparatorRecord };
  /** Group-level `SeparatorOverlay` props. */
  overlay: SeparatorOverlayAttributes | undefined;
  /** Upstream `inMemoryValuesRef`: survives re-mounts (and resume). */
  memory: { lastExpandedPanelSizes: { [panelIds: string]: number }; layouts: { [panelIds: string]: Layout } };
}

interface Runtime {
  element: HTMLElement;
  axis: RegisteredResizeAxis;
  /** Panel / separator elements in DOM order at mount (re-mount when they change). */
  members: Element[];
  dispose: () => void;
}

const runtimes = new Map<string, Runtime>();

const doc = (): Document | undefined => (globalThis as { document?: Document }).document;

/** Panel / separator children of the group element that have a record, in DOM order. */
function membersOf(state: GroupState, element: HTMLElement): HTMLElement[] {
  const list: HTMLElement[] = [];
  for (const child of Array.from(element.children)) {
    const el = child as HTMLElement;
    if (el.hasAttribute("data-panel") ? state.panels[el.id] : el.hasAttribute("data-separator") ? state.separators[el.id] : undefined) list.push(el);
  }
  return list;
}

const sameList = (a: readonly Element[], b: readonly Element[]): boolean => a.length === b.length && a.every((element, index) => element === b[index]);

/** Whether the group's engine is mounted (client). */
export function isGroupMounted(state: GroupState): boolean {
  const runtime = runtimes.get(state.id);
  return !!runtime && runtime.element.isConnected;
}

/**
 * Mounts (or re-mounts, after its panels / separators changed) the group's engine. Returns `true` when it mounted now
 * (the caller replays the event that activated it). No-op on the server or before the element is in the document.
 */
export function ensureGroup(state: GroupState): boolean {
  const document = doc();
  if (!document) return false;
  const element = document.getElementById(state.id);
  if (!element) return false;
  const runtime = runtimes.get(state.id);
  if (runtime && runtime.element === element && sameList(runtime.members, membersOf(state, element))) return false;
  runtime?.dispose();
  mountGroup(state, element);
  return true;
}

/** Unmounts the group's engine (client render cleanup). */
export function unmountGroup(state: GroupState): void {
  runtimes.get(state.id)?.dispose();
}

let pending: Set<GroupState> | undefined;

/** Re-checks the group on the next microtask (a panel / separator was added or removed). */
export function requestMount(state: GroupState): void {
  if (!doc()) return;
  if (!pending) {
    pending = new Set();
    queueMicrotask(() => {
      const list = pending!;
      pending = undefined;
      for (const s of list) ensureGroup(s);
    });
  }
  pending.add(state);
}

function mountGroup(state: GroupState, element: HTMLElement): void {
  const members = membersOf(state, element);
  const orientation = state.orientation;
  let panels: RegisteredResizeItem[] = [];
  let separators: RegisteredSeparator[] = [];
  const separatorRecords = new Map<RegisteredSeparator, SeparatorRecord>();
  for (const member of members) {
    if (member.hasAttribute("data-panel")) {
      const record = state.panels[member.id]!;
      const onResize = record.onResize;
      const idProp = record.idProp;
      const constraintProps: PanelConstraintProps = {
        groupResizeBehavior: record.groupResizeBehavior,
        collapsedSize: record.collapsedSize,
        collapsedThreshold: record.collapsedThreshold,
        collapsible: record.collapsible,
        defaultSize: record.defaultSize,
        disabled: untrack(() => read(record.disabled)),
        maxSize: record.maxSize,
        minSize: record.minSize,
      };
      panels.push({
        element: member,
        id: record.id,
        idIsStable: record.idIsStable,
        mutableValues: { expandToSize: undefined, prevSize: undefined },
        onResize: onResize ? (panelSize, _id, prevPanelSize) => onResize(panelSize, idProp, prevPanelSize) : undefined,
        constraintProps,
      });
    } else {
      const record = state.separators[member.id]!;
      const separator: RegisteredSeparator = {
        disabled: untrack(() => read(record.disabled)),
        disableDoubleClick: record.disableDoubleClick,
        element: member as HTMLDivElement,
        id: record.id,
        get preview() {
          return record.preview;
        },
      };
      separators.push(separator);
      separatorRecords.set(separator, record);
    }
  }
  // Keyed Panels/Separators can be moved without re-registering (e.g. reordered children),
  // so registration order may be stale; re-sort before deriving constraints from it.
  panels = sortByElementOffset(orientation, panels);
  separators = sortByElementOffset(orientation, separators);

  // Guard against unexpected layout attribute ordering by pre-sorting panel ids/keys; see issues/656
  const sortedDefaultLayout = (layout: Layout | undefined): Layout | undefined => {
    if (layout === undefined || Object.keys(layout).length !== panels.length) return undefined;
    const sorted: Layout = {};
    for (const panel of panels) {
      const size = layout[panel.id];
      if (size !== undefined) sorted[panel.id] = size;
    }
    return sorted;
  };

  const group: RegisteredResizeAxis = {
    disabled: !!untrack(() => read(state.disabled)),
    element,
    id: state.id,
    mutableState: {
      defaultLayout: sortedDefaultLayout(untrack(() => read(state.defaultLayout))),
      disableCursor: !!untrack(() => read(state.disableCursor)),
      expandedItemSizes: state.memory.lastExpandedPanelSizes,
      layouts: state.memory.layouts,
    },
    orientation,
    items: panels,
    resizePreviewMode: state.resizePreviewMode,
    get resizeTargetMinimumSize() {
      return state.resizeTargetMinimumSize;
    },
    separators,
  };

  // Upstream `prevLayoutRef` (memoized `onLayoutChange` / `onLayoutChanged`), per mount like upstream's per Group.
  const prev = runtimes.get(state.id) as unknown as { memo?: { change: Layout; changed: Layout } } | undefined;
  const memo = prev?.memo ?? { change: {} as Layout, changed: {} as Layout };
  const onLayoutChange = (layout: Layout) => {
    if (layoutsEqual(memo.change, layout)) return;
    memo.change = layout;
    state.onLayoutChange?.(layout);
  };
  const onLayoutChanged = (layout: Layout, isUserInteraction: boolean, requestedLayout: Layout) => {
    // Only the validated layout is memoized; requested layout changes alone don't trigger the callback
    if (layoutsEqual(memo.changed, layout)) return;
    memo.changed = layout;
    state.onLayoutChanged?.(layout, { isUserInteraction, requestedLayout });
  };

  /** Upstream ResizeSeparator's mounted-axis listener: WAI-ARIA values of every separator. */
  const updateAria = (next: ReturnType<typeof getMountedAxisState>) => {
    if (!next) return;
    const { derivedItemConstraints, layout, separatorToItems } = next;
    separatorRecords.forEach((record, separator) => {
      const items = separatorToItems.get(separator);
      if (!items) return;
      const primaryItem = items[0];
      // The index must be relative to the Group's panels (not the pair this Separator sits between
      // because it's used as a pivot index into the Group's layout. See #740.
      const itemIndex = derivedItemConstraints.findIndex((constraints) => constraints.itemId === primaryItem.id);
      record.aria.set(calculateSeparatorAriaValues({ layout, itemConstraints: derivedItemConstraints, itemId: primaryItem.id, itemIndex }));
    });
  };

  const unmountAxis = mountAxis(group);
  const initial = getMountedAxisState(group.id, true);
  batch(() => {
    state.layout.set(initial.layout);
    updateAria(initial);
  });
  if (!initial.defaultLayoutDeferred && initial.derivedItemConstraints.length > 0) {
    onLayoutChange(initial.layout);
    // Initial mount is not a user interaction (#716).
    onLayoutChanged(initial.layout, false, initial.requestedLayout);
  }

  const removeChangeEventListener = subscribeToMountedAxis(group.id, (event) => {
    const { defaultLayoutDeferred, derivedItemConstraints, layout, requestedLayout } = event.next;
    batch(() => {
      // Panel styles (upstream Panel `useSyncExternalStore` over the mounted axis).
      state.layout.set(layout);
      updateAria(event.next);
    });
    if (defaultLayoutDeferred || derivedItemConstraints.length === 0) {
      // This indicates that the Group has not finished mounting yet
      // Likely because it has been rendered inside of a hidden DOM subtree
      // Ignore layouts in this case because they will not have been validated
      return;
    }
    recordAxisLayoutChange({ derivedItemConstraints, axis: group, layout, prevLayout: event.prev?.layout, requestedLayout });
    // Lastly notify layout-change(d) handlers of the update
    const interactionState = getInteractionState();
    const isCompleted = interactionState.state !== "active" || !interactionState.hitRegions.some((region) => region.axis === group);
    onLayoutChange(layout);
    if (isCompleted) onLayoutChanged(layout, event.isUserInteraction, requestedLayout);
  });

  // Upstream ResizeSeparator's interaction listener: `data-separator` drag state.
  const dragStateOf = (interaction: InteractionState, separator: RegisteredSeparator): InteractionState["state"] =>
    interaction.state !== "inactive" && interaction.hitRegions.some((hitRegion: HitRegion) => hitRegion.separator === separator)
      ? interaction.state
      : "inactive";
  const updateDrag = (interaction: InteractionState) =>
    batch(() => separatorRecords.forEach((record, separator) => record.drag.set(dragStateOf(interaction, separator))));
  const removeInteractionListener = subscribeToInteractionState((event) => updateDrag(event.next));
  updateDrag(getInteractionState());

  const removePreviews = state.resizePreviewMode === "separator" ? mountPreviews(state, group) : undefined;

  // Props that update without re-registering (upstream Group's `useEffect` + `updatePanelProps` / `updateSeparatorProps`).
  const root = createRoot((dispose) => {
    let first = true;
    effect(() => {
      const defaultLayout = read(state.defaultLayout);
      const disableCursor = !!read(state.disableCursor);
      group.mutableState.defaultLayout = sortedDefaultLayout(defaultLayout);
      group.mutableState.disableCursor = disableCursor;
    });
    effect(() => {
      const disabled = !!read(state.disabled);
      if (!first && disabled !== group.disabled) untrack(() => requestRemount(state));
    });
    effect(() => {
      let changed = false;
      for (const panel of panels) {
        const disabled = read(state.panels[panel.id]?.disabled);
        if (panel.constraintProps.disabled !== disabled) {
          panel.constraintProps.disabled = disabled;
          changed = true;
        }
      }
      for (const separator of separators) separator.disabled = read(separatorRecords.get(separator)?.disabled);
      if (changed && !first)
        untrack(() => {
          const groupState = getMountedAxisState(group.id);
          if (groupState) updateMountedAxis(group, { ...groupState, derivedItemConstraints: calculateItemConstraints(group) });
        });
    });
    first = false;
    return dispose;
  });

  // Re-register when panel / separator children are added, removed or moved (upstream: registration + DOM order check).
  const observer = typeof MutationObserver === "function" ? new MutationObserver(() => requestMount(state)) : undefined;
  observer?.observe(element, { childList: true });

  const runtime: Runtime & { memo: typeof memo } = {
    element,
    axis: group,
    members,
    memo,
    dispose: () => {
      if (runtimes.get(state.id) === runtime) runtimes.delete(state.id);
      observer?.disconnect();
      root.value();
      removePreviews?.();
      removeInteractionListener();
      removeChangeEventListener();
      unmountAxis();
    },
  };
  runtimes.set(state.id, runtime);
}

function requestRemount(state: GroupState): void {
  runtimes.get(state.id)?.dispose();
  requestMount(state);
}

/* -------------------------------------------------------------------------------------------------
 * Activation (resumed pages)
 * -----------------------------------------------------------------------------------------------*/

const replayed = new WeakSet<Event>();

/**
 * Separator hover / focus: mounts the group (no replay — the next pointer move / key reaches the engine's own listeners).
 */
export function activateGroup(state: GroupState): void {
  ensureGroup(state);
}

/**
 * Group pointer down on a resumed page: mounts the group when the press can start a resize (on one of its separators,
 * a group without separators (panel edges), or a coarse pointer whose hit target reaches past the separator), then
 * replays the press to the engine once per event, after every group on the event path had its turn (nested groups).
 */
export function groupPointerDown(state: GroupState, event: PointerEvent): void {
  if (isGroupMounted(state) && !runtimes.get(state.id)!.members.some((member) => !member.isConnected)) {
    ensureGroup(state);
    return;
  }
  const element = event.currentTarget as HTMLElement | null;
  const target = event.target as Element | null;
  const separator = target?.closest?.("[data-separator]");
  const ownSeparator = !!separator && separator.parentElement === element;
  const hasSeparators = !!element && Array.from(element.children).some((child) => child.hasAttribute("data-separator"));
  if (event.pointerType === "mouse" && !ownSeparator && hasSeparators) return;
  if (!ensureGroup(state) || replayed.has(event)) return;
  replayed.add(event);
  queueMicrotask(() => onDocumentPointerDown(event));
}

/** Separator key down on a resumed page: mounts the group and replays the key when it was not mounted yet. */
export function separatorKeyDown(state: GroupState, event: KeyboardEvent): void {
  if (ensureGroup(state) && !replayed.has(event)) {
    replayed.add(event);
    onDocumentKeyDown(event);
  }
}

/* -------------------------------------------------------------------------------------------------
 * Imperative handles
 * -----------------------------------------------------------------------------------------------*/

const NO_PANEL: PanelImperativeHandle = {
  collapse: () => {},
  expand: () => {},
  getSize: () => ({ asPercentage: 0, inPixels: 0 }),
  isCollapsed: () => false,
  resize: () => {},
};

/** The engine's panel methods (mounting the group first); no-ops before the group is in the document. */
export function panelMethods(state: GroupState, panelId: string): PanelImperativeHandle {
  ensureGroup(state);
  return isGroupMounted(state) ? getImperativeItemMethods({ axisId: state.id, itemId: panelId }) : NO_PANEL;
}

/** The engine's group methods (mounting the group first); no-ops before the group is in the document. */
export function groupMethods(state: GroupState): GroupImperativeHandle {
  ensureGroup(state);
  return isGroupMounted(state) ? getImperativeAxisMethods({ axisId: state.id }) : { getLayout: () => ({}), setLayout: (layout) => layout };
}

/* -------------------------------------------------------------------------------------------------
 * Resize previews (resizePreviewMode="separator")
 * -----------------------------------------------------------------------------------------------*/

let previewScope: { active: boolean; orientation: Orientation } | undefined;

/** Inside a separator `preview` function: the preview being rendered (`SeparatorOverlay` renders itself there). */
export const currentPreview = (): { active: boolean; orientation: Orientation } | undefined => previewScope;

function mountPreviews(state: GroupState, group: RegisteredResizeAxis): () => void {
  let previews: ResizePreview[] = [];
  const nodes = new Map<string, { node: HTMLElement; dispose: () => void }>();
  const update = (interaction: InteractionState) => {
    const next =
      interaction.state === "active"
        ? interaction.previews.filter((preview) => preview.axis === group && (preview.active || !layoutNumbersEqual(preview.offset, 0)))
        : [];
    if (previews.length === next.length && next.every((preview, index) => preview === previews[index])) return;
    previews = next;
    const keep = new Set<string>();
    for (const preview of next) {
      keep.add(preview.key);
      const existing = nodes.get(preview.key);
      if (existing) existing.dispose();
      const created = renderPreview(state, group, preview);
      if (existing) existing.node.replaceWith(created.node);
      else group.element.appendChild(created.node);
      nodes.set(preview.key, created);
    }
    nodes.forEach((entry, key) => {
      if (!keep.has(key)) {
        entry.dispose();
        entry.node.remove();
        nodes.delete(key);
      }
    });
  };
  const unsubscribe = subscribeToInteractionState(({ next }) => update(next));
  update(getInteractionState());
  return () => {
    unsubscribe();
    nodes.forEach((entry) => {
      entry.dispose();
      entry.node.remove();
    });
    nodes.clear();
  };
}

const isOverlayMarker = (value: unknown): value is SeparatorOverlayMarker =>
  !!value && typeof value === "object" && "__rvSeparatorOverlay" in (value as object);

/** Appends Rivet content (Node | array | accessor | text) to `parent`. */
function appendContent(parent: Node, value: unknown, document: Document): void {
  if (value == null || value === false || value === true) return;
  if (typeof value === "function") return appendContent(parent, (value as () => unknown)(), document);
  if (Array.isArray(value)) return value.forEach((item) => appendContent(parent, item, document));
  if (value instanceof document.defaultView!.Node) parent.appendChild(value);
  else parent.appendChild(document.createTextNode(String(value)));
}

/** Applies JSX-like attributes (`class`, `style` object / string, `data-*`, others) to an element. */
function applyAttributes(element: HTMLElement, attributes: SeparatorOverlayAttributes, style: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (value == null || value === false || name === "style" || name === "children" || typeof value === "function") continue;
    element.setAttribute(name === "className" ? "class" : name, value === true ? "" : String(value));
  }
  const own = attributes.style;
  if (typeof own === "string") element.style.cssText = own;
  else if (own && typeof own === "object") for (const [key, value] of Object.entries(own as Record<string, unknown>)) setStyle(element, key, value);
  for (const [key, value] of Object.entries(style)) setStyle(element, key, value);
}

function setStyle(element: HTMLElement, key: string, value: unknown): void {
  if (value == null) return;
  const name = key.startsWith("--") ? key : key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
  element.style.setProperty(
    name,
    typeof value === "number" && name !== "opacity" && name !== "flex-grow" && name !== "flex-shrink" ? value + "px" : String(value),
  );
}

/** Upstream `SeparatorOverlayRenderer`. */
function renderOverlay(attributes: SeparatorOverlayAttributes, active: boolean, orientation: Orientation, document: Document): HTMLElement {
  const element = document.createElement("div");
  applyAttributes(element, { ...attributes, "data-separator-overlay": active ? "active" : "inactive" }, {});
  const constraints = orientation === "horizontal" ? { height: "100%", minWidth: "1px" } : { minHeight: "1px", width: "100%" };
  // Constraints first, then the user's style, then the fixed properties (upstream order).
  const user = attributes.style;
  element.style.cssText = "";
  for (const [key, value] of Object.entries(constraints)) setStyle(element, key, value);
  if (typeof user === "string") element.style.cssText += user;
  else if (user && typeof user === "object") for (const [key, value] of Object.entries(user as Record<string, unknown>)) setStyle(element, key, value);
  setStyle(element, "flexShrink", "0");
  setStyle(element, "pointerEvents", "none");
  return element;
}

/** Upstream `SeparatorClone`: a static copy of the separator with its computed styles. */
function renderClone(separator: RegisteredSeparator, document: Document): HTMLElement {
  const { element } = separator;
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "height:100%;opacity:0.65;pointer-events:none;width:100%";
  const clone = element.cloneNode(true) as HTMLDivElement;
  const sources = [element, ...element.querySelectorAll("*")];
  const targets = [clone, ...clone.querySelectorAll("*")];
  const ownerWindow = element.ownerDocument.defaultView!;
  sources.forEach((source, index) => {
    const target = targets[index]!;
    if (target instanceof ownerWindow.HTMLElement || target instanceof ownerWindow.SVGElement) {
      const computed = ownerWindow.getComputedStyle(source);
      for (let i = 0; i < computed.length; i++) {
        const property = computed.item(i);
        target.style.setProperty(property, computed.getPropertyValue(property));
      }
    }
    target.removeAttribute("data-testid");
    target.removeAttribute("id");
  });
  Object.assign(clone.style, { boxSizing: "border-box", height: "100%", margin: "0", position: "static", transform: "none", width: "100%" });
  wrapper.appendChild(clone);
  return wrapper;
}

/** Upstream `ResizePreview`. */
function renderPreview(state: GroupState, group: RegisteredResizeAxis, preview: ResizePreview): { node: HTMLElement; dispose: () => void } {
  const document = group.element.ownerDocument;
  const { offset, rect, separator } = preview;
  const horizontal = group.orientation === "horizontal";
  const node = document.createElement("div");
  node.setAttribute("aria-hidden", "true");
  node.setAttribute("data-resize-preview", "");
  node.inert = true;
  Object.assign(node.style, {
    height: rect.height + "px",
    left: rect.left + "px",
    pointerEvents: "none",
    position: "absolute",
    top: rect.top + "px",
    transform: horizontal ? `translateX(${offset}px)` : `translateY(${offset}px)`,
    width: rect.width + "px",
  });
  let dispose = () => {};
  let rendered: unknown;
  let overlay = state.overlay;
  const custom = separator ? state.separators[separator.id]?.preview : undefined;
  if (custom) {
    const result = createRoot((d) => {
      previewScope = { active: preview.active, orientation: group.orientation };
      try {
        return custom();
      } finally {
        previewScope = undefined;
      }
    });
    dispose = result.dispose;
    rendered = result.value;
    if (isOverlayMarker(rendered)) {
      overlay = rendered.__rvSeparatorOverlay;
      rendered = undefined;
    }
  }
  if (rendered == null) {
    if (overlay) node.appendChild(renderOverlay(overlay, preview.active, group.orientation, document));
    else if (separator) node.appendChild(renderClone(separator, document));
  } else appendContent(node, rendered, document);
  return { node, dispose };
}
