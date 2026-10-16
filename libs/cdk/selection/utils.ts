// Ported from @react-aria/selection (utils.ts), Apache-2.0, © Adobe.
import { createId } from "@rivetjs/runtime/id";
import { isMac } from "../platform/index.ts";
import type { Collection, Key } from "../collections/types.ts";
export { getItemElement } from "../collections/dom.ts";

/** A ref (`{ current }`) or the element itself. */
export type RefLike<E extends Element = HTMLElement> = { readonly current: E | null } | E | null | undefined;

/** Element of a `RefLike`. */
export function refElement<E extends Element>(ref: RefLike<E>): E | null {
  if (!ref) return null;
  return typeof (ref as Element).nodeType === "number" ? (ref as E) : (ref as { current: E | null }).current;
}

interface ModifierEvent {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Apple devices: Mac, iPhone, iPad. */
const isAppleDevice = (): boolean => {
  if (isMac()) return true;
  return typeof navigator !== "undefined" && /^(iPhone|iPad)/i.test(navigator.platform ?? "");
};

export function isNonContiguousSelectionModifier(e: ModifierEvent): boolean {
  // Ctrl + Arrow Up/Arrow Down has a system wide meaning on macOS, so use Alt instead.
  // On Windows and Ubuntu, Alt + Space has a system wide meaning.
  return isAppleDevice() ? e.altKey : e.ctrlKey;
}

/** Ctrl (Cmd on Apple) pressed. */
export function isCtrlKeyPressed(e: ModifierEvent): boolean {
  return isAppleDevice() ? e.metaKey : e.ctrlKey;
}

const collectionIds = new WeakMap<Collection<any>, string>();

/**
 * Id of a collection (`data-collection` on the collection and its items). Rivet: pass a stable id
 * (the component's `createId()`) so server and client agree; otherwise one is generated.
 */
export function useCollectionId(collection: Collection<any>, id?: string): string {
  const value = id ?? collectionIds.get(collection) ?? createId();
  collectionIds.set(collection, value);
  return value;
}

export function getCollectionId(collection: Collection<any>): string | undefined {
  return collectionIds.get(collection);
}

export type { Key };
