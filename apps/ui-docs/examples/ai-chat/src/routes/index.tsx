// Rivet-authored ChatConversation demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { simulateStream, streamText } from "@rivetjs/cdk/chat";
import { signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import { ChatConversation } from "@rivetjs/ui/chat-conversation";
import { ChatMessage } from "@rivetjs/ui/chat-message";
import { ChatMessageActions } from "@rivetjs/ui/chat-message-actions";
import { Markdown } from "@rivetjs/ui/markdown";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import type { PromptInputStatus } from "@rivetjs/ui/prompt-input";
import { PromptSuggestion } from "@rivetjs/ui/prompt-suggestion";
import { TextShimmer } from "@rivetjs/ui/text-shimmer";

export const head = { title: "AI chat" };

// #region demo
interface Turn {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** The reply being streamed: its node stays and is updated in place when the stream ends. */
  live?: boolean;
}

// Canned answers: the demo never calls a model. Words arrive from a local timer (`simulateStream`).
const ANSWERS: Record<string, string> = {
  resume: `Rivet pages **resume** instead of hydrating:

1. The server streams finished HTML.
2. The first interaction loads only the handler it needs.

\`\`\`tsx
<button onClick={() => count.set(count() + 1)}>{count()}</button>
\`\`\``,
  signals: "Signals hold state; every binding that reads one updates **in place** when it changes. No virtual DOM, no diffing.",
};
const FALLBACK = "Good question. Try asking about *resume* or *signals*: those are the two answers this demo knows.";

export function AiChat() {
  const turns = signal<Turn[]>([
    { id: 1, role: "user", text: "What is Rivet?" },
    { id: 2, role: "assistant", text: "A compiled JSX framework with **resumable** pages and fine-grained **signals**." },
  ]);
  const live = signal("");
  const status = signal<PromptInputStatus>("ready");
  const controller = signal<AbortController | undefined>(undefined);
  const ask = async (question: string) => {
    if (!question.trim() || status() !== "ready") return;
    const id = turns().length;
    const reply = id + 2;
    turns.set([...turns(), { id: id + 1, role: "user", text: question }, { id: reply, role: "assistant", text: "", live: true }]);
    live.set("");
    status.set("submitted");
    const abort = new AbortController();
    controller.set(abort);
    const key = /resum|hydrat/i.test(question) ? "resume" : /signal|state/i.test(question) ? "signals" : "";
    const answer = ANSWERS[key] ?? FALLBACK;
    await new Promise((resolve) => setTimeout(resolve, 700));
    status.set("streaming");
    // Natural cadence: bursts of one to a few words, uneven delays, a longer pause after a sentence.
    await streamText(live, simulateStream(answer, { interval: 45, wordsPerChunk: 2, jitter: 0.7, signal: abort.signal }), { signal: abort.signal });
    turns.set(turns().map((turn) => (turn.id === reply ? { ...turn, text: live(), live: false } : turn)));
    status.set("ready");
  };
  return (
    <div class="flex h-[34rem] w-full max-w-2xl flex-col gap-3">
      <ChatConversation id="ai-thread" class="min-h-0 flex-1" scrollButton isStreaming={() => status() !== "ready"}>
        <ChatConversation.Content>
          <For each={turns} by={(turn: Turn) => turn.id}>
            {(turn: () => Turn) =>
              turn().role === "user" ? (
                <ChatMessage.User>
                  <ChatMessage.Bubble>{turn().text}</ChatMessage.Bubble>
                </ChatMessage.User>
              ) : (
                <ChatMessage.Assistant isStreaming={() => turn().live === true}>
                  <ChatMessage.Avatar fallback="AI" />
                  <ChatMessage.Body>
                    <Show when={() => turn().live === true && status() === "submitted"}>
                      <TextShimmer class="text-sm text-muted">Thinking…</TextShimmer>
                    </Show>
                    <Markdown content={() => (turn().live ? live() : turn().text)} isStreaming={() => turn().live === true} />
                    <ChatMessage.Actions>
                      <ChatMessageActions>
                        <ChatMessageActions.Copy text={() => turn().text} />
                      </ChatMessageActions>
                    </ChatMessage.Actions>
                  </ChatMessage.Body>
                </ChatMessage.Assistant>
              )
            }
          </For>
        </ChatConversation.Content>
        <ChatConversation.ScrollButton />
      </ChatConversation>
      <PromptSuggestion>
        <PromptSuggestion.Items>
          <PromptSuggestion.Item id="ask-resume" onPress={() => void ask("How does a page resume?")}>
            How does a page resume?
          </PromptSuggestion.Item>
          <PromptSuggestion.Item onPress={() => void ask("What are signals?")}>What are signals?</PromptSuggestion.Item>
        </PromptSuggestion.Items>
      </PromptSuggestion>
      <PromptInput status={() => status()} onSubmit={(value) => void ask(value)} onStop={() => controller()?.abort()}>
        <PromptInput.Shell>
          <PromptInput.Content>
            <PromptInput.TextArea id="ai-prompt" placeholder="Ask about Rivet" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send id="ai-send" />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
        <PromptInput.Footer>Demo answers come from a local timer. No network calls.</PromptInput.Footer>
      </PromptInput>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <div class="w-full">
        <AiChat />
      </div>
    </div>
  );
}
