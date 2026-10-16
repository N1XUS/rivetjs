// Rivet addition (no HeroUI v3.2.6 counterpart): thread list rows for chat sidebars; feature set inspired by HeroUI Pro's
// public ChatListView docs, independent implementation (see `chat-list-view.tsx`).
import {
  ChatListViewIcon,
  ChatListViewItem,
  ChatListViewItemContent,
  ChatListViewMeta,
  ChatListViewPreview,
  ChatListViewRoot,
  ChatListViewSection,
  ChatListViewTitle,
} from "./chat-list-view.tsx";
import type { ChatListViewItemProps, ChatListViewPartProps, ChatListViewRootProps } from "./chat-list-view.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ChatListView = Object.assign(ChatListViewRoot, {
  Root: ChatListViewRoot,
  Item: ChatListViewItem,
  Icon: ChatListViewIcon,
  ItemContent: ChatListViewItemContent,
  Title: ChatListViewTitle,
  Preview: ChatListViewPreview,
  Meta: ChatListViewMeta,
  Section: ChatListViewSection,
});

export type ChatListView = {
  Props: ChatListViewRootProps;
  RootProps: ChatListViewRootProps;
  ItemProps: ChatListViewItemProps;
  PartProps: ChatListViewPartProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  ChatListViewRoot,
  ChatListViewItem,
  ChatListViewIcon,
  ChatListViewItemContent,
  ChatListViewTitle,
  ChatListViewPreview,
  ChatListViewMeta,
  ChatListViewSection,
} from "./chat-list-view.tsx";
export type { ChatListViewRootProps, ChatListViewRootProps as ChatListViewProps, ChatListViewItemProps, ChatListViewPartProps } from "./chat-list-view.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chatListViewVariants } from "../../../styles/src/components/chat-list-view/index.ts";

export type { ChatListViewVariants } from "../../../styles/src/components/chat-list-view/index.ts";
