// Server-target suite: DropZone (Rivet addition, feature set inspired by HeroUI Pro's public Drop Zone docs): area markup
// (cdk DropZone: hidden focus button labelled by the Label), default icon / trigger text, hidden input attributes, file
// list rows with status, format badge colour mapping, progress bar, retry / remove labels, disabled area.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { DropZone } from "../src/components/drop-zone/index.ts";

test("drop zone SSR: area, label, trigger, input", async () => {
  const html = await renderToString(() => (
    <DropZone>
      <DropZone.Area>
        <DropZone.Icon />
        <DropZone.Label>Drag files here</DropZone.Label>
        <DropZone.Description>PDF up to 10 MB.</DropZone.Description>
        <DropZone.Trigger />
      </DropZone.Area>
      <DropZone.Input accept="image/*,.pdf" multiple />
    </DropZone>
  ));
  assert.match(html, /<div class="drop-zone" data-slot="drop-zone" data-drop-zone="">/);
  assert.match(html, /class="drop-zone__area"/);
  assert.match(html, /data-slot="drop-zone-area"/);
  const label = /<span[^>]*id="([^"]+)"[^>]*>Drag files here<\/span>|<span[^>]*class="drop-zone__label"[^>]*id="([^"]+)"/.exec(html);
  assert.ok(label, "label has an id");
  const id = label[1] ?? label[2];
  assert.match(html, new RegExp(`<button type="button" id="[^"]+"[^>]*aria-labelledby="[^"]+ ${id}"`));
  assert.match(html, /class="drop-zone__icon"[^>]*><svg/);
  assert.match(html, /drop-zone__trigger[^>]*>Select files</);
  assert.match(html, /<input class="drop-zone__input"[^>]*type="file"[^>]*accept="image\/\*,\.pdf"[^>]*multiple/);
  assert.match(html, /data-drop-zone-input=""/);
});

test("drop zone SSR: file list, status, format colours, progress, triggers, disabled", async () => {
  const html = await renderToString(() => (
    <DropZone>
      <DropZone.Area isDisabled>
        <DropZone.Label>Off</DropZone.Label>
      </DropZone.Area>
      <DropZone.FileList>
        <DropZone.FileItem status="uploading">
          <DropZone.FileFormatIcon format="PDF" color="red" />
          <DropZone.FileInfo>
            <DropZone.FileName>Proposal.pdf</DropZone.FileName>
            <DropZone.FileMeta>2.4 MB</DropZone.FileMeta>
          </DropZone.FileInfo>
          <DropZone.FileProgress value={40}>
            <DropZone.FileProgressTrack>
              <DropZone.FileProgressFill />
            </DropZone.FileProgressTrack>
          </DropZone.FileProgress>
          <DropZone.FileRemoveTrigger />
        </DropZone.FileItem>
        <DropZone.FileItem status="failed">
          <DropZone.FileFormatIcon format="JPG" />
          <DropZone.FileRetryTrigger />
        </DropZone.FileItem>
      </DropZone.FileList>
    </DropZone>
  ));
  assert.match(html, /class="drop-zone__area"[^>]*data-disabled="true"|data-disabled="true"[^>]*class="drop-zone__area"/);
  assert.match(html, /<button type="button"[^>]*disabled/);
  assert.match(html, /<ul class="drop-zone__file-list"/);
  assert.match(html, /<li class="drop-zone__file-item" data-slot="drop-zone-file-item" data-status="uploading">/);
  assert.match(html, /data-status="failed"/);
  assert.match(html, /data-color="danger"[^>]*>.*?<span class="drop-zone__file-format-badge">PDF<\/span>/);
  assert.match(html, /data-color="default"[^>]*>.*?>JPG</);
  assert.match(html, /role="progressbar"[^>]*|aria-valuenow="40"/);
  assert.match(html, /aria-valuenow="40"/);
  assert.match(html, /aria-label="Remove file"/);
  assert.match(html, /aria-label="Retry upload"/);
  assert.match(html, /drop-zone__file-name[^>]*>Proposal\.pdf</);
});
