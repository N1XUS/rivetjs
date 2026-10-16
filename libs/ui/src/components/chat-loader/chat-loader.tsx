// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no chat loader). Feature set inspired by HeroUI Pro's public
// ChatLoader docs (parts `Dots` / `Pulse` / `Spinner` / `Skeleton` + skeleton primitives `SkeletonAvatar` /
// `SkeletonBlock` / `SkeletonLine`); independent implementation, Rivet-authored styles.
// - Every loader is a polite `role="status"` named by `aria-label` (default "Loading"); the moving parts are
//   `aria-hidden`. Animation = CSS keyframes (none under reduced motion); skeleton primitives reuse the vendored
//   `skeleton` classes (shimmer). Pure markup: no state, no script.
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { chatLoaderVariants } from "../../../styles/src/components/chat-loader/index.ts";
import { skeletonVariants } from "../../../styles/src/components/skeleton/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { SpinnerRoot } from "../spinner/spinner.tsx";

const SLOTS = chatLoaderVariants();
const SKELETON = skeletonVariants({ animationType: "shimmer" }).base();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

interface ChatLoaderStatusProps extends DivProps {
  /** Accessible name of the status. @default "Loading" */
  "aria-label"?: string;
}

const ChatLoaderDots = (props: ChatLoaderStatusProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label"]);
  const dot = SLOTS.dot();
  return (
    <div
      class={composeSlotClassName(SLOTS.dots, local.class)}
      role="status"
      aria-label={local["aria-label"] ?? "Loading"}
      data-slot="chat-loader-dots"
      {...rest}
    >
      <span class={dot} aria-hidden="true" />
      <span class={dot} aria-hidden="true" />
      <span class={dot} aria-hidden="true" />
      {local.children}
    </div>
  );
};

const ChatLoaderPulse = (props: ChatLoaderStatusProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label"]);
  return (
    <div
      class={composeSlotClassName(SLOTS.pulse, local.class)}
      role="status"
      aria-label={local["aria-label"] ?? "Loading"}
      data-slot="chat-loader-pulse"
      {...rest}
    >
      <span class={SLOTS.pulseDot()} aria-hidden="true" />
      {local.children}
    </div>
  );
};

interface ChatLoaderSpinnerProps extends ChatLoaderStatusProps {
  /** Spinner size. @default "sm" */
  size?: "sm" | "md" | "lg" | "xl";
}

const ChatLoaderSpinner = (props: ChatLoaderSpinnerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label", "size"]);
  return (
    <div
      class={composeSlotClassName(SLOTS.spinner, local.class)}
      role="status"
      aria-label={local["aria-label"] ?? "Loading"}
      data-slot="chat-loader-spinner"
      {...rest}
    >
      <SpinnerRoot size={local.size ?? "sm"} role="presentation" aria-label={undefined} aria-hidden="true" />
      {local.children}
    </div>
  );
};

/** A skeleton circle in the avatar column. */
const ChatLoaderSkeletonAvatar = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return <div class={`${SKELETON} ${composeSlotClassName(SLOTS.avatar, local.class)}`} aria-hidden="true" data-slot="chat-loader-avatar" {...rest} />;
};

/** The column of skeleton lines. */
const ChatLoaderSkeletonBlock = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.content, local.class)} aria-hidden="true" data-slot="chat-loader-content" {...rest}>
      {local.children}
    </div>
  );
};

interface ChatLoaderSkeletonLineProps extends DivProps {
  /** Line width (any CSS length / percentage). @default "100%" */
  width?: string;
}

/** One skeleton text line. */
const ChatLoaderSkeletonLine = (props: ChatLoaderSkeletonLineProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "width", "style"]);
  const width = local.width;
  return (
    <div
      class={`${SKELETON} ${composeSlotClassName(SLOTS.line, local.class)}`}
      style={width ? { width } : undefined}
      aria-hidden="true"
      data-slot="chat-loader-line"
      {...rest}
    />
  );
};

interface ChatLoaderSkeletonProps extends ChatLoaderStatusProps {
  /** Number of lines of the default content. @default 3 */
  lines?: number;
  /** Hide the avatar placeholder. */
  hideAvatar?: boolean;
}

/** A message-shaped skeleton (avatar + lines); children replace the default parts. */
const ChatLoaderSkeleton = (props: ChatLoaderSkeletonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label", "lines", "hideAvatar"]);
  const count = Math.max(1, local.lines ?? 3);
  const widths = ["92%", "78%", "56%", "84%", "64%"];
  const children = local.children;
  return (
    <div class={composeSlotClassName(SLOTS.base, local.class)} role="status" aria-label={local["aria-label"] ?? "Loading"} data-slot="chat-loader" {...rest}>
      {children ?? [
        local.hideAvatar ? null : <ChatLoaderSkeletonAvatar />,
        <ChatLoaderSkeletonBlock>
          {Array.from({ length: count }, (_, i) => (
            <ChatLoaderSkeletonLine width={i === count - 1 && count > 1 ? "48%" : widths[i % widths.length]} />
          ))}
        </ChatLoaderSkeletonBlock>,
      ]}
    </div>
  );
};

export { ChatLoaderDots, ChatLoaderPulse, ChatLoaderSpinner, ChatLoaderSkeleton, ChatLoaderSkeletonAvatar, ChatLoaderSkeletonBlock, ChatLoaderSkeletonLine };
export type { ChatLoaderStatusProps, ChatLoaderSpinnerProps, ChatLoaderSkeletonProps, ChatLoaderSkeletonLineProps, DivProps as ChatLoaderPartProps };
