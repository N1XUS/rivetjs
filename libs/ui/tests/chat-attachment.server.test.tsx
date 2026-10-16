// Server-target suite: `ChatAttachment` / `ChatAttachmentGroup` / `ChatAttachmentInput` SSR (Rivet-authored; feature set
// inspired by HeroUI Pro's public ChatAttachment docs): file card vs media tile, inferred kind, formatted size, remove,
// hidden file input + dropzone attributes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ChatAttachment, ChatAttachmentGroup, ChatAttachmentInput } from "../src/components/chat-attachment/index.ts";

test("chat-attachment SSR", async () => {
  const html = await renderToString(() => (
    <ChatAttachmentGroup>
      <ChatAttachment name="brief.pdf" mimeType="application/pdf" size={824120} onRemove={() => {}} />
      <ChatAttachment name="shot.png" src="/shot.png" />
    </ChatAttachmentGroup>
  ));
  assert.match(html, /role="group" aria-label="Attachments"/);
  assert.match(html, /data-variant="file" data-media-type="document"/);
  assert.match(html, /data-kind="pdf"/);
  assert.match(html, /804.8 KB|805 KB/);
  assert.match(html, /aria-label="Remove brief.pdf"/);
  assert.match(html, /data-variant="media" data-media-type="image"/);
  assert.match(html, /<img[^>]*chat-attachment__preview-image[^>]*src="\/shot.png"|<img[^>]*src="\/shot.png"[^>]*/);
});

test("chat-attachment-input SSR", async () => {
  const html = await renderToString(() => (
    <ChatAttachmentInput accept="image/*" onFilesSelected={() => {}}>
      <ChatAttachmentInput.Dropzone>
        <ChatAttachmentInput.Trigger />
      </ChatAttachmentInput.Dropzone>
    </ChatAttachmentInput>
  ));
  assert.match(html, /data-chat-attachment-input=""/);
  assert.match(html, /<input[^>]*type="file"[^>]*accept="image\/\*"[^>]*multiple/);
  assert.match(html, /data-chat-dropzone=""/);
  assert.match(html, /aria-label="Attach files"/);
});
