// Rivet-authored ChatMessageActions demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ChatMessageActions } from "@rivetjs/ui/chat-message-actions";
import { RotateCcw, Share2, ThumbsDown, ThumbsUp } from "lucide";

export const head = { title: "ChatMessageActions: Usage" };

// #region demo
const ANSWER = "The library opens at 9:00 on weekdays and 10:00 on Saturdays.";

export function Basic() {
  const feedback = signal("");
  return (
    <div class="flex w-96 flex-col gap-2">
      <p class="text-sm">{ANSWER}</p>
      <ChatMessageActions>
        <ChatMessageActions.Copy text={ANSWER} />
        <ChatMessageActions.Action aria-label="Regenerate" onPress={() => feedback.set("Regenerating…")}>
          <Icon icon={RotateCcw} size={16} />
        </ChatMessageActions.Action>
        <ChatMessageActions.Action aria-label="Good response" onPress={() => feedback.set("Thanks for the feedback.")}>
          <Icon icon={ThumbsUp} size={16} />
        </ChatMessageActions.Action>
        <ChatMessageActions.Action aria-label="Bad response" onPress={() => feedback.set("Sorry about that. We will do better.")}>
          <Icon icon={ThumbsDown} size={16} />
        </ChatMessageActions.Action>
        <ChatMessageActions.Action aria-label="Share" onPress={() => feedback.set("Link ready to share.")}>
          <Icon icon={Share2} size={16} />
        </ChatMessageActions.Action>
      </ChatMessageActions>
      <p id="feedback" class="min-h-5 text-xs text-muted" aria-live="polite">
        {feedback()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
