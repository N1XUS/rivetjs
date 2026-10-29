// Rivet addition (no HeroUI v3.2.6 counterpart): loading placeholders for assistant turns; feature set inspired by commercial UI kits'
//  public ChatLoader docs, independent implementation (see `chat-loader.tsx`).
import {
  ChatLoaderDots,
  ChatLoaderPulse,
  ChatLoaderSkeleton,
  ChatLoaderSkeletonAvatar,
  ChatLoaderSkeletonBlock,
  ChatLoaderSkeletonLine,
  ChatLoaderSpinner,
} from "./chat-loader.tsx";
import type {
  ChatLoaderPartProps,
  ChatLoaderSkeletonLineProps,
  ChatLoaderSkeletonProps,
  ChatLoaderSpinnerProps,
  ChatLoaderStatusProps,
} from "./chat-loader.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component (namespace: no root element)
 * -----------------------------------------------------------------------------------------------*/
export const ChatLoader = {
  Dots: ChatLoaderDots,
  Pulse: ChatLoaderPulse,
  Spinner: ChatLoaderSpinner,
  Skeleton: ChatLoaderSkeleton,
  SkeletonAvatar: ChatLoaderSkeletonAvatar,
  SkeletonBlock: ChatLoaderSkeletonBlock,
  SkeletonLine: ChatLoaderSkeletonLine,
};

export type ChatLoader = {
  StatusProps: ChatLoaderStatusProps;
  SpinnerProps: ChatLoaderSpinnerProps;
  SkeletonProps: ChatLoaderSkeletonProps;
  SkeletonLineProps: ChatLoaderSkeletonLineProps;
  PartProps: ChatLoaderPartProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  ChatLoaderDots,
  ChatLoaderPulse,
  ChatLoaderSpinner,
  ChatLoaderSkeleton,
  ChatLoaderSkeletonAvatar,
  ChatLoaderSkeletonBlock,
  ChatLoaderSkeletonLine,
} from "./chat-loader.tsx";
export type {
  ChatLoaderStatusProps,
  ChatLoaderSpinnerProps,
  ChatLoaderSkeletonProps,
  ChatLoaderSkeletonLineProps,
  ChatLoaderPartProps,
} from "./chat-loader.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { chatLoaderVariants } from "../../../styles/src/components/chat-loader/index.ts";

export type { ChatLoaderVariants } from "../../../styles/src/components/chat-loader/index.ts";
