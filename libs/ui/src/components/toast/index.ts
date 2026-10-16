// Ported from HeroUI v3.2.6 packages/react/src/components/toast/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import {
  ToastActionButton,
  ToastCloseButton,
  ToastContent,
  ToastDescription,
  ToastIndicator,
  ToastProvider,
  Toast as ToastRoot,
  ToastTitle,
} from "./toast.tsx";
import type {
  ToastActionButtonProps,
  ToastCloseButtonProps,
  ToastContentProps,
  ToastDescriptionProps,
  ToastIndicatorProps,
  ToastProps,
  ToastProviderProps,
  ToastTitleProps,
} from "./toast.tsx";
import { ToastQueue, toast, toastQueue } from "./toast-queue.ts";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Toast = Object.assign(ToastRoot, {
  Provider: ToastProvider,
  Content: ToastContent,
  Indicator: ToastIndicator,
  Title: ToastTitle,
  Description: ToastDescription,
  ActionButton: ToastActionButton,
  CloseButton: ToastCloseButton,
  Queue: ToastQueue,
  toast,
});

export type Toast = {
  Props: ToastProps;
  ProviderProps: ToastProviderProps;
  ContentProps: ToastContentProps;
  IndicatorProps: ToastIndicatorProps;
  TitleProps: ToastTitleProps;
  DescriptionProps: ToastDescriptionProps;
  ActionProps: ToastActionButtonProps;
  CloseButtonProps: ToastCloseButtonProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ToastProvider, ToastContent, ToastIndicator, ToastTitle, ToastDescription, ToastActionButton, ToastCloseButton };

export type {
  ToastActionButtonProps,
  ToastCloseButtonProps,
  ToastProviderProps,
  ToastContentProps,
  ToastDescriptionProps,
  ToastIndicatorProps,
  ToastProps,
  ToastTitleProps,
} from "./toast.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { toastVariants } from "../../../styles/src/components/toast/index.ts";

export type { ToastVariants } from "../../../styles/src/components/toast/index.ts";

/* -------------------------------------------------------------------------------------------------
 * Utilities
 * -----------------------------------------------------------------------------------------------*/
export { ToastQueue, toast, toastQueue };

/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/
export { DEFAULT_EXIT_DURATION, DEFAULT_GAP, DEFAULT_HOTKEY, DEFAULT_MAX_VISIBLE_TOAST, DEFAULT_TOAST_TIMEOUT } from "./constants.ts";

export type { ToastOptions, ToastContentValue, ToastPromiseOptions, ToastQueueOptions } from "./toast-queue.ts";
