// Ported from react-aria useComboBox (packages/react-aria/src/combobox/useComboBox.ts) and the parts of
// useMenuTrigger / useOverlayTrigger it uses (packages/react-aria/src/menu/useMenuTrigger.ts,
// src/overlays/useOverlayTrigger.ts), Apache-2.0, © Adobe.
// Rivet:
// - `useComboBox(props, state)` → `comboBoxProps(props, state)` (call during render, from `.tsx`: the bags hold
//   inline-arrow handlers / accessors that resumed bindings and contexts capture). Values that change are
//   accessors (`aria-expanded`, `aria-controls`, `aria-activedescendant`, `value`, `aria-invalid`, …).
// - hook-internal handlers → free functions: `comboBoxInputKeyDown`, `comboBoxInputFocus`, `comboBoxInputBlur`,
//   `comboBoxInputTouchEnd`, `comboBoxButtonPress`, `comboBoxButtonPressStart`, `comboBoxButtonKeyDown`,
//   `comboBoxLabelClick`, taking `(event, props, state, refs)`. The keyboard delegate / selection manager are
//   built at event time over the displayed collection.
// - refs are `ref()`s (`ComboBoxRefs`), read at event time.
// - the per-render `useEffect`s (VoiceOver focus / selection announcements, option count announcement,
//   `ariaHideOutside` while open, re-showing the input focus ring, the listbox `react-aria-item-action`
//   listener) run in one reactive effect root created on the first focus / button press
//   (`comboBoxEffects`) and disposed once the combobox is blurred and closed — nothing runs before the
//   first interaction. The listbox's item effect (virtual focus moves with the focused key) is emulated
//   after the input's collection key handling (`syncFocus` on the listbox with virtual focus).
// - `useValueId` → the caller's slot id (`valueSlot`, slots/ `createSlotId`) read in `aria-describedby`.
// - The input's key handler chain is wrapped in `createEventHandler` like upstream `useFocusable` /
//   `useKeyboard` (propagation stops unless a shortcut continues it).
import { createMergedId } from "../slots/index.tsx";
import { createRoot, effect, onCleanup, untrack } from "@rivetjs/reactivity";
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import { announce } from "../announcer/live-announcer.ts";
import { formatMessage } from "../_adapters/intl.ts";
import { getChildNodes, getItemCount } from "../collections/nodes.ts";
import type { FocusStrategy, Key, LayoutDelegate, Node, KeyboardDelegate } from "../collections/types.ts";
import { onFormReset, syncValidity } from "../form/behaviour.ts";
import { setInteractionModality } from "../interactions/focus-visible.tsx";
import { keyboardKeyDown } from "../interactions/keyboard.tsx";
import { createEventHandler } from "../interactions/utils.ts";
import { controllable } from "../interactions/controllable.ts";
import { labelsProps } from "../label/behaviour.ts";
import { getItemId } from "../listbox/behaviour.tsx";
import { ariaHideOutside } from "../overlay/aria-hide-outside.ts";
import { isAppleDevice } from "../platform/index.ts";
import { ListKeyboardDelegate } from "../selection/list-keyboard-delegate.ts";
import { selectableCollectionKeyDown, syncFocus, type AriaSelectableCollectionOptions } from "../selection/selectable-collection.ts";
import { dispatchVirtualFocus } from "../selection/dom-utils.ts";
import { nodeContains, cssEscape } from "../utils/dom.ts";
import { createId } from "../utils/id.ts";
import { routerOpen, type Router, type RouterOptions } from "../utils/links.tsx";
import { displayValidation, read, type MaybeAccessor, type ValidationResult } from "../state/form-validation.ts";
import {
  closeCombo,
  comboDisplayedCollection,
  comboInputText,
  comboSelectedItem,
  comboSelectedKey,
  comboSelectionManager,
  commitCombo,
  openCombo,
  revertCombo,
  setComboFocused,
  setComboFocusedKey,
  setComboInputValue,
  setComboValue,
  toggleCombo,
  type ComboBoxState,
  type SelectionMode,
} from "../state/combobox.ts";
import { textFieldProps, type AriaTextFieldProps, type PropBag, type TextFieldState } from "../text-field/behaviour.tsx";
import type { FieldIds } from "../label/behaviour.ts";
import { strings as intlMessages } from "./intl.ts";

/** The element refs of a combobox (`ref()`s from `@rivetjs/runtime/dom`). */
export interface ComboBoxRefs {
  /** The input element. */
  inputRef: Ref<HTMLInputElement>;
  /** The list box popover. */
  popoverRef: Ref<Element>;
  /** The list box. */
  listBoxRef: Ref<HTMLElement>;
  /** The optional list box popup trigger button. */
  buttonRef: Ref<Element>;
}

export interface AriaComboBoxProps extends Omit<AriaTextFieldProps, "value" | "defaultValue" | "onChange" | "type" | "inputElementType"> {
  /** Whether keyboard navigation is circular. */
  shouldFocusWrap?: boolean | undefined;
  /** Whether the ComboBox allows a non-item matching input value to be set. */
  allowsCustomValue?: boolean | undefined;
  /** Whether single or multiple selection is enabled. */
  selectionMode?: SelectionMode | undefined;
}

export interface AriaComboBoxOptions extends AriaComboBoxProps, ComboBoxRefs {
  /**
   * The HTML element used to render the label, e.g. 'label', or 'span'.
   *
   * @default 'label'
   */
  labelElementType?: "label" | "span";
  /** An optional keyboard delegate implementation, to override the default. */
  keyboardDelegate?: KeyboardDelegate;
  /**
   * A delegate object that provides layout information for items in the collection. By default this uses
   * the DOM, but this can be overridden to implement things like virtualized scrolling.
   */
  layoutDelegate?: LayoutDelegate;
  /** Rivet: locale of the announcements and labels (default "en-US"). */
  locale?: string;
  /** Rivet: the router of link items (RA `useRouter()`). */
  router?: Router;
  /** Rivet: the `ComboBoxValue` slot id (RA `useValueId`); read inside `aria-describedby`. */
  valueId?: () => string | undefined;
}

export interface ComboBoxAria {
  /** Props for the label element. */
  labelProps: PropBag;
  /** Props for the combo box input element. */
  inputProps: PropBag;
  /** Props for the list box (ListBoxContext). */
  listBoxProps: PropBag;
  /** Props for the optional trigger button (ButtonContext). */
  buttonProps: PropBag;
  /** Props for the element representing the selected value. */
  valueProps: { id: string | undefined };
  /** Props for the combo box description element, if any. */
  descriptionProps: PropBag;
  /** Props for the combo box error message element, if any. */
  errorMessageProps: PropBag;
  /** Rivet: ids of the field parts. */
  ids: FieldIds;
  /** Rivet: id of the list box (`ListState.id`). */
  listBoxId: string;
  isInvalid: () => boolean;
  validationErrors: () => string[];
  validationDetails: () => ValidationResult["validationDetails"];
}

/** Handler props (plain data + the user's callbacks). */
export interface ComboBoxHandlerProps {
  /** A value, or an accessor that stays live (live props: read at event time). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  isReadOnly?: MaybeAccessor<boolean | undefined>;
  allowsCustomValue?: boolean | undefined;
  shouldFocusWrap?: boolean | undefined;
  onFocus?: ((e: FocusEvent) => void) | undefined;
  onBlur?: ((e: FocusEvent) => void) | undefined;
  onKeyDown?: ((e: KeyboardEvent) => void) | undefined;
  keyboardDelegate?: KeyboardDelegate | undefined;
  layoutDelegate?: LayoutDelegate | undefined;
  locale?: string | undefined;
  router?: Router | undefined;
}

/** Per-instance transient data (browser only). */
interface Transient {
  lastEventTime: number;
  effects: (() => void) | null;
}
const transients = new WeakMap<object, Transient>();
function transient(state: ComboBoxState): Transient {
  const key = state.isOpen as object;
  let t = transients.get(key);
  if (!t) transients.set(key, (t = { lastEventTime: 0, effects: null }));
  return t;
}

/** The focused item while open (upstream `focusedItem`). */
function focusedItem(state: ComboBoxState): Node<unknown> | undefined {
  const key = state.focusedKey();
  return key != null && state.isOpen() ? (comboDisplayedCollection(state).getItem(key) ?? undefined) : undefined;
}

function collectionOptions(props: ComboBoxHandlerProps, state: ComboBoxState, refs: ComboBoxRefs): AriaSelectableCollectionOptions {
  const collection = comboDisplayedCollection(state);
  const selectionManager = comboSelectionManager(state);
  const listBox = refs.listBoxRef() ?? null;
  return {
    selectionManager,
    // By default, a KeyboardDelegate is provided which uses the DOM to query layout information (e.g. for page up/page down).
    // When virtualized, the layout object will be passed in as a prop and override this.
    keyboardDelegate:
      props.keyboardDelegate ||
      new ListKeyboardDelegate({
        collection,
        disabledKeys: selectionManager.disabledKeys,
        ref: listBox,
        layoutDelegate: props.layoutDelegate,
      }),
    disallowTypeAhead: true,
    disallowEmptySelection: true,
    shouldFocusWrap: props.shouldFocusWrap,
    ref: refs.inputRef() ?? null,
    // Prevent item scroll behavior from being applied here, should be handled in the user's Popover + ListBox component
    isVirtualized: true,
  };
}

/** The input's keydown (upstream: `chain(state.isOpen && collectionProps.onKeyDown, keyboardProps.onKeyDown, repeatKeyboardProps.onKeyDown, props.onKeyDown)`). */
export function comboBoxInputKeyDown(e: KeyboardEvent, props: ComboBoxHandlerProps, state: ComboBoxState, refs: ComboBoxRefs): void {
  onFormReset(state.isOpen, refs.inputRef(), () => setComboValue(state, state.defaultValue as Key | readonly Key[] | null));
  if (read(props.isReadOnly)) {
    createEventHandler(props.onKeyDown)?.(e);
    return;
  }
  createEventHandler<KeyboardEvent>((e) => {
    if (state.isOpen()) {
      const options = collectionOptions(props, state, refs);
      const before = untrack(state.focusedKey);
      selectableCollectionKeyDown(options, e);
      // The listbox's item effect: virtual focus (and scrolling) follows the focused key.
      const listBox = refs.listBoxRef();
      if (listBox) syncFocus({ ...options, ref: listBox, shouldUseVirtualFocus: true, isVirtualized: false }, before);
    }
    comboBoxShortcutKeyDown(e, props, state, refs);
    keyboardKeyDown(
      {
        shortcuts: {
          ArrowDown: () => {
            openCombo(state, "first", "manual");
            return { shouldPreventDefault: false };
          },
          ArrowUp: () => {
            openCombo(state, "last", "manual");
            return { shouldPreventDefault: false };
          },
          ArrowLeft: () => {
            setComboFocusedKey(state, null);
            return { shouldPreventDefault: false };
          },
          ArrowRight: () => {
            setComboFocusedKey(state, null);
            return { shouldPreventDefault: false };
          },
        },
        allowRepeats: true,
      },
      e,
    );
    props.onKeyDown?.(e);
  })!(e);
}

/** for textfield specific operations (upstream `keyboardProps`: Enter / Tab / Escape). */
function comboBoxShortcutKeyDown(e: KeyboardEvent, props: ComboBoxHandlerProps, state: ComboBoxState, refs: ComboBoxRefs): void {
  keyboardKeyDown(
    {
      shortcuts: {
        Enter: (e: KeyboardEvent) => {
          // Prevent default form submission if menu is open since we may be selecting a option
          const shouldPreventDefault = state.isOpen();
          // If the focused item is a link, trigger opening it. Items that are links are not selectable.
          const listBox = refs.listBoxRef();
          const focusedKey = state.focusedKey();
          if (state.isOpen() && listBox && focusedKey != null) {
            const collectionItem = comboDisplayedCollection(state).getItem(focusedKey) as (Node<unknown> & { props?: Record<string, any> }) | null;
            if (collectionItem?.props?.href) {
              const item = listBox.querySelector(`[data-key="${cssEscape(focusedKey.toString())}"]`);
              if (item instanceof HTMLAnchorElement) {
                routerOpen(props.router, item, e, collectionItem.props.href, collectionItem.props.routerOptions as RouterOptions);
              }
              closeCombo(state);
              return { shouldPreventDefault };
            } else if (collectionItem?.props?.onAction) {
              collectionItem.props.onAction();
              closeCombo(state);
              return { shouldPreventDefault };
            }
          }
          commitCombo(state);
          return { shouldPreventDefault };
        },
        Tab: () => {
          // If the focused item is a link, trigger opening it. Items that are links are not selectable.
          const focusedKey = state.focusedKey();
          if (state.isOpen() && refs.listBoxRef() && focusedKey != null) {
            const collectionItem = comboDisplayedCollection(state).getItem(focusedKey) as (Node<unknown> & { props?: Record<string, any> }) | null;
            if (collectionItem?.props?.href) {
              closeCombo(state);
              return { shouldPreventDefault: false };
            } else if (collectionItem?.props?.onAction) {
              collectionItem.props.onAction();
              closeCombo(state);
              return { shouldPreventDefault: false, shouldContinuePropagation: true };
            }
          }
          if (state.isOpen()) {
            commitCombo(state);
          }
          return { shouldPreventDefault: false, shouldContinuePropagation: true };
        },
        Escape: () => {
          let shouldContinuePropagation = false;
          if (!comboSelectionManager(state).isEmpty || state.inputValue() === "" || props.allowsCustomValue) {
            shouldContinuePropagation = true;
          }
          revertCombo(state);
          return { shouldContinuePropagation };
        },
      },
    },
    e,
  );
}

/** The input's blur. */
export function comboBoxInputBlur(e: FocusEvent, props: ComboBoxHandlerProps, state: ComboBoxState, refs: ComboBoxRefs): void {
  const blurFromButton = nodeContains(refs.buttonRef() ?? null, e.relatedTarget as Element);
  const blurIntoPopover = nodeContains(refs.popoverRef() ?? null, e.relatedTarget as Element);

  // Ignore blur if focused moved to the button(if exists) or into the popover.
  if (blurFromButton || blurIntoPopover) {
    return;
  }

  if (props.onBlur) {
    props.onBlur(e);
  }

  // RA useFormValidation's layout effect records the native validity on every render; record it before the commit.
  syncValidity(state.validation, refs.inputRef() as HTMLInputElement | null);
  setComboFocused(state, false);
}

/** The input's focus. */
export function comboBoxInputFocus(e: FocusEvent, props: ComboBoxHandlerProps, state: ComboBoxState, refs: ComboBoxRefs): void {
  onFormReset(state.isOpen, refs.inputRef(), () => setComboValue(state, state.defaultValue as Key | readonly Key[] | null));
  comboBoxEffects(props, state, refs);
  if (state.isFocused()) {
    return;
  }

  if (props.onFocus) {
    props.onFocus(e);
  }

  setComboFocused(state, true);
}

/**
 * Rivet: `menuTrigger="focus"` opens the menu from the input's focus handler, synchronously inside the button press. React
 * batches that open with the press's `toggle`, which still reads the closed pre-focus state and opens (trigger "manual"); a
 * signal toggle would read the open state and close the menu again. Returns true when the focus opened it: keep it open as the
 * toggle would.
 */
function keptOpenByFocus(state: ComboBoxState, wasOpen: boolean, focusStrategy: FocusStrategy | null): boolean {
  if (wasOpen || !state.isOpen()) return false;
  state.menuOpenTrigger.set("manual");
  state.focusStrategy.set(focusStrategy);
  return true;
}

/** Press handlers for the ComboBox button: `onPress` (touch). */
export function comboBoxButtonPress(e: { pointerType: string }, props: ComboBoxHandlerProps, state: ComboBoxState, refs: ComboBoxRefs): void {
  if (e.pointerType === "touch") {
    comboBoxEffects(props, state, refs);
    // Focus the input field in case it isn't focused yet
    const wasOpen = state.isOpen();
    refs.inputRef()?.focus();
    if (keptOpenByFocus(state, wasOpen, null)) return;
    toggleCombo(state, null, "manual");
  }
}

/** Press handlers for the ComboBox button: `onPressStart` (mouse / keyboard / virtual). */
export function comboBoxButtonPressStart(e: { pointerType: string }, props: ComboBoxHandlerProps, state: ComboBoxState, refs: ComboBoxRefs): void {
  if (e.pointerType !== "touch") {
    comboBoxEffects(props, state, refs);
    const focusStrategy = e.pointerType === "keyboard" || e.pointerType === "virtual" ? "first" : null;
    const wasOpen = state.isOpen();
    refs.inputRef()?.focus();
    if (keptOpenByFocus(state, wasOpen, focusStrategy)) return;
    toggleCombo(state, focusStrategy, "manual");
  }
}

/** The trigger button's keydown (useMenuTrigger `keyboardProps`, trigger "press"). */
export function comboBoxButtonKeyDown(e: KeyboardEvent, props: ComboBoxHandlerProps, state: ComboBoxState): void {
  const open = (shouldOpen: boolean, e: KeyboardEvent, focusStrategy: FocusStrategy = "first"): boolean | void => {
    if (!shouldOpen || e.defaultPrevented) {
      return false;
    }
    toggleCombo(state, focusStrategy);
  };
  keyboardKeyDown(
    {
      isDisabled: !!read(props.isDisabled) || !!read(props.isReadOnly),
      shortcuts: {
        Enter: (e: KeyboardEvent) => open(true, e, "first"),
        " ": (e: KeyboardEvent) => open(true, e, "first"),
        ArrowDown: (e: KeyboardEvent) => open(true, e, "first"),
        ArrowUp: (e: KeyboardEvent) => open(true, e, "last"),
        "Alt+Enter": (e: KeyboardEvent) => open(false, e, "first"),
        "Alt+ ": (e: KeyboardEvent) => open(false, e, "first"),
        "Alt+ArrowDown": (e: KeyboardEvent) => open(true, e, "first"),
        "Alt+ArrowUp": (e: KeyboardEvent) => open(true, e, "last"),
      },
    },
    e,
  );
}

/** If a touch happens on direct center of ComboBox input, might be virtual click from iPad so open ComboBox menu. */
export function comboBoxInputTouchEnd(e: TouchEvent, props: ComboBoxHandlerProps, state: ComboBoxState, refs: ComboBoxRefs): void {
  if (read(props.isDisabled) || read(props.isReadOnly)) {
    return;
  }

  const t = transient(state);
  // Sometimes VoiceOver on iOS fires two touchend events in quick succession. Ignore the second one.
  if (e.timeStamp - t.lastEventTime < 500) {
    e.preventDefault();
    refs.inputRef()?.focus();
    return;
  }

  const rect = (e.target as Element).getBoundingClientRect();
  const touch = e.changedTouches[0]!;

  const centerX = Math.ceil(rect.left + 0.5 * rect.width);
  const centerY = Math.ceil(rect.top + 0.5 * rect.height);

  if (touch.clientX === centerX && touch.clientY === centerY) {
    e.preventDefault();
    comboBoxEffects(props, state, refs);
    refs.inputRef()?.focus();
    toggleCombo(state, null, "manual");

    t.lastEventTime = e.timeStamp;
  }
}

/** `a || b` of two flags, one of them live (a returned arrow: resumable). */
function eitherFlag(a: MaybeAccessor<boolean | undefined>, b: MaybeAccessor<boolean | undefined>): () => boolean {
  return () => !!read(a) || !!read(b);
}

/** Focus the input in case the label is not a native <label> element. */
export function comboBoxLabelClick(refs: Pick<ComboBoxRefs, "inputRef">): void {
  refs.inputRef()?.focus();
  setInteractionModality("keyboard");
}

/**
 * The per-render effects of useComboBox (announcements, `ariaHideOutside` while open, focus ring re-show,
 * closing on a listbox item action): one reactive root, created on the first interaction, disposed once the
 * combobox is neither focused nor open.
 */
export function comboBoxEffects(props: ComboBoxHandlerProps, state: ComboBoxState, refs: ComboBoxRefs): void {
  const t = transient(state);
  if (t.effects || typeof document === "undefined") return;
  const format = (key: string, args?: Record<string, unknown>) => formatMessage(intlMessages, props.locale, key, args);
  t.effects = createRoot((dispose) => {
    // VoiceOver has issues with announcing aria-activedescendant properly on change
    // (especially on iOS). We use a live region announcer to announce focus changes
    // manually. In addition, section titles are announced when navigating into a new section.
    let lastSection: Key | null = untrack(() => focusedItem(state)?.parentKey ?? null);
    let lastItem: Key | null = untrack(state.focusedKey);
    effect(() => {
      const item = focusedItem(state);
      const sectionKey = item?.parentKey ?? null;
      const itemKey = state.focusedKey() ?? null;
      untrack(() => {
        if (isAppleDevice() && item != null && itemKey != null && itemKey !== lastItem) {
          const isSelected = comboSelectionManager(state).isSelected(itemKey);
          const collection = comboDisplayedCollection(state);
          const section = sectionKey != null ? collection.getItem(sectionKey) : null;
          const sectionTitle = section?.["aria-label"] || (typeof section?.rendered === "string" ? section.rendered : "") || "";

          const announcement = format("focusAnnouncement", {
            isGroupChange: (section && sectionKey !== lastSection) ?? false,
            groupTitle: sectionTitle,
            groupCount: section ? [...getChildNodes(section, collection)].length : 0,
            optionText: item["aria-label"] || item.textValue || "",
            isSelected,
          });

          announce(announcement);
        }
      });
      lastSection = sectionKey;
      lastItem = itemKey;
    });

    // Announce the number of available suggestions when it changes
    let lastSize = untrack(() => getItemCount(comboDisplayedCollection(state)));
    let lastOpen = untrack(state.isOpen);
    effect(() => {
      const optionCount = getItemCount(comboDisplayedCollection(state));
      const isOpen = state.isOpen();
      const focusedKey = state.focusedKey();
      untrack(() => {
        // Only announce the number of options available when the menu opens if there is no
        // focused item, otherwise screen readers will typically read e.g. "1 of 6".
        // The exception is VoiceOver since this isn't included in the message above.
        const didOpenWithoutFocusedItem = isOpen !== lastOpen && (focusedKey == null || isAppleDevice());

        if (isOpen && (didOpenWithoutFocusedItem || optionCount !== lastSize)) {
          const announcement = format("countAnnouncement", { optionCount });
          announce(announcement);
        }
      });
      lastSize = optionCount;
      lastOpen = isOpen;
    });

    // Announce when a selection occurs for VoiceOver. Other screen readers typically do this automatically.
    let lastSelectedKey = untrack(() => comboSelectedKey(state));
    effect(() => {
      const selectedKey = comboSelectedKey(state);
      const isFocused = state.isFocused();
      untrack(() => {
        const selectedItem = comboSelectedItem(state);
        if (isAppleDevice() && isFocused && selectedItem && selectedKey !== lastSelectedKey) {
          const optionText = selectedItem["aria-label"] || selectedItem.textValue || "";
          const announcement = format("selectedAnnouncement", { optionText });
          announce(announcement);
        }
      });
      lastSelectedKey = selectedKey;
    });

    // ariaHideOutside while open; the listbox's `react-aria-item-action` closes the menu.
    effect(() => {
      if (!state.isOpen()) return;
      const input = refs.inputRef();
      const popover = refs.popoverRef();
      const listBox = refs.listBoxRef();
      const cleanups: (() => void)[] = [];
      untrack(() => {
        cleanups.push(ariaHideOutside([input, popover].filter((element): element is NonNullable<typeof element> => element != null)));
        if (listBox) {
          const onItemAction = () => closeCombo(state);
          listBox.addEventListener("react-aria-item-action", onItemAction);
          cleanups.push(() => listBox.removeEventListener("react-aria-item-action", onItemAction));
        }
      });
      onCleanup(() => cleanups.forEach((fn) => fn()));
    });

    // Re-show focus ring when there is no virtually focused item.
    let first = true;
    effect(() => {
      const item = focusedItem(state);
      if (first) {
        first = false;
        return;
      }
      untrack(() => {
        const input = refs.inputRef();
        if (!item && input && input.ownerDocument.activeElement === input) {
          dispatchVirtualFocus(input, null);
        }
      });
    });

    // Dispose once neither focused nor open.
    effect(() => {
      if (!state.isFocused() && !state.isOpen()) {
        queueMicrotask(() => {
          if (untrack(() => !state.isFocused() && !state.isOpen()) && t.effects) {
            t.effects();
            t.effects = null;
          }
        });
      }
    });
    return dispose;
  }).value;
}

/** Disposes the interaction effects (`comboBoxEffects`): call when the combobox unmounts (React effect cleanup). */
export function comboBoxDisposeEffects(state: Pick<ComboBoxState, "isOpen">): void {
  const t = transients.get(state.isOpen as object);
  if (t?.effects) {
    t.effects();
    t.effects = null;
  }
}

/**
 * Provides the behavior and accessibility implementation for a combo box component. A combo box combines a
 * text input with a listbox, allowing users to filter a list of options to items matching a query.
 */
export function comboBoxProps(props: AriaComboBoxOptions, state: ComboBoxState): ComboBoxAria {
  const {
    inputRef,
    buttonRef,
    listBoxRef,
    popoverRef,
    shouldFocusWrap,
    isReadOnly,
    isDisabled,
    allowsCustomValue,
    keyboardDelegate,
    layoutDelegate,
    locale,
    router,
  } = props;
  const refs: ComboBoxRefs = { inputRef, buttonRef, listBoxRef, popoverRef };
  const userOnFocus = props.onFocus,
    userOnBlur = props.onBlur,
    userOnKeyDown = props.onKeyDown;
  const handlerProps: ComboBoxHandlerProps = {
    isDisabled,
    isReadOnly,
    allowsCustomValue,
    shouldFocusWrap,
    onFocus: userOnFocus,
    onBlur: userOnBlur,
    onKeyDown: userOnKeyDown,
    keyboardDelegate,
    layoutDelegate,
    locale,
    router,
  };
  const format = (key: string) => formatMessage(intlMessages, locale, key);

  // useMenuTrigger({type: 'listbox'}) + useOverlayTrigger: trigger / overlay ids.
  const menuTriggerId = createId();
  // Set listbox id so it can be used when calling getItemId later
  const listBoxId = state.id;
  // RA useMenuTrigger `menuId` (useId): the ListBox's own id merges into it (mergeIds re-renders useComboBox), so
  // aria-controls / aria-activedescendant / getItemId follow a `<ListBox id>` (`contextProps` sets `current`).
  const menuId = createMergedId(listBoxId);
  const multiple = props.selectionMode === "multiple";
  const isRequired = props.isRequired;

  // useTextField over the combobox's input value and validation (RA `privateValidationStateProp`).
  // Object-literal arrows (resumable symbols); call-argument arrows are not.
  // `comboInputText`: a live controlled value changed by the parent re-syncs the text here (the input's value binding),
  // in place on a resumed page too.
  const io = { read: () => comboInputText(state), write: (value: string) => setComboInputValue(state, value) };
  const textState: TextFieldState = {
    value: controllable<string>(io.read, "", io.write),
    initial: state.defaultInputValue,
    validation: state.validation,
  };
  const text = textFieldProps(
    {
      ...props,
      // In multi-select mode, only set required if the selection is empty (bound below).
      isRequired: multiple ? false : isRequired,
      onKeyDown: undefined,
      onFocus: undefined,
      onBlur: undefined,
      // RA passes the user's onFocusChange to useTextField (`...props`): its useFocus calls it after the combo box's own onFocus / onBlur.
      autoComplete: "off",
      validate: undefined,
      validationBehavior: state.validation.behavior,
    },
    undefined,
    textState,
  );
  const behaviour = state.validation.behavior;
  const valueId = props.valueId;
  const ownDescribedBy = props["aria-describedby"];
  const describedBy = text.inputProps["aria-describedby"] as () => string | undefined;
  const requiredEmpty = () => !!read(isRequired as MaybeAccessor<boolean | undefined>) && comboSelectionManager(state).isEmpty;

  const inputProps: PropBag = {
    ...text.inputProps,
    ...(multiple
      ? {
          required: () => (requiredEmpty() && behaviour === "native") || undefined,
          "aria-required": () => (requiredEmpty() && behaviour === "aria") || undefined,
        }
      : {}),
    "aria-describedby": () => [valueId?.(), ownDescribedBy, describedBy()].filter(Boolean).join(" ") || undefined,
    onKeyDown: (e: KeyboardEvent) => comboBoxInputKeyDown(e, handlerProps, state, refs),
    // The text field's focus handling runs from the native focus / blur here, after the combo box's own (RA order).
    onFocusIn: undefined,
    onFocus: (e: FocusEvent) => {
      comboBoxInputFocus(e, handlerProps, state, refs);
      (text.inputProps.onFocusIn as (e: FocusEvent) => void)(e);
      (text.inputProps.onFocus as ((e: FocusEvent) => void) | undefined)?.(e);
    },
    onBlur: (e: FocusEvent) => {
      comboBoxInputBlur(e, handlerProps, state, refs);
      (text.inputProps.onBlur as ((e: FocusEvent) => void) | undefined)?.(e);
    },
    onInput: (e: Event) => {
      (text.inputProps.onInput as (e: Event) => void)(e);
      // A plain controlled `inputValue` keeps the field's text (React re-renders the input with `value`).
      if (state.inputFixed) {
        const input = e.currentTarget as HTMLInputElement;
        const value = untrack(state.inputValue);
        if (input.value !== value) input.value = value;
      }
    },
    role: "combobox",
    "aria-expanded": () => String(state.isOpen()),
    "aria-controls": () => (state.isOpen() ? menuId.current() : undefined),
    // TODO: readd proper logic for completionMode = complete (aria-autocomplete: both)
    "aria-autocomplete": "list",
    "aria-activedescendant": () => {
      const item = focusedItem(state);
      return item ? getItemId(menuId.current(), item.key) : undefined;
    },
    onTouchEnd: (e: TouchEvent) => comboBoxInputTouchEnd(e, handlerProps, state, refs),
    // This disable's iOS's autocorrect suggestions, since the combo box provides its own suggestions.
    autoCorrect: "off",
    // This disable's the macOS Safari spell check auto corrections.
    spellCheck: "false",
  };

  const labelId = text.ids.labelProps.id;
  const triggerLabelProps = labelsProps(menuTriggerId, format("buttonLabel"), props["aria-labelledby"] || labelId);
  const listBoxLabels = labelsProps(listBoxId, format("listboxLabel"), props["aria-labelledby"] || labelId);

  const hasFor = !!text.labelProps.for;
  // Focus the input in case the label is not a native <label> element.
  const labelProps: PropBag =
    typeof isDisabled === "function"
      ? hasFor
        ? { ...text.labelProps }
        : { ...text.labelProps, onClick: () => (read(isDisabled) ? undefined : comboBoxLabelClick(refs)) }
      : hasFor || isDisabled
        ? { ...text.labelProps }
        : { ...text.labelProps, onClick: () => comboBoxLabelClick(refs) };

  return {
    labelProps,
    buttonProps: {
      // useOverlayTrigger triggerProps
      "aria-haspopup": "listbox",
      "aria-expanded": () => state.isOpen(),
      "aria-controls": () => (state.isOpen() ? menuId.current() : undefined),
      // useMenuTrigger keyboardProps
      onKeyDown: (e: KeyboardEvent) => comboBoxButtonKeyDown(e, handlerProps, state),
      ...triggerLabelProps,
      id: menuTriggerId,
      excludeFromTabOrder: true,
      preventFocusOnPress: true,
      onPress: (e: { pointerType: string }) => comboBoxButtonPress(e, handlerProps, state, refs),
      onPressStart: (e: { pointerType: string }) => comboBoxButtonPressStart(e, handlerProps, state, refs),
      isDisabled: typeof isDisabled === "function" || typeof isReadOnly === "function" ? eitherFlag(isDisabled, isReadOnly) : !!(isDisabled || isReadOnly),
    },
    inputProps,
    listBoxProps: {
      // useMenuTrigger menuProps (+ useOverlayTrigger overlayProps)
      ...listBoxLabels,
      id: menuId as unknown as string,
      onClose: () => closeCombo(state),
      onAction: undefined,
      autoFocus: () => state.focusStrategy() || true,
      shouldUseVirtualFocus: true,
      shouldSelectOnPressUp: true,
      shouldFocusOnHover: true,
      linkBehavior: "selection" as const,
      UNSTABLE_itemBehavior: "action",
    },
    valueProps: { id: untrack(() => valueId?.()) },
    descriptionProps: text.descriptionProps,
    errorMessageProps: text.errorMessageProps,
    ids: text.ids,
    listBoxId,
    isInvalid: () => displayValidation(state.validation).isInvalid,
    validationErrors: () => displayValidation(state.validation).validationErrors,
    validationDetails: () => displayValidation(state.validation).validationDetails,
  };
}
