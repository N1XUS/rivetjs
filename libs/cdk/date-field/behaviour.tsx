// Ported from react-aria (react-spectrum) src/datepicker/useDateField.ts, useDateSegment.ts,
// useDatePickerGroup.ts, useDisplayNames.ts, the keyboard / ARIA part of spinbutton/useSpinButton.ts
// and react-aria-components src/HiddenDateInput.tsx, Apache-2.0, © Adobe.
// Rivet:
// - Naming: `useDateField` / `useTimeField` → `dateFieldProps` / `timeFieldProps(props, state)` ({ labelProps,
//   fieldProps, inputProps, descriptionProps, errorMessageProps, isInvalid, validationErrors, validationDetails }),
//   `useDateSegment` → `dateSegmentProps({ key }, state)` ({ segmentProps }), RAC `useHiddenDateInput` →
//   `hiddenDateInputProps` ({ containerProps, inputProps }). State-dependent values are accessors (read in
//   bindings / spreads); handlers are free functions `(event, state)`. `.tsx`: the closures resume.
// - Segments are server-rendered `contenteditable` spinbuttons keyed by type + occurrence (`segmentKeys`): their
//   text and ARIA are patched in place. Keys / focus / pointer handlers are delegated on the field group
//   (`fieldProps`); `beforeinput` / `input` run on the segment (React Aria: per segment). Typing is handled at
//   keydown (printable keys, so a cold first key — held by `data-rk` while the chunk loads — is not inserted into
//   the segment) and at `beforeinput` for IME / virtual keyboards. The hidden form input's custom validity is
//   synced from the handlers (no layout effect runs before interaction).
// Deviation: iOS VoiceOver `role="textbox"` switch is not applied (server-rendered: spinbuttons everywhere but the
// time zone segment).
import { untrack } from "@rivetjs/reactivity";
import {
  CalendarDate,
  parseDate,
  parseDateTime,
  toCalendar,
  toCalendarDate,
  toCalendarDateTime,
  toLocalTimeZone,
  type CalendarDateTime,
} from "@rivetjs/cdk/date";
import { announce, visuallyHidden } from "@rivetjs/cdk/a11y";
import { createFocusManager, getFocusableTreeWalker, type FocusManager } from "@rivetjs/cdk/focus";
import { formatString, getStringsForLocale, isRTL } from "@rivetjs/cdk/i18n";
import { getDateFormatter } from "../i18n/date-formatter.ts";
import { isMac } from "@rivetjs/cdk/platform";
import {
  clearServerErrors,
  commitValidation,
  displayValidation,
  mergeValidation,
  realtimeValidation,
  resetValidation,
  updateValidation,
  type ValidationResult,
} from "../state/form-validation.ts";
import { nativeValidity, onFormReset, validityError } from "../form/behaviour.ts";
import { labelsProps } from "../label/behaviour.ts";
import { createSlotId, slotIdRef } from "../slots/index.tsx";
import { timeValue } from "../state/time-field.ts";
import {
  calendarOf,
  clearSegment,
  decrement,
  decrementPage,
  decrementToMin,
  fieldDateValue,
  fieldDateFormatter,
  fieldGranularity,
  fieldValueString,
  formatValue,
  increment,
  incrementPage,
  incrementToMax,
  isFieldInvalid,
  ownerDisabled,
  ownerOf,
  ownerReadOnly,
  ownerRequired,
  parseValue,
  resolvedOptionsOf,
  segments,
  setSegment,
  setValue,
  confirmPlaceholder,
  syncBuiltin,
  type DateFieldState,
  type DateOwnerBase,
  type DateSegment,
  type DateSegmentType,
} from "../state/date-field.ts";
import { datePickerMessages, type DatePickerMessageKey } from "./intl.ts";

export { validityError };

export const SEGMENT_ATTR = "data-rv-segment";
export const SEGMENT = "[" + SEGMENT_ATTR + "]";

// ---------------------------------------------------------------------------------------------
// Ids and strings

/** Id of the hidden form input of a field (RAC `<Input>` of DateInput). */
export const inputId = (state: DateFieldState): string => state.id + "-input";
/** Id of the selected-value description (React Aria `useDescription`). */
export const valueDescriptionId = (state: { id: string }): string => state.id + "-value";

const messages = (locale: string) => getStringsForLocale(datePickerMessages, locale);
export const message = (locale: string, key: DatePickerMessageKey, variables?: Record<string, string>): string =>
  formatString(messages(locale)[key], variables);

// ---------------------------------------------------------------------------------------------
// useDisplayNames

interface DisplayNames {
  of(field: string): string | undefined;
}
const displayNamesCache = new Map<string, DisplayNames>();

/** @private Field names (`Intl.DisplayNames` dateTimeField, else the bundled strings). */
export function displayNames(locale: string): DisplayNames {
  let names = displayNamesCache.get(locale);
  if (names) return names;
  // Try to use Intl.DisplayNames if possible. It may be supported in browsers, but not support the dateTimeField
  // type as that was only added in v2. https://github.com/tc39/intl-displaynames-v2
  try {
    names = new Intl.DisplayNames(locale, { type: "dateTimeField" } as unknown as Intl.DisplayNamesOptions) as DisplayNames;
  } catch {
    const strings = messages(locale) as Record<string, string>;
    names = { of: (field) => strings[field] };
  }
  displayNamesCache.set(locale, names);
  return names;
}

// ---------------------------------------------------------------------------------------------
// Segment keys: stable per segment type and occurrence, so the rows (and focus) survive updates.

/** Keys of the field's segments (`month`, `literal`, `literal-1` …). Reads. */
export function segmentKeys(state: DateFieldState): string[] {
  return keysOf(segments(state)).slice();
}
// Keys per segments array (`segments` returns the same array while the value is unchanged): every segment
// attribute binding asks `segmentOf`, so the keys were rebuilt ~15× per segment and render (HOTPATH 2026-10-09).
const segmentKeyCache = new WeakMap<DateSegment[], readonly string[]>();
function keysOf(list: DateSegment[]): readonly string[] {
  let keys = segmentKeyCache.get(list);
  if (!keys) {
    const seen: Record<string, number> = {};
    keys = list.map((segment) => {
      const n = (seen[segment.type] = (seen[segment.type] ?? -1) + 1);
      return n ? segment.type + "-" + n : segment.type;
    });
    segmentKeyCache.set(list, keys);
  }
  return keys;
}

/** The segment of `key`. Reads. */
export function segmentOf(state: DateFieldState, key: string): DateSegment | undefined {
  const list = segments(state);
  const index = keysOf(list).indexOf(key);
  return index < 0 ? undefined : list[index];
}

export const segmentId = (state: DateFieldState, key: string): string => state.id + "-" + key;

// ---------------------------------------------------------------------------------------------
// useDateField

/** The selected-value description of a standalone field (`Selected Date: …`). Reads. */
export function fieldValueDescription(state: DateFieldState): string {
  if (!fieldValueString(state)) return "";
  const time = state.maxGranularity === "hour";
  return message(state.locale, time ? "selectedTimeDescription" : "selectedDateDescription", {
    [time ? "time" : "date"]: formatValue(state, { month: "long" }),
  });
}

// ---------------------------------------------------------------------------------------------
// useDateSegment

const formatterOf = (state: DateFieldState) => fieldDateFormatter(state);

function textValueOf(state: DateFieldState, segment: DateSegment): string {
  let textValue = segment.isPlaceholder ? "" : segment.text;
  const options = resolvedOptionsOf(formatterOf(state));
  if (segment.type === "month" && !segment.isPlaceholder) {
    const monthTextValue = getDateFormatter(state.locale, { month: "long", timeZone: options.timeZone }).format(fieldDateValue(state));
    textValue = monthTextValue !== textValue ? `${textValue} – ${monthTextValue}` : monthTextValue;
  } else if (segment.type === "hour" && !segment.isPlaceholder) {
    textValue = getDateFormatter(state.locale, { hour: "numeric", hour12: options.hour12, timeZone: options.timeZone }).format(fieldDateValue(state));
  }
  return textValue;
}

/** useSpinButton `aria-valuetext`. */
function ariaTextValue(state: DateFieldState, segment: DateSegment): string {
  const textValue = textValueOf(state, segment);
  return textValue === "" ? message(state.locale, "Empty") : (textValue || `${segment.value}`).replace("-", "−");
}

/** Segment style (caret hidden; RTL: numeric segments embedded left-to-right). Reads. */
export function segmentStyle(state: DateFieldState, key: string): Record<string, string> {
  const segment = segmentOf(state, key);
  const style: Record<string, string> = { caretColor: "transparent" };
  if (!segment || segment.type === "literal") return {};
  if (isRTL(state.locale)) {
    // While the bidirectional algorithm seems to work properly on inline elements with actual values, it returns different results for placeholder strings.
    // To ensure placeholder render in correct format, we apply the CSS equivalent of LRE (left-to-right embedding). See https://www.unicode.org/reports/tr9/#Explicit_Directional_Embeddings.
    // However, we apply this to both placeholders and date segments with an actual value because the date segments will shift around when deleting otherwise.
    style.unicodeBidi = "embed";
    const format = (resolvedOptionsOf(formatterOf(state)) as unknown as Record<string, unknown>)[segment.type];
    if (format === "numeric" || format === "2-digit") style.direction = "ltr";
  }
  return style;
}

/** Segment text. Reads. */
export const segmentText = (state: DateFieldState, key: string): string => segmentOf(state, key)?.text ?? "";

/** Keys held while a cold field's chunk loads (`data-rk`): spin / navigation keys, digits, day period letters. */
export function fieldKeys(state: DateFieldState): string {
  const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", "Backspace", "Delete", "Space"];
  for (let i = 0; i < 10; i++) keys.push(String(i));
  if (state.hourCycle === "h11" || state.hourCycle === "h12") {
    const { am, pm } = dayPeriods(state.locale);
    for (const text of [am, pm]) {
      const first = text.charAt(0);
      for (const c of new Set([first, first.toLowerCase(), first.toUpperCase()])) if (c && c !== " " && !keys.includes(c)) keys.push(c);
    }
  }
  return keys.join(" ");
}

// Number parsing (`@internationalized/number` NumberParser, integers only: locale digits + ASCII).
const digitsCache = new Map<string, Map<string, string>>();
function digitsOf(locale: string): Map<string, string> {
  let map = digitsCache.get(locale);
  if (!map) {
    map = new Map();
    const formatter = new Intl.NumberFormat(locale, { useGrouping: false });
    for (let i = 0; i < 10; i++) {
      map.set(formatter.format(i), String(i));
      map.set(String(i), String(i));
    }
    digitsCache.set(locale, map);
  }
  return map;
}
const toAscii = (locale: string, text: string): string | null => {
  const digits = digitsOf(locale);
  let out = "";
  for (const c of text) {
    const d = digits.get(c);
    if (d === undefined) return null;
    out += d;
  }
  return out;
};
/** NumberParser `isValidPartialNumber` ({maximumFractionDigits: 0}). */
export const isValidPartialNumber = (locale: string, text: string): boolean => toAscii(locale, text) !== null;
/** NumberParser `parse` (NaN when empty / not a number). */
export const parseNumber = (locale: string, text: string): number => {
  const ascii = toAscii(locale, text);
  return ascii ? Number(ascii) : NaN;
};

// useFilter({sensitivity: 'base'}).startsWith
const collators = new Map<string, Intl.Collator>();
function startsWith(locale: string, string: string, substring: string): boolean {
  if (substring.length === 0) return true;
  let collator = collators.get(locale);
  if (!collator) collators.set(locale, (collator = new Intl.Collator(locale, { usage: "search", sensitivity: "base" })));
  string = string.normalize("NFC");
  substring = substring.normalize("NFC");
  return collator.compare(string.slice(0, substring.length), substring) === 0;
}

// Safari dayPeriod option doesn't work...
function dayPeriods(locale: string): { am: string; pm: string } {
  const formatter = getDateFormatter(locale, { hour: "numeric", hour12: true });
  const date = new Date();
  date.setHours(0);
  const am = formatter.formatToParts(date).find((part) => part.type === "dayPeriod")?.value ?? "AM";
  date.setHours(12);
  const pm = formatter.formatToParts(date).find((part) => part.type === "dayPeriod")?.value ?? "PM";
  return { am, pm };
}

// Get a list of formatted era names so users can type the first character to choose one.
function erasOf(state: DateFieldState): { era: string; formatted: string }[] {
  const calendar = calendarOf(state);
  const eraFormatter = getDateFormatter(state.locale, { year: "numeric", era: "narrow", timeZone: "UTC" });
  const date = toCalendar(new CalendarDate(1, 1, 1), calendar);
  const eras = calendar.getEras().map((era) => {
    const eraDate = date.set({ year: 1, month: 1, day: 1, era }).toDate("UTC");
    const parts = eraFormatter.formatToParts(eraDate);
    // Some eras have no localized name in CLDR (e.g. the Coptic 'BCE' era), in which case
    // Intl omits the era part entirely. Fall back to the era identifier so it stays typeable.
    const formatted = parts.find((p) => p.type === "era")?.value ?? era;
    return { era, formatted };
  });
  // Remove the common prefix from formatted values. This is so that in calendars with eras like
  // ERA0 and ERA1 (e.g. Ethiopic), users can press "0" and "1" to select an era. In other cases,
  // the first letter is used.
  const prefixLength = commonPrefixLength(eras.map((era) => era.formatted));
  if (prefixLength) for (const era of eras) era.formatted = era.formatted.slice(prefixLength);
  return eras;
}

function commonPrefixLength(strings: string[]): number {
  // Sort the strings, and compare the characters in the first and last to find the common prefix.
  strings.sort();
  const first = strings[0]!;
  const last = strings[strings.length - 1]!;
  for (let i = 0; i < first.length; i++) if (first[i] !== last[i]) return i;
  return 0;
}

// Entered keys per field segment (React Aria `enteredKeys` ref; browser-only).
const enteredKeys = new WeakMap<DateFieldState, Record<string, string>>();
const entered = (state: DateFieldState, key: string): string => enteredKeys.get(state)?.[key] ?? "";
function setEntered(state: DateFieldState, key: string, value: string): void {
  let record = enteredKeys.get(state);
  if (!record) enteredKeys.set(state, (record = {}));
  record[key] = value;
}

/** The field's focus manager (segments of its scope: the field, or a range picker's group). */
function fieldFocusManager(segment: Element): FocusManager {
  const field = segment.closest("[data-rv-date-field]");
  const scopeId = field?.getAttribute("data-rv-focus-scope");
  const scope = (scopeId && segment.ownerDocument.getElementById(scopeId)) || field;
  return createFocusManager(() => scope, { accept: (element) => element.hasAttribute(SEGMENT_ATTR) });
}

/** Events a field handler handled (the picker group's handler skips them; cold events are already default-prevented). */
const handled = new WeakSet<Event>();
export const wasHandled = (event: Event): boolean => handled.has(event);

function afterChange(state: DateFieldState, segmentEl: HTMLElement, key: string): void {
  syncFieldInput(state, segmentEl.ownerDocument);
  // useSpinButton announces the new value while the segment is focused.
  const doc = segmentEl.ownerDocument;
  queueMicrotask(() => {
    if (doc.activeElement !== segmentEl) return;
    const segment = untrack(() => segmentOf(state, key));
    if (segment && segment.type !== "literal")
      announce(
        untrack(() => ariaTextValue(state, segment)),
        "assertive",
      );
  });
}

function backspace(state: DateFieldState, segmentEl: HTMLElement, key: string, segment: DateSegment): void {
  const owner = ownerOf(state);
  if (segment.text === segment.placeholder) fieldFocusManager(segmentEl).focusPrevious();
  if (isValidPartialNumber(state.locale, segment.text) && !ownerReadOnly(owner) && !segment.isPlaceholder) {
    let newValue = segment.text.slice(0, -1);
    const parsed = parseNumber(state.locale, newValue);
    newValue = parsed === 0 ? "" : newValue;
    if (newValue.length === 0 || parsed === 0) clearSegment(state, segment.type);
    else setSegment(state, segment.type, parsed);
    setEntered(state, key, newValue);
  } else if (segment.type === "dayPeriod" || segment.type === "era") clearSegment(state, segment.type);
}

function onInput(state: DateFieldState, segmentEl: HTMLElement, key: string, segment: DateSegment, input: string): void {
  const owner = ownerOf(state);
  if (ownerDisabled(owner) || ownerReadOnly(owner)) return;
  const newValue = entered(state, key) + input;
  const focusManager = fieldFocusManager(segmentEl);
  switch (segment.type) {
    case "dayPeriod": {
      const { am, pm } = dayPeriods(state.locale);
      if (startsWith(state.locale, am, input)) setSegment(state, "dayPeriod", 0);
      else if (startsWith(state.locale, pm, input)) setSegment(state, "dayPeriod", 1);
      else break;
      focusManager.focusNext();
      break;
    }
    case "era": {
      const matched = erasOf(state).find((e) => startsWith(state.locale, e.formatted, input));
      if (matched) {
        setSegment(state, "era", matched.era);
        focusManager.focusNext();
      }
      break;
    }
    case "day":
    case "hour":
    case "minute":
    case "second":
    case "month":
    case "year": {
      if (!isValidPartialNumber(state.locale, newValue)) return;
      const numberValue = parseNumber(state.locale, newValue);
      let segmentValue = numberValue;
      if (segment.maxValue !== undefined && numberValue > segment.maxValue) segmentValue = parseNumber(state.locale, input);
      if (isNaN(numberValue)) return;
      setSegment(state, segment.type, segmentValue);
      if (segment.maxValue !== undefined && (Number(numberValue + "0") > segment.maxValue || newValue.length >= String(segment.maxValue).length)) {
        setEntered(state, key, "");
        focusManager.focusNext();
      } else setEntered(state, key, newValue);
      break;
    }
  }
}

type FieldEvent<E extends Event> = E & { currentTarget: HTMLElement };

function segmentTarget(state: DateFieldState, event: Event): { el: HTMLElement; key: string; segment: DateSegment } | null {
  const el = (event.target as Element | null)?.closest?.<HTMLElement>(SEGMENT);
  if (!el || !(event.currentTarget as Element).contains(el)) return null;
  const key = el.getAttribute(SEGMENT_ATTR)!;
  const segment = untrack(() => segmentOf(state, key));
  return segment ? { el, key, segment } : null;
}

/**
 * Whether the field group handling `event` is the innermost one around its target: a group nested in another one of the same field (HeroUI
 * `DateInputGroup` = `<Group>` around RAC `DateInput`'s own `<Group>`, both merging the field's GroupContext props) handles the event once
 * (React Aria: the segment's `useKeyboard` stops propagation).
 */
const innermostField = (event: Event): boolean => (event.target as Element | null)?.closest?.("[data-rv-date-field]") === event.currentTarget;

const noModifiers = (event: KeyboardEvent): boolean => !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

/**
 * keydown on the field: the segment's spin button keys (useSpinButton), Backspace / Delete, typed
 * characters; a standalone field also moves between segments with ArrowLeft / ArrowRight
 * (useDatePickerGroup; in a picker the group does).
 */
export function dateFieldKeyDown(event: FieldEvent<KeyboardEvent>, state: DateFieldState): void {
  if (event.isComposing) return;
  const target = segmentTarget(state, event);
  if (!target) return;
  const { el, key, segment } = target;
  const owner = ownerOf(state);
  const spin = !ownerDisabled(owner) && !ownerReadOnly(owner) && segment.isEditable && segment.type !== "literal";
  const type = segment.type as DateSegmentType;
  let done = false;
  if (noModifiers(event) && spin) {
    done = true;
    switch (event.key) {
      case "PageUp":
        setEntered(state, key, "");
        incrementPage(state, type);
        break;
      case "ArrowUp":
        setEntered(state, key, "");
        increment(state, type);
        break;
      case "PageDown":
        setEntered(state, key, "");
        decrementPage(state, type);
        break;
      case "ArrowDown":
        setEntered(state, key, "");
        decrement(state, type);
        break;
      case "Home":
        setEntered(state, key, "");
        decrementToMin(state, type);
        break;
      case "End":
        setEntered(state, key, "");
        incrementToMax(state, type);
        break;
      default:
        done = false;
    }
  }
  if (!done && (event.key === "Backspace" || event.key === "Delete") && !event.altKey && !event.ctrlKey && !event.metaKey) {
    backspace(state, el, key, segment);
    done = true;
  } else if (!done && (isMac() ? event.metaKey : event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "a") {
    // Firefox does not fire selectstart for Ctrl/Cmd + A
    done = true;
  } else if (!done && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    onInput(state, el, key, segment, event.key);
    done = true;
  }
  if (!done && noModifiers(event) && el.closest("[data-rv-date-field]")?.getAttribute("role") !== "presentation")
    done = arrowNavigation(state.locale, el.closest("[data-rv-date-field]")!, el, event);
  if (!done) return;
  event.preventDefault();
  handled.add(event);
  afterChange(state, el, key);
}

/** useDatePickerGroup ArrowLeft / ArrowRight within `scope` (RTL: by position). */
export function arrowNavigation(locale: string, scope: Element, from: HTMLElement, event: KeyboardEvent): boolean {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return false;
  const dir = event.key === "ArrowLeft" ? -1 : 1;
  if (isRTL(locale)) {
    const next = findNextSegment(scope, from.getBoundingClientRect().left, dir);
    if (next) {
      next.focus();
      return true;
    }
    return false;
  }
  const manager = createFocusManager(() => scope);
  if (dir < 0) manager.focusPrevious({ from });
  else manager.focusNext({ from });
  return true;
}

function findNextSegment(group: Element, fromX: number, direction: number): HTMLElement | null {
  const walker = getFocusableTreeWalker(group, { tabbable: true });
  let node = walker.nextNode();
  let closest: HTMLElement | null = null;
  let closestDistance = Infinity;
  while (node) {
    const x = (node as Element).getBoundingClientRect().left;
    const distance = x - fromX;
    const absoluteDistance = Math.abs(distance);
    if (Math.sign(distance) === direction && absoluteDistance < closestDistance) {
      closest = node as HTMLElement;
      closestDistance = absoluteDistance;
    }
    node = walker.nextNode();
  }
  return closest;
}

// Composition text per segment element (`compositionRef`).
const composition = new WeakMap<Element, string | null>();

/** beforeinput on the field: the DOM never changes; text from IME / virtual keyboards is typed into the segment. */
export function dateFieldBeforeInput(event: FieldEvent<InputEvent>, state: DateFieldState): void {
  const target = segmentTarget(state, event);
  if (!target) return;
  const { el, key, segment } = target;
  event.preventDefault();
  switch (event.inputType) {
    case "deleteContentBackward":
    case "deleteContentForward":
      if (isValidPartialNumber(state.locale, segment.text) && !ownerReadOnly(ownerOf(state))) backspace(state, el, key, segment);
      break;
    case "insertCompositionText":
      // insertCompositionText cannot be canceled.
      // Record the current state of the element so we can restore it in the `input` event below.
      composition.set(el, el.textContent);
      // Safari gets stuck in a composition state unless we also assign to the value here.
      // eslint-disable-next-line no-self-assign
      el.textContent = el.textContent;
      return;
    default:
      if (event.data != null) onInput(state, el, key, segment, event.data);
      break;
  }
  afterChange(state, el, key);
}

/** input on the field: restore the DOM after composition text (it cannot be canceled). */
export function dateFieldInput(event: FieldEvent<InputEvent>, state: DateFieldState): void {
  const target = segmentTarget(state, event);
  if (!target || event.inputType !== "insertCompositionText") return;
  const { el, key, segment } = target;
  // Reset the DOM to how it was in the beforeinput event.
  el.textContent = composition.get(el) ?? el.textContent;
  // Android sometimes fires key presses of letters as composition events. Need to handle am/pm keys here too.
  // Can also happen e.g. with Pinyin keyboard on iOS.
  const data = event.data;
  const { am, pm } = dayPeriods(state.locale);
  if (data != null && (startsWith(state.locale, am, data) || startsWith(state.locale, pm, data))) {
    onInput(state, el, key, segment, data);
    afterChange(state, el, key);
  }
}

// Focus within the field (useFocusWithin of useDateField): value on focus, blur commits.
const valueOnFocus = new WeakMap<DateFieldState, string | null>();
let selectionListener = false;

/** focusin on the field: focus within starts (value on focus), the segment's selection collapses. */
export function dateFieldFocusIn(event: FieldEvent<FocusEvent>, state: DateFieldState): void {
  const field = event.currentTarget;
  if (!field.contains(event.relatedTarget as Node | null)) {
    valueOnFocus.set(
      state,
      untrack(() => fieldValueString(state)),
    );
    syncBuiltin(ownerOf(state));
    syncFieldInput(state, field.ownerDocument);
  }
  const target = segmentTarget(state, event);
  if (!target) return;
  setEntered(state, target.key, "");
  target.el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  // Collapse selection to start or Chrome won't fire input events.
  const doc = field.ownerDocument;
  doc.defaultView?.getSelection()?.collapse(target.el);
  if (!selectionListener) {
    selectionListener = true;
    doc.addEventListener("selectionchange", () => {
      // Enforce that the selection is collapsed when inside a date segment.
      // Otherwise, when tapping on a segment in Android Chrome and then entering text,
      // composition events will be fired that break the DOM structure and crash the page.
      const selection = doc.defaultView?.getSelection();
      const active = doc.activeElement;
      // Only collapse while focused, otherwise a stale anchor left in the segment (e.g. on Firefox)
      // steals focus back into it on selectionchange. See #10259.
      if (selection?.anchorNode && active?.hasAttribute(SEGMENT_ATTR) && active.contains(selection.anchorNode)) selection.collapse(active);
    });
  }
}

/** focusout of the field: confirm the placeholder (constrain / emit) and commit the validation when the value changed. */
export function dateFieldFocusOut(event: FieldEvent<FocusEvent>, state: DateFieldState): void {
  const field = event.currentTarget;
  if (field.contains(event.relatedTarget as Node | null)) return;
  confirmPlaceholder(state);
  syncFieldInput(state, field.ownerDocument);
  if (untrack(() => fieldValueString(state)) !== (valueOnFocus.get(state) ?? null)) commitValidation(ownerOf(state).validation);
}

/** useDatePickerGroup press: focus the first placeholder segment from the end (mouse: press start; touch / pen: press up). */
export function dateGroupPointerDown(event: FieldEvent<PointerEvent>): void {
  if (event.button !== 0 || pressIgnored(event)) return;
  if (event.pointerType === "mouse") {
    // preventFocusOnPress
    event.preventDefault();
    focusLast(event.currentTarget, event.target as Element);
  }
}

export function dateGroupPointerUp(event: FieldEvent<PointerEvent>): void {
  if (pressIgnored(event)) return;
  if (event.pointerType === "touch" || event.pointerType === "pen") focusLast(event.currentTarget, event.target as Element);
}

// Segments and buttons handle their own presses (React Aria: segments stop pointer propagation, buttons' usePress does).
function pressIgnored(event: Event): boolean {
  if (handled.has(event)) return true;
  const target = event.target as Element;
  const own = target.closest?.(SEGMENT + ", button, [data-rv-date-field]");
  if (own && own !== event.currentTarget && (own.hasAttribute(SEGMENT_ATTR) || own.localName === "button" || own.hasAttribute("data-rv-date-field"))) {
    // A nested field handles the press itself (the field inside a picker's group).
    if (own.hasAttribute("data-rv-date-field") && !own.contains(target.closest(SEGMENT))) return false;
    return true;
  }
  if (target.closest?.(SEGMENT)) return true;
  handled.add(event);
  return false;
}

function focusLast(root: Element, from: Element | null): void {
  // Try to find the segment prior to the element that was clicked on.
  let target = from as HTMLElement | null;
  const walker = getFocusableTreeWalker(root, { tabbable: true });
  if (target) {
    walker.currentNode = target;
    target = walker.previousNode() as HTMLElement | null;
  }
  // If no target found, find the last element from the end.
  if (!target) {
    let last: HTMLElement | null;
    do {
      last = walker.lastChild() as HTMLElement | null;
      if (last) target = last;
    } while (last);
  }
  // Now go backwards until we find an element that is not a placeholder.
  while (target?.hasAttribute("data-placeholder")) {
    const prev = walker.previousNode() as HTMLElement | null;
    if (prev && prev.hasAttribute("data-placeholder")) target = prev;
    else break;
  }
  target?.focus();
}

/** Label click: focus the first segment of `scopeId`'s element. */
export function focusFirstSegment(doc: Document, scopeId: string): void {
  const scope = doc.getElementById(scopeId);
  if (scope) createFocusManager(() => scope).focusFirst();
}

// ---------------------------------------------------------------------------------------------
// Hidden form input (useDateField inputProps + useFormValidation / useFormReset)

/** The value of the field's hidden form input. Reads. */
export const fieldInputValue = (state: DateFieldState): string =>
  ownerOf(state).kind === "time" ? (timeValue(state as never)?.toString() ?? "") : (fieldValueString(state) ?? "");

/**
 * Sync the hidden input of `state` (value now, ahead of the async binding; native custom validity
 * from the owner's realtime validation; a range picker merges the native validity of both ends).
 */
export function syncFieldInput(state: DateFieldState, doc: Document): void {
  const input = doc.getElementById(inputId(state)) as HTMLInputElement | null;
  if (!input) return;
  const value = untrack(() => fieldInputValue(state));
  if (input.value !== value) input.value = value;
  const owner = ownerOf(state);
  onFormReset(state, input, () => {
    setValue(state, parseValue(state.defaultValue));
    resetValidation(owner.validation);
  });
  const validation = owner.validation;
  if (validation.behavior !== "native" || input.disabled) return;
  const realtime = untrack(() => realtimeValidation(validation));
  // A range picker's fields share the validation (React Aria: each field's useFormValidation runs
  // every render): sync the other end's input too (`<picker id>-start-input` / `-end-input`).
  const other =
    owner.kind === "range"
      ? (doc.getElementById(state.id.replace(/-(start|end)$/, state.part === "start" ? "-end" : "-start") + "-input") as HTMLInputElement | null)
      : null;
  for (const element of other && !other.disabled ? [input, other] : [input]) {
    element.setCustomValidity(realtime.isInvalid ? realtime.validationErrors.join(" ") || "Invalid value." : "");
    // Prevent the default tooltip for the validation message (Firefox).
    if (!element.hasAttribute("title")) element.title = "";
  }
  if (realtime.isInvalid) return;
  const native = nativeValidity(input);
  if (owner.kind === "range") {
    const parts = { ...untrack(owner.partValidity), [state.part!]: native } as { start: ValidationResult; end: ValidationResult };
    if (other && !other.disabled) parts[state.part === "start" ? "end" : "start"] = nativeValidity(other);
    owner.partValidity.set(parts);
    updateValidation(validation, mergeValidation(parts.start, parts.end));
  } else updateValidation(validation, native);
}

/** `invalid` on the hidden input (submit / checkValidity): commit, focus the first segment, no browser bubble. */
export function dateFieldInvalid(event: Event, state: DateFieldState): void {
  const input = event.target as HTMLInputElement;
  const validation = ownerOf(state).validation;
  // Only commit when not already displaying an error: keeps server errors the user did not fix.
  if (!untrack(() => displayValidation(validation)).isInvalid) {
    clearServerErrors(validation);
    syncFieldInput(state, input.ownerDocument);
    commitValidation(validation);
  }
  const form = input.form;
  if (!event.defaultPrevented && form && [...form.elements].find((element) => (element as HTMLInputElement).validity?.valid === false) === input) {
    const field = input.ownerDocument.getElementById(state.id);
    const segment = field?.querySelector<HTMLElement>(SEGMENT + "[tabindex]");
    segment?.focus();
  }
  // Prevent the browser's error bubble.
  event.preventDefault();
}

// ---------------------------------------------------------------------------------------------
// HiddenDateInput (RAC): a native date input for browser autofill.

const granularityMap = { hour: 1, minute: 2, second: 3 } as const;

/** input on the autofill input: the browser filled it; set the field (each segment first for a standalone field). */
export function hiddenDateInputChange(event: Event, state: DateFieldState, picker: boolean): void {
  const targetString = (event.target as HTMLInputElement).value.toString();
  if (!targetString) return;
  try {
    const granularity = untrack(() => fieldGranularity(state));
    let targetValue: CalendarDateTime | CalendarDate = parseDateTime(targetString);
    if (granularity === "day") targetValue = parseDate(targetString);
    let timeSegments = ["hour", "minute", "second"];
    // Depending on the granularity, we only want to validate certain time segments
    if (timeSegments.includes(granularity)) timeSegments = timeSegments.slice(0, granularityMap[granularity as keyof typeof granularityMap]);
    // A DateField sets each segment before committing (its setValue commits complete values only);
    // a DatePicker sets the value directly.
    if (!picker)
      for (const type of ["year", "month", "day", ...timeSegments])
        if (type in targetValue) setSegment(state, type as DateSegmentType, (targetValue as unknown as Record<string, number>)[type]!);
    setValue(state, targetValue);
    syncFieldInput(state, (event.target as Element).ownerDocument);
  } catch {
    // ignore
  }
}

/** React Aria `FocusableProps` focus events of a field / picker group (useFocusWithin: focus entering / leaving the group). */
export interface FocusWithinHandlers {
  onFocus?: ((event: FocusEvent) => void) | undefined;
  onBlur?: ((event: FocusEvent) => void) | undefined;
  onFocusChange?: ((isFocused: boolean) => void) | undefined;
}

const focusedWithin = new WeakMap<Element, boolean>();
const reported = new WeakMap<Event, Element>();

/**
 * Call the user's handler of `event` once per container: a picker forwards the field's events and
 * (client-created) they also bubble to the group / root.
 */
export function onceFor(container: Element, event: Event): boolean {
  if (reported.get(event) === container) return false;
  reported.set(event, container);
  return true;
}

/**
 * useFocusWithin of `container` from a focusin / focusout inside it: `onFocus` + `onFocusChange(true)`
 * when focus enters, `onBlur` + `onFocusChange(false)` when it leaves. `isDisabled` (an open picker):
 * nothing is reported and the focused-within state is kept.
 */
export function focusWithinEvent(container: Element | null, event: FocusEvent, handlers: FocusWithinHandlers, isDisabled = false): void {
  if (!container || isDisabled || !onceFor(container, event)) return;
  if (event.type === "focusin") {
    if (focusedWithin.get(container) || !container.contains(event.target as Node)) return;
    focusedWithin.set(container, true);
    handlers.onFocus?.(event);
    handlers.onFocusChange?.(true);
  } else {
    if (!focusedWithin.get(container) || container.contains(event.relatedTarget as Node | null)) return;
    focusedWithin.set(container, false);
    handlers.onBlur?.(event);
    handlers.onFocusChange?.(false);
  }
}

// ---------------------------------------------------------------------------------------------
// useDateField / useTimeField

type Accessor<T> = () => T;
const flag = (value: unknown): "true" | undefined => (value ? "true" : undefined);

// Live props (P5): a field / picker flag given as an accessor (`isDisabled={d()}`) stays live on the owner
// (`owner.disabled`, …). The helpers below give the creation value on the static path (unchanged), else a returned
// arrow (resumable; a conditional bare arrow is not) reading the flag now. `which`: 0 disabled, 1 read-only, 2 required.
/** Which owner flag (0 `isDisabled`, 1 `isReadOnly`, 2 `isRequired`). */
export type OwnerFlag = 0 | 1 | 2;
const liveFlagOf = (owner: DateOwnerBase, which: OwnerFlag) => (which === 0 ? owner.disabled : which === 1 ? owner.readOnly : owner.required);
const createdFlag = (owner: DateOwnerBase, which: OwnerFlag): boolean => (which === 0 ? owner.isDisabled : which === 1 ? owner.isReadOnly : owner.isRequired);
/** The owner flag now (live accessor, else the creation value). Reads. */
export const ownerFlagNow = (owner: DateOwnerBase, which: OwnerFlag): boolean =>
  which === 0 ? ownerDisabled(owner) : which === 1 ? ownerReadOnly(owner) : ownerRequired(owner);
/** An owner flag as a part prop (Group / Button / Calendar `isDisabled`, …): the creation value, or an accessor while live. */
export function ownerFlag(owner: DateOwnerBase, which: OwnerFlag): Accessor<boolean> | boolean {
  return liveFlagOf(owner, which) ? flagReader(owner, which) : createdFlag(owner, which);
}
function flagReader(owner: DateOwnerBase, which: OwnerFlag): Accessor<boolean> {
  return () => ownerFlagNow(owner, which);
}
/** An owner flag as a `"true"` / absent attribute (`aria-*`, `data-*`): the creation value, or an accessor while live. */
export function ownerFlagAttr(owner: DateOwnerBase, which: OwnerFlag): Accessor<"true" | undefined> | "true" | undefined {
  return liveFlagOf(owner, which) ? flagAttrReader(owner, which) : flag(createdFlag(owner, which));
}
function flagAttrReader(owner: DateOwnerBase, which: OwnerFlag): Accessor<"true" | undefined> {
  return () => flag(ownerFlagNow(owner, which));
}
/** An owner flag as a boolean DOM attribute (`disabled`, `required`): `true` / absent, or an accessor while live. */
export function ownerFlagTrue(owner: DateOwnerBase, which: OwnerFlag): Accessor<true | undefined> | true | undefined {
  return liveFlagOf(owner, which) ? flagTrueReader(owner, which) : createdFlag(owner, which) || undefined;
}
function flagTrueReader(owner: DateOwnerBase, which: OwnerFlag): Accessor<true | undefined> {
  return () => ownerFlagNow(owner, which) || undefined;
}
/** A segment's `tabIndex` (`0`, none while disabled): an accessor while `isDisabled` is live. */
function segmentTabIndex(owner: DateOwnerBase): Accessor<0 | undefined> | 0 | undefined {
  return owner.disabled ? tabIndexReader(owner) : owner.isDisabled ? undefined : 0;
}
function tabIndexReader(owner: DateOwnerBase): Accessor<0 | undefined> {
  return () => (ownerDisabled(owner) ? undefined : 0);
}
/** A `boolean | accessor` option as a `true` / absent attribute value (an accessor stays live: a returned arrow). */
function trueAttr(value: boolean | Accessor<boolean | undefined> | undefined): Accessor<true | undefined> | true | undefined {
  return typeof value === "function" ? trueOf(value) : value || undefined;
}
function trueOf(read: Accessor<boolean | undefined>): Accessor<true | undefined> {
  return () => read() || undefined;
}

/** useDateField props (AriaDateFieldOptions minus the state's). */
export interface AriaDateFieldOptions {
  "aria-label"?: string | undefined;
  /** A picker passes its own labelled-by (an accessor: its Label slot settles after mount). */
  "aria-labelledby"?: string | (() => string | undefined) | undefined;
  /** A picker passes its own described-by (an accessor) to its presentation fields. */
  "aria-describedby"?: string | (() => string | undefined) | undefined;
  "aria-details"?: string | undefined;
  /** Whether a visible label renders (RAC `useSlot`): an accessor, or a boolean. */
  label?: boolean | Accessor<boolean> | undefined;
  name?: string | undefined;
  form?: string | undefined;
  /** @default "native" */
  validationBehavior?: "native" | "aria" | undefined;
  /** Rivet: a picker's field is `role="presentation"` inside the picker's group (useDatePicker fieldProps). */
  isPresentation?: boolean | undefined;
  /** Rivet: a range picker's group id: ArrowLeft / ArrowRight move across both fields (useDatePickerGroup). */
  focusScope?: string | undefined;
  /**
   * Rivet: the picker's group handler of the field's keydown / focusin / focusout (a resumed page runs only the
   * nearest element's handler of an event, so the field forwards to its picker).
   */
  forward?: ((event: Event) => void) | undefined;
  onFocus?: ((event: FocusEvent) => void) | undefined;
  onBlur?: ((event: FocusEvent) => void) | undefined;
  onFocusChange?: ((isFocused: boolean) => void) | undefined;
  onKeyDown?: ((event: KeyboardEvent) => void) | undefined;
  onKeyUp?: ((event: KeyboardEvent) => void) | undefined;
}

export interface DateFieldAria {
  /** The label (`<Label elementType="span">`): clicking it focuses the first segment. */
  labelProps: Record<string, unknown>;
  /** The field group (`<Group>` of DateInput): role, labelling, delegated handlers, `data-rk`. */
  fieldProps: Record<string, unknown>;
  /** The hidden form input (`<Input>` of DateInput). */
  inputProps: Record<string, unknown>;
  /** The description (`<Text slot="description">`), a slot id: dropped from `aria-describedby` while not rendered. */
  descriptionProps: { id: ReturnType<typeof createSlotId> };
  /** The error message (`<Text slot="errorMessage">` / FieldError). */
  errorMessageProps: { id: ReturnType<typeof createSlotId> };
  isInvalid: Accessor<boolean>;
  validationErrors: Accessor<string[]>;
  validationDetails: Accessor<ValidationResult["validationDetails"]>;
}

/**
 * useDateField: the attribute bags of a date field. Also records the labelling the segments read
 * (React Aria `hookData`) on the state.
 */
/** useLabel: the visible label labels the field; aria-label + aria-labelledby → the field labels itself too. Reads. */
export function fieldLabelledBy(state: DateFieldState): string | undefined {
  const aria = state.aria ?? {};
  const own = typeof aria.ownLabelledBy === "function" ? aria.ownLabelledBy() : aria.ownLabelledBy;
  const ids =
    [(typeof aria.hasLabel === "function" ? aria.hasLabel() : aria.hasLabel) ? state.id + "-label" : undefined, own].filter(Boolean).join(" ") || undefined;
  return labelsProps(state.id, aria.label, ids)["aria-labelledby"];
}

/**
 * useDescription (the selected value) + useField's description / error message + the user's. Reads.
 * Rivet: the FieldError only renders while invalid (RAC), so its id is skipped while valid; the description id only when
 * its part renders (server: the field's slot probe, `probeSlots`, marks it first): the server markup matches the client.
 */
export function fieldDescribedBy(state: DateFieldState): string | undefined {
  const aria = state.aria ?? {};
  const extra = typeof aria.extraDescribedBy === "function" ? aria.extraDescribedBy() : aria.extraDescribedBy;
  // RA: inside a picker the field passes the picker's described-by (value of the whole picker + its slots).
  if (aria.presentation) return extra || undefined;
  return (
    [
      fieldValueDescription(state) ? valueDescriptionId(state) : undefined,
      slotIdRef(aria.descriptionId, false),
      isFieldInvalid(state) ? slotIdRef(aria.errorId) : undefined,
      extra,
    ]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function dateFieldProps(props: AriaDateFieldOptions, state: DateFieldState): DateFieldAria {
  const owner = ownerOf(state);
  const validation = owner.validation;
  const labelId = state.id + "-label";
  const label = props.label;
  // A function (createSlot's `hasSlot`, resumable) or a plain boolean: an arrow made here would not serialize.
  const hasLabel = typeof label === "function" ? label : !!label;
  const ariaLabel = props["aria-label"];
  const isInvalid = () => isFieldInvalid(state);
  const descriptionId = createSlotId(state.id + "-description");
  const errorId = createSlotId(state.id + "-error", isInvalid);
  const isPresentation = !!props.isPresentation;
  state.aria = {
    label: ariaLabel,
    ownLabelledBy: props["aria-labelledby"],
    hasLabel,
    descriptionId,
    errorId,
    extraDescribedBy: props["aria-describedby"],
    presentation: isPresentation || undefined,
  };
  const labelledBy = () => fieldLabelledBy(state);
  const describedBy = () => fieldDescribedBy(state);
  const { forward, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp } = props;
  const focusWithin = onFocus || onBlur || onFocusChange ? { onFocus, onBlur, onFocusChange } : undefined;
  // Resumable closures: every handler is an inline arrow inside an object literal (no post-hoc assignment).
  const common = {
    id: state.id,
    style: { unicodeBidi: "isolate" },
    "data-rv-date-field": "",
    "data-rv-focus-scope": props.focusScope,
    "data-rk": fieldKeys(state),
    isDisabled: ownerFlag(owner, 0),
    isReadOnly: ownerFlag(owner, 1),
    isInvalid,
    onKeyDown: (event: FieldEvent<KeyboardEvent>) => {
      if (!innermostField(event)) return;
      dateFieldKeyDown(event, state);
      forward?.(event);
      onKeyDown?.(event);
    },
    onKeyUp,
    onFocusIn: (event: FieldEvent<FocusEvent>) => {
      if (!innermostField(event)) return;
      dateFieldFocusIn(event, state);
      forward?.(event);
      if (focusWithin) focusWithinEvent(event.currentTarget, event, focusWithin);
    },
    onFocusOut: (event: FieldEvent<FocusEvent>) => {
      if (!innermostField(event)) return;
      dateFieldFocusOut(event, state);
      forward?.(event);
      if (focusWithin) focusWithinEvent(event.currentTarget, event, focusWithin);
    },
  };
  const fieldProps: Record<string, unknown> = isPresentation
    ? { role: "presentation", ...common }
    : {
        role: "group",
        "aria-label": ariaLabel,
        "aria-labelledby": labelledBy,
        "aria-describedby": describedBy,
        "aria-details": props["aria-details"],
        "aria-disabled": ownerFlagAttr(owner, 0),
        ...common,
        onPointerDown: (event: FieldEvent<PointerEvent>) => innermostField(event) && dateGroupPointerDown(event),
        onPointerUp: (event: FieldEvent<PointerEvent>) => innermostField(event) && dateGroupPointerUp(event),
      };
  const native = (props.validationBehavior ?? "native") === "native";
  return {
    labelProps: { id: labelId, onClick: (event: MouseEvent) => focusFirstSegment((event.currentTarget as Element).ownerDocument, state.id) },
    fieldProps,
    inputProps: {
      id: inputId(state),
      type: native ? "text" : "hidden",
      hidden: native || undefined,
      name: props.name,
      form: props.form,
      required: native ? ownerFlagTrue(owner, 2) : undefined,
      disabled: ownerFlagTrue(owner, 0),
      value: () => fieldInputValue(state),
      "data-rv-error": () => validityError(validation),
      onInvalid: (event: Event) => dateFieldInvalid(event, state),
    },
    descriptionProps: { id: descriptionId },
    errorMessageProps: { id: errorId },
    isInvalid,
    validationErrors: () => displayValidation(validation).validationErrors,
    validationDetails: () => displayValidation(validation).validationDetails,
  };
}

/** useTimeField: useDateField over a time field state (`createTimeFieldState`). */
export const timeFieldProps = dateFieldProps;

// ---------------------------------------------------------------------------------------------
// useDateSegment

export interface DateSegmentAria {
  /** The segment element's attributes (accessor values; `style` included). */
  segmentProps: Record<string, unknown>;
}

/**
 * useDateSegment (+ useSpinButton): the attributes of the segment `key` (`segmentKeys`). Values are
 * accessors; the field's labelling comes from `dateFieldProps` (hookData on the state).
 */
export function dateSegmentProps(props: { key: string }, state: DateFieldState): DateSegmentAria {
  const key = props.key;
  const owner = ownerOf(state);
  const id = segmentId(state, key);
  const segment = () => segmentOf(state, key);
  const type = untrack(segment)?.type;
  const isInvalid = () => isFieldInvalid(state);
  const data = {
    "data-type": type,
    "data-placeholder": () => flag(segment()?.isPlaceholder),
    "data-invalid": () => flag(isInvalid()),
    "data-readonly": ownerFlagAttr(owner, 1),
    "data-disabled": ownerFlagAttr(owner, 0),
  };
  // Literal segments should not be visible to screen readers.
  if (type === "literal") return { segmentProps: { "aria-hidden": "true", ...data } };
  const ariaLabel = state.aria?.label;
  // Prepend the label passed from the field to each segment name. This is needed because VoiceOver on iOS does not announce groups.
  const name = displayNames(state.locale).of(type!) ?? type!;
  const label = () => {
    const by = fieldLabelledBy(state);
    return labelsProps(id, `${name}${ariaLabel ? `, ${ariaLabel}` : ""}${by ? ", " : ""}`, by);
  };
  const textbox = type === "timeZoneName";
  const isEditable = () => !ownerDisabled(owner) && !ownerReadOnly(owner) && !!segment()?.isEditable;
  return {
    segmentProps: {
      [SEGMENT_ATTR]: key,
      id,
      role: textbox ? "textbox" : "spinbutton",
      "aria-valuenow": () => {
        const value = segment()?.value;
        return textbox || value == null || isNaN(value) ? undefined : value;
      },
      "aria-valuetext": () => {
        const s = segment();
        return textbox || !s ? undefined : ariaTextValue(state, s);
      },
      "aria-valuemin": () => (textbox ? undefined : segment()?.minValue),
      "aria-valuemax": () => (textbox ? undefined : segment()?.maxValue),
      "aria-disabled": ownerFlagAttr(owner, 0),
      "aria-required": ownerFlagAttr(owner, 2),
      "aria-label": () => label()["aria-label"],
      "aria-labelledby": () => label()["aria-labelledby"],
      "aria-invalid": () => flag(isInvalid()),
      // Only on the first segment, unless the field is invalid (not read every time the user moves to a new segment).
      "aria-describedby": () => {
        const s = segment();
        const first = segments(state).find((x) => x.isEditable);
        return s && (s === first || isInvalid()) ? fieldDescribedBy(state) : undefined;
      },
      "aria-readonly": () => flag(ownerReadOnly(owner) || !segment()?.isEditable),
      contentEditable: () => (isEditable() ? "true" : undefined),
      spellCheck: () => (isEditable() ? "false" : undefined),
      autoCorrect: () => (isEditable() ? "off" : undefined),
      enterKeyHint: () => (isEditable() ? "next" : undefined),
      inputMode: () => (ownerDisabled(owner) || type === "dayPeriod" || type === "era" || !isEditable() ? undefined : "numeric"),
      tabIndex: segmentTabIndex(owner),
      style: () => segmentStyle(state, key),
      onBeforeInput: (event: FieldEvent<InputEvent>) => dateFieldBeforeInput(event, state),
      onInput: (event: FieldEvent<InputEvent>) => dateFieldInput(event, state),
      ...data,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// RAC HiddenDateInput (useHiddenDateInput)

/** Visually hidden; fixed so autofilling it never scrolls the page. */
const hiddenInputStyle = { ...visuallyHidden, position: "fixed", top: "0", left: "0" } as const;

export interface HiddenDateInputOptions {
  autoComplete?: string | undefined;
  name?: string | undefined;
  /** Whether the field is disabled (an accessor stays live). */
  isDisabled?: boolean | Accessor<boolean | undefined> | undefined;
  /** Rivet: a DatePicker sets the value directly (a DateField sets each segment first). */
  isPicker?: boolean | undefined;
}

/** useHiddenDateInput: the container + native date input browser autofill fills. */
export function hiddenDateInputProps(
  props: HiddenDateInputOptions,
  state: DateFieldState,
): { containerProps: Record<string, unknown>; inputProps: Record<string, unknown> } {
  const picker = !!props.isPicker;
  const granularity = () => fieldGranularity(state);
  return {
    containerProps: {
      style: hiddenInputStyle,
      "aria-hidden": "true",
      "data-react-aria-prevent-focus": "true",
      "data-a11y-ignore": "aria-hidden-focus",
      "data-testid": "hidden-dateinput-container",
    },
    inputProps: {
      type: () => (granularity() === "day" ? "date" : "datetime-local"),
      step: () => {
        const g = granularity();
        return g === "second" ? 1 : g === "hour" ? 3600 : 60;
      },
      value: () => {
        const value = parseValue(fieldValueString(state));
        if (!value) return "";
        if (granularity() === "day") return toCalendarDate(value).toString();
        return toCalendarDateTime("timeZone" in value ? toLocalTimeZone(value) : value).toString();
      },
      autoComplete: props.autoComplete,
      name: props.name,
      tabIndex: -1,
      disabled: trueAttr(props.isDisabled),
      form: "",
      onInput: (event: Event) => hiddenDateInputChange(event, state, picker),
    },
  };
}
