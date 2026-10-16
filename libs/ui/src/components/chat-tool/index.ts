// Rivet addition (no HeroUI v3.2.6 counterpart): AI tool-call cards + groups; feature set inspired by HeroUI Pro's public
// ChatTool docs, independent implementation (see `chat-tool.tsx`).
import {
  ChatToolApproval,
  ChatToolArgs,
  ChatToolContent,
  ChatToolError,
  ChatToolGroupContent,
  ChatToolGroupRoot,
  ChatToolGroupTrigger,
  ChatToolIcon,
  ChatToolResult,
  ChatToolRoot,
  ChatToolStatusIcon,
  ChatToolTrigger,
} from "./chat-tool.tsx";
import type {
  ChatToolApprovalProps,
  ChatToolArgsProps,
  ChatToolContentProps,
  ChatToolErrorProps,
  ChatToolGroupRootProps,
  ChatToolResultProps,
  ChatToolRootProps,
  ChatToolStatusIconProps,
  ChatToolTriggerProps,
} from "./chat-tool.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Components
 * -----------------------------------------------------------------------------------------------*/
export const ChatTool = Object.assign(ChatToolRoot, {
  Root: ChatToolRoot,
  Trigger: ChatToolTrigger,
  StatusIcon: ChatToolStatusIcon,
  Icon: ChatToolIcon,
  Content: ChatToolContent,
  Args: ChatToolArgs,
  Result: ChatToolResult,
  Error: ChatToolError,
  Approval: ChatToolApproval,
});

export type ChatTool = {
  Props: ChatToolRootProps;
  RootProps: ChatToolRootProps;
  TriggerProps: ChatToolTriggerProps;
  StatusIconProps: ChatToolStatusIconProps;
  ContentProps: ChatToolContentProps;
  ArgsProps: ChatToolArgsProps;
  ResultProps: ChatToolResultProps;
  ErrorProps: ChatToolErrorProps;
  ApprovalProps: ChatToolApprovalProps;
};

export const ChatToolGroup = Object.assign(ChatToolGroupRoot, {
  Root: ChatToolGroupRoot,
  Trigger: ChatToolGroupTrigger,
  Content: ChatToolGroupContent,
});

export type ChatToolGroup = {
  Props: ChatToolGroupRootProps;
  RootProps: ChatToolGroupRootProps;
  TriggerProps: ChatToolTriggerProps;
  ContentProps: ChatToolContentProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Components
 * -----------------------------------------------------------------------------------------------*/
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
} from "./chat-tool.tsx";
export type {
  ChatToolState,
  ChatToolRootProps,
  ChatToolRootProps as ChatToolProps,
  ChatToolTriggerProps,
  ChatToolStatusIconProps,
  ChatToolContentProps,
  ChatToolArgsProps,
  ChatToolResultProps,
  ChatToolErrorProps,
  ChatToolApprovalProps,
  ChatToolGroupRootProps,
  ChatToolGroupRootProps as ChatToolGroupProps,
} from "./chat-tool.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chatToolVariants } from "../../../styles/src/components/chat-tool/index.ts";

export type { ChatToolVariants } from "../../../styles/src/components/chat-tool/index.ts";
