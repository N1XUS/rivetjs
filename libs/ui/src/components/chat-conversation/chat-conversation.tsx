// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no conversation view). Feature set inspired by commercial UI kits' public
// ChatConversation docs (scrollable root viewport that sticks to the bottom while a response streams, centred `Content`
// column, `ScrollButton` shown only away from the bottom, `ScrollAnchor`); independent implementation, Rivet-authored
// styles.
// - Stick-to-bottom is CSS: the root scrolls with `flex-direction: column-reverse` (the browser opens it at the bottom and
//   keeps it there while content grows; nothing runs at load or per token). A single inner stack keeps document order.
// - `data-at-bottom` is server-rendered `"true"`; with `scrollButton` the root's `scroll` handler (`@rivetjs/cdk/chat`
//   `syncAtBottom`) updates it, and CSS shows the `ScrollButton` only without it. The button scrolls the root to the end
//   (`scrollToBottom`). Without `scrollButton` the root has no handler at all: a conversation without the button is static
//   markup (no resume region, no loader, no runtime boot — 2026-10-22: a static demo booted ~80 KB for this one handler).
// - Root = `role="log"` (accessible name `aria-label`, default "Conversation"), focusable for keyboard scrolling;
//   `isStreaming` (value or accessor) sets `aria-busy` so screen readers wait for the finished message.
import { conversationViewportOf, scrollToBottom, syncAtBottom } from "@rivetjs/cdk/chat";
import { Icon } from "@rivetjs/kit/icon";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { ArrowDown } from "lucide";

import { chatConversationVariants } from "../../../styles/src/components/chat-conversation/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { ButtonRoot } from "../button/button.tsx";
import type { ButtonRootProps } from "../button/button.tsx";

const SLOTS = chatConversationVariants();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

interface ChatConversationRootProps extends DivProps {
  /** @default "Conversation" */
  "aria-label"?: string;
  /** A response is streaming (`aria-busy`). Value or accessor. */
  isStreaming?: boolean | (() => boolean);
  /**
   * The conversation renders a `ScrollButton`: the root tracks `data-at-bottom` on scroll (the button's visibility).
   * Off (default), the root has no scroll handler and a static conversation ships no JS.
   */
  scrollButton?: boolean;
}

const ChatConversationRoot = (props: ChatConversationRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label", "isStreaming", "scrollButton"]);
  const busy = (): "true" | undefined => {
    const value = local.isStreaming;
    return (typeof value === "function" ? value() : value) === true ? "true" : undefined;
  };
  return (
    <div
      class={composeSlotClassName(SLOTS.base, local.class)}
      role="log"
      aria-label={local["aria-label"] ?? "Conversation"}
      aria-busy={busy}
      tabIndex={0}
      data-chat-viewport=""
      data-at-bottom="true"
      data-slot="chat-conversation"
      onScroll={local.scrollButton ? (event: Event) => syncAtBottom(event.currentTarget as Element) : undefined}
      {...rest}
    >
      <div class={SLOTS.stack()}>{local.children}</div>
    </div>
  );
};

const ChatConversationContent = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.content, local.class)} data-slot="chat-conversation-content" {...rest}>
      {local.children}
    </div>
  );
};

const ChatConversationScrollAnchor = (props: Omit<DivProps, "children">): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return <div class={composeSlotClassName(SLOTS.scrollAnchor, local.class)} aria-hidden="true" data-slot="chat-conversation-scroll-anchor" {...rest} />;
};

interface ChatConversationScrollButtonProps extends Omit<ButtonRootProps, "onPress"> {
  /** @default "Scroll to bottom" */
  "aria-label"?: string;
  /** Scroll animation. @default "smooth" */
  behavior?: ScrollBehavior;
}

const ChatConversationScrollButton = (props: ChatConversationScrollButtonProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label", "behavior", "variant", "size", "isIconOnly"]);
  const behavior = local.behavior ?? "smooth";
  return (
    <div class={SLOTS.scrollButtonContainer()} data-slot="chat-conversation-scroll-button-container">
      <ButtonRoot
        variant={local.variant ?? "secondary"}
        size={local.size ?? "sm"}
        isIconOnly={local.isIconOnly ?? true}
        class={composeSlotClassName(SLOTS.scrollButton, typeof local.class === "string" ? local.class : undefined)}
        aria-label={local["aria-label"] ?? "Scroll to bottom"}
        data-slot="chat-conversation-scroll-button"
        onPress={(event: { target: EventTarget | null }) => {
          const viewport = conversationViewportOf(event.target as Element | null);
          if (viewport) scrollToBottom(viewport, behavior);
        }}
        {...rest}
      >
        {local.children ?? <Icon icon={ArrowDown} size={16} aria-hidden="true" />}
      </ButtonRoot>
    </div>
  );
};

export { ChatConversationRoot, ChatConversationContent, ChatConversationScrollAnchor, ChatConversationScrollButton };
export type { ChatConversationRootProps, DivProps as ChatConversationContentProps, ChatConversationScrollButtonProps };
