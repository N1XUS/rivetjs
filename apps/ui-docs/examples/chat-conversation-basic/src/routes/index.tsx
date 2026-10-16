// Rivet-authored ChatConversation demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChatConversation } from "@rivetjs/ui/chat-conversation";
import { ChatMessage } from "@rivetjs/ui/chat-message";

export const head = { title: "ChatConversation: Usage" };

// #region demo
const TURNS = [
  { role: "user", text: "What should I cook tonight?" },
  { role: "assistant", text: "What do you have in the fridge?" },
  { role: "user", text: "Eggs, spinach, feta and half a lemon." },
  { role: "assistant", text: "A spinach and feta omelette with lemon zest: ten minutes, one pan." },
];

export function Basic() {
  return (
    <ChatConversation class="h-72 w-[28rem] rounded-xl border border-separator">
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
    </ChatConversation>
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
