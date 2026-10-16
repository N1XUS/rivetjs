// Rivet addition (no HeroUI v3.2.6 counterpart): AI message composer; feature set inspired by HeroUI Pro's public
// PromptInput docs, independent implementation (see `prompt-input.tsx`).
import {
  PromptInputAction,
  PromptInputAttachments,
  PromptInputContent,
  PromptInputFooter,
  PromptInputQueue,
  PromptInputQueueItem,
  PromptInputQueueItemAction,
  PromptInputQueueItemActions,
  PromptInputQueueItemAttachments,
  PromptInputQueueItemAttachmentsOverflow,
  PromptInputQueueItemBody,
  PromptInputQueueItemContent,
  PromptInputQueueItemDescription,
  PromptInputQueueItemHandle,
  PromptInputQueueItemIcon,
  PromptInputQueueItemMore,
  PromptInputQueueItemRemove,
  PromptInputQueueList,
  PromptInputRoot,
  PromptInputSend,
  PromptInputShell,
  PromptInputTextArea,
  PromptInputToolbar,
  PromptInputToolbarEnd,
  PromptInputToolbarStart,
} from "./prompt-input.tsx";
import type {
  PromptInputActionProps,
  PromptInputPartProps,
  PromptInputQueueItemAttachmentsOverflowProps,
  PromptInputQueueProps,
  PromptInputRootProps,
  PromptInputSendProps,
  PromptInputTextAreaProps,
} from "./prompt-input.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
const PromptInputQueueItemCompound = Object.assign(PromptInputQueueItem, {
  Handle: PromptInputQueueItemHandle,
  Body: PromptInputQueueItemBody,
  Icon: PromptInputQueueItemIcon,
  Content: PromptInputQueueItemContent,
  Description: PromptInputQueueItemDescription,
  Attachments: PromptInputQueueItemAttachments,
  AttachmentsOverflow: PromptInputQueueItemAttachmentsOverflow,
  Actions: PromptInputQueueItemActions,
  Action: PromptInputQueueItemAction,
  Remove: PromptInputQueueItemRemove,
  More: PromptInputQueueItemMore,
});

const PromptInputQueueCompound = Object.assign(PromptInputQueue, {
  List: PromptInputQueueList,
  Item: PromptInputQueueItemCompound,
});

export const PromptInput = Object.assign(PromptInputRoot, {
  Root: PromptInputRoot,
  Shell: PromptInputShell,
  Content: PromptInputContent,
  Attachments: PromptInputAttachments,
  TextArea: PromptInputTextArea,
  Toolbar: PromptInputToolbar,
  ToolbarStart: PromptInputToolbarStart,
  ToolbarEnd: PromptInputToolbarEnd,
  Action: PromptInputAction,
  Send: PromptInputSend,
  Footer: PromptInputFooter,
  Queue: PromptInputQueueCompound,
});

export type PromptInput = {
  Props: PromptInputRootProps;
  RootProps: PromptInputRootProps;
  PartProps: PromptInputPartProps;
  TextAreaProps: PromptInputTextAreaProps;
  ActionProps: PromptInputActionProps;
  SendProps: PromptInputSendProps;
  QueueProps: PromptInputQueueProps;
  QueueItemAttachmentsOverflowProps: PromptInputQueueItemAttachmentsOverflowProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
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
} from "./prompt-input.tsx";
export type {
  PromptInputStatus,
  PromptInputLayout,
  PromptInputRootProps,
  PromptInputRootProps as PromptInputProps,
  PromptInputPartProps,
  PromptInputTextAreaProps,
  PromptInputActionProps,
  PromptInputSendProps,
  PromptInputQueueProps,
  PromptInputQueueItemAttachmentsOverflowProps,
} from "./prompt-input.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { promptInputVariants } from "../../../styles/src/components/prompt-input/index.ts";

export type { PromptInputVariants } from "../../../styles/src/components/prompt-input/index.ts";
