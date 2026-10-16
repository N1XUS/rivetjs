// Rivet-authored ChatMessage demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChatMessage } from "@rivetjs/ui/chat-message";
import { Markdown } from "@rivetjs/ui/markdown";

export const head = { title: "ChatMessage: With Markdown" };

// #region demo
const REPLY = `Here is a **two-day plan** for Annecy:

1. Day one: old town, canal walk, lunch by the lake.
2. Day two: rent a bike and ride the *voie verte* to Talloires.

Pack a light jacket: evenings by the water are cool.`;

export function WithMarkdown() {
  return (
    <div class="flex w-[30rem] flex-col gap-4">
      <ChatMessage.User>
        <ChatMessage.Bubble>Plan two days in Annecy.</ChatMessage.Bubble>
      </ChatMessage.User>
      <ChatMessage.Assistant>
        <ChatMessage.Avatar fallback="AI" />
        <ChatMessage.Body>
          <Markdown content={REPLY} />
        </ChatMessage.Body>
      </ChatMessage.Assistant>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithMarkdown />
    </div>
  );
}
