// Server-target suite: `TagGroup` SSR — grid / row roles, classes, default remove button with onRemove.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Description, ErrorMessage, Label, Tag, TagGroup } from "../index.ts";
import { assertSameHtml } from "./same-html.ts";

test("tag-group SSR: markup + classes", async () => {
  const html = await renderToString(() => (
    <TagGroup selectionMode="single" size="sm" onRemove={() => {}}>
      <Label>Amenities</Label>
      <TagGroup.List>
        <Tag id="news">News</Tag>
      </TagGroup.List>
    </TagGroup>
  ));
  assert.match(html, /class="tag-group"/);
  assert.match(html, /data-slot="tag-group"/);
  assert.match(html, /role="grid"/);
  assert.match(html, /class="tag-group__list"/);
  assert.match(html, /role="row"/);
  assert.match(html, /class="tag tag--sm tag--default"/);
  assert.match(html, /data-slot="tag-remove-button"/);
});

test("tag-group SSR: auto form (label / description / errorMessage) = compound form; items + render function", async () => {
  await assertSameHtml(
    () => (
      <TagGroup selectionMode="multiple" label="Amenities" description="Pick any" errorMessage="Pick one">
        <Tag id="laundry">Laundry</Tag>
        <Tag id="pool">Pool</Tag>
      </TagGroup>
    ),
    () => (
      <TagGroup selectionMode="multiple">
        <Label>Amenities</Label>
        <TagGroup.List>
          <Tag id="laundry">Laundry</Tag>
          <Tag id="pool">Pool</Tag>
        </TagGroup.List>
        <Description>Pick any</Description>
        <ErrorMessage>Pick one</ErrorMessage>
      </TagGroup>
    ),
  );
  const items = [
    { id: "laundry", name: "Laundry" },
    { id: "pool", name: "Pool" },
  ];
  await assertSameHtml(
    () => (
      <TagGroup aria-label="Amenities" items={items}>
        {(i: { id: string; name: string }) => <Tag id={i.id}>{i.name}</Tag>}
      </TagGroup>
    ),
    () => (
      <TagGroup aria-label="Amenities">
        <TagGroup.List items={items}>{(i: { id: string; name: string }) => <Tag id={i.id}>{i.name}</Tag>}</TagGroup.List>
      </TagGroup>
    ),
  );
});
