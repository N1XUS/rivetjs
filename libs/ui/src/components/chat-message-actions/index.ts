// Rivet addition (no HeroUI v3.2.6 counterpart): inline message action buttons; feature set inspired by HeroUI Pro's public
// ChatMessageActions docs, independent implementation (see `chat-message-actions.tsx`).
import { ChatMessageAction, ChatMessageActionsRoot, ChatMessageCopy } from "./chat-message-actions.tsx";
import type { ChatMessageActionProps, ChatMessageActionsRootProps, ChatMessageCopyProps } from "./chat-message-actions.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ChatMessageActions = Object.assign(ChatMessageActionsRoot, {
  Root: ChatMessageActionsRoot,
  Action: ChatMessageAction,
  Copy: ChatMessageCopy,
});

export type ChatMessageActions = {
  Props: ChatMessageActionsRootProps;
  RootProps: ChatMessageActionsRootProps;
  ActionProps: ChatMessageActionProps;
  CopyProps: ChatMessageCopyProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ChatMessageActionsRoot, ChatMessageAction, ChatMessageCopy } from "./chat-message-actions.tsx";
export type {
  ChatMessageActionsRootProps,
  ChatMessageActionsRootProps as ChatMessageActionsProps,
  ChatMessageActionProps,
  ChatMessageCopyProps,
} from "./chat-message-actions.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chatMessageActionsVariants } from "../../../styles/src/components/chat-message-actions/index.ts";

export type { ChatMessageActionsVariants } from "../../../styles/src/components/chat-message-actions/index.ts";
