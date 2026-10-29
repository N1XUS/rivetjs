// Rivet-authored ChatMessage demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ChatMessage } from "@rivetjs/ui/chat-message";
import { ChatMessageActions } from "@rivetjs/ui/chat-message-actions";

export const head = { title: "ChatMessage: Usage" };

// #region demo
const ANSWER = "How about “Crumb & Co.”? It is short, easy to say, and leaves room for coffee later.";

export function Basic() {
  return (
    <div class="flex w-[28rem] flex-col gap-4">
      <ChatMessage.User>
        <ChatMessage.Bubble>Can you suggest a name for my bakery?</ChatMessage.Bubble>
      </ChatMessage.User>
      <ChatMessage.Assistant>
        <ChatMessage.Avatar fallback="AI" />
        <ChatMessage.Body>
          <ChatMessage.Content>{ANSWER}</ChatMessage.Content>
          <ChatMessage.Actions>
            <ChatMessageActions>
              <ChatMessageActions.Copy text={ANSWER} />
            </ChatMessageActions>
          </ChatMessage.Actions>
        </ChatMessage.Body>
      </ChatMessage.Assistant>
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
