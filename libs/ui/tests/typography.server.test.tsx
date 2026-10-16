// Server-target suite: `Typography` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Typography } from "../src/components/typography/index.ts";

test("typography SSR: heading levels, paragraph, code, prose", async () => {
  const h = await renderToString(() => <Typography.Heading level={3}>Title</Typography.Heading>);
  assert.match(h, /<h3[^>]*data-slot="typography"[^>]*>Title<\/h3>/);
  assert.match(h, /data-type="h3"/);
  assert.match(h, /typography--h3/);
  assert.match(await renderToString(() => <Typography.Paragraph size="sm">p</Typography.Paragraph>), /<p[^>]*data-type="body-sm"/);
  assert.match(await renderToString(() => <Typography.Code>c</Typography.Code>), /<code[^>]*data-type="code"[^>]*>c<\/code>/);
  assert.match(
    await renderToString(() => <Typography.Prose>x</Typography.Prose>),
    /<div[^>]*class="typography-prose"[^>]*data-slot="prose"|<div[^>]*data-slot="prose"[^>]*class="typography-prose"/,
  );
});
