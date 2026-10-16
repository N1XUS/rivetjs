// Tabs behaviour (react-aria useTabList / useTab / useTabPanel): ids, readers for bindings, the
// tablist's delegated handlers and the tab press callbacks. Ported from react-spectrum (Apache-2.0,
// © Adobe): packages/react-aria/src/tabs/{useTabList,useTab,useTabPanel,utils}.ts.
//
// The tablist handlers run the ported useSelectableCollection (keyboard: TabsKeyboardDelegate,
// selectOnFocus = automatic activation, disallowEmptySelection, linkBehavior "selection") against the
// DOM collection of the tablist. Each tab's usePress (`../interactions/press.tsx` in `./index.tsx`)
// calls `tabPressStart` / `tabPressUp` / `tabPress` (useSelectableItem: select on mouse down / key down;
// link tabs select on press up) and `tabClick` (link tabs navigate through the router).
import { untrack } from "@rivetjs/reactivity";
import { tabbables } from "@rivetjs/cdk/a11y";
import { direction } from "@rivetjs/cdk/bidi";
import { navigationKeys } from "@rivetjs/cdk/keys";
import { keyId } from "@rivetjs/cdk/collections";
import type { Key } from "../_adapters/collection.ts";
import { DOMCollection, elementKey } from "../_adapters/dom-collection.ts";
import { hasKey, SelectionManager } from "../_adapters/grid-selection.ts";
import {
  selectableCollectionFocusIn,
  selectableCollectionKeyDown,
  selectableItemLinkClick,
  selectableItemPress,
  selectableItemPressStart,
  selectableItemPressUp,
  type SelectableCollectionOptions,
  type SelectableItemOptions,
} from "../_adapters/selectable.ts";
import { setInteractionModality, type PressEvent } from "../_adapters/press.ts";
import { isOpeningLink, type Router } from "../link/router.ts";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import {
  effectiveFocusedKey,
  isTabsDisabled,
  setTabFocusedKey,
  tabsDisabledKeys,
  tabsKeyboardActivation,
  tabsOrientation,
  tabsSelectionState,
  type TabListState,
} from "../state/tabs.ts";
import { TabsKeyboardDelegate } from "./keyboard-delegate.ts";

export { TabsKeyboardDelegate } from "./keyboard-delegate.ts";

export const TAB = '[role="tab"]';

/** Tab id (react-aria generateId(state, key, "tab")); keys are escaped into the id. */
export const tabId = (state: TabListState, key: Key): string => keyId(state.id + "-tab", key);
/** Panel id (generateId(state, key, "tabpanel")). */
export const tabPanelId = (state: TabListState, key: Key): string => keyId(state.id + "-tabpanel", key);

/** Keys handled on the tablist (`data-rk`, held by the loader while the chunk loads). */
export const tabsKeys = (state: TabListState): string =>
  navigationKeys({ orientation: tabsOrientation(state) === "vertical" ? "both" : "horizontal" }) + " Space Enter";

const same = (a: Key | null | undefined, b: Key | null | undefined): boolean => a != null && b != null && String(a) === String(b);

/** Whether `key` is the selected tab (reads `selectedKey`). */
export const isTabSelected = (state: TabListState, key: Key): boolean => same(state.selectedKey(), key);
/** `aria-selected` (reads `selectedKey`). */
export const tabSelected = (state: TabListState, key: Key): "true" | "false" => (isTabSelected(state, key) ? "true" : "false");

/** Whether a tab is disabled (useTab: prop, whole tablist, or disabledKeys); reads a live item / tablist `isDisabled`. */
export const isTabDisabled = (state: TabListState, key: Key, itemDisabled: MaybeAccessor<boolean | undefined> = false): boolean =>
  !!read(itemDisabled) || isTabsDisabled(state) || hasKey(tabsDisabledKeys(state), key);

/** Roving tabindex (reads focus state): 0 on the tab stop, -1 elsewhere, none when disabled. */
export function tabTabIndex(state: TabListState, key: Key, disabled = false): number | undefined {
  if (disabled) return undefined;
  return same(effectiveFocusedKey(state), key) ? 0 : -1;
}

// --- handlers -----------------------------------------------------------------------------------

const tabOf = (event: Event, list: Element): HTMLElement | null => {
  const tab = (event.target as Element | null)?.closest?.<HTMLElement>(TAB) ?? null;
  return tab && list.contains(tab) && tab.closest('[role="tablist"]') === list ? tab : null;
};

function collectionOptions(state: TabListState, list: HTMLElement, router?: Router): SelectableCollectionOptions {
  const collection = new DOMCollection(list);
  const selection = tabsSelectionState(state);
  const manager = new SelectionManager(collection, selection);
  return {
    manager,
    delegate: new TabsKeyboardDelegate(collection, direction(list), tabsOrientation(state), tabsDisabledKeys(state)),
    ref: list,
    state: selection,
    direction: direction(list),
    selectOnFocus: tabsKeyboardActivation(state) === "automatic",
    disallowEmptySelection: true,
    scrollRef: list,
    linkBehavior: "selection",
    router,
  };
}

function itemOptions(state: TabListState, list: HTMLElement, tab: HTMLElement, router?: Router): SelectableItemOptions {
  const o = collectionOptions(state, list, router);
  const key = elementKey(tab)!;
  return {
    manager: o.manager,
    key,
    element: tab,
    isDisabled: isTabsDisabled(state) || tab.getAttribute("aria-disabled") === "true",
    // Link tabs behave like native anchors: select / navigate on press up.
    shouldSelectOnPressUp: tab.hasAttribute("href") || tab.hasAttribute("data-href"),
    linkBehavior: "selection",
    router,
  };
}

/** The selected panel gets tabindex 0 only when it has no tabbable content (useTabPanel / useHasTabbableChild). */
export function syncPanelTabIndex(state: TabListState, root: ParentNode = document): void {
  const key = untrack(state.selectedKey);
  if (key == null) return;
  const panel = (root as Document).getElementById?.(tabPanelId(state, key)) ?? document.getElementById(tabPanelId(state, key));
  if (!panel) return;
  if (tabbables(panel).length) panel.removeAttribute("tabindex");
  else panel.setAttribute("tabindex", "0");
}

/** keydown on the tablist: arrows / Home / End move (and select with automatic activation). Enter / Space are the tab's press. */
export function tabListKeyDown(state: TabListState, event: KeyboardEvent & { currentTarget: Element }, router?: Router): void {
  const list = event.currentTarget as HTMLElement;
  setInteractionModality("keyboard");
  if (event.key === "Tab") syncPanelTabIndex(state);
  const o = collectionOptions(state, list, router);
  selectableCollectionKeyDown(o, event);
}

/** pointerdown on the tablist: pointer modality; a disabled tab's pointerdown is prevented (no focus on the body). */
export function tabListPointerDown(event: PointerEvent & { currentTarget: Element }): void {
  const list = event.currentTarget as HTMLElement;
  setInteractionModality("pointer");
  const tab = tabOf(event, list);
  if (tab && event.button === 0 && tab.getAttribute("aria-disabled") === "true") event.preventDefault();
}

// --- tab presses (react-aria useTab → useSelectableItem's usePress handlers) ------------------------

const listOf = (tab: Element): HTMLElement | null => tab.closest<HTMLElement>('[role="tablist"]');

function pressOptions(state: TabListState, tab: HTMLElement, router?: Router): SelectableItemOptions | null {
  const list = listOf(tab);
  return list ? itemOptions(state, list, tab, router) : null;
}

/** onPressStart of a tab: mouse / keyboard presses select (automatic and manual activation). */
export function tabPressStart(state: TabListState, event: PressEvent, router?: Router): void {
  const o = pressOptions(state, event.target as HTMLElement, router);
  if (!o || o.isDisabled) return;
  selectableItemPressStart(o, event);
  syncPanelTabIndex(state);
}

/** onPressUp of a tab. */
export function tabPressUp(state: TabListState, event: PressEvent, router?: Router): void {
  const o = pressOptions(state, event.target as HTMLElement, router);
  if (o && !o.isDisabled) selectableItemPressUp(o, event);
}

/** onPress of a tab: touch / virtual presses select; link tabs select on press up. */
export function tabPress(state: TabListState, event: PressEvent, router?: Router): void {
  const o = pressOptions(state, event.target as HTMLElement, router);
  if (!o || o.isDisabled) return;
  selectableItemPress(o, event);
  syncPanelTabIndex(state);
}

/** click on a tab: link tabs navigate through the router (useLinkProps); a disabled tab's click is prevented. */
export function tabClick(state: TabListState, event: MouseEvent & { currentTarget: Element }, router?: Router): void {
  if (isOpeningLink()) return; // openLink's own synthetic click: let the browser / router follow it
  const o = pressOptions(state, event.currentTarget as HTMLElement, router);
  if (!o) return;
  if (o.isDisabled) {
    event.preventDefault();
    return;
  }
  selectableItemLinkClick(o, event);
}

/** focusin on the tablist (useSelectableCollection onFocus + useSelectableItem onFocus). */
export function tabListFocusIn(state: TabListState, event: FocusEvent & { currentTarget: Element }, router?: Router): void {
  const list = event.currentTarget as HTMLElement;
  const o = collectionOptions(state, list, router);
  const tab = tabOf(event, list);
  if (tab && event.target === tab && tab.getAttribute("aria-disabled") !== "true") {
    o.manager.setFocused(true);
    const key = elementKey(tab)!;
    if (!same(untrack(state.focusedKey), key)) setTabFocusedKey(state, key);
    return;
  }
  selectableCollectionFocusIn(o, event);
}

/** focusout on the tablist. */
export function tabListFocusOut(state: TabListState, event: FocusEvent & { currentTarget: Element }): void {
  const list = event.currentTarget as Element;
  if (!list.contains(event.relatedTarget as Node)) {
    state.isFocused.set(false);
    // Keep the tab stop where it was (useTabListState: focusedKey stays until the selection changes).
    state.focusedSelection.set(untrack(state.selectedKey));
  }
}
