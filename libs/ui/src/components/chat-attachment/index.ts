// Rivet addition (no HeroUI v3.2.6 counterpart): chat attachments, groups and the picker / dropzone; feature set inspired
// by commercial UI kits' public ChatAttachment docs, independent implementation (see `chat-attachment.tsx`).
import {
  ChatAttachmentGroup,
  ChatAttachmentIcon,
  ChatAttachmentInfo,
  ChatAttachmentInputDropzone,
  ChatAttachmentInputRoot,
  ChatAttachmentInputTrigger,
  ChatAttachmentName,
  ChatAttachmentPreview,
  ChatAttachmentRemove,
  ChatAttachmentRoot,
  ChatAttachmentSize,
} from "./chat-attachment.tsx";
import type {
  ChatAttachmentGroupProps,
  ChatAttachmentInputDropzoneProps,
  ChatAttachmentInputRootProps,
  ChatAttachmentInputTriggerProps,
  ChatAttachmentPartProps,
  ChatAttachmentRemoveProps,
  ChatAttachmentRootProps,
} from "./chat-attachment.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Components
 * -----------------------------------------------------------------------------------------------*/
export const ChatAttachment = Object.assign(ChatAttachmentRoot, {
  Root: ChatAttachmentRoot,
  Preview: ChatAttachmentPreview,
  Icon: ChatAttachmentIcon,
  Info: ChatAttachmentInfo,
  Name: ChatAttachmentName,
  Size: ChatAttachmentSize,
  Remove: ChatAttachmentRemove,
});

export type ChatAttachment = {
  Props: ChatAttachmentRootProps;
  RootProps: ChatAttachmentRootProps;
  PartProps: ChatAttachmentPartProps;
  RemoveProps: ChatAttachmentRemoveProps;
};

export const ChatAttachmentInput = Object.assign(ChatAttachmentInputRoot, {
  Root: ChatAttachmentInputRoot,
  Trigger: ChatAttachmentInputTrigger,
  Dropzone: ChatAttachmentInputDropzone,
});

export type ChatAttachmentInput = {
  Props: ChatAttachmentInputRootProps;
  RootProps: ChatAttachmentInputRootProps;
  TriggerProps: ChatAttachmentInputTriggerProps;
  DropzoneProps: ChatAttachmentInputDropzoneProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Components
 * -----------------------------------------------------------------------------------------------*/
export {
  inferChatAttachmentFileKind,
  formatChatAttachmentSize,
  ChatAttachmentRoot,
  ChatAttachmentPreview,
  ChatAttachmentIcon,
  ChatAttachmentInfo,
  ChatAttachmentName,
  ChatAttachmentSize,
  ChatAttachmentRemove,
  ChatAttachmentGroup,
  ChatAttachmentInputRoot,
  ChatAttachmentInputTrigger,
  ChatAttachmentInputDropzone,
} from "./chat-attachment.tsx";
export type {
  ChatAttachmentMediaType,
  ChatAttachmentFileKind,
  ChatAttachmentRootProps,
  ChatAttachmentRootProps as ChatAttachmentProps,
  ChatAttachmentPartProps,
  ChatAttachmentRemoveProps,
  ChatAttachmentGroupProps,
  ChatAttachmentInputRootProps,
  ChatAttachmentInputRootProps as ChatAttachmentInputProps,
  ChatAttachmentInputTriggerProps,
  ChatAttachmentInputDropzoneProps,
  ChatAttachmentDropzoneRenderProps,
} from "./chat-attachment.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chatAttachmentVariants } from "../../../styles/src/components/chat-attachment/index.ts";

export type { ChatAttachmentVariants } from "../../../styles/src/components/chat-attachment/index.ts";
