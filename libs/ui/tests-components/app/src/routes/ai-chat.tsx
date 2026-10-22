// AI chat components on a resumed page (`/ai-chat`; Rivet additions, feature sets inspired by HeroUI Pro's public AI docs):
// `#conv` ChatConversation with a user turn + an assistant turn (ChainOfThought `#cot`, ChatTool `#tool`, Markdown, sources,
// message actions `#copy`, `#cites` = two inline sources in one paragraph), `#suggest` PromptSuggestion pills, `#composer` PromptInput (`#prompt` textarea, `#send`). Submitting
// streams a fake reply from a local timer (`simulateStream`, no network) into `#live` Markdown; `#status` mirrors the run state.
import { simulateStream } from "@rivetjs/cdk/chat";
import { For, Show } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { ChainOfThought } from "@rivetjs/ui/chain-of-thought";
import { ChatConversation } from "@rivetjs/ui/chat-conversation";
import { ChatMessage } from "@rivetjs/ui/chat-message";
import { ChatMessageActions } from "@rivetjs/ui/chat-message-actions";
import { ChatSource, ChatSources } from "@rivetjs/ui/chat-source";
import { ChatTool } from "@rivetjs/ui/chat-tool";
import { Markdown } from "@rivetjs/ui/markdown";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import type { PromptInputStatus } from "@rivetjs/ui/prompt-input";
import { PromptSuggestion } from "@rivetjs/ui/prompt-suggestion";

const FIRST =
  "Rivet resumes **server HTML** instead of re-rendering it.\n\n- No hydration pass\n- Handlers load on first use\n\n```ts\nconst count = signal(0);\n```";
const REPLY = "Sure. Here is the **short version**:\n\n1. The server streams HTML.\n2. The browser resumes on interaction.\n\nDone.";

interface Turn {
  id: number;
  role: "user" | "assistant";
  text: string;
}

export default function AiChat() {
  const turns = signal<Turn[]>([
    { id: 1, role: "user", text: "How does Rivet start a page?" },
    { id: 2, role: "assistant", text: FIRST },
  ]);
  const live = signal("");
  const status = signal<PromptInputStatus>("ready");
  const send = async (value: string) => {
    turns.set([...turns(), { id: turns().length + 1, role: "user", text: value }]);
    live.set("");
    status.set("streaming");
    for await (const chunk of simulateStream(REPLY, { interval: 15 })) {
      if (status() !== "streaming") break;
      live.set(live() + chunk);
    }
    turns.set([...turns(), { id: turns().length + 1, role: "assistant", text: live() }]);
    live.set("");
    status.set("ready");
  };
  return (
    <main class="mx-auto flex h-[100dvh] max-w-3xl flex-col gap-3 p-4">
      <output id="status">{status()}</output>
      <ChatConversation id="conv" class="min-h-0 flex-1" scrollButton isStreaming={() => status() === "streaming"}>
        <ChatConversation.Content>
          <For each={turns} by={(t: Turn) => t.id}>
            {(turn: () => Turn) =>
              turn().role === "user" ? (
                <ChatMessage.User data-turn={turn().id}>
                  <ChatMessage.Bubble>{turn().text}</ChatMessage.Bubble>
                </ChatMessage.User>
              ) : (
                <ChatMessage.Assistant data-turn={turn().id}>
                  <ChatMessage.Avatar fallback="AI" />
                  <ChatMessage.Body>
                    <Markdown content={turn().text} />
                  </ChatMessage.Body>
                </ChatMessage.Assistant>
              )
            }
          </For>
          <ChatMessage.Assistant>
            <ChatMessage.Avatar fallback="AI" />
            <ChatMessage.Body>
              <ChainOfThought id="cot">
                <ChainOfThought.Trigger>Thought for 2 seconds</ChainOfThought.Trigger>
                <ChainOfThought.Content>
                  <ChainOfThought.Steps>
                    <ChainOfThought.Step label="Read the docs" />
                    <ChainOfThought.Step label="Compare frameworks" />
                  </ChainOfThought.Steps>
                </ChainOfThought.Content>
              </ChainOfThought>
              <ChatTool id="tool" toolName="searchDocs" triggerPrefix="Used tool: " state="output-available" input={{ query: "resume" }} output={{ hits: 3 }} />
              <Markdown content="Resumability keeps **zero** startup work." />
              <p id="cites">
                See <ChatSource href="https://example.com/resume" title="Resume guide" description="How resumed pages start." /> and{" "}
                <ChatSource href="https://www.example.org/signals/" />.
              </p>
              <ChatSources>
                <ChatSources.Trigger>2 sources</ChatSources.Trigger>
                <ChatSources.Content>
                  <ChatSources.List>
                    <ChatSource href="https://example.com/resume" title="Resume guide" description="How resumed pages start." />
                    <ChatSource title="notes.pdf" />
                  </ChatSources.List>
                </ChatSources.Content>
              </ChatSources>
              <ChatMessage.Actions>
                <ChatMessageActions>
                  <ChatMessageActions.Copy id="copy" text="Resumability keeps zero startup work." />
                </ChatMessageActions>
              </ChatMessage.Actions>
            </ChatMessage.Body>
          </ChatMessage.Assistant>
          <Show when={() => status() === "streaming"}>
            <ChatMessage.Assistant id="live-turn">
              <ChatMessage.Avatar fallback="AI" />
              <ChatMessage.Body>
                <Markdown id="live" content={() => live()} isStreaming />
              </ChatMessage.Body>
            </ChatMessage.Assistant>
          </Show>
        </ChatConversation.Content>
        <ChatConversation.ScrollButton id="to-bottom" />
      </ChatConversation>
      <PromptSuggestion id="suggest">
        <PromptSuggestion.Items>
          <PromptSuggestion.Item onPress={() => void send("Explain resumability")}>Explain resumability</PromptSuggestion.Item>
        </PromptSuggestion.Items>
      </PromptSuggestion>
      <PromptInput id="composer" status={() => status()} onSubmit={(value) => void send(value)} onStop={() => status.set("ready")}>
        <PromptInput.Shell>
          <PromptInput.Content>
            <PromptInput.TextArea id="prompt" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send id="send" />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
    </main>
  );
}
