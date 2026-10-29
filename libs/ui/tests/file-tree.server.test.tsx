// Server-target suite: FileTree (Rivet addition, feature set inspired by HeroUI Pro's public File Tree docs): treegrid markup
// (cdk Tree), size / guide-line attributes, expand buttons only on parent rows, icons, title, levels, selection checkboxes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { FileTree } from "../src/components/file-tree/index.ts";

test("file tree SSR: rows, levels, expand button, icon, title", async () => {
  const html = await renderToString(() => (
    <FileTree aria-label="Files" defaultExpandedKeys={["src"]}>
      <FileTree.Item id="src" title="src" icon={<i data-icon="folder" />}>
        <FileTree.Item id="index" title="index.ts" />
      </FileTree.Item>
      <FileTree.Item id="readme" title="README.md" />
    </FileTree>
  ));
  assert.match(html, /role="treegrid"/);
  assert.match(html, /class="file-tree file-tree--md[^"]*"/);
  assert.match(html, /data-guide-lines="always"/);
  assert.equal((html.match(/role="row"/g) ?? []).length, 3);
  assert.equal((html.match(/slot="chevron"/g) ?? []).length, 1);
  assert.match(html, /file-tree__indicator-icon/);
  assert.match(html, /data-icon="folder"/);
  assert.match(html, /file-tree__title[^>]*>index\.ts</);
  assert.match(html, /aria-level="2"/);
  assert.match(html, /aria-expanded="true"/);
  assert.doesNotMatch(html, /file-tree__selection-cell/);
});

test("file tree SSR: sizes, guide lines, selection checkboxes, custom indicator", async () => {
  const html = await renderToString(() => (
    <FileTree aria-label="Files" size="sm" showGuideLines="hover" selectionMode="multiple">
      <FileTree.Item id="docs" title="docs" indicator={<b data-ind="" />}>
        <FileTree.Item id="a" title="a.md" />
      </FileTree.Item>
    </FileTree>
  ));
  assert.match(html, /file-tree--sm/);
  assert.match(html, /data-guide-lines="hover"/);
  assert.match(html, /file-tree__selection-cell/);
  assert.match(html, /data-ind=""/);
  const off = await renderToString(() => (
    <FileTree aria-label="Files" size="lg" showGuideLines={false}>
      <FileTree.Item id="x" title="x" />
    </FileTree>
  ));
  assert.match(off, /file-tree--lg/);
  assert.match(off, /data-guide-lines="none"/);
});

test("file tree SSR: reduceMotion sets data-reduce-motion (absent by default)", async () => {
  const on = await renderToString(() => (
    <FileTree aria-label="Files" reduceMotion defaultExpandedKeys={["src"]}>
      <FileTree.Item id="src" title="src">
        <FileTree.Item id="index" title="index.ts" />
      </FileTree.Item>
    </FileTree>
  ));
  assert.match(on, /role="treegrid"[^>]*data-reduce-motion="true"|data-reduce-motion="true"[^>]*role="treegrid"/);
  const off = await renderToString(() => (
    <FileTree aria-label="Files">
      <FileTree.Item id="x" title="x" />
    </FileTree>
  ));
  assert.doesNotMatch(off, /data-reduce-motion/);
});
