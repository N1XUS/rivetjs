// Rivet-authored ChatMessageActions demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ChatMessageActions } from "@rivetjs/ui/chat-message-actions";
import { Bookmark, Flag, Languages, Volume2 } from "lucide";

export const head = { title: "ChatMessageActions: Custom Icons" };

// #region demo
export function CustomIcons() {
  return (
    <ChatMessageActions aria-label="Answer tools">
      <ChatMessageActions.Action aria-label="Read aloud">
        <Icon icon={Volume2} size={16} />
      </ChatMessageActions.Action>
      <ChatMessageActions.Action aria-label="Translate">
        <Icon icon={Languages} size={16} />
      </ChatMessageActions.Action>
      <ChatMessageActions.Action aria-label="Save">
        <Icon icon={Bookmark} size={16} />
      </ChatMessageActions.Action>
      <ChatMessageActions.Action aria-label="Report">
        <Icon icon={Flag} size={16} />
      </ChatMessageActions.Action>
    </ChatMessageActions>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIcons />
    </div>
  );
}
