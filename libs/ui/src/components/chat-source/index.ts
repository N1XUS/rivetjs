// Rivet addition (no HeroUI v3.2.6 counterpart): citation pills + grouped source lists; feature set inspired by commercial UI kits'
//  public ChatSource docs, independent implementation (see `chat-source.tsx`).
import {
  ChatSourceIcon,
  ChatSourcePreview,
  ChatSourceRoot,
  ChatSourcesContent,
  ChatSourcesFavicons,
  ChatSourcesList,
  ChatSourcesRoot,
  ChatSourcesTrigger,
  ChatSourceTitle,
  ChatSourceTrigger,
} from "./chat-source.tsx";
import type {
  ChatSourceIconProps,
  ChatSourcePreviewProps,
  ChatSourceRootProps,
  ChatSourcesContentProps,
  ChatSourcesFaviconsProps,
  ChatSourcesListProps,
  ChatSourcesRootProps,
  ChatSourcesTriggerProps,
  ChatSourceTitleProps,
  ChatSourceTriggerProps,
} from "./chat-source.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Components
 * -----------------------------------------------------------------------------------------------*/
export const ChatSource = Object.assign(ChatSourceRoot, {
  Root: ChatSourceRoot,
  Trigger: ChatSourceTrigger,
  Icon: ChatSourceIcon,
  Title: ChatSourceTitle,
  Preview: ChatSourcePreview,
});

export type ChatSource = {
  Props: ChatSourceRootProps;
  RootProps: ChatSourceRootProps;
  TriggerProps: ChatSourceTriggerProps;
  IconProps: ChatSourceIconProps;
  TitleProps: ChatSourceTitleProps;
  PreviewProps: ChatSourcePreviewProps;
};

export const ChatSources = Object.assign(ChatSourcesRoot, {
  Root: ChatSourcesRoot,
  Trigger: ChatSourcesTrigger,
  Content: ChatSourcesContent,
  List: ChatSourcesList,
  Favicons: ChatSourcesFavicons,
});

export type ChatSources = {
  Props: ChatSourcesRootProps;
  RootProps: ChatSourcesRootProps;
  TriggerProps: ChatSourcesTriggerProps;
  ContentProps: ChatSourcesContentProps;
  ListProps: ChatSourcesListProps;
  FaviconsProps: ChatSourcesFaviconsProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Components
 * -----------------------------------------------------------------------------------------------*/
export {
  ChatSourceRoot,
  ChatSourceTrigger,
  ChatSourceIcon,
  ChatSourceTitle,
  ChatSourcePreview,
  ChatSourcesRoot,
  ChatSourcesTrigger,
  ChatSourcesContent,
  ChatSourcesList,
  ChatSourcesFavicons,
} from "./chat-source.tsx";
export type {
  ChatSourceType,
  ChatSourceRootProps,
  ChatSourceRootProps as ChatSourceProps,
  ChatSourceTriggerProps,
  ChatSourceIconProps,
  ChatSourceTitleProps,
  ChatSourcePreviewProps,
  ChatSourcesRootProps,
  ChatSourcesRootProps as ChatSourcesProps,
  ChatSourcesTriggerProps,
  ChatSourcesContentProps,
  ChatSourcesListProps,
  ChatSourcesFaviconsProps,
} from "./chat-source.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chatSourceVariants } from "../../../styles/src/components/chat-source/index.ts";

export type { ChatSourceVariants } from "../../../styles/src/components/chat-source/index.ts";
