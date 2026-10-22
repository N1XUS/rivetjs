// Rivet-authored ChatConversation demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChatConversation } from "@rivetjs/ui/chat-conversation";
import { ChatMessage } from "@rivetjs/ui/chat-message";

export const head = { title: "ChatConversation: Scroll Button" };

// #region demo
const TURNS = Array.from({ length: 12 }, (_, i) =>
  i % 2 === 0
    ? { role: "user", text: `Question ${i / 2 + 1}: what is step ${i / 2 + 1}?` }
    : { role: "assistant", text: `Step ${(i + 1) / 2} is explained here in a few sentences, long enough to wrap onto a second line.` },
);

export function ScrollButtonDemo() {
  return (
    <ChatConversation id="long-thread" scrollButton class="h-72 w-[28rem] rounded-xl border border-separator">
      <ChatConversation.Content>
        {TURNS.map((turn) =>
          turn.role === "user" ? (
            <ChatMessage.User>
              <ChatMessage.Bubble>{turn.text}</ChatMessage.Bubble>
            </ChatMessage.User>
          ) : (
            <ChatMessage.Assistant>
              <ChatMessage.Avatar fallback="AI" />
              <ChatMessage.Body>
                <ChatMessage.Content>{turn.text}</ChatMessage.Content>
              </ChatMessage.Body>
            </ChatMessage.Assistant>
          ),
        )}
      </ChatConversation.Content>
      <ChatConversation.ScrollButton />
    </ChatConversation>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ScrollButtonDemo />
    </div>
  );
}
