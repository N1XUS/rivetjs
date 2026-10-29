// Server-target suite: `PromptInput` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public PromptInput docs):
// root data attributes + max-height variable, textarea value as content, send icon set + disabled when empty, stop label
// while streaming, queue parts, footer.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { PromptInput } from "../src/components/prompt-input/index.ts";
import { PromptInputQueueReorder } from "../src/components/prompt-input-queue-reorder/index.ts";

const Composer = (props: { status?: "ready" | "streaming"; defaultValue?: string }) => (
  <PromptInput status={props.status} defaultValue={props.defaultValue} maxHeight={200} size="lg" variant="secondary">
    <PromptInput.Queue>
      <PromptInput.Queue.List>
        <PromptInput.Queue.Item>
          <PromptInput.Queue.Item.Body>
            <PromptInput.Queue.Item.Icon />
            <PromptInput.Queue.Item.Content>Next prompt</PromptInput.Queue.Item.Content>
          </PromptInput.Queue.Item.Body>
          <PromptInput.Queue.Item.Actions>
            <PromptInput.Queue.Item.Remove />
          </PromptInput.Queue.Item.Actions>
        </PromptInput.Queue.Item>
      </PromptInput.Queue.List>
    </PromptInput.Queue>
    <PromptInput.Shell>
      <PromptInput.Content>
        <PromptInput.TextArea />
      </PromptInput.Content>
      <PromptInput.Toolbar>
        <PromptInput.ToolbarEnd>
          <PromptInput.Send />
        </PromptInput.ToolbarEnd>
      </PromptInput.Toolbar>
    </PromptInput.Shell>
    <PromptInput.Footer>Check important info.</PromptInput.Footer>
  </PromptInput>
);

test("prompt-input SSR: ready + empty", async () => {
  const html = await renderToString(() => <Composer />);
  assert.match(html, /data-status="ready" data-layout="stacked" data-size="lg" data-variant="secondary"/);
  assert.match(html, /--prompt-input-max-height:\s*200px/);
  assert.match(html, /<textarea[^>]*placeholder="What do you want to know\?"/);
  assert.match(html, /aria-label="Send message"/);
  assert.match(html, /<button[^>]*prompt-input__send[^>]*disabled|<button[^>]*disabled[^>]*prompt-input__send/);
  assert.equal(html.match(/prompt-input__send-icon/g)?.length, 4);
  assert.match(html, /role="region" aria-label="Queued prompts" data-actions="hover"/);
  assert.match(html, /aria-label="Remove from queue"/);
  assert.match(html, /<p class="prompt-input__footer"/);
});

test("prompt-input SSR: value + streaming", async () => {
  const html = await renderToString(() => <Composer status="streaming" defaultValue="Hello <b>" />);
  assert.match(html, /<textarea[^>]*disabled[^>]*>\n?Hello &lt;b(>|&gt;)<\/textarea>/);
  assert.match(html, /aria-label="Stop generating"/);
  assert.match(html, /data-status="streaming"/);
});

test("prompt-input SSR: PromptInputQueueReorder renders the drag list with the Queue.List markup (PRO-LAST)", async () => {
  const values = ["a", "b"];
  const row = (v: string) => [<PromptInput.Queue.Item.Handle />, <PromptInput.Queue.Item.Content>{v}</PromptInput.Queue.Item.Content>];
  const queue = (reorder: boolean) => (
    <PromptInput>
      <PromptInput.Queue>
        {reorder ? (
          <PromptInputQueueReorder.List values={values} onReorder={() => {}} axis="x">
            {values.map((v) => (
              <PromptInputQueueReorder.Item value={v}>{row(v)}</PromptInputQueueReorder.Item>
            ))}
          </PromptInputQueueReorder.List>
        ) : (
          <PromptInput.Queue.List>
            {values.map((v) => (
              <PromptInput.Queue.Item>{row(v)}</PromptInput.Queue.Item>
            ))}
          </PromptInput.Queue.List>
        )}
      </PromptInput.Queue>
    </PromptInput>
  );
  const html = await renderToString(() => queue(true));
  const list = /<div[^>]*data-slot="prompt-input-queue-list"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(list, /cdk-drop-list/);
  assert.match(list, /prompt-input__queue-list/);
  assert.match(list, /role="list"/);
  assert.match(list, /data-reorderable="true"/);
  assert.match(list, /data-axis="x"/);
  assert.match(list, /data-orientation="horizontal"/);
  const items = html.match(/<div[^>]*data-slot="prompt-input-queue-item"[^>]*>/g) ?? [];
  assert.equal(items.length, 2);
  for (const item of items) {
    assert.match(item, /cdk-drag/);
    assert.match(item, /prompt-input__queue-item/);
    assert.match(item, /role="listitem"/);
    assert.match(item, /tabindex="0"/);
    assert.match(item, /aria-keyshortcuts="Alt\+ArrowLeft Alt\+ArrowRight"/);
  }
  assert.doesNotMatch(html, / values=| value=/);
  const plain = await renderToString(() => queue(false));
  assert.doesNotMatch(plain, /cdk-drop-list|cdk-drag|data-reorderable|tabindex|aria-keyshortcuts/);
  assert.doesNotMatch(plain, / values=| value=| axis=/);
  assert.match(plain, /<div class="prompt-input__queue-list" role="list" data-slot="prompt-input-queue-list"/);
  assert.equal((plain.match(/role="listitem"/g) ?? []).length, 2);
});
