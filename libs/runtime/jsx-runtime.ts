import type { Signal } from "@rivetjs/reactivity";
// Generated with the compiler's list from lib.dom (scripts/gen-events.mjs).
import type { EventMap } from "./jsx-events.ts";
/** Native events by name (`Click`, `PointerDown`, …), as JSX `on<Name>` props accept them. */
export type { EventMap };
import type { ClassValue, StyleObject } from "./style.ts";
declare const compiledBrand: unique symbol;
declare const refBrand: unique symbol;
/** Authoring result erased by the Rivet compiler; usable by either output target. */
export interface CompiledElement {
  readonly [compiledBrand]: true;
}
type Scalar = string | number;
type CrossOrigin = "" | "anonymous" | "use-credentials";
type FetchPriority = "high" | "low" | "auto";
type Children =
  | CompiledElement
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly Children[]
  | (() => Children);
/**
 * Slot content: a function rendering JSX, called where the component renders the slot (lazy; it sees
 * the context the component provides). `A` are scoped-slot arguments (`<slot r:args={[item]}>`).
 */
export type Slot<A extends unknown[] = []> = (...args: A) => Children;
/** A prop rendered as content: an eager JSX value or a lazy `Slot`. */
export type Content = Children;
/** Optional slot props for `<slot r:name="…">` names (named slots are always optional). */
export type Slots<N extends string, A extends unknown[] = []> = { [K in N]?: Slot<A> | Content };
/**
 * An element ref from `ref<T>()` (`@rivetjs/runtime/dom`): `r()` is the element once attached
 * (`<canvas ref={r} />`), else undefined; signal-backed, so effects reading it re-run on attach.
 */
export interface Ref<T extends Element = HTMLElement> {
  (): T | undefined;
  /** Type-only: which elements the ref accepts (contravariant, so `Ref<HTMLElement>` fits any HTML element). */
  readonly [refBrand]: (element: T) => void;
}
/** `ref={…}` on an element of type `E`: a `Ref` accepting `E`, or a callback receiving it. */
export type RefProp<E> = { readonly [refBrand]: (element: E) => void } | (((element: E) => void) & { readonly [refBrand]?: never });
type Handler<E, V extends Event> = (event: V & { readonly currentTarget: E }) => unknown;
type Events<E> = { [K in keyof EventMap as `on${K}` | `on${K}Capture`]?: Handler<E, EventMap[K]> };
type GlobalEvents = {
  [K in `window:on${Capitalize<string>}` | `document:on${Capitalize<string>}`]?: (event: Event) => unknown;
};
/** `on:name` (custom events, any case, no capture) and `prop:name` (element property, browser only). */
type CustomEvents<E> = { [K in `on:${string}`]?: Handler<E, CustomEvent> } & { [K in `prop:${string}`]?: unknown };
/** `class:name={on}` toggles one class; `style:prop={value}` sets one CSS property (kebab-case). */
type Directives = { [K in `class:${string}`]?: unknown } & { [K in `style:${string}`]?: string | number | null | undefined | false };
type Global<E> = Events<E> & GlobalEvents & CustomEvents<E> & Directives & {
  children?: Children;
  /** A `ref()` object or a callback receiving the native element once it exists in the browser; never set / called on the server. */
  ref?: RefProp<E>;
  /** Usage side of a named slot: this element becomes the parent component's `name` slot content. */
  "r:slot"?: string;
  id?: string;
  /** A class string, an array of class values, or `{ name: condition }` (literal objects / arrays; pass others through `cx()`). */
  class?: ClassValue;
  className?: ClassValue;
  /** A style object (`{ color: c, "--x": v }`); style strings are compile errors. */
  style?: StyleObject;
  title?: string;
  role?: string;
  hidden?: boolean | "until-found";
  inert?: boolean;
  tabIndex?: number;
  lang?: string;
  dir?: "ltr" | "rtl" | "auto";
  draggable?: boolean | "true" | "false";
  spellCheck?: boolean;
  accessKey?: string;
  translate?: "yes" | "no";
  contentEditable?: boolean | "true" | "false" | "plaintext-only";
  inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  autoCapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
  popover?: boolean | "auto" | "manual" | "hint";
  /** Native (shadow DOM) slot assignment; Rivet slot content uses `r:slot`. */
  slot?: string;
  nonce?: string;
  itemProp?: string;
  itemScope?: boolean;
  itemType?: string;
  itemId?: string;
  itemRef?: string;
} & { [K in `data-${string}`]?: Scalar | boolean | null } & { [K in `aria-${string}`]?: Scalar | boolean | null };
type Controls = {
  name?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  form?: string;
};
type Input = Controls & {
  type?:
    | "text"
    | "search"
    | "email"
    | "url"
    | "tel"
    | "password"
    | "checkbox"
    | "radio"
    | "file"
    | "number"
    | "range"
    | "date"
    | "time"
    | "datetime-local"
    | "month"
    | "week"
    | "color"
    | "hidden"
    | "button"
    | "submit"
    | "reset"
    | "image";
  value?: Scalar;
  checked?: boolean;
  /** Uncontrolled initial value (the `value` attribute; a form reset restores it). */
  defaultValue?: Scalar;
  /** Uncontrolled initial checkedness (the `checked` attribute). */
  defaultChecked?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  min?: Scalar;
  max?: Scalar;
  step?: Scalar;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  multiple?: boolean;
  accept?: string;
  autoComplete?: string;
  list?: string;
  "model:value"?: Signal<string>;
  "model:checked"?: Signal<boolean>;
};
type Textarea = Controls & {
  value?: string;
  /** Uncontrolled initial value (the textarea's content). */
  defaultValue?: string;
  readOnly?: boolean;
  placeholder?: string;
  rows?: number;
  cols?: number;
  maxLength?: number;
  minLength?: number;
  wrap?: "hard" | "soft" | "off";
  autoComplete?: string;
  "model:value"?: Signal<string>;
};
type HTMLSpecific<K> = K extends "input"
  ? Input
  : K extends "textarea"
    ? Textarea
    : K extends "button"
      ? Controls & {
          type?: "button" | "submit" | "reset";
          value?: Scalar;
          formAction?: string;
          formNoValidate?: boolean;
          /** Popover invoker: id of the popover it toggles (no JavaScript). */
          popovertarget?: string;
          popovertargetaction?: "toggle" | "show" | "hide";
          /** Invoker command for the element `commandfor` names (`show-modal`, `close`, `toggle-popover`, …, or `--custom`). */
          command?: "show-modal" | "close" | "request-close" | "toggle-popover" | "show-popover" | "hide-popover" | `--${string}`;
          commandfor?: string;
          /** Interest invoker: id of the popover shown on hover / focus. */
          interestfor?: string;
        }
      : K extends "select"
        ? Controls & {
            multiple?: boolean;
            size?: number;
            /** Selects the matching option(s) on every target; an array for `multiple`. */
            value?: Scalar | readonly Scalar[];
            "model:value"?: Signal<string> | Signal<string[]>;
            autoComplete?: string;
          }
        : K extends "option"
          ? { disabled?: boolean; selected?: boolean; value?: Scalar; label?: string }
          : K extends "label"
            ? { for?: string; htmlFor?: string }
            : K extends "fieldset"
              ? { disabled?: boolean; name?: string; form?: string }
            : K extends "a" | "area"
              ? {
                  href?: string;
                  target?: string;
                  rel?: string;
                  download?: string | boolean;
                  hreflang?: string;
                  type?: string;
                }
              : K extends "iframe"
                ? {
                    src?: string;
                    name?: string;
                    width?: Scalar;
                    height?: Scalar;
                    allow?: string;
                    allowFullScreen?: boolean;
                    loading?: "eager" | "lazy";
                    referrerPolicy?: ReferrerPolicy;
                    /** Space-separated tokens (`allow-scripts allow-same-origin` …); `srcdoc` is not supported. */
                    sandbox?: string;
                  }
              : K extends "time" | "del" | "ins"
                ? { dateTime?: string; cite?: string }
              : K extends "meta"
                ? { charset?: string; charSet?: string; content?: string; name?: string; httpEquiv?: string; property?: string; media?: string }
              : K extends "link"
                ? {
                    href?: string;
                    rel?: string;
                    as?: string;
                    type?: string;
                    media?: string;
                    sizes?: string;
                    hreflang?: string;
                    crossOrigin?: CrossOrigin;
                    integrity?: string;
                    fetchPriority?: FetchPriority;
                    referrerPolicy?: ReferrerPolicy;
                    imageSrcSet?: string;
                    imageSizes?: string;
                    disabled?: boolean;
                    blocking?: "render";
                  }
              : K extends "script"
                ? { src?: string; type?: string; async?: boolean; defer?: boolean; crossOrigin?: CrossOrigin; integrity?: string; noModule?: boolean; fetchPriority?: FetchPriority; referrerPolicy?: ReferrerPolicy }
              : K extends "form"
                ? {
                    action?: string;
                    method?: "get" | "post" | "dialog";
                    encType?: string;
                    noValidate?: boolean;
                    name?: string;
                    target?: string;
                  }
                : K extends "canvas"
                  ? { width?: Scalar; height?: Scalar }
                : K extends "img"
                  ? {
                      src?: string;
                      alt?: string;
                      width?: Scalar;
                      height?: Scalar;
                      srcSet?: string;
                      sizes?: string;
                      loading?: "eager" | "lazy";
                      decoding?: "sync" | "async" | "auto";
                      fetchPriority?: FetchPriority;
                      crossOrigin?: CrossOrigin;
                      referrerPolicy?: ReferrerPolicy;
                    }
                  : K extends "video" | "audio"
                    ? {
                        src?: string;
                        controls?: boolean;
                        autoPlay?: boolean;
                        loop?: boolean;
                        muted?: boolean;
                        poster?: string;
                        preload?: string;
                        crossOrigin?: CrossOrigin;
                        playsInline?: boolean;
                        /** `nodownload` / `nofullscreen` / `noremoteplayback` tokens. */
                        controlsList?: string;
                        disableRemotePlayback?: boolean;
                        disablePictureInPicture?: K extends "video" ? boolean : never;
                        /** video only: intrinsic display size (reserves layout space before metadata loads). */
                        width?: K extends "video" ? Scalar : never;
                        height?: K extends "video" ? Scalar : never;
                      }
                    : K extends "source"
                      ? { src?: string; srcSet?: string; type?: string; media?: string }
                      : K extends "object"
                        ? { data?: string; type?: string; name?: string; width?: Scalar; height?: Scalar }
                      : K extends "td" | "th"
                        ? { colSpan?: number; rowSpan?: number; headers?: string; scope?: string }
                        : K extends "ol"
                          ? { start?: number; reversed?: boolean; type?: string }
                          : K extends "li" | "data"
                            ? { value?: K extends "li" ? number : string }
                            : K extends "progress" | "meter"
                              ? { value?: number; min?: number; max?: number }
                              : K extends "details" | "dialog"
                                ? {
                                    open?: boolean;
                                    /** details: exclusive accordion group (one open per name). */
                                    name?: K extends "details" ? string : never;
                                    /** dialog: which user actions close it (light dismiss, Escape). */
                                    closedby?: K extends "dialog" ? "any" | "closerequest" | "none" : never;
                                  }
                                : K extends "slot"
                                  ? {
                                      /** Native (shadow DOM) slot name; Rivet slots use `r:name`. */
                                      name?: string;
                                      /** Rivet slot: the prop rendered here (default: `children`). */
                                      "r:name"?: string;
                                      /** Scoped slot arguments passed to the slot function. */
                                      "r:args"?: readonly unknown[];
                                    }
                                  : {};
type SVGAttrs = {
  viewBox?: string;
  preserveAspectRatio?: string;
  width?: Scalar;
  height?: Scalar;
  x?: Scalar;
  y?: Scalar;
  x1?: Scalar;
  y1?: Scalar;
  x2?: Scalar;
  y2?: Scalar;
  cx?: Scalar;
  cy?: Scalar;
  r?: Scalar;
  rx?: Scalar;
  ry?: Scalar;
  d?: string;
  points?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: Scalar;
  "stroke-width"?: Scalar;
  opacity?: Scalar;
  transform?: string;
  href?: string;
  "xlink:href"?: string;
  "xml:lang"?: string;
  xmlns?: string;
  focusable?: boolean | "true" | "false";
};
/** Resume preload directive for the element's handlers (compiler-only, never rendered); on
 * <audio>/<video> `preload` is the native attribute instead. */
type PreloadDirective<K> = K extends "audio" | "video" ? {} : { preload?: "eager" | "idle" | "visible" | "intent" | "interaction" };
type HTMLTags = { [K in keyof HTMLElementTagNameMap]: Global<HTMLElementTagNameMap[K]> & HTMLSpecific<K> & PreloadDirective<K> };
type SVGTags = {
  [K in Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>]: Global<SVGElementTagNameMap[K]> & SVGAttrs & PreloadDirective<K>;
};
/** Custom elements (`<my-widget>`): global attributes and events, plus any other attribute.
 * Unknown `on…` events and unsafe attributes stay compile errors, so they are excluded here. */
type Letter = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z";
type NameChar<Not extends Letter> = Exclude<Letter, Not> | Uppercase<Exclude<Letter, Not>> | "_";
/** Attribute names not starting with `on` (any case): the compiler reads every `on…` as an event. */
type LooseName = `${NameChar<"o">}${string}` | `${"o" | "O"}${NameChar<"n"> | "-" | ":" | "." | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"}${string}`;
type CustomTags = {
  [K in `${string}-${string}`]: Global<HTMLElement> & { [N in LooseName]?: unknown } & {
    srcdoc?: never;
    innerHTML?: never;
    dangerouslySetInnerHTML?: never;
  };
};
type MathTags = {
  [K in Exclude<keyof MathMLElementTagNameMap, keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap>]: Global<
    MathMLElementTagNameMap[K]
  > & {
    display?: "block" | "inline";
    mathvariant?: string;
    mathsize?: Scalar;
    mathcolor?: string;
    mathbackground?: string;
  };
};
/**
 * Framework bridges (types only, 0 B): `@rivetjs/bridge-<fw>` packages augment these registries (`declare module
 * "@rivetjs/runtime/jsx-runtime"`), one key per framework. Empty (no bridge types loaded): JSX typing is unchanged.
 * - `RivetForeignObjects`: component values that are not plain functions (class components, Vue / Svelte component
 *   objects), e.g. `{ vue: DefineComponent }`; they become valid JSX tags.
 * - `RivetForeignProps<C>`: per framework, the island props of `C` when `C` is that framework's component, else
 *   `never`, e.g. `{ react: C extends ReactCounterpart<infer P> ? IslandProps<P> : never }`.
 */
export interface RivetForeignObjects {}
// `C` is read only by augmentations (an augmentation repeats the parameter name).
export interface RivetForeignProps<C> {}
/** Union of the registered foreign component object types (`never` without bridges). */
export type RivetForeignObject = RivetForeignObjects[keyof RivetForeignObjects];
/** Island props of a foreign component `C` (`never` when no registered framework claims it). */
export type IslandPropsOf<C> = RivetForeignProps<C>[keyof RivetForeignProps<C>];
export namespace JSX {
  export type Element = CompiledElement;
  export type ElementType = keyof IntrinsicElements | ((props: never) => unknown) | RivetForeignObject;
  /** A component a bridge claims takes its island props; every other component keeps its own (`P`). */
  export type LibraryManagedAttributes<C, P> = [IslandPropsOf<C>] extends [never] ? P : IslandPropsOf<C>;
  export interface ElementChildrenAttribute {
    children: {};
  }
  /** Attributes every component element accepts. */
  export interface IntrinsicAttributes {
    /** Usage side of a named slot: this element becomes the parent component's `name` slot content. */
    "r:slot"?: string;
  }
  export type IntrinsicElements = HTMLTags & SVGTags & MathTags & CustomTags;
}
// Also `@rivetjs/runtime/jsx-dev-runtime` (`jsxDEV`): a dev automatic-JSX transform (esbuild/oxc
// `jsx: "automatic"`, a file the Rivet plugin skipped) resolves, then fails here with this message.
const unsupported: (...args: unknown[]) => never = () => {
  throw new Error("Rivet JSX must pass through @rivetjs/compiler; use jsx: preserve, not automatic JSX execution");
};
export { unsupported as jsx, unsupported as jsxs, unsupported as jsxDEV, unsupported as Fragment };
