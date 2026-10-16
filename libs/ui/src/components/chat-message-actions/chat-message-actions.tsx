// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no message actions). Feature set inspired by HeroUI Pro's public
// ChatMessageActions docs (root action group + `Action` icon buttons for copy / retry / rating / share, own icons);
// independent implementation, Rivet-authored styles.
// - Root = `role="group"` named by `aria-label` (default "Message actions"). `Action` = ui Button (ghost, sm, icon-only
//   defaults; give it an `aria-label`). Rivet extra `Copy`: copies `text` with `@rivetjs/cdk/clipboard` `copy` and shows a
//   check for 2 s (`data-copied` on the button, icons swapped by CSS: no signal, nothing runs before the press); its
//   accessible name switches to `copiedLabel` while copied. `aria-pressed` toggles (thumbs up / down) are plain
//   `Action`s with `aria-pressed`. Copy behaviour: `../../utils/copy-feedback.tsx`.
import { Icon } from "@rivetjs/kit/icon";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { Check, Copy } from "lucide";

import { chatMessageActionsVariants } from "../../../styles/src/components/chat-message-actions/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { copyWithFeedback } from "../../utils/copy-feedback.tsx";
import { splitLive } from "../../utils/live.tsx";
import { ButtonRoot } from "../button/button.tsx";
import type { ButtonRootProps } from "../button/button.tsx";

const SLOTS = chatMessageActionsVariants();

interface ChatMessageActionsRootProps extends Omit<JSX.IntrinsicElements["div"], "class" | "children"> {
  /** @default "Message actions" */
  "aria-label"?: string;
  class?: string;
  children?: Content;
}

const ChatMessageActionsRoot = (props: ChatMessageActionsRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label"]);
  return (
    <div
      class={composeSlotClassName(SLOTS.base, local.class)}
      role="group"
      aria-label={local["aria-label"] ?? "Message actions"}
      data-slot="chat-message-actions"
      {...rest}
    >
      {local.children}
    </div>
  );
};

type ChatMessageActionProps = ButtonRootProps;

const ChatMessageAction = (props: ChatMessageActionProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "variant", "size", "isIconOnly"]);
  const cls = composeSlotClassName(SLOTS.action, typeof local.class === "string" ? local.class : undefined);
  return (
    <ButtonRoot
      variant={local.variant ?? "ghost"}
      size={local.size ?? "sm"}
      isIconOnly={local.isIconOnly ?? true}
      class={cls}
      data-slot="chat-message-action"
      {...rest}
    />
  );
};

interface ChatMessageCopyProps extends Omit<ChatMessageActionProps, "children" | "onPress"> {
  /** Text written to the clipboard. */
  text: string | (() => string);
  /** @default "Copy" */
  "aria-label"?: string;
  /** Accessible name while the check shows. @default "Copied" */
  copiedLabel?: string;
  /** Called after the copy with whether the clipboard accepted it. */
  onCopy?: (copied: boolean) => void;
  /** Icon size (px). @default 16 */
  iconSize?: number;
}

const ChatMessageCopy = (props: ChatMessageCopyProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["text", "aria-label", "copiedLabel", "onCopy", "iconSize"]);
  const label = local["aria-label"] ?? "Copy";
  const copiedLabel = local.copiedLabel ?? "Copied";
  const onCopy = local.onCopy;
  const text = local.text;
  const size = local.iconSize ?? 16;
  return (
    <ChatMessageAction
      aria-label={label}
      data-copy-button=""
      onPress={(event: { target: EventTarget | null }) =>
        copyWithFeedback(event.target, typeof text === "function" ? text() : text, { label, copiedLabel }, onCopy)
      }
      {...rest}
    >
      <Icon icon={Copy} size={size} class={SLOTS.copyIcon()} aria-hidden="true" />
      <Icon icon={Check} size={size} class={SLOTS.copiedIcon()} aria-hidden="true" />
    </ChatMessageAction>
  );
};

export { ChatMessageActionsRoot, ChatMessageAction, ChatMessageCopy };
export type { ChatMessageActionsRootProps, ChatMessageActionProps, ChatMessageCopyProps };
