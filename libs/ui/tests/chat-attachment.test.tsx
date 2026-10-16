// DOM-target suite (happy-dom): `ChatAttachment` / `ChatAttachmentInput` (Rivet-authored; feature set inspired by HeroUI
// Pro's public ChatAttachment docs): helpers, remove press, file input change → onFilesSelected (accept filter), trigger
// opens the input, drag over a dropzone marks it, drop delivers the files.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const mod = await import("../src/components/chat-attachment/index.ts");
const { ChatAttachment, ChatAttachmentInput, inferChatAttachmentFileKind, formatChatAttachmentSize } = mod;
const W = window as unknown as {
  PointerEvent: typeof PointerEvent;
  MouseEvent: typeof MouseEvent;
  KeyboardEvent: typeof KeyboardEvent;
  Event: typeof Event;
  InputEvent: typeof InputEvent;
};
const press = (el: Element) => {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
};
const flush = () => new Promise((r) => setTimeout(r, 20));

test("chat-attachment: helpers", () => {
  assert.equal(inferChatAttachmentFileKind("application/pdf"), "pdf");
  assert.equal(inferChatAttachmentFileKind(undefined, "data.csv"), "spreadsheet");
  assert.equal(inferChatAttachmentFileKind("", "a.tsx"), "code");
  assert.equal(inferChatAttachmentFileKind("image/png"), "image");
  assert.equal(inferChatAttachmentFileKind(undefined, "x.bin"), "generic");
  assert.equal(formatChatAttachmentSize(512), "512 B");
  assert.equal(formatChatAttachmentSize(1536), "1.5 KB");
  assert.equal(formatChatAttachmentSize(25 * 1024 * 1024), "25 MB");
  assert.equal(formatChatAttachmentSize(undefined), "");
});

test("chat-attachment: remove", () => {
  let removed = 0;
  const r = render(() => <ChatAttachment name="a.txt" size={10} onRemove={() => removed++} />);
  press(r.container.querySelector("[aria-label='Remove a.txt']")!);
  assert.equal(removed, 1);
  r.unmount();
});

test("chat-attachment-input: pick + drop", () => {
  const got: string[][] = [];
  const r = render(() => (
    <ChatAttachmentInput accept="image/*" onFilesSelected={(files) => got.push(files.map((f) => f.name))}>
      <ChatAttachmentInput.Dropzone>
        <ChatAttachmentInput.Trigger />
      </ChatAttachmentInput.Dropzone>
    </ChatAttachmentInput>
  ));
  const input = r.container.querySelector("input[type=file]") as HTMLInputElement;
  let clicked = 0;
  input.click = () => void clicked++;
  press(r.container.querySelector("[aria-label='Attach files']")!);
  assert.equal(clicked, 1);
  const F = (window as unknown as { File: typeof File }).File;
  const files = [new F(["x"], "a.png", { type: "image/png" }), new F(["y"], "b.pdf", { type: "application/pdf" })];
  Object.defineProperty(input, "files", { configurable: true, value: files });
  input.dispatchEvent(new W.Event("change", { bubbles: true }));
  assert.deepEqual(got, [["a.png"]]);
  const zone = r.container.querySelector("[data-chat-dropzone]")!;
  const drag = (type: string) => {
    const event = new W.Event(type, { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, "dataTransfer", { value: { types: ["Files"], files, dropEffect: "none" } });
    zone.dispatchEvent(event);
    return event;
  };
  assert.equal(drag("dragover").defaultPrevented, true);
  assert.equal(zone.getAttribute("data-drop-target"), "true");
  drag("drop");
  assert.equal(zone.getAttribute("data-drop-target"), null);
  assert.deepEqual(got, [["a.png"], ["a.png"]]);
  r.unmount();
});
