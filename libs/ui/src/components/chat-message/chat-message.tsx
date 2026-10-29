// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no chat message). Feature set inspired by commercial UI kits' public
// ChatMessage docs (parts `Assistant` / `User` / `Avatar` / `Body` / `Bubble` / `Content` / `Actions`); independent
// implementation, Rivet-authored styles on HeroUI tokens.
// - `Assistant` = avatar column + body column (full width: markdown, tools, sources); `User` = an end-aligned bubble.
//   Roots carry `data-role` (`assistant` / `user`) and are `article`-free `div`s (the conversation is the `log`).
// - `Avatar` = the ui Avatar (`size` sm) with `fallback` content (initials or a lucide icon) and an optional `src`; without
//   `src` / children it is static markup with the Avatar classes (no image-status effect: nothing boots on a resumed page);
//   `show={false}` keeps the column (grouped consecutive turns) without drawing an avatar.
// - `Actions` show on hover / focus within for user turns and always for assistant turns (`actionsVisibility`).
// - Rivet extra `isStreaming` (value or accessor) on `Assistant`: `data-streaming` hides the actions row while the turn
//   streams; when it flips off the row fades in (a CSS transition on the attribute change: never at page load). Keep the
//   streamed turn's node (update it in place) so the flip happens on the same element.
// - Pure markup: no state, no script.
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { chatMessageVariants } from "../../../styles/src/components/chat-message/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { avatarVariants } from "../../../styles/src/components/avatar/index.ts";
import { AvatarFallback, AvatarImage, AvatarRoot } from "../avatar/avatar.tsx";
import type { AvatarRootProps } from "../avatar/avatar.tsx";

const SLOTS = chatMessageVariants();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

interface ChatMessageRootProps extends DivProps {
  /**
   * When the message actions show: `"hover"` (pointer over / focus within the message) or `"always"`.
   *
   * @default "always" for Assistant, "hover" for User
   */
  actionsVisibility?: "always" | "hover";
  /** Rivet extra (`Assistant`): the turn is streaming; its actions stay hidden and fade in when it ends. Value or accessor. */
  isStreaming?: boolean | (() => boolean);
}

const ChatMessageAssistant = (props: ChatMessageRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "actionsVisibility", "isStreaming"]);
  const isStreaming = local.isStreaming;
  const streaming = typeof isStreaming === "function" ? () => (isStreaming() ? "true" : undefined) : isStreaming ? "true" : undefined;
  return (
    <div
      class={`${SLOTS.base()} ${composeSlotClassName(SLOTS.assistant, local.class)}`}
      data-slot="chat-message"
      data-role="assistant"
      data-actions={local.actionsVisibility ?? "always"}
      data-streaming={streaming as never}
      {...rest}
    >
      {local.children}
    </div>
  );
};

const ChatMessageUser = (props: ChatMessageRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "actionsVisibility", "isStreaming"]);
  return (
    <div
      class={`${SLOTS.base()} ${composeSlotClassName(SLOTS.user, local.class)}`}
      data-slot="chat-message"
      data-role="user"
      data-actions={local.actionsVisibility ?? "hover"}
      {...rest}
    >
      {local.children}
    </div>
  );
};

interface ChatMessageAvatarProps extends Omit<AvatarRootProps, "children"> {
  /** Image URL (optional: the fallback shows until it loads). */
  src?: string;
  /** Image alt text / accessible name. */
  alt?: string;
  /** Fallback content: initials or a lucide `Icon`. */
  fallback?: Content;
  /** `false` keeps the avatar column empty (consecutive turns of one sender). @default true */
  show?: boolean;
  children?: Content;
}

const ChatMessageAvatar = (props: ChatMessageAvatarProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "src", "alt", "fallback", "show", "size", "color", "variant"]);
  const cls = composeSlotClassName(SLOTS.avatar, local.class);
  if (local.show === false) return <div class={cls} data-slot="chat-message-avatar" data-hidden="true" aria-hidden="true" />;
  const src = local.src;
  const size = local.size ?? "sm";
  const color = local.color ?? "accent";
  const variant = local.variant ?? "soft";
  // No image: the avatar look as static markup (the ui Avatar's image-status / fallback-delay effects would boot a resumed
  // page at load). With `src` (or custom children): the ui Avatar.
  if (!src && local.children == null) {
    const slots = avatarVariants({ size, color, variant });
    return (
      <div class={cls} data-slot="chat-message-avatar">
        <span class={slots.base()} data-slot="avatar" {...(rest as {})}>
          <span class={slots.fallback()} data-slot="avatar-fallback">
            {local.fallback}
          </span>
        </span>
      </div>
    );
  }
  return (
    <div class={cls} data-slot="chat-message-avatar">
      <AvatarRoot size={size} color={color} variant={variant} {...rest}>
        {local.children ?? [src ? <AvatarImage src={src} alt={local.alt ?? ""} /> : null, <AvatarFallback>{local.fallback}</AvatarFallback>]}
      </AvatarRoot>
    </div>
  );
};

const part =
  (slot: "body" | "bubble" | "content" | "actions" | "meta", dataSlot: string) =>
  (props: DivProps): JSX.Element => {
    const [local, rest] = splitLive(props, ["children", "class"]);
    return (
      <div class={composeSlotClassName(SLOTS[slot], local.class)} data-slot={dataSlot} {...rest}>
        {local.children}
      </div>
    );
  };

/** Assistant content column (markdown, tools, sources, actions). */
const ChatMessageBody = part("body", "chat-message-body");
/** User bubble. */
const ChatMessageBubble = part("bubble", "chat-message-bubble");
/** Message text / content. */
const ChatMessageContent = part("content", "chat-message-content");
/** Row of message actions. */
const ChatMessageActionsRow = part("actions", "chat-message-actions-row");
/** Small muted line (time, model, status) — Rivet extra. */
const ChatMessageMeta = part("meta", "chat-message-meta");

export {
  ChatMessageAssistant,
  ChatMessageUser,
  ChatMessageAvatar,
  ChatMessageBody,
  ChatMessageBubble,
  ChatMessageContent,
  ChatMessageActionsRow,
  ChatMessageMeta,
};
export type { ChatMessageRootProps, ChatMessageAvatarProps, DivProps as ChatMessagePartProps };
