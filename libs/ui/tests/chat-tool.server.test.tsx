// Server-target suite: `ChatTool` / `ChatToolGroup` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public
// ChatTool docs): preset trigger + status icon, JSON args / result, error, approval (expanded by default), group.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ChatTool, ChatToolGroup } from "../src/components/chat-tool/index.ts";

test("chat-tool SSR: preset states", async () => {
  const done = await renderToString(() => (
    <ChatTool toolName="searchDocs" triggerPrefix="Used tool: " state="output-available" input={{ query: "x" }} output={{ matches: 3 }} />
  ));
  assert.match(done, /data-state="output-available"/);
  assert.match(done, /Used tool: <strong class="chat-tool__tool-name">searchDocs<\/strong>/);
  assert.match(done, /role="img" aria-label="Completed"/);
  assert.match(done, /chat-tool__args/);
  assert.match(done, /chat-tool__result/);
  assert.match(done, /&quot;matches&quot;|"matches"/);
  assert.match(done, /aria-expanded="false"/);
  const failed = await renderToString(() => <ChatTool toolName="t" state="output-error" errorText="Boom" />);
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Boom/);
  const approval = await renderToString(() => <ChatTool toolName="t" state="requires-action" />);
  assert.match(approval, /aria-expanded="true"/);
  assert.match(approval, />Approve</);
  assert.match(approval, />Reject</);
  assert.match(approval, /aria-label="Needs approval"/);
});

test("chat-tool-group SSR", async () => {
  const html = await renderToString(() => (
    <ChatToolGroup defaultExpanded>
      <ChatToolGroup.Trigger>2 tools</ChatToolGroup.Trigger>
      <ChatToolGroup.Content>
        <ChatTool toolName="a" state="input-streaming" />
      </ChatToolGroup.Content>
    </ChatToolGroup>
  ));
  assert.match(html, /chat-tool-group/);
  assert.match(html, /aria-label="Running"/);
});
