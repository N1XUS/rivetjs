// Rivet-authored showcase (own content: an invented shop assistant with canned answers; no model is called).
import { simulateStream, streamText } from "@rivetjs/cdk/chat";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { AppLayout } from "@rivetjs/ui/app-layout";
import { Card } from "@rivetjs/ui/card";
import { Disclosure } from "@rivetjs/ui/disclosure";
import { Meter } from "@rivetjs/ui/meter";
import { Switch } from "@rivetjs/ui/switch";
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
import { Status } from "@rivetjs/ui/status";
import { TextShimmer } from "@rivetjs/ui/text-shimmer";
import {
  Bot,
  CheckCheck,
  FileCode,
  FileImage,
  FileText,
  Folder,
  GitBranch,
  GitPullRequest,
  Globe,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Square,
  Terminal,
  ThumbsDown,
  ThumbsUp,
} from "lucide";

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

function DetailCard(props: { title: string; section: string; children?: Content }) {
  return (
    <Card class="rounded-2xl border border-separator p-3 shadow-none">
      <Disclosure defaultExpanded data-detail={props.section}>
        <Disclosure.Heading>
          <Disclosure.Trigger class="flex w-full items-center gap-2 py-1 text-left text-sm font-medium">
            {props.title}
            <Disclosure.Indicator class="data-[expanded=true]:rotate-0 data-[expanded=true]:-scale-y-100" />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <div class="flex flex-col gap-2 pt-2 text-sm">{props.children}</div>
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}

function ChatDetails() {
  const webSearch = signal(true);
  const settings = signal(false);
  const more = signal(false);
  const draft = signal(false);
  const inventoryRunning = signal(true);
  const sourcesRunning = signal(true);
  return (
    <div class="flex flex-col gap-3 lg:p-3">
      <AppLayout.MobileAside>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">Chat details</h2>
          <AppLayout.AsideTrigger aria-label="Close chat details" />
        </div>
      </AppLayout.MobileAside>
      <DetailCard title="Environment" section="environment">
        <div class="flex items-center gap-2">
          <Icon icon={Bot} size={16} class="shrink-0 text-muted" />
          <span class="flex-1">Rivet assistant</span>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label="Model settings"
            aria-expanded={() => (settings() ? "true" : "false")}
            onPress={() => settings.set(!settings())}
          >
            <Icon icon={Settings} size={16} />
          </Button>
        </div>
        <Show when={settings}>
          <p class="text-xs text-muted">Balanced model · Sample responses</p>
        </Show>
        <div class="flex min-w-0 items-center gap-2">
          <Icon icon={Folder} size={16} class="shrink-0 text-muted" />
          <span class="truncate">
            Northstar <span class="text-muted">· /shop</span>
          </span>
        </div>
        <div class="flex items-center gap-2">
          <Icon icon={GitBranch} size={16} class="text-muted" />
          <span>Autumn campaign</span>
        </div>
        <div class="flex items-center gap-2">
          <Icon icon={Globe} size={16} class="text-muted" />
          <span class="flex-1">Web search</span>
          <Switch size="sm" aria-label="Web search" isSelected={webSearch}>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </div>
      </DetailCard>
      <DetailCard title="Context" section="context">
        <Meter aria-label="Context window used" value={79} color="warning" size="sm" class="w-full">
          <span class="text-xs text-muted">Context window</span>
          <Meter.Output />
          <Meter.Track>
            <Meter.Fill />
          </Meter.Track>
        </Meter>
      </DetailCard>
      <DetailCard title="Connectors" section="connectors">
        <div class="flex items-center justify-between gap-2">
          <span>Shop data</span>
          <span class="text-xs text-muted">2 to reconnect</span>
        </div>
      </DetailCard>
      <DetailCard title="Outputs" section="outputs">
        <ul class="flex min-w-0 flex-col gap-3">
          <li class="flex items-center gap-2">
            <Icon icon={FileText} size={16} class="shrink-0 text-muted" />
            <span class="min-w-0 flex-1 truncate">Restock brief</span>
            <Chip size="sm" variant="soft">
              Artifact
            </Chip>
          </li>
          <li class="flex items-center gap-2">
            <Icon icon={FileCode} size={16} class="shrink-0 text-muted" />
            <span class="truncate">inventory-summary.csv</span>
          </li>
          <li class="flex items-center gap-2">
            <Icon icon={FileText} size={16} class="shrink-0 text-muted" />
            <span class="truncate">supplier-email.md</span>
          </li>
          <Show when={more}>
            <li class="flex items-center gap-2">
              <Icon icon={FileImage} size={16} class="shrink-0 text-muted" />
              <span class="truncate">autumn-campaign.png</span>
            </li>
          </Show>
        </ul>
        <Button size="sm" variant="ghost" class="self-start text-muted" aria-expanded={() => (more() ? "true" : "false")} onPress={() => more.set(!more())}>
          {more() ? "Show less" : "Show more"}
        </Button>
      </DetailCard>
      <DetailCard title="Changes" section="changes">
        <div class="flex items-center gap-2">
          <Icon icon={GitPullRequest} size={16} class="shrink-0 text-muted" />
          <span class="flex-1 whitespace-nowrap text-xs tabular-nums">
            <span class="text-success">+24</span> <span class="text-danger">−8</span>
          </span>
          <Button size="sm" variant="secondary" isDisabled={draft} onPress={() => draft.set(true)}>
            {draft() ? "Draft ready" : "Create PR"}
          </Button>
        </div>
        <Show when={draft}>
          <p class="text-xs text-muted" role="status">
            Demo draft ready for review. Nothing was published.
          </p>
        </Show>
      </DetailCard>
      <DetailCard title="Background tasks" section="tasks">
        <div class="flex items-center gap-2" data-task="inventory">
          <Icon icon={Terminal} size={16} class="shrink-0 text-muted" />
          <span class="min-w-0 flex-1 truncate">Refresh inventory</span>
          <span class="text-xs tabular-nums text-muted" role="status">
            {inventoryRunning() ? "32s" : "Stopped"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label="Stop inventory refresh"
            isDisabled={() => !inventoryRunning()}
            onPress={() => inventoryRunning.set(false)}
          >
            <Icon icon={Square} size={12} />
          </Button>
        </div>
        <div class="flex items-center gap-2" data-task="sources">
          <Icon icon={Terminal} size={16} class="shrink-0 text-muted" />
          <span class="min-w-0 flex-1 truncate">Check suppliers</span>
          <span class="text-xs tabular-nums text-muted" role="status">
            {sourcesRunning() ? "12s" : "Stopped"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label="Stop supplier check"
            isDisabled={() => !sourcesRunning()}
            onPress={() => sourcesRunning.set(false)}
          >
            <Icon icon={Square} size={12} />
          </Button>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted">
          <Icon icon={CheckCheck} size={16} />
          18 finished
        </div>
      </DetailCard>
      <p class="px-1 text-xs text-muted">Sample workspace, files and tool activity.</p>
    </div>
  );
}

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
    // One provider: the history stays contained and resizable; AppLayout owns the right column and mobile drawer.
    <AppLayout
      id="chat-workspace"
      contained
      scrollMode="content"
      sidebarCollapsible="offcanvas"
      asideMobile="sheet"
      asideLabel="Chat details"
      class="mx-auto h-[820px] max-h-none max-w-[1440px] rounded-2xl border border-separator bg-surface text-sm"
      style={{ "--sidebar-width": "15rem", "--app-layout-aside-width": "20rem" }}
      sidebar={() => (
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
      )}
      navbar={() => (
        <>
          <Sidebar.Trigger id="history-toggle" aria-label="Toggle conversations" />
          <span class="hidden size-8 shrink-0 sm:flex items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Icon icon={Sparkles} size={16} />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="truncate font-semibold">Shop assistant</h2>
            <p class="truncate text-xs text-muted">Answers from your orders, stock and suppliers</p>
          </div>
          <Chip id="assistant-online" size="sm" variant="soft" color="success" class="hidden sm:flex">
            <Status color="success" size="sm" pulse />
            Online
          </Chip>
          <AppLayout.AsideTrigger id="details-toggle" aria-label="Toggle chat details" />
        </>
      )}
      aside={() => <ChatDetails />}
    >
      <section aria-label="Chat" class="flex h-full min-w-0 flex-col">
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
    </AppLayout>
  );
}
// #endregion
