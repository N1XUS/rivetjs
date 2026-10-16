// Ported from @react-types/shared (packages/@react-types/shared/src/{dom,events,inputs,labelable,key,
// selection,orientation,collections,style}.d.ts), Apache-2.0, © Adobe.
// THE shared prop bases of every cdk component (types only: importing this module costs 0 bytes).
// Rivet:
// - events are native DOM events (no React SyntheticEvent); keyboard handlers get the native event
//   augmented with `continuePropagation()` (`RivetKeyboardEvent`, interactions/keyboard.tsx).
// - one source per type: PressEvent(s) = interactions/press.tsx, HoverEvent(s) = interactions/hover.tsx,
//   Key / Selection / Orientation… = collections/types.ts, router types = utils/links.tsx, validation
//   result types = state/form-validation.ts — re-exported here so components import ONE module.
// - `ReactNode` → `Content` (`@rivetjs/runtime/jsx-runtime`).
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { RivetKeyboardEvent } from "../interactions/keyboard.tsx";
import type { ValidationResult } from "../state/form-validation.ts";

export type { PressEvent, PressEvents, PointerType } from "../interactions/press.tsx";
export type { HoverEvent, HoverEvents } from "../interactions/hover.tsx";
export type { RivetKeyboardEvent as KeyboardEvent } from "../interactions/keyboard.tsx";
export type {
  Key,
  Selection,
  SelectionMode,
  SelectionBehavior,
  FocusStrategy,
  DisabledBehavior,
  Orientation,
  Direction,
  LoadingState,
  SortDescriptor,
  SortDirection,
} from "../collections/types.ts";
export type { Href, RouterOptions, LinkDOMProps } from "./links.tsx";
export type { ValidationResult, ValidationErrors, ValidationFunction, ValidationBehavior } from "../state/form-validation.ts";
export type { GlobalDOMAttributes, GlobalDOMEvents } from "./dom-props.ts";

// ---- events.d.ts ----

export interface KeyboardEvents {
  /** Handler that is called when a key is pressed. */
  onKeyDown?: (e: RivetKeyboardEvent) => void;
  /** Handler that is called when a key is released. */
  onKeyUp?: (e: RivetKeyboardEvent) => void;
}

export interface FocusEvents<Target extends Element = Element> {
  /** Handler that is called when the element receives focus. */
  onFocus?: (e: FocusEvent & { currentTarget: Target }) => void;
  /** Handler that is called when the element loses focus. */
  onBlur?: (e: FocusEvent & { currentTarget: Target }) => void;
  /** Handler that is called when the element's focus status changes. */
  onFocusChange?: (isFocused: boolean) => void;
}

export interface FocusableProps<Target extends Element = Element> extends FocusEvents<Target>, KeyboardEvents {
  /** Whether the element should receive focus on render. */
  autoFocus?: boolean;
}

// ---- dom.d.ts ----

export interface AriaLabelingProps {
  /** Defines a string value that labels the current element. */
  "aria-label"?: string;
  /** Identifies the element (or elements) that labels the current element. */
  "aria-labelledby"?: string;
  /** Identifies the element (or elements) that describes the object. */
  "aria-describedby"?: string;
  /** Identifies the element (or elements) that provide a detailed, extended description for the object. */
  "aria-details"?: string;
}

export interface AriaValidationProps {
  /** Identifies the element that provides an error message for the object. */
  "aria-errormessage"?: string;
}

/** Common DOM props allowed on any component. */
export interface DOMProps {
  /** The element's unique identifier. */
  id?: string;
}

export interface FocusableDOMProps extends DOMProps {
  /** Whether to exclude the element from the sequential tab order. */
  excludeFromTabOrder?: boolean;
}

/** Inline style object (`style` prop of every component; render-prop form in `StyleRenderProps`). */
export type StyleObject = Record<string, string | number | undefined>;

// ---- inputs.d.ts ----

export type ValidationState = "valid" | "invalid";
export type ValidationError = string | string[];

export interface Validation<T = unknown> {
  /** Whether user input is required on the input before form submission. */
  isRequired?: boolean;
  /** Whether the input value is invalid. */
  isInvalid?: boolean;
  /** @deprecated upstream: use `isInvalid`. */
  validationState?: ValidationState;
  /** `native` blocks form submission and shows native errors; `aria` only marks the field invalid. @default "native" (RAC) */
  validationBehavior?: "aria" | "native";
  /** Custom validation: error message(s), or `true` / `null` / `undefined` when valid. */
  validate?: (value: T) => ValidationError | true | null | undefined;
}

export interface InputBase {
  /** Whether the input is disabled. */
  isDisabled?: boolean;
  /** Whether the input can be selected but not changed by the user. */
  isReadOnly?: boolean;
}

/**
 * Value props. Rivet: `value` is a plain value OR a two-way `Signal` (see `controllable`).
 */
export interface ValueBase<T, C = T> {
  /** The current value (controlled): a plain value or a Signal. */
  value?: T | import("@rivetjs/reactivity").Signal<T>;
  /** The default value (uncontrolled). */
  defaultValue?: T;
  /** Handler that is called when the value changes. */
  onChange?: (value: C) => void;
}

export interface TextInputBase {
  /** Temporary text that occupies the text input when it is empty. */
  placeholder?: string;
}

export interface RangeValue<T> {
  start: T;
  end: T;
}

export interface RangeInputBase<T> {
  minValue?: T;
  maxValue?: T;
  step?: T;
}

export interface HelpTextProps {
  /** A description for the field. */
  description?: Content;
  /** An error message for the field. */
  errorMessage?: Content | ((v: ValidationResult) => Content);
}

// ---- labelable.d.ts ----

export interface LabelableProps {
  /** The content to display as the label. */
  label?: Content;
}
