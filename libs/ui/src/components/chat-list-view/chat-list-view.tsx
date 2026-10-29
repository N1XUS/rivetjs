// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no chat list). Feature set inspired by commercial UI kits' public
// ChatListView docs (thread rows with Icon / ItemContent / Title / Preview / Meta, compact variant for dense sidebars);
// independent implementation, Rivet-authored styles.
// - Root = `div` (wrap it in a `nav` / landmark of your own); `variant` `"default"` (title + preview) / `"compact"` (one
//   line). `Item` = cdk Link with `href` (router-aware, `aria-current="page"` from `isCurrent`) or cdk Button without
//   (`aria-current="true"`); `isCurrent` = value or accessor (`data-current`). Pure markup + the items' own handlers.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps } from "@rivetjs/cdk/button";
import { Link as LinkPrimitive } from "@rivetjs/cdk/link";
import type { LinkProps as LinkPrimitiveProps } from "@rivetjs/cdk/link";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ChatListViewVariants } from "../../../styles/src/components/chat-list-view/index.ts";
import { chatListViewVariants } from "../../../styles/src/components/chat-list-view/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = chatListViewVariants();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

interface ChatListViewRootProps extends DivProps, ChatListViewVariants {}

const ChatListViewRoot = (props: ChatListViewRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "variant"]);
  const variant = local.variant ?? "default";
  return (
    <div class={chatListViewVariants({ variant }).base({ class: local.class })} data-slot="chat-list-view" data-variant={variant} {...rest}>
      {local.children}
    </div>
  );
};

interface ChatListViewItemExtras {
  /** The open thread (value or accessor): `aria-current` + `data-current`. */
  isCurrent?: boolean | (() => boolean);
  class?: string;
  children?: Content;
}

type ChatListViewItemProps = ChatListViewItemExtras &
  ((Omit<ButtonPrimitiveProps, "class" | "children"> & { href?: undefined }) | (Omit<LinkPrimitiveProps, "class" | "children"> & { href: string }));

const ChatListViewItem = (props: ChatListViewItemProps): JSX.Element => {
  const [local, rest] = splitLive(props as ChatListViewItemExtras & { href?: string }, ["isCurrent", "class", "children"]);
  const isCurrent = local.isCurrent;
  const href = rest.href;
  const currentValue = href === undefined ? "true" : "page";
  // In the body: the accessors close over component locals, so they resume.
  const current = typeof isCurrent === "function" ? () => (isCurrent() ? currentValue : undefined) : isCurrent ? currentValue : undefined;
  const dataCurrent = typeof isCurrent === "function" ? () => (isCurrent() ? "true" : undefined) : isCurrent ? "true" : undefined;
  const cls = composeSlotClassName(SLOTS.item, local.class) ?? "";
  const children = local.children;
  if (href === undefined)
    return (
      <ButtonPrimitive
        {...(rest as ButtonPrimitiveProps)}
        class={cls}
        data-slot="chat-list-view-item"
        aria-current={current as never}
        data-current={dataCurrent as never}
      >
        {children}
      </ButtonPrimitive>
    );
  return (
    <LinkPrimitive
      {...(rest as LinkPrimitiveProps)}
      class={cls}
      data-slot="chat-list-view-item"
      aria-current={current as never}
      data-current={dataCurrent as never}
    >
      {children}
    </LinkPrimitive>
  );
};

const part =
  (slot: "icon" | "itemContent" | "title" | "preview" | "meta" | "section", dataSlot: string) =>
  (props: DivProps): JSX.Element => {
    const [local, rest] = splitLive(props, ["children", "class"]);
    return (
      <span class={composeSlotClassName(SLOTS[slot], local.class)} data-slot={dataSlot} {...(rest as {})}>
        {local.children}
      </span>
    );
  };

const ChatListViewIcon = part("icon", "chat-list-view-icon");
const ChatListViewItemContent = part("itemContent", "chat-list-view-item-content");
const ChatListViewTitle = part("title", "chat-list-view-title");
const ChatListViewPreview = part("preview", "chat-list-view-preview");
const ChatListViewMeta = part("meta", "chat-list-view-meta");

/** Rivet extra: a group heading ("Today", "Last week"). */
const ChatListViewSection = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <div class={composeSlotClassName(SLOTS.section, local.class)} data-slot="chat-list-view-section" {...rest}>
      {local.children}
    </div>
  );
};

export {
  ChatListViewRoot,
  ChatListViewItem,
  ChatListViewIcon,
  ChatListViewItemContent,
  ChatListViewTitle,
  ChatListViewPreview,
  ChatListViewMeta,
  ChatListViewSection,
};
export type { ChatListViewRootProps, ChatListViewItemProps, DivProps as ChatListViewPartProps };
