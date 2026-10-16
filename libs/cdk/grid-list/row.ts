// Ported from react-aria-components (src/GridList.tsx GridListItem internals), Apache-2.0, © Adobe.
//
// Rivet: shared row plumbing of the live-mode grid list rows (GridListItem, Tag): the row's own node
// props as plain data (`rowSpec`), its one-node collection, the event-time node (DOM collection +
// own props) and focus rings that write a custom data attribute.
import type { Signal } from "@rivetjs/reactivity";
import { isSlot } from "@rivetjs/runtime/slot";
import { buildCollection, ItemNode, type CollectionNodeSpec } from "../collections/base.ts";
import type { Key, Node } from "../collections/types.ts";
import type { focusRingFocus } from "../focus/focus-ring.tsx";
import { setDataAttr } from "../utils/data-attrs.tsx";
import { slotIdRef, type SlotId } from "../slots/index.tsx";
import type { GridListStateLike } from "./behaviour.ts";

/** A render-prop function (not a lazy children slot). */
export const isFn = (v: unknown): boolean => typeof v === "function" && !isSlot(v);
const isServer = typeof document === "undefined";
/** react-aria `useSlotId` on the server: the id is always rendered; in the browser only while the part is. */
export const slotRef = (slot: SlotId): string | undefined => (isServer ? slot.id : slotIdRef(slot));

export const LINK_PROPS = ["href", "hrefLang", "target", "rel", "download", "ping", "referrerPolicy", "routerOptions"] as const;
// RA collectionItemProps press handlers: chained by selectable-item (mouse, touch, keyboard, virtual presses).
export const PRESS_PROPS = ["onPressStart", "onPressEnd", "onPressChange", "onPress", "onPressUp", "onClick"] as const;

/** The row's node props a one-node collection needs (disabled, link, action). */
export type RowSpec = Omit<CollectionNodeSpec<unknown>, "type">;
/** The row's one-node collection (the node class is added here: handlers capture `RowSpec` data, never a class). */
export const rowCollection = (spec: RowSpec) => buildCollection([{ ...spec, type: ItemNode }]);

export function rowSpec(key: Key, node: Node<unknown>, props: Record<string, any>): RowSpec {
  // Plain data + the user's own (resumable) onAction reference, built as one literal.
  const p: Record<string, unknown> = {
    ...(props.isDisabled ? { isDisabled: true } : null),
    ...(props.onAction ? { onAction: props.onAction } : null),
    ...Object.fromEntries(PRESS_PROPS.filter((name) => props[name] !== undefined).map((name) => [name, props[name]])),
    ...Object.fromEntries(LINK_PROPS.filter((name) => props[name] !== undefined).map((name) => [name, props[name]])),
  };
  return { id: key, textValue: node.textValue, "aria-label": node["aria-label"], props: p };
}

/** `spec` with the row's current `isDisabled` (a live GridListItem `isDisabled`; plain data). */
export function withDisabled(spec: RowSpec, isDisabled: boolean): RowSpec {
  const props: Record<string, unknown> = { ...spec.props };
  if (isDisabled) props.isDisabled = true;
  else delete props.isDisabled;
  return { ...spec, props };
}

/** The row's node for an event: the DOM collection's (sibling links) with the row's own props. */
export function eventNode(v: GridListStateLike<any>, spec: RowSpec): Node<unknown> {
  const dom = v.collection.getItem(spec.id!);
  if (!dom) return rowCollection(spec).getItem(spec.id!)!;
  const node = Object.create(dom) as Node<unknown> & { props: Record<string, unknown> };
  node.props = { ...dom.props, ...spec.props };
  return node;
}

export type Ring = Parameters<typeof focusRingFocus>[0];
const rings = new WeakMap<Element, { self?: Ring; within?: Ring }>();
/** A focus ring writing `attr` on `el` (RA `useFocusRing`; `data-focused` is the row's focused-key state, not the ring's). */
export function ringOf(el: Element, within: boolean, attr: string, state?: Signal<boolean>): Ring {
  let entry = rings.get(el);
  if (!entry) rings.set(el, (entry = {}));
  const slot = within ? "within" : "self";
  let focused = false;
  return (entry[slot] ??= {
    props: { within },
    focused: Object.assign(() => focused, { set: (v: boolean) => (focused = v) }),
    visible: { set: (v: boolean) => (setDataAttr(el, attr, v), state?.set(v)) },
    state: { isFocused: false, isFocusVisible: false, unsubscribe: null },
  });
}
