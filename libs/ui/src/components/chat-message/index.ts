// Rivet addition (no HeroUI v3.2.6 counterpart): assistant / user message layouts; feature set inspired by commercial UI kits'
// public ChatMessage docs, independent implementation (see `chat-message.tsx`).
import {
  ChatMessageActionsRow,
  ChatMessageAssistant,
  ChatMessageAvatar,
  ChatMessageBody,
  ChatMessageBubble,
  ChatMessageContent,
  ChatMessageMeta,
  ChatMessageUser,
} from "./chat-message.tsx";
import type { ChatMessageAvatarProps, ChatMessagePartProps, ChatMessageRootProps } from "./chat-message.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component (namespace: two roots)
 * -----------------------------------------------------------------------------------------------*/
export const ChatMessage = {
  Assistant: ChatMessageAssistant,
  User: ChatMessageUser,
  Avatar: ChatMessageAvatar,
  Body: ChatMessageBody,
  Bubble: ChatMessageBubble,
  Content: ChatMessageContent,
  Actions: ChatMessageActionsRow,
  Meta: ChatMessageMeta,
};

export type ChatMessage = {
  RootProps: ChatMessageRootProps;
  AvatarProps: ChatMessageAvatarProps;
  PartProps: ChatMessagePartProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  ChatMessageAssistant,
  ChatMessageUser,
  ChatMessageAvatar,
  ChatMessageBody,
  ChatMessageBubble,
  ChatMessageContent,
  ChatMessageActionsRow,
  ChatMessageMeta,
} from "./chat-message.tsx";
export type { ChatMessageRootProps, ChatMessageAvatarProps, ChatMessagePartProps } from "./chat-message.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chatMessageVariants } from "../../../styles/src/components/chat-message/index.ts";

export type { ChatMessageVariants } from "../../../styles/src/components/chat-message/index.ts";
