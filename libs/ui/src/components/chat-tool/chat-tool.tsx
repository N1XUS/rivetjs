// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no tool-call card). Feature set inspired by commercial UI kits' public
// ChatTool docs (collapsible tool-call card: `toolName`, `state` input-streaming / input-available / output-available /
// output-error / requires-action, `triggerPrefix`, `input` / `output` as JSON, `argsText`, `errorText`, `onApprove` /
// `onReject`, `defaultExpanded` / `isExpanded`; preset or composable `Trigger` / `StatusIcon` / `Content` / `Args` /
// `Result` / `Error` / `Approval`; `ChatToolGroup` disclosure); independent implementation, Rivet-authored styles.
// - Root = ui `Disclosure`; `defaultExpanded` defaults to `state === "requires-action"` (the approval must be visible).
// - Context = plain data (`rv-ui-chat-tool`: state + tool name). `StatusIcon`: spinning loader (input-*), check, x, shield
//   (requires-action), `role="img"` named by the state ("Running", "Completed", "Failed", "Needs approval").
// - JSON = ui `CodeBlock` (Rivet highlighter: no Shiki peer, so `ChatTool` ships from the package root too).
import { Icon } from "@rivetjs/kit/icon";
import type { IconNode } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { CircleCheck, CircleX, LoaderCircle, ShieldAlert, Wrench } from "lucide";

import { chatToolVariants } from "../../../styles/src/components/chat-tool/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { ButtonRoot } from "../button/button.tsx";
import { CodeBlockCode, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockRoot } from "../code-block/code-block.tsx";
import { DisclosureBody, DisclosureContent, DisclosureHeading, DisclosureIndicator, DisclosureRoot, DisclosureTrigger } from "../disclosure/disclosure.tsx";
import type { DisclosureRootProps } from "../disclosure/disclosure.tsx";

const SLOTS = chatToolVariants();

type ChatToolState = "input-streaming" | "input-available" | "output-available" | "output-error" | "requires-action";

interface ChatToolContext {
  state?: ChatToolState;
  toolName?: string;
}

const ChatToolContext = createContext<ChatToolContext>({});

const STATE_LABELS: Record<ChatToolState, string> = {
  "input-streaming": "Running",
  "input-available": "Running",
  "output-available": "Completed",
  "output-error": "Failed",
  "requires-action": "Needs approval",
};

const STATE_ICONS: Record<ChatToolState, IconNode> = {
  "input-streaming": LoaderCircle,
  "input-available": LoaderCircle,
  "output-available": CircleCheck,
  "output-error": CircleX,
  "requires-action": ShieldAlert,
};

/** `value` as display text: strings as is, everything else pretty JSON. */
const jsonText = (value: unknown): string => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

/* -------------------------------------------------------------------------------------------------
 * ChatTool
 * -----------------------------------------------------------------------------------------------*/
interface ChatToolRootProps extends Omit<DisclosureRootProps, "class" | "children"> {
  /** Tool display name. */
  toolName?: string;
  /** Tool call state. @default "input-available" */
  state?: ChatToolState;
  /** Label before the tool name in preset mode ("Used tool: "). */
  triggerPrefix?: Content;
  /** Tool input, rendered as JSON in preset mode. */
  input?: unknown;
  /** Tool output, rendered as JSON in preset mode (`output-available`). */
  output?: unknown;
  /** Preformatted input text (partial JSON while the input streams); wins over `input`. */
  argsText?: string;
  /** Error details (`output-error`). */
  errorText?: string;
  /** Preset approve action (`requires-action`). */
  onApprove?: () => void;
  /** Preset reject action (`requires-action`). */
  onReject?: () => void;
  /** Custom composition; default: preset trigger + content. */
  children?: Content;
  class?: string;
}

const ChatToolRoot = (props: ChatToolRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, [
    "class",
    "children",
    "toolName",
    "state",
    "triggerPrefix",
    "input",
    "output",
    "argsText",
    "errorText",
    "onApprove",
    "onReject",
    "defaultExpanded",
  ]);
  const state = local.state ?? "input-available";
  const context: ChatToolContext = { state, toolName: local.toolName };
  const children = local.children;
  const hasInput = local.argsText !== undefined || local.input !== undefined;
  const inputText = local.argsText ?? (local.input !== undefined ? jsonText(local.input) : "");
  const outputText = local.output !== undefined ? jsonText(local.output) : undefined;
  const errorText = local.errorText;
  const onApprove = local.onApprove;
  const onReject = local.onReject;
  const prefix = local.triggerPrefix;
  // Functions: Rivet JSX builds nodes eagerly, the parts must be created inside the provider.
  const preset = () => (
    <>
      <ChatToolTrigger>
        <ChatToolStatusIcon />
        <span class={SLOTS.triggerLabel()}>
          {prefix}
          <strong class={SLOTS.toolName()}>{local.toolName}</strong>
        </span>
      </ChatToolTrigger>
      <ChatToolContent>
        {hasInput ? <ChatToolArgs input={inputText} /> : null}
        {state === "output-available" && outputText !== undefined ? <ChatToolResult value={outputText} /> : null}
        {state === "output-error" ? <ChatToolError>{errorText ?? "The tool call failed."}</ChatToolError> : null}
        {state === "requires-action" ? <ChatToolApproval onApprove={() => onApprove?.()} onReject={() => onReject?.()} /> : null}
      </ChatToolContent>
    </>
  );
  const body = () => (
    <DisclosureRoot
      class={composeSlotClassName(SLOTS.base, local.class)}
      defaultExpanded={local.defaultExpanded ?? state === "requires-action"}
      data-state={state}
      data-chat-tool=""
      {...rest}
    >
      {children != null ? children : preset()}
    </DisclosureRoot>
  );
  return (
    <Provider token={ChatToolContext} value={context}>
      {body()}
    </Provider>
  );
};

interface ChatToolTriggerProps {
  children?: Content;
  /** Heading level of the trigger wrapper. @default 3 */
  level?: number;
  class?: string;
}

const ChatToolTrigger = (props: ChatToolTriggerProps): JSX.Element => {
  const [local] = splitLive(props, ["class", "children", "level"]);
  return (
    <DisclosureHeading class={SLOTS.heading()} level={local.level ?? 3}>
      <DisclosureTrigger class={composeSlotClassName(SLOTS.trigger, local.class)} data-slot="chat-tool-trigger">
        {local.children}
        <DisclosureIndicator class={SLOTS.indicator()} />
      </DisclosureTrigger>
    </DisclosureHeading>
  );
};

interface ChatToolStatusIconProps {
  /** @default the root `state` */
  state?: ChatToolState;
  /** Lucide icon replacing the state icon. */
  icon?: IconNode;
  class?: string;
}

const ChatToolStatusIcon = (props: ChatToolStatusIconProps): JSX.Element => {
  const [local] = splitLive(props, ["state", "icon", "class"]);
  const context = useContext(ChatToolContext);
  const state = local.state ?? context.state ?? "input-available";
  return (
    <span
      class={composeSlotClassName(SLOTS.statusIcon, local.class)}
      role="img"
      aria-label={STATE_LABELS[state]}
      data-state={state}
      data-slot="chat-tool-status-icon"
    >
      <Icon icon={local.icon ?? STATE_ICONS[state]} size={16} aria-hidden="true" />
    </span>
  );
};

/** Lucide wrench, for custom triggers. */
const ChatToolIcon = (props: { class?: string }): JSX.Element => (
  <Icon icon={Wrench} size={16} class={composeSlotClassName(SLOTS.toolIcon, props.class)} aria-hidden="true" />
);

interface ChatToolContentProps {
  children?: Content;
  class?: string;
}

const ChatToolContent = (props: ChatToolContentProps): JSX.Element => {
  const [local] = splitLive(props, ["class", "children"]);
  return (
    <DisclosureContent class={SLOTS.content()} data-slot="chat-tool-content">
      <DisclosureBody class={composeSlotClassName(SLOTS.body, local.class)}>{local.children}</DisclosureBody>
    </DisclosureContent>
  );
};

const jsonBlock = (label: Content, text: string): JSX.Element => (
  <CodeBlockRoot class={SLOTS.code()}>
    <CodeBlockHeader>
      <CodeBlockLanguage>{label}</CodeBlockLanguage>
      <CodeBlockCopyButton code={text} />
    </CodeBlockHeader>
    <CodeBlockCode code={text} language="json" wrap />
  </CodeBlockRoot>
);

interface ChatToolArgsProps {
  /** Tool input (JSON-stringified unless a string). */
  input?: unknown;
  /** @default "Input" */
  label?: Content;
  /** Custom content instead of the JSON block. */
  children?: Content;
  class?: string;
}

const ChatToolArgs = (props: ChatToolArgsProps): JSX.Element => {
  const [local] = splitLive(props, ["input", "label", "children", "class"]);
  return (
    <div class={composeSlotClassName(SLOTS.args, local.class)} data-slot="chat-tool-args">
      {local.children ?? jsonBlock(local.label ?? "Input", jsonText(local.input ?? ""))}
    </div>
  );
};

interface ChatToolResultProps {
  /** Tool output (JSON-stringified unless a string). */
  value?: unknown;
  /** @default "Result" */
  label?: Content;
  children?: Content;
  class?: string;
}

const ChatToolResult = (props: ChatToolResultProps): JSX.Element => {
  const [local] = splitLive(props, ["value", "label", "children", "class"]);
  return (
    <div class={composeSlotClassName(SLOTS.result, local.class)} data-slot="chat-tool-result">
      {local.children ?? jsonBlock(local.label ?? "Result", jsonText(local.value ?? ""))}
    </div>
  );
};

interface ChatToolErrorProps {
  children?: Content;
  class?: string;
}

const ChatToolError = (props: ChatToolErrorProps): JSX.Element => {
  const [local] = splitLive(props, ["children", "class"]);
  return (
    <div class={composeSlotClassName(SLOTS.error, local.class)} role="alert" data-slot="chat-tool-error">
      <Icon icon={CircleX} size={16} class={SLOTS.errorIcon()} aria-hidden="true" />
      <div class={SLOTS.errorText()}>{local.children}</div>
    </div>
  );
};

interface ChatToolApprovalProps {
  /** Message. @default "Allow this tool to run?" */
  children?: Content;
  onApprove?: () => void;
  onReject?: () => void;
  /** @default "Approve" */
  approveLabel?: Content;
  /** @default "Reject" */
  rejectLabel?: Content;
  class?: string;
}

const ChatToolApproval = (props: ChatToolApprovalProps): JSX.Element => {
  const [local] = splitLive(props, ["children", "onApprove", "onReject", "approveLabel", "rejectLabel", "class"]);
  const onApprove = local.onApprove;
  const onReject = local.onReject;
  return (
    <div class={composeSlotClassName(SLOTS.approval, local.class)} data-slot="chat-tool-approval">
      <div class={SLOTS.approvalText()}>{local.children ?? "Allow this tool to run?"}</div>
      <div class={SLOTS.approvalActions()}>
        <ButtonRoot variant="tertiary" size="sm" onPress={() => onReject?.()}>
          {local.rejectLabel ?? "Reject"}
        </ButtonRoot>
        <ButtonRoot variant="primary" size="sm" onPress={() => onApprove?.()}>
          {local.approveLabel ?? "Approve"}
        </ButtonRoot>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ChatToolGroup
 * -----------------------------------------------------------------------------------------------*/
interface ChatToolGroupRootProps extends Omit<DisclosureRootProps, "class"> {
  class?: string;
}

const ChatToolGroupRoot = (props: ChatToolGroupRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <DisclosureRoot class={composeSlotClassName(SLOTS.group, local.class)} data-chat-tool-group="" {...rest}>
      {local.children}
    </DisclosureRoot>
  );
};

const ChatToolGroupTrigger = (props: ChatToolTriggerProps): JSX.Element => {
  const [local] = splitLive(props, ["class", "children", "level"]);
  return (
    <DisclosureHeading class={SLOTS.heading()} level={local.level ?? 3}>
      <DisclosureTrigger class={composeSlotClassName(SLOTS.groupTrigger, local.class)} data-slot="chat-tool-group-trigger">
        {local.children}
        <DisclosureIndicator class={SLOTS.indicator()} />
      </DisclosureTrigger>
    </DisclosureHeading>
  );
};

const ChatToolGroupContent = (props: ChatToolContentProps): JSX.Element => {
  const [local] = splitLive(props, ["class", "children"]);
  return (
    <DisclosureContent class={SLOTS.content()} data-slot="chat-tool-group-content">
      <DisclosureBody class={composeSlotClassName(SLOTS.groupBody, local.class)}>{local.children}</DisclosureBody>
    </DisclosureContent>
  );
};

export {
  ChatToolRoot,
  ChatToolTrigger,
  ChatToolStatusIcon,
  ChatToolIcon,
  ChatToolContent,
  ChatToolArgs,
  ChatToolResult,
  ChatToolError,
  ChatToolApproval,
  ChatToolGroupRoot,
  ChatToolGroupTrigger,
  ChatToolGroupContent,
};
export type {
  ChatToolState,
  ChatToolRootProps,
  ChatToolTriggerProps,
  ChatToolStatusIconProps,
  ChatToolContentProps,
  ChatToolArgsProps,
  ChatToolResultProps,
  ChatToolErrorProps,
  ChatToolApprovalProps,
  ChatToolGroupRootProps,
};
