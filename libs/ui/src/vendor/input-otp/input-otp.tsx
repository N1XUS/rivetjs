// Rivet port of input-otp 1.5.0 (MIT, © 2024 Guilherme Rodz; https://github.com/guilhermerodz/input-otp; ported from the
// published tarball's `dist/index.mjs.map` sources: `src/input.tsx`, `src/sync-timeouts.ts`, `src/use-previous.ts`,
// `src/use-pwm-badge.tsx`, `src/regexp.ts`; the version HeroUI v3.2.6 pins in `packages/react/package.json`). HeroUI builds
// `InputOTP` on it (`import { OTPInput, OTPInputContext } from "input-otp"`); React stays out of the tree, so the component is
// re-implemented here on signals. Licence + notice: `libs/ui/NOTICE`.
// Upstream behaviour kept 1:1:
// - one transparent `<input data-input-otp>` (absolute, `letter-spacing: -.5em`, `font-size: var(--root-height)`) over the
//   container `div[data-input-otp-container][translate=no]` (`position: relative`, `pointer-events: none`); `autocomplete`
//   `one-time-code` default, `inputmode` `numeric` default, `spellcheck` false default, `pattern` = the regexp source,
//   `aria-placeholder` = `placeholder`, `data-input-otp-placeholder-shown` / `-mss` / `-mse` mirrors;
// - typing: value sliced to `maxLength`, rejected (input keeps the old value) when it does not match `pattern`; a shorter value
//   dispatches `selectionchange` on the document (cut / delete fire none); `onComplete(value)` when the value grows to
//   `maxLength`; paste: `pasteTransformer` (any platform) or iOS → manual insert / replace at the selection;
// - document `selectionchange` (capture) mirrors the selection; a single caret (not in insert mode) selects one char (start /
//   end / previous-direction offset algorithm); focus selects `[min(len, max - 1), len]`; three `setTimeout`s (0 / 10 / 50 ms)
//   after a value / focus change re-dispatch `input` (drops `:autofill`) and re-read the selection;
// - mount: sync a browser-restored value (`onChange(input.value)`), one `<style id="input-otp-style">` per document (`nonce`;
//   `::selection`, `:autofill`, iOS and password-manager rules, `insertRule` failures only `console.warn`), `--root-height`
//   from the input's `clientHeight` (+ `ResizeObserver` when present);
// - password-manager badge (`pushPasswordManagerStrategy` `increase-width` default / `none`): space check every second,
//   badge probe at 0 / 2 / 5 s after focus (known managers' selectors, else `elementFromPoint`), done after 6 s; a pushed badge
//   widens the input by 40 px (`clip-path` hides the gutter);
// - `render(renderProps)` or `OTPInputContext` children;
//   render props `{ slots: { char, placeholderChar, isActive, hasFakeCaret }[], isFocused, isHovering }`.
// Rivet:
// - `className` → `class` (the input, as upstream `className`), `containerClassName` → `containerClass`; `ref` → the input
//   (upstream `useImperativeHandle`), callback or `signal` ref (runtime `bindRef`).
// - `value`: a string (live prop `value={v()}`), an accessor, or a two-way `Signal<string>` (set on change, cdk convention);
//   without it an internal signal seeded from `defaultValue`. React's controlled input is emulated: an `input` event whose value
//   equals the current value is ignored (React's value tracker), and the DOM value is restored when the change is rejected
//   (pattern) or the owner keeps the old value.
// - `OTPInputContext` (resumable `rv-ui-input-otp-primitive`) carries getters over signals (`slots` is a `computed` array):
//   readers bind attributes / children to them (React re-renders the context consumers). `RenderProps` fields are read
//   lazily; `render` receives the same getter object.
// - effects → `clientEffect` (runs on a resumed page without a user event: the mirrors / style / `--root-height` need the
//   mounted input); `usePrevious` → the value before the change (`untrack`), `onComplete` tracks its own previous value.
// - no `<noscript><style>` fallback: Rivet JSX rejects inline `<style>` / `<script>` content (build-time assets only, CSP), so
//   `noScriptCSSFallback` is accepted and ignored (`NOSCRIPT_CSS_FALLBACK` exported for an app stylesheet); without JS the
//   input stays transparent over the slots (upstream: a visible bordered input).
// - inline styles are Rivet style objects; the input's event props are chained after the internal handlers (`onPaste`,
//   `onMouseOver`, `onMouseLeave`, `onFocus`, `onBlur`; upstream calls `props.onX` the same way) and `onInput` after the
//   change handler (React `onChange` = `input`).
import { computed, createContext, signal, untrack } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { Provider, bindRef, clientEffect, ref } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { splitLive } from "../../utils/live.tsx";
import { PWM_BADGE_SPACE_WIDTH, PWM_BADGE_SPACE_WIDTH_PX, availableBadgeSpace, injectStyles, trackPWMBadge } from "./dom.ts";
import type { BadgeState } from "./dom.ts";

/* -------------------------------------------------------------------------------------------------
 * Types (upstream `src/types.ts`)
 * -----------------------------------------------------------------------------------------------*/
export interface SlotProps {
  isActive: boolean;
  char: string | null;
  placeholderChar: string | null;
  hasFakeCaret: boolean;
}

export interface RenderProps {
  slots: SlotProps[];
  isFocused: boolean;
  isHovering: boolean;
}

type InputAttributes = JSX.IntrinsicElements["input"];

export type OTPInputBaseProps = Omit<InputAttributes, "value" | "onChange" | "maxLength" | "children" | "ref"> & {
  /** Controlled value: a string, an accessor or a two-way `Signal<string>`. */
  value?: string | (() => string) | Signal<string>;
  defaultValue?: string;
  onChange?: (newValue: string) => unknown;
  maxLength: number;
  textAlign?: "left" | "center" | "right";
  onComplete?: (...args: any[]) => unknown;
  pushPasswordManagerStrategy?: "increase-width" | "none" | "experimental-no-flickering";
  pasteTransformer?: (pasted: string) => string;
  /** Class of the container `div` (upstream `containerClassName`). */
  containerClass?: string;
  /** Accepted, not rendered (no inline `<style>` in Rivet JSX; see the header). */
  noScriptCSSFallback?: string | null;
  nonce?: string;
  /** The hidden input element (upstream `forwardRef`). */
  ref?: ((element: HTMLInputElement) => void) | Signal<HTMLInputElement | undefined>;
};

export type InputOTPRenderFn = (props: RenderProps) => Content;

export type OTPInputProps = OTPInputBaseProps & ({ render: InputOTPRenderFn; children?: never } | { render?: never; children: Content });

/* -------------------------------------------------------------------------------------------------
 * Regular expressions (upstream `src/regexp.ts`)
 * -----------------------------------------------------------------------------------------------*/
export const REGEXP_ONLY_DIGITS = "^\\d+$";
export const REGEXP_ONLY_CHARS = "^[a-zA-Z]+$";
export const REGEXP_ONLY_DIGITS_AND_CHARS = "^[a-zA-Z0-9]+$";

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/
export const OTPInputContext = createContext<RenderProps>({} as RenderProps);

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/
/** Upstream `syncTimeouts`. */
function syncTimeouts(cb: (...args: any[]) => unknown) {
  const t1 = setTimeout(cb, 0); // For faster machines
  const t2 = setTimeout(cb, 1_0);
  const t3 = setTimeout(cb, 5_0);
  return [t1, t2, t3];
}

type Selection = [number | null, number | null, "none" | "forward" | "backward" | null];

/** Upstream `onDocumentSelectionChange` algorithm: the selection to mirror (and to apply to the input). */
function mirrorSelection(input: HTMLInputElement, prev: Selection): Selection {
  // Aliases
  const _s = input.selectionStart;
  const _e = input.selectionEnd;
  const _dir = input.selectionDirection;
  const _ml = input.maxLength;
  const _val = input.value;

  // Algorithm
  let start = -1;
  let end = -1;
  let direction: "forward" | "backward" | "none" | undefined = undefined;
  if (_val.length !== 0 && _s !== null && _e !== null) {
    const isSingleCaret = _s === _e;
    const isInsertMode = _s === _val.length && _val.length < _ml;

    if (isSingleCaret && !isInsertMode) {
      const c = _s;
      if (c === 0) {
        start = 0;
        end = 1;
        direction = "forward";
      } else if (c === _ml) {
        start = c - 1;
        end = c;
        direction = "backward";
      } else if (_ml > 1 && _val.length > 1) {
        let offset = 0;
        if (prev[0] !== null && prev[1] !== null) {
          direction = c < prev[1] ? "backward" : "forward";
          const wasPreviouslyInserting = prev[0] === prev[1] && prev[0] < _ml;
          if (direction === "backward" && !wasPreviouslyInserting) {
            offset = -1;
          }
        }

        start = offset + c;
        end = offset + c + 1;
      }
    }

    if (start !== -1 && end !== -1 && start !== end) {
      input.setSelectionRange(start, end, direction);
    }
  }

  return [start !== -1 ? start : _s, end !== -1 ? end : _e, direction ?? _dir];
}

const isSignal = (value: unknown): value is Signal<string> => typeof value === "function" && typeof (value as Partial<Signal<string>>).set === "function";

/** Upstream's `<noscript><style>` fallback text (not rendered here, see the header). Decided to go with <noscript> instead of
 *  the `scripting` CSS media query because it's a fallback for initial page load. */
export const NOSCRIPT_CSS_FALLBACK = `
[data-input-otp] {
  --nojs-bg: white !important;
  --nojs-fg: black !important;

  background-color: var(--nojs-bg) !important;
  color: var(--nojs-fg) !important;
  caret-color: var(--nojs-fg) !important;
  letter-spacing: .25em !important;
  text-align: center !important;
  border: 1px solid var(--nojs-fg) !important;
  border-radius: 4px !important;
  width: 100% !important;
}
@media (prefers-color-scheme: dark) {
  [data-input-otp] {
    --nojs-bg: black !important;
    --nojs-fg: white !important;
  }
}`;

/* -------------------------------------------------------------------------------------------------
 * OTPInput
 * -----------------------------------------------------------------------------------------------*/
export const OTPInput = (props: OTPInputProps): JSX.Element => {
  const [local, rest] = splitLive(props as OTPInputBaseProps & { render?: InputOTPRenderFn; children?: Content }, [
    "value",
    "defaultValue",
    "onChange",
    "maxLength",
    "textAlign",
    "pattern",
    "placeholder",
    "inputMode",
    "onComplete",
    "pushPasswordManagerStrategy",
    "pasteTransformer",
    "containerClass",
    "noScriptCSSFallback",
    "nonce",
    "render",
    "children",
    "ref",
    "autoComplete",
    "spellCheck",
    "disabled",
    "onPaste",
    "onInput",
    "onMouseOver",
    "onMouseLeave",
    "onFocus",
    "onBlur",
  ]);
  const inputRest = rest as InputAttributes;

  // Only used when `value` is not provided
  const internalValue = signal(typeof local.defaultValue === "string" ? local.defaultValue : "");

  // Definitions
  const value = (): string => {
    const v = local.value;
    if (v === undefined || v === null) return internalValue();
    return typeof v === "function" ? v() : v;
  };
  const maxLength = (): number => local.maxLength;
  const strategy = (): string => local.pushPasswordManagerStrategy ?? "increase-width";
  const regexp = computed(() => {
    const pattern = local.pattern as string | RegExp | undefined;
    return pattern ? (typeof pattern === "string" ? new RegExp(pattern) : pattern) : null;
  });

  /** Elements (upstream `inputRef` / `containerRef`). */
  const inputRef = ref<HTMLInputElement>();
  const containerRef = ref<HTMLDivElement>();
  /** Previous selection (upstream `inputMetadataRef.current.prev`). */
  const prevSelection = signal<Selection>([null, null, null]);

  /** Mirrors for UI rendering purpose only */
  const isHoveringInput = signal(false);
  const isFocused = signal(false);
  const mirrorSelectionStart = signal<number | null>(null);
  const mirrorSelectionEnd = signal<number | null>(null);

  /** Password-manager badge */
  const badge: BadgeState = { hasPWMBadge: signal(false), hasPWMBadgeSpace: signal(false), done: signal(false) };
  const willPushPWMBadge = (): boolean => {
    const s = strategy();
    if (s === "none") return false;
    return (s === "increase-width" || s === "experimental-no-flickering") && badge.hasPWMBadge() && badge.hasPWMBadgeSpace();
  };

  // Mount (upstream mount-only effect): value sync, selection mirror, styles, root height.
  clientEffect(() => {
    const input = inputRef();
    const container = containerRef();
    if (!input || !container) return;
    return untrack(() => {
      // Sync input value (e.g. restored by the browser)
      if (value() !== input.value) {
        local.onChange?.(input.value);
        const v = local.value;
        if (isSignal(v)) v.set(input.value);
        internalValue.set(input.value);
      }

      // Previous selection
      prevSelection.set([input.selectionStart, input.selectionEnd, input.selectionDirection]);
      const onDocumentSelectionChange = () => {
        if (document.activeElement !== input) {
          mirrorSelectionStart.set(null);
          mirrorSelectionEnd.set(null);
          return;
        }
        const next = mirrorSelection(input, untrack(prevSelection));
        // Finally, update the state
        mirrorSelectionStart.set(next[0]);
        mirrorSelectionEnd.set(next[1]);
        // Store the previous selection value
        prevSelection.set(next);
      };
      document.addEventListener("selectionchange", onDocumentSelectionChange, { capture: true });

      // Set initial mirror state
      onDocumentSelectionChange();
      if (document.activeElement === input) isFocused.set(true);

      // Apply needed styles (the style tag is created once per document: only the first nonce is used)
      injectStyles(untrack(() => local.nonce));

      // Track root height
      const updateRootHeight = () => container.style.setProperty("--root-height", `${input.clientHeight}px`);
      updateRootHeight();
      // ResizeObserver is missing in older browsers (e.g. iOS Safari <13.4); without it the root height is measured once.
      const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateRootHeight);
      resizeObserver?.observe(input);

      return () => {
        document.removeEventListener("selectionchange", onDocumentSelectionChange, { capture: true });
        resizeObserver?.disconnect();
      };
    });
  });

  // `ref` → the input
  clientEffect(() => {
    const input = inputRef();
    if (input) untrack(() => bindRef(input, local.ref as ((element: Element) => void) | undefined));
  });

  // Value / focus change: drop `:autofill` and re-read the selection (upstream effect `[value, isFocused]`).
  clientEffect(() => {
    value();
    isFocused();
    const timeouts = syncTimeouts(() => {
      const input = untrack(inputRef);
      // Forcefully remove :autofill state
      input?.dispatchEvent(new Event("input"));

      // Update the selection state
      const s = input?.selectionStart;
      const e = input?.selectionEnd;
      const dir = input?.selectionDirection;
      if (s !== null && e !== null) {
        mirrorSelectionStart.set(s ?? null);
        mirrorSelectionEnd.set(e ?? null);
        prevSelection.set([s ?? null, e ?? null, dir ?? null]);
      }
    });
    return () => timeouts.forEach((timeout) => clearTimeout(timeout));
  });

  // `onComplete` (upstream effect over the previous render's value)
  const completedFrom = signal<string | undefined>(undefined);
  clientEffect(() => {
    const v = value();
    untrack(() => {
      const previousValue = completedFrom();
      completedFrom.set(v);
      if (previousValue === undefined) return;
      if (v !== previousValue && previousValue.length < maxLength() && v.length === maxLength()) local.onComplete?.(v);
    });
  });

  // Password-manager badge: space check every second (upstream `checkHasSpace` interval).
  clientEffect(() => {
    const container = containerRef();
    if (!container || strategy() === "none") return;
    const checkHasSpace = () => badge.hasPWMBadgeSpace.set(availableBadgeSpace(container) >= PWM_BADGE_SPACE_WIDTH_PX);
    checkHasSpace();
    const interval = setInterval(checkHasSpace, 1000);
    return () => clearInterval(interval);
  });

  // Password-manager badge: probe after focus.
  clientEffect(() => {
    const input = inputRef();
    const focused = isFocused() || (input !== undefined && document.activeElement === input);
    const s = strategy();
    badge.done();
    if (s === "none" || !focused) return;
    const track = () => trackPWMBadge(badge, untrack(containerRef), untrack(inputRef), s);
    const t1 = setTimeout(track, 0);
    const t2 = setTimeout(track, 2000);
    const t3 = setTimeout(track, 5000);
    const t4 = setTimeout(() => badge.done.set(true), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  });

  /** Upstream `onChange` callback: notify, then store. */
  const onChange = (newValue: string) => {
    local.onChange?.(newValue);
    const v = local.value;
    if (isSignal(v)) v.set(newValue);
    internalValue.set(newValue);
  };

  /** Render props (upstream `contextValue`). */
  const slots = computed<SlotProps[]>(() => {
    const v = value();
    const focused = isFocused();
    const mss = mirrorSelectionStart();
    const mse = mirrorSelectionEnd();
    const placeholder = local.placeholder;
    return Array.from({ length: maxLength() }).map((_, slotIdx) => {
      const isActive = focused && mss !== null && mse !== null && ((mss === mse && slotIdx === mss) || (slotIdx >= mss && slotIdx < mse));

      const char = v[slotIdx] !== undefined ? v[slotIdx]! : null;
      const placeholderChar = v[0] !== undefined ? null : (placeholder?.[slotIdx] ?? null);

      return { char, placeholderChar, isActive, hasFakeCaret: isActive && char === null };
    });
  });
  const contextValue: RenderProps = {
    get slots() {
      return slots();
    },
    get isFocused() {
      return isFocused();
    },
    get isHovering() {
      return !local.disabled && isHoveringInput();
    },
  };

  const children = () => (local.render ? local.render(contextValue) : local.children);
  const renderedChildren = () => (
    <Provider token={OTPInputContext} value={contextValue}>
      {children()}
    </Provider>
  );

  return (
    <>
      <div
        ref={containerRef}
        data-input-otp-container
        // Chrome's translation feature rewrites the slots' text nodes, and a one-time code is never meaningful to translate.
        translate="no"
        style={{
          position: "relative",
          cursor: local.disabled ? "default" : "text",
          "user-select": "none",
          "-webkit-user-select": "none",
          "pointer-events": "none",
        }}
        class={local.containerClass}
      >
        {renderedChildren()}
        <div style={{ position: "absolute", inset: "0", "pointer-events": "none" }}>
          <input
            autoComplete={local.autoComplete || "one-time-code"}
            {...inputRest}
            disabled={local.disabled}
            data-input-otp
            data-input-otp-placeholder-shown={value().length === 0 || undefined}
            data-input-otp-mss={mirrorSelectionStart() ?? undefined}
            data-input-otp-mse={mirrorSelectionEnd() ?? undefined}
            inputMode={local.inputMode ?? "numeric"}
            pattern={regexp()?.source}
            aria-placeholder={local.placeholder}
            style={{
              position: "absolute",
              inset: "0",
              width: willPushPWMBadge() ? `calc(100% + ${PWM_BADGE_SPACE_WIDTH})` : "100%",
              "clip-path": willPushPWMBadge() ? `inset(0 ${PWM_BADGE_SPACE_WIDTH} 0 0)` : undefined,
              height: "100%",
              display: "flex",
              "text-align": local.textAlign ?? "left",
              opacity: "1", // Mandatory for iOS hold-paste
              color: "transparent",
              "pointer-events": "all",
              background: "transparent",
              "caret-color": "transparent",
              border: "0 solid transparent",
              outline: "0 solid transparent",
              "box-shadow": "none",
              "line-height": "1",
              "letter-spacing": "-.5em",
              "font-size": "var(--root-height, 16px)",
              "font-family": "monospace",
              "font-variant-numeric": "tabular-nums",
            }}
            maxLength={maxLength()}
            value={value()}
            ref={inputRef}
            spellCheck={local.spellCheck ?? false}
            onPaste={(e: ClipboardEvent) => {
              // Fix iOS pasting (and `pasteTransformer` everywhere)
              const input = e.currentTarget as HTMLInputElement;
              const isIOS = typeof window !== "undefined" && window?.CSS?.supports?.("-webkit-touch-callout", "none");
              if (local.pasteTransformer || (isIOS && e.clipboardData)) {
                const _content = e.clipboardData?.getData("text/plain") ?? "";
                const content = local.pasteTransformer ? local.pasteTransformer(_content) : _content;
                e.preventDefault();

                const current = untrack(value);
                const start = input.selectionStart ?? 0;
                const end = input.selectionEnd ?? start;
                const isReplacing = start !== end;
                const newValueUncapped = isReplacing
                  ? current.slice(0, start) + content + current.slice(end) // Replacing
                  : current.slice(0, start) + content + current.slice(start); // Inserting
                const newValue = newValueUncapped.slice(0, maxLength());

                const re = untrack(regexp);
                if (!(newValue.length > 0 && re && !re.test(newValue))) {
                  input.value = newValue;
                  onChange(newValue);

                  const _start = Math.min(newValue.length, maxLength() - 1);
                  const _end = newValue.length;
                  input.setSelectionRange(_start, _end);
                  mirrorSelectionStart.set(_start);
                  mirrorSelectionEnd.set(_end);
                }
              }
              local.onPaste?.(e as never);
            }}
            onInput={(e: InputEvent) => {
              const input = e.currentTarget as HTMLInputElement;
              const previousValue = untrack(value);
              // React's value tracker: no change, no `onChange` (the sync timeouts re-dispatch `input`).
              if (input.value !== previousValue) {
                const newValue = input.value.slice(0, maxLength());
                const re = untrack(regexp);
                if (newValue.length > 0 && re && !re.test(newValue)) {
                  e.preventDefault();
                } else {
                  // Cutting / deleting text fires no `selectionchange`: dispatch it.
                  if (newValue.length < previousValue.length) document.dispatchEvent(new Event("selectionchange"));
                  onChange(newValue);
                }
                // Controlled input: the DOM shows the value (rejected change or an owner keeping the old value).
                const shown = untrack(value);
                if (input.value !== shown) input.value = shown;
              }
              local.onInput?.(e as never);
            }}
            onMouseOver={(e: MouseEvent) => {
              isHoveringInput.set(true);
              local.onMouseOver?.(e as never);
            }}
            onMouseLeave={(e: MouseEvent) => {
              isHoveringInput.set(false);
              local.onMouseLeave?.(e as never);
            }}
            onFocus={(e: FocusEvent) => {
              const input = e.currentTarget as HTMLInputElement;
              const start = Math.min(input.value.length, maxLength() - 1);
              const end = input.value.length;
              input.setSelectionRange(start, end);
              mirrorSelectionStart.set(start);
              mirrorSelectionEnd.set(end);
              isFocused.set(true);
              local.onFocus?.(e as never);
            }}
            onBlur={(e: FocusEvent) => {
              isFocused.set(false);
              local.onBlur?.(e as never);
            }}
          />
        </div>
      </div>
    </>
  );
};
