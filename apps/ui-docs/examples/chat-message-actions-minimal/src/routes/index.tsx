// Rivet-authored ChatMessageActions demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ChatMessageActions } from "@rivetjs/ui/chat-message-actions";
import { RotateCcw } from "lucide";

export const head = { title: "ChatMessageActions: Minimal" };

// #region demo
export function Minimal() {
  return (
    <ChatMessageActions>
      <ChatMessageActions.Copy text="Short answer: yes." />
      <ChatMessageActions.Action aria-label="Regenerate">
        <Icon icon={RotateCcw} size={16} />
      </ChatMessageActions.Action>
    </ChatMessageActions>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Minimal />
    </div>
  );
}
