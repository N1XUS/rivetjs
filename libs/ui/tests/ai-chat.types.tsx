// Type-level suite (`tsc -p libs/ui` only) for the AI chat components (Rivet-authored; feature sets inspired by HeroUI
// Pro's public AI docs): TextShimmer, ChatLoader, ChatMessage, ChatMessageActions, PromptSuggestion, ChatListView,
// CodeBlock, Markdown, ChainOfThought, ChatSource / ChatSources, ChatTool / ChatToolGroup, ChatConversation,
// ChatAttachment / ChatAttachmentGroup / ChatAttachmentInput, PromptInput, PromptInputQueueReorder (+ FileTree sections, PRO-LAST); value / accessor props, `X["…Props"]`, errors.
import { signal } from "@rivetjs/reactivity";

import { ChainOfThought } from "../src/components/chain-of-thought/index.ts";
import { ChatAttachment, ChatAttachmentGroup, ChatAttachmentInput } from "../src/components/chat-attachment/index.ts";
import { ChatConversation } from "../src/components/chat-conversation/index.ts";
import { ChatListView } from "../src/components/chat-list-view/index.ts";
import { ChatLoader } from "../src/components/chat-loader/index.ts";
import { ChatMessage } from "../src/components/chat-message/index.ts";
import { ChatMessageActions } from "../src/components/chat-message-actions/index.ts";
import { ChatSource, ChatSources } from "../src/components/chat-source/index.ts";
import { ChatTool, ChatToolGroup } from "../src/components/chat-tool/index.ts";
import { CodeBlock } from "../src/components/code-block/index.ts";
import { Markdown } from "../src/components/markdown/index.ts";
import { PromptInput } from "../src/components/prompt-input/index.ts";
import type { PromptInputStatus } from "../src/components/prompt-input/index.ts";
import { PromptInputQueueReorder } from "../src/components/prompt-input-queue-reorder/index.ts";
import { PromptSuggestion } from "../src/components/prompt-suggestion/index.ts";
import { FileTree } from "../src/components/file-tree/index.ts";
import { TextShimmer } from "../src/components/text-shimmer/index.ts";

export const ok = () => {
  const text = signal("");
  const status = signal<PromptInputStatus>("ready");
  const streaming = () => status() === "streaming";
  return (
    <ChatConversation isStreaming={streaming} scrollButton class="h-96">
      <ChatConversation.Content>
        <ChatMessage.User>
          <ChatMessage.Bubble>Hi</ChatMessage.Bubble>
        </ChatMessage.User>
        <ChatMessage.Assistant actionsVisibility="hover">
          <ChatMessage.Avatar fallback="AI" show />
          <ChatMessage.Body>
            <ChainOfThought isStreaming={streaming} defaultExpanded>
              <ChainOfThought.Trigger icon={null}>
                <TextShimmer isActive={streaming}>Thinking</TextShimmer>
              </ChainOfThought.Trigger>
              <ChainOfThought.Content>
                <ChainOfThought.Steps>
                  <ChainOfThought.Step label="Search" status="active" />
                </ChainOfThought.Steps>
              </ChainOfThought.Content>
            </ChainOfThought>
            <ChatTool toolName="search" state="output-available" input={{ q: 1 }} output={[1]} onApprove={() => {}} />
            <ChatToolGroup>
              <ChatToolGroup.Trigger>2 tools</ChatToolGroup.Trigger>
              <ChatToolGroup.Content>x</ChatToolGroup.Content>
            </ChatToolGroup>
            <Markdown content={() => text()} isStreaming={streaming} showCaret={false} />
            <Markdown>{"**hi**"}</Markdown>
            <CodeBlock>
              <CodeBlock.Code code={() => text()} language="ts" wrap />
              <CodeBlock.CopyButton code="x" onCopy={(ok) => void ok} />
            </CodeBlock>
            <ChatSources>
              <ChatSources.Trigger>
                <ChatSources.Favicons sources={[{ href: "https://a.dev" }]} max={2} />
              </ChatSources.Trigger>
              <ChatSources.Content>
                <ChatSources.List>
                  <ChatSource href="https://a.dev" description="d" faviconUrl="/f.png" sourceType="url" />
                </ChatSources.List>
              </ChatSources.Content>
            </ChatSources>
            <ChatMessage.Actions>
              <ChatMessageActions>
                <ChatMessageActions.Copy text={() => text()} />
                <ChatMessageActions.Action aria-label="Retry" onPress={() => {}} />
              </ChatMessageActions>
            </ChatMessage.Actions>
          </ChatMessage.Body>
        </ChatMessage.Assistant>
        <ChatLoader.Skeleton lines={2} />
        <ChatLoader.Dots />
      </ChatConversation.Content>
      <ChatConversation.ScrollButton behavior="auto" />
      <PromptInput
        value={text()}
        onValueChange={(v) => text.set(v)}
        status={() => status()}
        onSubmit={(v) => void v}
        onStop={() => {}}
        layout="compact"
        size="sm"
        variant="secondary"
        maxHeight="12rem"
      >
        <ChatAttachmentInput accept="image/*" multiple={false} onFilesSelected={(files) => void files.length}>
          <ChatAttachmentInput.Dropzone
            render={(p) => (
              <PromptInput.Shell {...p}>
                <PromptInput.Attachments>
                  <ChatAttachmentGroup>
                    <ChatAttachment name="a.png" mediaType="image" size={10} src="/a.png" onRemove={() => {}} />
                  </ChatAttachmentGroup>
                </PromptInput.Attachments>
                <PromptInput.TextArea disableAutosize placeholder="Ask" />
                <PromptInput.Toolbar>
                  <PromptInput.ToolbarStart>
                    <ChatAttachmentInput.Trigger />
                    <PromptInput.Action aria-label="Voice" tooltip="Voice" />
                  </PromptInput.ToolbarStart>
                  <PromptInput.ToolbarEnd>
                    <PromptInput.Send stopLabel="Stop" />
                  </PromptInput.ToolbarEnd>
                </PromptInput.Toolbar>
              </PromptInput.Shell>
            )}
          />
        </ChatAttachmentInput>
        <PromptInput.Queue actionsVisibility="always">
          <PromptInput.Queue.List>
            <PromptInput.Queue.Item>
              <PromptInput.Queue.Item.AttachmentsOverflow hiddenCount={2} noun="images" />
            </PromptInput.Queue.Item>
          </PromptInput.Queue.List>
        </PromptInput.Queue>
      </PromptInput>
      <PromptSuggestion variant="card">
        <PromptSuggestion.Items>
          <PromptSuggestion.Item onPress={() => {}}>x</PromptSuggestion.Item>
        </PromptSuggestion.Items>
      </PromptSuggestion>
      <ChatListView variant="compact">
        <ChatListView.Item href="/c/1" isCurrent={() => true}>
          <ChatListView.Title>t</ChatListView.Title>
        </ChatListView.Item>
      </ChatListView>
    </ChatConversation>
  );
};

export const props: PromptInput["Props"] = { status: "ready", layout: "inline" };
export const toolProps: ChatTool["Props"] = { state: "requires-action", toolName: "x" };
export const markdownProps: Markdown["Props"] = { content: "x" };

// @ts-expect-error unknown status
export const badStatus = () => <PromptInput status="running" />;

// @ts-expect-error unknown tool state
export const badState = () => <ChatTool state="done" />;

// @ts-expect-error unknown layout
export const badLayout = () => <PromptInput layout="grid" />;

// @ts-expect-error code is required
export const missingCode = () => <CodeBlock.Code />;

// @ts-expect-error unknown suggestion variant
export const badVariant = () => <PromptSuggestion variant="grid" />;

// @ts-expect-error hiddenCount is required
export const missingCount = () => <PromptInput.Queue.Item.AttachmentsOverflow />;

// Queue reorder (PRO-LAST): `onReorder` gets the `values` element type.
export const reorderQueue = () => (
  <PromptInputQueueReorder.List values={[{ id: 1 }]} onReorder={(next) => next.map((q) => q.id.toFixed())} axis="x">
    <PromptInputQueueReorder.Item value={{ id: 1 }} />
  </PromptInputQueueReorder.List>
);

// @ts-expect-error onReorder is required
export const missingReorder = () => <PromptInputQueueReorder.List values={[1]} />;

// @ts-expect-error unknown axis
export const badAxis = () => <PromptInputQueueReorder.List values={[1]} onReorder={() => {}} axis="z" />;

// FileTree sections (PRO-LAST).
export const fileTreeSections = () => (
  <FileTree aria-label="Files">
    <FileTree.Section id="s" aria-label="Section">
      <FileTree.Header class="x">Header</FileTree.Header>
      <FileTree.Item id="a" title="a" />
    </FileTree.Section>
  </FileTree>
);
