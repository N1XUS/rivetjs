// Rivet addition (no HeroUI v3.2.6 counterpart): stick-to-bottom chat viewport; feature set inspired by commercial UI kits'
// public ChatConversation docs, independent implementation (see `chat-conversation.tsx`).
import { ChatConversationContent, ChatConversationRoot, ChatConversationScrollAnchor, ChatConversationScrollButton } from "./chat-conversation.tsx";
import type { ChatConversationContentProps, ChatConversationRootProps, ChatConversationScrollButtonProps } from "./chat-conversation.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ChatConversation = Object.assign(ChatConversationRoot, {
  Root: ChatConversationRoot,
  Content: ChatConversationContent,
  ScrollAnchor: ChatConversationScrollAnchor,
  ScrollButton: ChatConversationScrollButton,
});

export type ChatConversation = {
  Props: ChatConversationRootProps;
  RootProps: ChatConversationRootProps;
  ContentProps: ChatConversationContentProps;
  ScrollButtonProps: ChatConversationScrollButtonProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ChatConversationRoot, ChatConversationContent, ChatConversationScrollAnchor, ChatConversationScrollButton } from "./chat-conversation.tsx";
export type {
  ChatConversationRootProps,
  ChatConversationRootProps as ChatConversationProps,
  ChatConversationContentProps,
  ChatConversationScrollButtonProps,
} from "./chat-conversation.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chatConversationVariants } from "../../../styles/src/components/chat-conversation/index.ts";

export type { ChatConversationVariants } from "../../../styles/src/components/chat-conversation/index.ts";
