// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no message composer). Token input for `PromptInput`, feature set
// inspired by the "Token Input" section of HeroUI Pro's public PromptInput docs (`usePromptInputTokens` with `triggers`
// (`@`, `/`) / `allowsSpaces` / `value` / `defaultValue` / `onChange`, returning `value` / `setValue` / `inputRef` /
// `anchor` / `query` / `trigger` / `isOpen` / `insertToken(text, { appendSpace, value })` / `close()`; parts `TokenInput`,
// `Tokens`, `TokenSuggestions` (`placement` "bottom start" default, hides without items), `Token` (`data-selected` /
// `data-disabled`); Enter selects the highlighted suggestion, arrows move it while the caret stays in the field, Escape
// dismisses it for the current trigger); independent implementation, Rivet-authored styles.
// - No contenteditable (Pro builds on the RAC alpha TokenField): the field is the native `<textarea>`; the value is a
//   segment list whose flattened text IS the textarea text (`@rivetjs/cdk/chat` token model). Tokens are atomic ranges:
//   Backspace / Delete next to one removes it whole, arrows step over it, the caret never rests inside one, an edit that
//   touches one (cut, word delete, typing over a selection) removes it. A mirror layer behind the textarea (same box, font,
//   wrapping) draws the text with the token pills; the textarea's own text is transparent (caret, selection, IME stay
//   native).
// - Suggestions = an APG list autocomplete: the textarea keeps DOM focus (`aria-autocomplete="list"`, `aria-controls`,
//   `aria-activedescendant`), `TokenSuggestions` is a `role="listbox"` positioned at the caret (absolute inside the
//   shell / root, measured from the mirror) and `TokenSuggestion` a `role="option"` (Rivet part: Pro composes a Menu).
//   Rivet ruling: not cdk Autocomplete + ListBox / Menu (their virtual-focus wiring has an open resumed-typing bug, see
//   `libs/cdk/autocomplete/CLAUDE.md`) and not the overlay layer (the panel belongs to the field and scrolls with it).
// - `PromptInput` integration: `TokenInput` hands the root its flattened text (Send enablement, `onSubmit(text)`) and a
//   reset (an uncontrolled composer clears the tokens after submit). Leave `value` unset on `PromptInput`.
// - Resumable: state is signals of plain data (segments, selection offsets); handlers run on first input.
import { applyPromptTextEdit, deletePromptToken, findPromptTrigger, insertPromptToken, isSubmitKey, normalizePromptTokens } from "@rivetjs/cdk/chat";
import { promptTokenRanges, promptTokenStep, promptTokenText, snapPromptCaret } from "@rivetjs/cdk/chat";
import type { PromptSegment, PromptTokenEdit, PromptTokenMatch, PromptTokenValue } from "@rivetjs/cdk/chat";
import { resumedId } from "@rivetjs/cdk/id";
import { controllable, setControlledValue } from "@rivetjs/cdk/interactions";
import { createContext, signal, useContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { promptInputVariants } from "../../../styles/src/components/prompt-input/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { PromptInputContext, promptInputIsRunning, promptInputSyncCompactExpanded } from "../prompt-input/prompt-input.tsx";
import type { PromptInputContextValue } from "../prompt-input/prompt-input.tsx";

const SLOTS = promptInputVariants();

/* -------------------------------------------------------------------------------------------------
 * State
 * -----------------------------------------------------------------------------------------------*/
interface PromptInputTokensOptions {
  /** Strings that open the suggestions at a word boundary. @default ["@", "/"] */
  triggers?: readonly string[];
  /** The query may contain spaces (it ends at the first space otherwise). @default false */
  allowsSpaces?: boolean;
  /** Initial segments when uncontrolled. @default [] */
  defaultValue?: PromptTokenValue;
  /** Controlled segments (value, Signal = two-way, or accessor). */
  value?: PromptTokenValue | Signal<PromptTokenValue> | (() => PromptTokenValue);
  /** Every change (typing, token insert / removal, `setValue`). */
  onChange?: (value: PromptSegment[]) => void;
}

/** Caret box relative to the suggestions' positioning container (px). */
interface PromptTokenAnchor {
  x: number;
  top: number;
  bottom: number;
}

interface PromptInputTokens {
  /** Current segments. */
  value: () => PromptTokenValue;
  setValue: (value: PromptTokenValue) => void;
  /** Flattened text (what Send submits). */
  text: () => string;
  /** The token field's textarea (null until it handled an event). */
  inputRef: () => HTMLTextAreaElement | null;
  /** Caret box for the suggestions (null while closed / unmeasured). */
  anchor: () => PromptTokenAnchor | null;
  /** Text typed after the active trigger ("" when none). */
  query: () => string;
  /** The active trigger, or null. */
  trigger: () => string | null;
  /** Suggestions should show: a trigger is active, the field has focus, not dismissed / closed. */
  isOpen: () => boolean;
  /** Replace the active trigger + query with a token (`text` shown, `value` carried) and a trailing space. */
  insertToken: (text: string, options?: { appendSpace?: boolean; value?: string }) => void;
  /** Hide the suggestions until the next edit or caret move. */
  close: () => void;
  /** @internal listbox id. */
  listId: string;
  /** @internal highlighted option id. */
  activeId: Signal<string | null>;
  /** @internal selection `[start, end]` (flat offsets). */
  selection: () => readonly [number, number];
  /** @internal field handlers. */
  field: PromptTokenFieldHandlers;
}

interface PromptTokenFieldHandlers {
  focus: (el: HTMLTextAreaElement) => void;
  blur: () => void;
  input: (el: HTMLTextAreaElement) => void;
  /** True when the key was handled (the caller stops there). */
  keyDown: (el: HTMLTextAreaElement, event: KeyboardEvent) => boolean;
  caret: (el: HTMLTextAreaElement) => void;
  scroll: (el: HTMLTextAreaElement) => void;
  activate: (id: string) => void;
}

const MIRROR = "[data-slot=prompt-input-token-mirror]";

/** Box of the character at flat offset `pos` in the mirror (text node ranges; the mirror wraps exactly like the textarea). */
const charRect = (mirror: Element, pos: number): DOMRect | null => {
  const doc = mirror.ownerDocument;
  let offset = 0;
  const parts = mirror.querySelectorAll("[data-segment]");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const node = part.firstChild;
    const length = part.textContent?.length ?? 0;
    if (pos < offset + length && node) {
      try {
        const range = doc.createRange();
        range.setStart(node, pos - offset);
        range.setEnd(node, pos - offset + 1);
        const rects = range.getClientRects();
        return rects.length ? rects[0]! : range.getBoundingClientRect();
      } catch {
        return null;
      }
    }
    offset += length;
  }
  const end = mirror.querySelector("[data-slot=prompt-input-token-end]");
  return end ? end.getBoundingClientRect() : null;
};

/**
 * Token state for `PromptInputTokenInput` / `Tokens` / `TokenSuggestions` (Pro `usePromptInputTokens`). Call it in the
 * component body; pass the result as `tokens`.
 */
function usePromptInputTokens(options: PromptInputTokensOptions = {}): PromptInputTokens {
  const triggers = options.triggers ?? ["@", "/"];
  const allowsSpaces = options.allowsSpaces === true;
  const state = controllable<PromptTokenValue, PromptSegment[]>(options.value, options.defaultValue ?? [], options.onChange);
  const initialLength = promptTokenText(state.value()).length;
  const selection = signal<readonly [number, number]>([initialLength, initialLength], { equals: (a, b) => a[0] === b[0] && a[1] === b[1] });
  const focused = signal(false);
  const dismissed = signal(-1);
  const closed = signal(false);
  const activeId = signal<string | null>(null);
  const anchor = signal<PromptTokenAnchor | null>(null, { equals: false });
  // Keyed: the resume record keeps the server id (the field, the listbox and its options adopt at different times).
  const listId = resumedId();
  let input: HTMLTextAreaElement | null = null;
  // The trigger + query the highlight was last reset for (a new query highlights the first option again).
  let highlighted: string | null = null;

  const match = (): PromptTokenMatch | null => {
    const [start, end] = selection();
    if (start !== end) return null;
    return findPromptTrigger(state.value(), end, triggers, allowsSpaces);
  };
  const isOpen = (): boolean => {
    const active = match();
    return !!active && focused() && !closed() && dismissed() !== active.start;
  };
  const listbox = (): HTMLElement | null => input?.ownerDocument.getElementById(listId) ?? null;
  const options_ = (): HTMLElement[] => {
    const list = listbox();
    return list ? Array.from(list.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])')) : [];
  };
  // After the DOM followed a change: highlight the first option for a new query (else keep a rendered one), measure.
  const settle = (): void => {
    queueMicrotask(() => {
      const active = match();
      const key = active ? `${active.start}:${active.query}` : null;
      const items = options_();
      const current = activeId();
      if (key !== highlighted || !items.some((item) => item.id === current)) activeId.set(items[0]?.id ?? null);
      highlighted = key;
      measure();
    });
  };
  const measure = (): void => {
    const el = input;
    const list = listbox();
    const active = match();
    if (!el || !list || !active) return;
    const mirror = el.parentElement?.querySelector(MIRROR);
    const container = list.parentElement?.closest("[data-slot=prompt-input-shell],[data-slot=prompt-input]") ?? list.parentElement;
    // Anchored at the trigger (the panel stays put while the query is typed).
    const rect = mirror ? charRect(mirror, active.start) : null;
    if (!rect || !container) return;
    const box = container.getBoundingClientRect();
    anchor.set({ x: Math.round(rect.left - box.left), top: Math.round(rect.top - box.top), bottom: Math.round(rect.bottom - box.top) });
  };
  // A cold page may replay the first input without its focus event (the resume loader holds input, not focus).
  const syncFocus = (el: HTMLTextAreaElement): void => {
    if (el.ownerDocument.activeElement === el) focused.set(true);
  };
  const readSelection = (el: HTMLTextAreaElement, direction: "nearest" | "backward" | "forward" = "nearest"): void => {
    input = el;
    syncFocus(el);
    // An edit is pending (its `input` event follows): selection offsets would not match the segments yet.
    if (el.value !== promptTokenText(state.value())) return;
    let start = el.selectionStart ?? 0;
    let end = el.selectionEnd ?? start;
    if (start === end) {
      const snapped = snapPromptCaret(state.value(), end, direction);
      if (snapped !== end) {
        el.setSelectionRange(snapped, snapped);
        start = end = snapped;
      }
    }
    const previous = selection();
    if (previous[0] !== start || previous[1] !== end) closed.set(false);
    selection.set([start, end]);
    const active = match();
    if (!active || active.start !== dismissed()) dismissed.set(-1);
    settle();
  };
  const apply = (edit: PromptTokenEdit, el: HTMLTextAreaElement | null): void => {
    const text = promptTokenText(edit.value);
    if (el) {
      input = el;
      syncFocus(el);
      if (el.value !== text) el.value = text;
      el.setSelectionRange(edit.caret, edit.caret);
    }
    closed.set(false);
    setControlledValue(state, edit.value);
    selection.set([edit.caret, edit.caret]);
    const active = match();
    if (!active || active.start !== dismissed()) dismissed.set(-1);
    settle();
  };
  const move = (step: 1 | -1): void => {
    const items = options_();
    if (!items.length) return;
    const index = items.findIndex((item) => item.id === activeId());
    const next = items[index < 0 ? (step > 0 ? 0 : items.length - 1) : (index + step + items.length) % items.length]!;
    activeId.set(next.id);
    next.scrollIntoView?.({ block: "nearest" });
  };

  return {
    value: () => state.value(),
    setValue: (value) => {
      const next = normalizePromptTokens(value);
      const caret = promptTokenText(next).length;
      setControlledValue(state, next);
      selection.set([caret, caret]);
      if (input && input.value !== promptTokenText(next)) input.value = promptTokenText(next);
    },
    text: () => promptTokenText(state.value()),
    inputRef: () => input,
    anchor: () => (isOpen() ? anchor() : null),
    query: () => match()?.query ?? "",
    trigger: () => match()?.trigger ?? null,
    isOpen,
    insertToken: (text, insert = {}) => {
      const active = match();
      if (!active) return;
      apply(insertPromptToken(state.value(), active, selection()[1], { text, value: insert.value }, insert.appendSpace !== false), input);
      input?.focus();
    },
    close: () => closed.set(true),
    listId,
    activeId,
    selection: () => selection(),
    field: {
      focus: (el) => {
        focused.set(true);
        readSelection(el);
      },
      blur: () => focused.set(false),
      input: (el) => apply(applyPromptTextEdit(state.value(), el.value, el.selectionEnd ?? el.value.length), el),
      keyDown: (el, event) => {
        input = el;
        syncFocus(el);
        const open = isOpen();
        const key = event.key;
        if (open && (key === "ArrowDown" || key === "ArrowUp") && !event.altKey) {
          event.preventDefault();
          move(key === "ArrowDown" ? 1 : -1);
          return true;
        }
        if (open && key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
          // The highlight settles in a microtask: a key replayed right after its input (cold page) sees the first option.
          const items = options_();
          const option = items.find((item) => item.id === activeId()) ?? items[0];
          if (option) {
            event.preventDefault();
            option.click();
            return true;
          }
        }
        if (open && key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          dismissed.set(match()!.start);
          return true;
        }
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? start;
        const plain = !event.altKey && !event.ctrlKey && !event.metaKey;
        if (start === end && plain && (key === "Backspace" || key === "Delete")) {
          const edit = deletePromptToken(state.value(), end, key === "Backspace" ? "backward" : "forward");
          if (edit) {
            event.preventDefault();
            apply(edit, el);
            return true;
          }
        }
        if (start === end && plain && !event.shiftKey && (key === "ArrowLeft" || key === "ArrowRight")) {
          const rtl = getComputedStyle(el).direction === "rtl";
          const backward = (key === "ArrowLeft") !== rtl;
          const target = promptTokenStep(state.value(), end, backward ? "backward" : "forward");
          if (target !== null) {
            event.preventDefault();
            el.setSelectionRange(target, target);
            readSelection(el);
            return true;
          }
        }
        return false;
      },
      caret: (el) => readSelection(el),
      scroll: (el) => {
        const mirror = el.parentElement?.querySelector(MIRROR);
        if (mirror) {
          mirror.scrollTop = el.scrollTop;
          mirror.scrollLeft = el.scrollLeft;
        }
        measure();
      },
      activate: (id) => activeId.set(id),
    },
  };
}

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/
const PromptInputTokensContext = createContext<PromptInputTokens | null>(null);

/** The token field owns the composer's prompt: flattened text for Send / submit, cleared after an uncontrolled submit. */
const ownComposer = (context: PromptInputContextValue, tokens: PromptInputTokens): void => {
  context.text = tokens.text;
  context.reset = () => tokens.setValue([]);
};

const useTokens = (tokens: PromptInputTokens | undefined, part: string): PromptInputTokens => {
  const value = tokens ?? useContext(PromptInputTokensContext);
  if (!value) throw new Error(`PromptInput${part} needs \`tokens\` (from usePromptInputTokens) or a PromptInputTokens parent.`);
  return value;
};

interface PromptInputTokensProps {
  /** Token state (`usePromptInputTokens`). */
  tokens: PromptInputTokens;
  children?: Content;
}

/** Connects the token field and its suggestions (no DOM). Keep the toolbar and other menus outside it. */
const PromptInputTokensRoot = (props: PromptInputTokensProps): JSX.Element => {
  const tokens = props.tokens;
  // Registered here too (not only in TokenInput): siblings such as Send may render before the provider's children.
  ownComposer(useContext(PromptInputContext), tokens);
  return (
    <Provider token={PromptInputTokensContext} value={tokens}>
      {props.children}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Token (mirror pill)
 * -----------------------------------------------------------------------------------------------*/
interface PromptInputTokenProps {
  /** The segment (accessor, as `TokenInput`'s render function receives it). */
  segment: () => PromptSegment;
  /** Segment index (accessor). */
  index: () => number;
  class?: string;
}

/** One segment of the field's mirror: plain text, or a token pill (`data-token`, `data-selected`, `data-disabled`). */
const PromptInputToken = (props: PromptInputTokenProps): JSX.Element => {
  const tokens = useContext(PromptInputTokensContext);
  const composer = useContext(PromptInputContext);
  const segment = props.segment;
  const index = props.index;
  const isToken = (): boolean => segment().type === "token";
  const selected = (): string | undefined => {
    if (!tokens || !isToken()) return undefined;
    const [start, end] = tokens.selection();
    if (start === end) return undefined;
    const range = promptTokenRanges(tokens.value()).find((item) => item.index === index());
    return range && start < range.end && end > range.start ? "true" : undefined;
  };
  return (
    <span
      class={isToken() ? composeSlotClassName(SLOTS.token, props.class) : undefined}
      data-segment=""
      data-token={isToken() ? (segment() as { trigger?: string }).trigger || "" : undefined}
      data-value={isToken() ? (segment() as { value?: string }).value : undefined}
      data-selected={selected()}
      data-disabled={isToken() && composer.disabled?.() ? "true" : undefined}
    >
      {segment().text}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * TokenInput
 * -----------------------------------------------------------------------------------------------*/
interface PromptInputTokenInputProps extends Omit<JSX.IntrinsicElements["textarea"], "class" | "children" | "value" | "defaultValue"> {
  /** Token state; optional inside `PromptInputTokens`. */
  tokens?: PromptInputTokens;
  /** Render each mirror segment (default `PromptInputToken`); return a `PromptInputToken` (it measures the caret). */
  children?: (segment: () => PromptSegment, index: () => number) => JSX.Element;
  /** @default "What do you want to know?" */
  placeholder?: string;
  /** @default the placeholder */
  "aria-label"?: string;
  /** Shift+Enter inserts a newline (otherwise it submits too). @default true */
  allowsNewlines?: boolean;
  /** @default false */
  isReadOnly?: boolean;
  /** @default the composer's disabled / run-lock state */
  isDisabled?: boolean;
  class?: string;
}

const PromptInputTokenInput = (props: PromptInputTokenInputProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "tokens", "children", "placeholder", "aria-label", "allowsNewlines", "isReadOnly", "isDisabled"]);
  const tokens = useTokens(local.tokens, "TokenInput");
  const context = useContext(PromptInputContext);
  ownComposer(context, tokens);
  const field = tokens.field;
  const allowsNewlines = local.allowsNewlines !== false;
  const compact = context.layout === "compact";
  const placeholder = local.placeholder ?? "What do you want to know?";
  const render = local.children;
  const locked = (): boolean =>
    local.isDisabled === true || !!context.disabled?.() || (context.lockInputOnRun !== false && promptInputIsRunning(context.status?.() ?? "ready"));
  return (
    <Provider token={PromptInputTokensContext} value={tokens}>
      <div class={SLOTS.tokenField()} data-slot="prompt-input-token-field">
        <div class={SLOTS.tokenMirror()} aria-hidden="true" data-slot="prompt-input-token-mirror">
          <For each={() => tokens.value()} by={(_: PromptSegment, index: number) => index}>
            {(segment: () => PromptSegment, index: () => number) => (render ? render(segment, index) : <PromptInputToken segment={segment} index={index} />)}
          </For>
          <span data-slot="prompt-input-token-end">{"​"}</span>
        </div>
        <textarea
          class={composeSlotClassName(SLOTS.tokenInput, local.class)}
          rows={1}
          placeholder={placeholder}
          aria-label={local["aria-label"] ?? placeholder}
          aria-autocomplete="list"
          aria-controls={tokens.listId}
          aria-activedescendant={tokens.isOpen() ? (tokens.activeId() ?? undefined) : undefined}
          disabled={locked()}
          readOnly={local.isReadOnly === true}
          value={tokens.text()}
          spellCheck={false}
          data-slot="prompt-input-token-input"
          onFocus={(event: FocusEvent) => field.focus(event.currentTarget as HTMLTextAreaElement)}
          onBlur={() => field.blur()}
          onInput={(event: Event) => {
            const textarea = event.currentTarget as HTMLTextAreaElement;
            field.input(textarea);
            if (compact) promptInputSyncCompactExpanded(textarea);
          }}
          onKeyDown={(event: KeyboardEvent) => {
            const textarea = event.currentTarget as HTMLTextAreaElement;
            if (field.keyDown(textarea, event)) return;
            if (!isSubmitKey(event, allowsNewlines)) return;
            event.preventDefault();
            context.submit?.();
          }}
          onKeyUp={(event: KeyboardEvent) => field.caret(event.currentTarget as HTMLTextAreaElement)}
          onPointerUp={(event: PointerEvent) => field.caret(event.currentTarget as HTMLTextAreaElement)}
          onSelect={(event: Event) => field.caret(event.currentTarget as HTMLTextAreaElement)}
          onScroll={(event: Event) => field.scroll(event.currentTarget as HTMLTextAreaElement)}
          {...rest}
        />
      </div>
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * TokenSuggestions / TokenSuggestion
 * -----------------------------------------------------------------------------------------------*/
type PromptTokenPlacement = "bottom start" | "bottom end" | "top start" | "top end";

interface PromptInputTokenSuggestionsProps extends Omit<JSX.IntrinsicElements["div"], "class" | "children" | "role"> {
  /** Token state; optional inside `PromptInputTokens`. */
  tokens?: PromptInputTokens;
  /** @default tokens.isOpen */
  isOpen?: boolean | (() => boolean);
  /** Side of the caret. Use "top start" for a composer docked at the bottom of the viewport. @default "bottom start" */
  placement?: PromptTokenPlacement;
  /** @default "Suggestions" */
  "aria-label"?: string;
  class?: string;
  children?: Content;
}

const PromptInputTokenSuggestions = (props: PromptInputTokenSuggestionsProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "tokens", "isOpen", "placement", "aria-label"]);
  const tokens = useTokens(local.tokens, "TokenSuggestions");
  const placement = local.placement ?? "bottom start";
  const open = (): boolean => {
    const value = local.isOpen;
    return value === undefined ? tokens.isOpen() : typeof value === "function" ? value() : value;
  };
  const px = (key: "x" | "top" | "bottom"): string | undefined => {
    const anchor = tokens.anchor();
    return anchor ? `${anchor[key]}px` : undefined;
  };
  return (
    <Provider token={PromptInputTokensContext} value={tokens}>
      <div
        class={composeSlotClassName(SLOTS.tokenSuggestions, local.class)}
        id={tokens.listId}
        role="listbox"
        aria-label={local["aria-label"] ?? "Suggestions"}
        hidden={!open()}
        data-open={open() ? "true" : undefined}
        data-placement={placement}
        style={{ "--prompt-input-token-x": px("x"), "--prompt-input-token-top": px("top"), "--prompt-input-token-bottom": px("bottom") }}
        data-slot="prompt-input-token-suggestions"
        onPointerDown={(event: PointerEvent) => event.preventDefault()}
        onMouseDown={(event: MouseEvent) => event.preventDefault()}
        {...rest}
      >
        {local.children}
      </div>
    </Provider>
  );
};

interface PromptInputTokenSuggestionProps extends Omit<JSX.IntrinsicElements["div"], "class" | "children" | "role" | "id"> {
  /** Stable key (also the inserted token's `value` by default). */
  id?: string;
  /** Text of the option for its key when `id` is missing. */
  textValue?: string;
  /** Token text inserted when picked without `onAction` (e.g. "@ana"). */
  token?: string;
  /** Picked (click / Enter). Default: `tokens.insertToken(token, { value: id })`. */
  onAction?: () => void;
  isDisabled?: boolean;
  class?: string;
  children?: Content;
}

const optionKey = (value: string): string => value.replace(/[^A-Za-z0-9_-]+/g, "-");

const PromptInputTokenSuggestion = (props: PromptInputTokenSuggestionProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "id", "textValue", "token", "onAction", "isDisabled"]);
  const tokens = useTokens(undefined, "TokenSuggestion");
  const key = local.id ?? local.textValue ?? local.token ?? resumedId();
  const id = `${tokens.listId}-${optionKey(key)}`;
  const disabled = local.isDisabled === true;
  const onAction = local.onAction;
  const token = local.token;
  const value = local.id;
  const active = (): boolean => tokens.activeId() === id;
  return (
    <div
      class={composeSlotClassName(SLOTS.tokenSuggestion, local.class)}
      id={id}
      role="option"
      aria-selected={active() ? "true" : "false"}
      aria-disabled={disabled ? "true" : undefined}
      data-focused={active() ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      data-slot="prompt-input-token-suggestion"
      onPointerMove={() => {
        if (!disabled && !active()) tokens.field.activate(id);
      }}
      onClick={() => {
        if (disabled) return;
        if (onAction) onAction();
        else if (token) tokens.insertToken(token, { value });
      }}
      {...rest}
    >
      {local.children ?? local.textValue ?? token}
    </div>
  );
};

export {
  usePromptInputTokens,
  PromptInputTokensRoot as PromptInputTokens,
  PromptInputTokenInput,
  PromptInputTokenSuggestions,
  PromptInputTokenSuggestion,
  PromptInputToken,
  PromptInputTokensContext,
};
export type {
  PromptInputTokensOptions,
  PromptInputTokens as PromptInputTokensState,
  PromptInputTokensProps,
  PromptInputTokenInputProps,
  PromptInputTokenSuggestionsProps,
  PromptInputTokenSuggestionProps,
  PromptInputTokenProps,
  PromptTokenAnchor,
  PromptTokenPlacement,
};
