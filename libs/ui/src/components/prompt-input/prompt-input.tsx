// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no message composer). Feature set inspired by HeroUI Pro's public
// PromptInput docs (composer: `value` / `onValueChange`, `onSubmit`, `onStop`, `status` ready / submitted / streaming /
// error, `isDisabled`, `lockInputOnRun` (true), `maxHeight` (240, `--prompt-input-max-height`), `size` sm / md / lg,
// `variant` primary / secondary, `layout` stacked / compact / inline; parts `Shell` / `Content` / `Attachments` /
// `TextArea` (`disableAutosize`) / `Toolbar` / `ToolbarStart` / `ToolbarEnd` / `Action` (`tooltip`) / `Send` / `Footer` /
// `Queue` (`actionsVisibility`) with `List` / `Item` (`Handle` / `Body` / `Icon` / `Content` / `Description` /
// `Attachments` / `AttachmentsOverflow` / `Actions` / `Remove` / `More` / `Action`); Enter submits, Shift+Enter newline;
// drag-over dotted accent border); independent implementation, Rivet-authored styles.
// - State: `controllable(value, defaultValue ?? "", onValueChange)` (a live `value` passes as an accessor) in the
//   `rv-ui-prompt-input` context with the run status accessor and the submit / stop handlers (component-body arrows:
//   resumable). Nothing runs before the first keystroke / press.
// - `onSubmit(value)` (Rivet: the text is passed); an uncontrolled composer clears itself after submitting. `Send` (and
//   Enter) submit only a non-blank value while `status` is ready / error; while submitted / streaming `Send` calls `onStop`.
// - `TextArea` = native `<textarea>` sized by CSS `field-sizing: content` up to `--prompt-input-max-height` (fallback
//   `@rivetjs/cdk/chat` `autosizeTextArea` on input). Compact layout: one row until the text wraps / has a newline /
//   attachments show (`data-expanded`, written on input).
// - Token input (TokenInput / Tokens / TokenSuggestions / Token / usePromptInputTokens): subpath `prompt-input-tokens/`, on a
//   native textarea instead of Pro's contenteditable RAC TokenField; it hands this root its text + reset via the context.
// - Gap (see libs/ui/CLAUDE.md Known diffs): Queue.List drag reordering (`onReorder` / `axis`) is not ported.
import { autosizeTextArea, isSubmitKey } from "@rivetjs/cdk/chat";
import { controllable, setControlledValue } from "@rivetjs/cdk/interactions";
import type { ControlledState } from "@rivetjs/cdk/interactions";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { ArrowUp, CircleAlert, CornerDownRight, Ellipsis, GripVertical, LoaderCircle, Square, X } from "lucide";

import { promptInputVariants } from "../../../styles/src/components/prompt-input/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { accessorIfLive, splitLive } from "../../utils/live.tsx";
import { ButtonRoot } from "../button/button.tsx";
import type { ButtonRootProps } from "../button/button.tsx";
import { TooltipContent, TooltipRoot } from "../tooltip/tooltip.tsx";

const SLOTS = promptInputVariants();

type PromptInputStatus = "ready" | "submitted" | "streaming" | "error";
type PromptInputLayout = "stacked" | "compact" | "inline";

interface PromptInputContext {
  state?: ControlledState<string, string>;
  status?: () => PromptInputStatus;
  disabled?: () => boolean;
  lockInputOnRun?: boolean;
  layout?: PromptInputLayout;
  submit?: () => void;
  stop?: () => void;
  /** Set by `TokenInput` while it renders: the token field owns the prompt (its flattened text). */
  text?: () => string;
  /** Set by `TokenInput`: clears the token field after an uncontrolled submit. */
  reset?: () => void;
}

const PromptInputContext = createContext<PromptInputContext>({});

const isRunning = (status: PromptInputStatus): boolean => status === "submitted" || status === "streaming";

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

/* -------------------------------------------------------------------------------------------------
 * Root
 * -----------------------------------------------------------------------------------------------*/
interface PromptInputRootProps extends Omit<DivProps, "onSubmit"> {
  /** Controlled text (value, Signal or accessor). */
  value?: string | (() => string);
  /** Initial text when uncontrolled. @default "" */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Submit requested (Enter / Send) with the current text. */
  onSubmit?: (value: string) => void;
  /** Stop requested (Send while submitted / streaming). */
  onStop?: () => void;
  /** Run state. Value or accessor. @default "ready" */
  status?: PromptInputStatus | (() => PromptInputStatus);
  /** Value or accessor. @default false */
  isDisabled?: boolean | (() => boolean);
  /** Disable the textarea while submitted / streaming. @default true */
  lockInputOnRun?: boolean;
  /** Max textarea height (px number or CSS length). @default 240 */
  maxHeight?: number | string;
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** @default "primary" */
  variant?: "primary" | "secondary";
  /** @default "stacked" */
  layout?: PromptInputLayout;
}

const PromptInputRoot = (props: PromptInputRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, [
    "class",
    "children",
    "value",
    "defaultValue",
    "onValueChange",
    "onSubmit",
    "onStop",
    "status",
    "isDisabled",
    "lockInputOnRun",
    "maxHeight",
    "size",
    "variant",
    "layout",
  ]);
  const state = controllable<string>(accessorIfLive(local, "value") as string | (() => string) | undefined, local.defaultValue ?? "", local.onValueChange);
  const status = (): PromptInputStatus => {
    const value = local.status;
    return (typeof value === "function" ? value() : value) ?? "ready";
  };
  const disabled = (): boolean => {
    const value = local.isDisabled;
    return (typeof value === "function" ? value() : value) === true;
  };
  const onSubmit = local.onSubmit;
  const onStop = local.onStop;
  const stop = (): void => onStop?.();
  const layout = local.layout ?? "stacked";
  const maxHeight = local.maxHeight ?? 240;
  const context: PromptInputContext = {
    state,
    status,
    disabled,
    lockInputOnRun: local.lockInputOnRun !== false,
    layout,
    submit: () => {
      const text = context.text ? context.text() : state.value();
      if (disabled() || isRunning(status()) || !text.trim()) return;
      onSubmit?.(text);
      if (state.isControlled) return;
      setControlledValue(state, "");
      context.reset?.();
    },
    stop,
  };
  const body = () => (
    <div
      class={composeSlotClassName(SLOTS.base, local.class)}
      data-status={status}
      data-layout={layout}
      data-size={local.size ?? "md"}
      data-variant={local.variant ?? "primary"}
      data-disabled={() => (disabled() ? "true" : undefined)}
      data-slot="prompt-input"
      style={{ "--prompt-input-max-height": typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight }}
      {...rest}
    >
      {local.children}
    </div>
  );
  return (
    <Provider token={PromptInputContext} value={context}>
      {body()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Layout parts
 * -----------------------------------------------------------------------------------------------*/
type LayoutSlot = "shell" | "content" | "attachments" | "toolbar" | "toolbarStart" | "toolbarEnd";

const layoutPart = (slot: LayoutSlot, dataSlot: string) =>
  function PromptInputPart(props: DivProps): JSX.Element {
    const [local, rest] = splitLive(props, ["class", "children"]);
    return (
      <div class={composeSlotClassName(SLOTS[slot], local.class)} data-slot={dataSlot} {...rest}>
        {local.children}
      </div>
    );
  };

const PromptInputShell = layoutPart("shell", "prompt-input-shell");
const PromptInputContent = layoutPart("content", "prompt-input-content");
const PromptInputAttachments = layoutPart("attachments", "prompt-input-attachments");
const PromptInputToolbar = layoutPart("toolbar", "prompt-input-toolbar");
const PromptInputToolbarStart = layoutPart("toolbarStart", "prompt-input-toolbar-start");
const PromptInputToolbarEnd = layoutPart("toolbarEnd", "prompt-input-toolbar-end");

const PromptInputFooter = (props: Omit<JSX.IntrinsicElements["p"], "class" | "children"> & { class?: string; children?: Content }): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <p class={composeSlotClassName(SLOTS.footer, local.class)} data-slot="prompt-input-footer" {...rest}>
      {local.children}
    </p>
  );
};

/* -------------------------------------------------------------------------------------------------
 * TextArea
 * -----------------------------------------------------------------------------------------------*/
/** Compact layout: expand (`data-expanded`) once the text wraps or has a newline; collapse when emptied. */
const syncCompactExpanded = (textarea: HTMLTextAreaElement): void => {
  const root = textarea.closest("[data-slot=prompt-input]");
  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
  const expanded = textarea.value.includes("\n") || textarea.scrollHeight > lineHeight * 1.5 + 1;
  if (expanded) root?.setAttribute("data-expanded", "true");
  else if (!textarea.value) root?.removeAttribute("data-expanded");
};

interface PromptInputTextAreaProps extends Omit<JSX.IntrinsicElements["textarea"], "class" | "children" | "value"> {
  /** Turn off growing with the content. */
  disableAutosize?: boolean;
  /** Shift+Enter inserts a newline (otherwise Shift+Enter submits too). @default true */
  allowsNewlines?: boolean;
  /** @default "What do you want to know?" */
  placeholder?: string;
  /** @default the placeholder */
  "aria-label"?: string;
  class?: string;
}

const PromptInputTextArea = (props: PromptInputTextAreaProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "disableAutosize", "allowsNewlines", "placeholder", "aria-label"]);
  const context = useContext(PromptInputContext);
  const state = context.state;
  const autosize = local.disableAutosize !== true;
  const allowsNewlines = local.allowsNewlines !== false;
  const compact = context.layout === "compact";
  const placeholder = local.placeholder ?? "What do you want to know?";
  const locked = (): boolean => !!context.disabled?.() || (context.lockInputOnRun !== false && isRunning(context.status?.() ?? "ready"));
  return (
    <textarea
      class={composeSlotClassName(SLOTS.textarea, local.class)}
      rows={1}
      placeholder={placeholder}
      aria-label={local["aria-label"] ?? placeholder}
      disabled={locked()}
      value={state ? state.value() : ""}
      data-autosize={autosize ? undefined : "false"}
      data-slot="prompt-input-textarea"
      onInput={(event: Event) => {
        const textarea = event.currentTarget as HTMLTextAreaElement;
        if (state) setControlledValue(state, textarea.value);
        if (autosize) autosizeTextArea(textarea);
        if (compact) syncCompactExpanded(textarea);
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (!isSubmitKey(event, allowsNewlines)) return;
        event.preventDefault();
        context.submit?.();
      }}
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Action / Send
 * -----------------------------------------------------------------------------------------------*/
interface PromptInputActionProps extends ButtonRootProps {
  /** Tooltip content (ui Tooltip around the button). */
  tooltip?: Content;
}

const PromptInputAction = (props: PromptInputActionProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "tooltip", "variant", "size", "isIconOnly"]);
  const tooltip = local.tooltip;
  const button = () => (
    <ButtonRoot
      variant={local.variant ?? "ghost"}
      size={local.size ?? "sm"}
      isIconOnly={local.isIconOnly ?? true}
      class={composeSlotClassName(SLOTS.action, typeof local.class === "string" ? local.class : undefined)}
      data-slot="prompt-input-action"
      {...rest}
    />
  );
  if (tooltip == null) return button();
  return (
    <TooltipRoot delay={400}>
      {button()}
      <TooltipContent>{tooltip}</TooltipContent>
    </TooltipRoot>
  );
};

interface PromptInputSendProps extends Omit<ButtonRootProps, "onPress"> {
  /** @default "Send message" */
  "aria-label"?: string;
  /** Accessible name while submitted / streaming. @default "Stop generating" */
  stopLabel?: string;
}

const PromptInputSend = (props: PromptInputSendProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label", "stopLabel", "variant", "size", "isIconOnly", "isDisabled"]);
  const context = useContext(PromptInputContext);
  const state = context.state;
  const status = (): PromptInputStatus => context.status?.() ?? "ready";
  const sendLabel = local["aria-label"] ?? "Send message";
  const stopLabel = local.stopLabel ?? "Stop generating";
  const isDisabled = (): boolean => {
    if (local.isDisabled === true || context.disabled?.()) return true;
    const text = context.text ? context.text() : state ? state.value() : "";
    return !isRunning(status()) && !text.trim();
  };
  return (
    <ButtonRoot
      variant={local.variant ?? "primary"}
      size={local.size ?? "sm"}
      isIconOnly={local.isIconOnly ?? true}
      class={composeSlotClassName(SLOTS.send, typeof local.class === "string" ? local.class : undefined)}
      aria-label={() => (isRunning(status()) ? stopLabel : sendLabel)}
      isDisabled={isDisabled()}
      data-status={status}
      data-slot="prompt-input-send"
      onPress={() => {
        if (isRunning(status())) context.stop?.();
        else context.submit?.();
      }}
      {...rest}
    >
      {local.children ?? (
        <>
          <Icon icon={ArrowUp} size={16} class={SLOTS.sendIcon()} data-icon="send" aria-hidden="true" />
          <Icon icon={LoaderCircle} size={16} class={SLOTS.sendIcon()} data-icon="submitted" aria-hidden="true" />
          <Icon icon={Square} size={12} class={SLOTS.sendIcon()} data-icon="stop" aria-hidden="true" />
          <Icon icon={CircleAlert} size={16} class={SLOTS.sendIcon()} data-icon="error" aria-hidden="true" />
        </>
      )}
    </ButtonRoot>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Queue
 * -----------------------------------------------------------------------------------------------*/
interface PromptInputQueueProps extends DivProps {
  /** @default "hover" */
  actionsVisibility?: "always" | "hover";
  /** @default "Queued prompts" */
  "aria-label"?: string;
}

const PromptInputQueue = (props: PromptInputQueueProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "actionsVisibility", "aria-label"]);
  return (
    <div
      class={composeSlotClassName(SLOTS.queue, local.class)}
      role="region"
      aria-label={local["aria-label"] ?? "Queued prompts"}
      data-actions={local.actionsVisibility ?? "hover"}
      data-slot="prompt-input-queue"
      {...rest}
    >
      {local.children}
    </div>
  );
};

const PromptInputQueueList = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.queueList, local.class)} role="list" data-slot="prompt-input-queue-list" {...rest}>
      {local.children}
    </div>
  );
};

const PromptInputQueueItem = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.queueItem, local.class)} role="listitem" data-slot="prompt-input-queue-item" {...rest}>
      {local.children}
    </div>
  );
};

type QueueSlot = "queueItemBody" | "queueItemContent" | "queueItemDescription" | "queueItemAttachments" | "queueItemActions";

const queuePart = (slot: QueueSlot, dataSlot: string) =>
  function PromptInputQueuePart(props: DivProps): JSX.Element {
    const [local, rest] = splitLive(props, ["class", "children"]);
    return (
      <div class={composeSlotClassName(SLOTS[slot], local.class)} data-slot={dataSlot} {...rest}>
        {local.children}
      </div>
    );
  };

const PromptInputQueueItemBody = queuePart("queueItemBody", "prompt-input-queue-item-body");
const PromptInputQueueItemContent = queuePart("queueItemContent", "prompt-input-queue-item-content");
const PromptInputQueueItemDescription = queuePart("queueItemDescription", "prompt-input-queue-item-description");
const PromptInputQueueItemAttachments = queuePart("queueItemAttachments", "prompt-input-queue-item-attachments");
const PromptInputQueueItemActions = queuePart("queueItemActions", "prompt-input-queue-item-actions");

/** Presentational drag handle (reordering is not ported). */
const PromptInputQueueItemHandle = (props: { class?: string }): JSX.Element => (
  <span class={composeSlotClassName(SLOTS.queueItemHandle, props.class)} aria-hidden="true" data-slot="prompt-input-queue-item-handle">
    <Icon icon={GripVertical} size={14} />
  </span>
);

const PromptInputQueueItemIcon = (props: { class?: string; children?: Content }): JSX.Element => (
  <span class={composeSlotClassName(SLOTS.queueItemIcon, props.class)} aria-hidden="true" data-slot="prompt-input-queue-item-icon">
    {props.children ?? <Icon icon={CornerDownRight} size={14} />}
  </span>
);

interface PromptInputQueueItemAttachmentsOverflowProps {
  /** Attachments hidden beyond the visible previews. */
  hiddenCount: number;
  /** @default "files" */
  noun?: string;
  class?: string;
}

const PromptInputQueueItemAttachmentsOverflow = (props: PromptInputQueueItemAttachmentsOverflowProps): JSX.Element | null => {
  const [local] = splitLive(props, ["hiddenCount", "noun", "class"]);
  if (!(local.hiddenCount > 0)) return null;
  return (
    <span class={composeSlotClassName(SLOTS.queueItemAttachmentsOverflow, local.class)} data-slot="prompt-input-queue-item-attachments-overflow">
      +{local.hiddenCount} {local.noun ?? "files"}
    </span>
  );
};

const PromptInputQueueItemAction = (props: ButtonRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "variant", "size", "isIconOnly"]);
  return (
    <ButtonRoot
      variant={local.variant ?? "ghost"}
      size={local.size ?? "sm"}
      isIconOnly={local.isIconOnly ?? true}
      class={composeSlotClassName(SLOTS.queueItemAction, typeof local.class === "string" ? local.class : undefined)}
      data-slot="prompt-input-queue-item-action"
      {...rest}
    />
  );
};

const PromptInputQueueItemRemove = (props: ButtonRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "aria-label"]);
  return (
    <PromptInputQueueItemAction aria-label={local["aria-label"] ?? "Remove from queue"} {...rest}>
      {local.children ?? <Icon icon={X} size={14} aria-hidden="true" />}
    </PromptInputQueueItemAction>
  );
};

const PromptInputQueueItemMore = (props: ButtonRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "aria-label"]);
  return (
    <PromptInputQueueItemAction aria-label={local["aria-label"] ?? "More actions"} {...rest}>
      {local.children ?? <Icon icon={Ellipsis} size={14} aria-hidden="true" />}
    </PromptInputQueueItemAction>
  );
};

export {
  PromptInputRoot,
  PromptInputShell,
  PromptInputContent,
  PromptInputAttachments,
  PromptInputTextArea,
  PromptInputToolbar,
  PromptInputToolbarStart,
  PromptInputToolbarEnd,
  PromptInputAction,
  PromptInputSend,
  PromptInputFooter,
  PromptInputQueue,
  PromptInputQueueList,
  PromptInputQueueItem,
  PromptInputQueueItemHandle,
  PromptInputQueueItemBody,
  PromptInputQueueItemIcon,
  PromptInputQueueItemContent,
  PromptInputQueueItemDescription,
  PromptInputQueueItemAttachments,
  PromptInputQueueItemAttachmentsOverflow,
  PromptInputQueueItemActions,
  PromptInputQueueItemAction,
  PromptInputQueueItemRemove,
  PromptInputQueueItemMore,
};
// Internal (token input parts in `../prompt-input-tokens/prompt-input-tokens.tsx`).
export { PromptInputContext, isRunning as promptInputIsRunning, syncCompactExpanded as promptInputSyncCompactExpanded };
export type {
  PromptInputContext as PromptInputContextValue,
  PromptInputStatus,
  PromptInputLayout,
  PromptInputRootProps,
  DivProps as PromptInputPartProps,
  PromptInputTextAreaProps,
  PromptInputActionProps,
  PromptInputSendProps,
  PromptInputQueueProps,
  PromptInputQueueItemAttachmentsOverflowProps,
};
