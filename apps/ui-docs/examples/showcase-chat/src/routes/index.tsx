// Rivet-authored showcase (own content: an invented shop assistant with canned answers; no model is called).
import { simulateStream, streamText } from "@rivetjs/cdk/chat";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { ChatAttachment, ChatAttachmentGroup, ChatAttachmentInput } from "@rivetjs/ui/chat-attachment";
import { ChatConversation } from "@rivetjs/ui/chat-conversation";
import { ChatListView } from "@rivetjs/ui/chat-list-view";
import { ChatMessage } from "@rivetjs/ui/chat-message";
import { ChatMessageActions } from "@rivetjs/ui/chat-message-actions";
import { ChatSource } from "@rivetjs/ui/chat-source";
import { ChatTool } from "@rivetjs/ui/chat-tool";
import type { ChatToolState } from "@rivetjs/ui/chat-tool";
import { Chip } from "@rivetjs/ui/chip";
import { Markdown } from "@rivetjs/ui/markdown";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import type { PromptInputStatus } from "@rivetjs/ui/prompt-input";
import { PromptSuggestion } from "@rivetjs/ui/prompt-suggestion";
import { Sidebar } from "@rivetjs/ui/sidebar";
import { TextShimmer } from "@rivetjs/ui/text-shimmer";
import { MessageSquare, Plus, Sparkles, ThumbsDown, ThumbsUp } from "lucide";

export const head = { title: "Showcase: AI chat" };

// #region demo
type Attached = { id: number; name: string; size: number; type: string; src?: string };
type Tool = { name: string; input: unknown; output: unknown };
type Source = { title: string; description: string };
type Turn = {
  id: number;
  role: "user" | "assistant";
  /** Markdown for answers, plain text for questions. */
  text: string;
  files?: Attached[];
  tool?: Tool;
  sources?: Source[];
  /** The reply being streamed: its row stays and is finished in place. */
  live?: boolean;
};

const HISTORY = [
  {
    group: "Today",
    items: [
      { id: "c1", title: "Autumn newsletter ideas", when: "10:12" },
      { id: "c2", title: "Why did refunds go up?", when: "8:47" },
    ],
  },
  {
    group: "Earlier",
    items: [
      { id: "c3", title: "Lamp restock timing", when: "Yesterday" },
      { id: "c4", title: "Rewrite the returns page", when: "Mon" },
      { id: "c5", title: "Size guide for the runner", when: "Sep 30" },
    ],
  },
];

const SUGGESTIONS = ["Summarise last week's sales", "Draft a restock email", "Which products should I discount?"];

// Canned answers keyed by a word in the question (the showcase never calls a model).
const ANSWERS: { match: RegExp; text: string; tool?: Tool; sources?: Source[] }[] = [
  {
    match: /sales|summar|week/i,
    text: `Last week brought **214 orders and $11,940** in revenue, 6.1% more than the week before.

- The trail runner sold best (61 pairs), followed by the canvas tote (48).
- Friday was the strongest day at $2,010; Sunday the quietest at $1,490.
- Refunds rose to 1.4% of orders, mostly sizing returns on the runner.`,
    tool: { name: "salesReport", input: { range: "last_7_days" }, output: { orders: 214, revenue: 11940, change: "+6.1%", refundRate: "1.4%" } },
    sources: [{ title: "Shop dashboard", description: "Orders and revenue, last 7 days" }],
  },
  {
    match: /restock|email|supplier/i,
    text: `Here is a draft:

> Hi Ilse, thanks for getting the halo lamps through customs so quickly. Could you reserve another 40 units in warm grey for early November? We would like them in the warehouse before the gift guide goes out.
>
> Best, Theo`,
    sources: [{ title: "Suppliers", description: "Harbourlight: Ilse Varga, lead time 3 weeks" }],
  },
  {
    match: /discount|sale|price/i,
    text: `Two candidates: the **speckled mug and the knit beanie**. Both have more than 90 days of stock at the current pace and sell mostly when they are featured.

A 15% bundle with the tote would clear stock without discounting the runner, which sells well at full price.`,
    tool: {
      name: "stockCover",
      input: { minDays: 90 },
      output: [
        { product: "Speckled mug", days: 118 },
        { product: "Knit beanie", days: 96 },
      ],
    },
    sources: [
      { title: "Inventory", description: "Stock levels, updated 9:40" },
      { title: "Sales, 90 days", description: "Units sold per product" },
    ],
  },
];
const FALLBACK = "I can only answer from the shop's own numbers here. Try asking about *sales*, *restocking* or *discounts*.";
const FILES_NOTE = "This demo cannot open files, so I left the attachments unread. ";

export default function ChatShowcase() {
  const turns = signal<Turn[]>([
    { id: 1, role: "user", text: "How many lamps do we have left?" },
    {
      id: 2,
      role: "assistant",
      text: "**12 halo lamps** are in stock. At the current pace that lasts about 9 days; the 40 units from Harbourlight arrive on Monday.",
      tool: { name: "inventory", input: { sku: "halo-lamp" }, output: { inStock: 12, perDay: 1.3, incoming: { units: 40, from: "Harbourlight", eta: "Mon" } } },
      sources: [{ title: "Inventory", description: "Stock levels, updated 9:40" }],
    },
  ]);
  const live = signal("");
  const status = signal<PromptInputStatus>("ready");
  const controller = signal<AbortController | undefined>(undefined);
  const files = signal<Attached[]>([]);
  const liked = signal<Record<number, "up" | "down">>({});
  const active = signal("c3");

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || status() !== "ready") return;
    const attached = files();
    const id = turns().length ? turns()[turns().length - 1].id + 1 : 1;
    const hit = ANSWERS.find((a) => a.match.test(text));
    turns.set([
      ...turns(),
      { id, role: "user", text, files: attached.length ? attached : undefined },
      { id: id + 1, role: "assistant", text: "", tool: hit?.tool, sources: hit?.sources, live: true },
    ]);
    files.set([]);
    live.set("");
    status.set("submitted");
    const abort = new AbortController();
    controller.set(abort);
    const answer = (attached.length ? FILES_NOTE : "") + (hit?.text ?? FALLBACK);
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (!abort.signal.aborted) {
      status.set("streaming");
      await streamText(live, simulateStream(answer, { interval: 40, wordsPerChunk: 2, jitter: 0.6, signal: abort.signal }), { signal: abort.signal });
    }
    turns.set(turns().map((turn) => (turn.id === id + 1 ? { ...turn, text: live() || "Stopped.", live: false } : turn)));
    status.set("ready");
  };

  return (
    // A card-sized app shell: `contained` keeps the sidebar inside the bordered box (not the viewport) on the box's surface.
    <Sidebar.Provider contained class="mx-auto h-[760px] max-w-6xl rounded-2xl border border-separator bg-surface text-sm">
      {/* History: drag the edge to resize (below half the minimum it collapses; double-click resets); a sheet below 768 px */}
      <Sidebar id="chat-history" role="navigation" aria-label="Conversations" resizable minWidth="13rem" maxWidth="24rem">
        <Sidebar.Header class="p-3 pb-0">
          <Button
            id="new-chat"
            variant="secondary"
            class="self-start"
            onPress={() => {
              controller()?.abort();
              for (const turn of turns()) for (const file of turn.files ?? []) if (file.src) URL.revokeObjectURL(file.src);
              turns.set([]);
              active.set("");
            }}
          >
            <Icon icon={Plus} size={16} />
            New chat
          </Button>
        </Sidebar.Header>
        <Sidebar.Content class="p-3">
          <ChatListView aria-label="Recent chats" variant="compact">
            {HISTORY.map((section) => [
              <ChatListView.Section>{section.group}</ChatListView.Section>,
              section.items.map((c) => (
                <ChatListView.Item isCurrent={() => active() === c.id} onPress={() => active.set(c.id)}>
                  <ChatListView.Icon>
                    <Icon icon={MessageSquare} size={16} />
                  </ChatListView.Icon>
                  <ChatListView.ItemContent>
                    <ChatListView.Title>{c.title}</ChatListView.Title>
                  </ChatListView.ItemContent>
                  <ChatListView.Meta>{c.when}</ChatListView.Meta>
                </ChatListView.Item>
              )),
            ])}
          </ChatListView>
        </Sidebar.Content>
      </Sidebar>

      <section aria-label="Chat" class="flex min-w-0 flex-1 flex-col">
        <header class="flex items-center gap-3 border-b border-separator px-4 py-3">
          <Sidebar.Trigger id="history-toggle" aria-label="Toggle conversations" class="-ms-1" />
          <span class="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Icon icon={Sparkles} size={16} />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="truncate font-semibold">Shop assistant</h2>
            <p class="truncate text-xs text-muted">Answers from your orders, stock and suppliers</p>
          </div>
          <Chip size="sm" variant="soft" color="success">
            Online
          </Chip>
        </header>

        <ChatConversation id="chat-log" class="min-h-0 flex-1" scrollButton isStreaming={() => status() !== "ready"}>
          <ChatConversation.Content class="px-4 py-6">
            {turns().length === 0 ? (
              <div class="m-auto flex max-w-sm flex-col items-center gap-2 py-24 text-center text-muted">
                <Icon icon={Sparkles} size={28} />
                <p class="text-base font-medium text-foreground">What would you like to know?</p>
                <p>Ask about sales, stock, suppliers or customers.</p>
              </div>
            ) : null}
            <For each={turns} by={(turn: Turn) => turn.id}>
              {(turn: () => Turn) =>
                turn().role === "user" ? (
                  <ChatMessage.User>
                    {turn().files ? (
                      <ChatAttachmentGroup class="justify-end">
                        {turn().files!.map((file) => (
                          <ChatAttachment name={file.name} size={file.size} mimeType={file.type} src={file.src} />
                        ))}
                      </ChatAttachmentGroup>
                    ) : null}
                    <ChatMessage.Bubble class="bg-accent text-accent-foreground">{turn().text}</ChatMessage.Bubble>
                  </ChatMessage.User>
                ) : (
                  <ChatMessage.Assistant isStreaming={() => turn().live === true}>
                    <ChatMessage.Avatar fallback={<Icon icon={Sparkles} size={14} />} />
                    <ChatMessage.Body>
                      {/* The tool call runs while the answer is pending, then completes (state read once: keyed Show). */}
                      <Show
                        keyed
                        when={turn().tool ? ((turn().live && status() === "submitted" ? "input-available" : "output-available") as ChatToolState) : undefined}
                      >
                        {(state) => (
                          <ChatTool
                            toolName={turn().tool!.name}
                            triggerPrefix={state() === "input-available" ? "Checking " : "Checked "}
                            state={state()}
                            input={turn().tool!.input}
                            output={turn().tool!.output}
                          />
                        )}
                      </Show>
                      <Show when={() => turn().live === true && status() === "submitted"}>
                        <TextShimmer class="text-muted">Looking at your shop data…</TextShimmer>
                      </Show>
                      <Markdown content={() => (turn().live ? live() : turn().text)} isStreaming={() => turn().live === true} />
                      <ChatMessage.Actions>
                        <ChatMessageActions aria-label="Answer actions">
                          <ChatMessageActions.Copy aria-label="Copy answer" text={() => turn().text} />
                          <ChatMessageActions.Action
                            aria-label="Good answer"
                            aria-pressed={() => (liked()[turn().id] === "up" ? "true" : "false")}
                            onPress={() => liked.set({ ...liked(), [turn().id]: "up" })}
                          >
                            <Icon icon={ThumbsUp} size={16} class={liked()[turn().id] === "up" ? "text-accent" : ""} />
                          </ChatMessageActions.Action>
                          <ChatMessageActions.Action
                            aria-label="Bad answer"
                            aria-pressed={() => (liked()[turn().id] === "down" ? "true" : "false")}
                            onPress={() => liked.set({ ...liked(), [turn().id]: "down" })}
                          >
                            <Icon icon={ThumbsDown} size={16} class={liked()[turn().id] === "down" ? "text-danger" : ""} />
                          </ChatMessageActions.Action>
                        </ChatMessageActions>
                        {turn().sources ? (
                          <span class="ms-auto flex flex-wrap items-center gap-1.5">
                            {turn().sources!.map((source) => (
                              <ChatSource title={source.title} description={source.description} />
                            ))}
                          </span>
                        ) : null}
                      </ChatMessage.Actions>
                    </ChatMessage.Body>
                  </ChatMessage.Assistant>
                )
              }
            </For>
          </ChatConversation.Content>
          <ChatConversation.ScrollButton />
        </ChatConversation>

        <div class="flex flex-col gap-3 border-t border-separator p-3">
          <PromptSuggestion>
            {/* One scrolling row; padding cancelled by negative margin so the pills' focus ring is not clipped by the scroller. */}
            <PromptSuggestion.Items class="-m-1 flex-nowrap scroll-px-1 overflow-x-auto p-1">
              {SUGGESTIONS.map((s, i) => (
                <PromptSuggestion.Item id={`suggest-${i}`} class="shrink-0" onPress={() => void send(s)}>
                  {s}
                </PromptSuggestion.Item>
              ))}
            </PromptSuggestion.Items>
          </PromptSuggestion>
          <PromptInput status={() => status()} onSubmit={(value) => void send(value)} onStop={() => controller()?.abort()}>
            <ChatAttachmentInput
              onFilesSelected={(picked) =>
                files.set([
                  ...files(),
                  ...picked.map((file, index) => ({
                    id: Date.now() + index,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    src: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
                  })),
                ])
              }
            >
              <ChatAttachmentInput.Dropzone
                render={(attrs) => (
                  <PromptInput.Shell {...attrs}>
                    <PromptInput.Attachments>
                      <For each={files} by={(file: Attached) => file.id}>
                        {(file: () => Attached) => (
                          <ChatAttachment
                            name={file().name}
                            size={file().size}
                            mimeType={file().type}
                            src={file().src}
                            onRemove={() => {
                              const src = file().src;
                              if (src) URL.revokeObjectURL(src);
                              files.set(files().filter((f) => f.id !== file().id));
                            }}
                          />
                        )}
                      </For>
                    </PromptInput.Attachments>
                    <PromptInput.Content>
                      <PromptInput.TextArea id="chat-input" aria-label="Message" placeholder="Ask about your shop" />
                    </PromptInput.Content>
                    <PromptInput.Toolbar>
                      <PromptInput.ToolbarStart>
                        <ChatAttachmentInput.Trigger />
                      </PromptInput.ToolbarStart>
                      <PromptInput.ToolbarEnd>
                        <PromptInput.Send id="chat-send" />
                      </PromptInput.ToolbarEnd>
                    </PromptInput.Toolbar>
                  </PromptInput.Shell>
                )}
              />
            </ChatAttachmentInput>
            <PromptInput.Footer>Sample answers from an invented shop. Check numbers before you act on them.</PromptInput.Footer>
          </PromptInput>
        </div>
      </section>
    </Sidebar.Provider>
  );
}
// #endregion
