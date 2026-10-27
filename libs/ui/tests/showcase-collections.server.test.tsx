// Server-target suite (SHOWCASE-1 2026-10-27): ItemCardGroupCollection SSR (grid + rows with item-card classes,
// unread / current / selected state in the server HTML), Kanban keyboard markup (focusable described cards, keyed lists,
// hidden instructions) + Composer trigger, Sidebar.Provider contained wrapper class.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ItemCard } from "../src/components/item-card/index.ts";
import { ItemCardGroup } from "../src/components/item-card-group/index.ts";
import { ItemCardGroupCollection } from "../src/components/item-card-group-collection/index.ts";
import { Kanban, KanbanComposer } from "../src/components/kanban/index.ts";
import { Sidebar } from "../src/components/sidebar/index.ts";

test("item card group SSR: collection mode renders a grid of item-card rows with state", async () => {
  const html = await renderToString(() => (
    <ItemCardGroupCollection aria-label="Inbox" selectionMode="single" defaultSelectedKeys={["b"]}>
      <ItemCard id="a" textValue="A" isUnread>
        <ItemCard.Content>
          <ItemCard.Title>A</ItemCard.Title>
        </ItemCard.Content>
        <ItemCard.Indicator aria-label="Unread" />
      </ItemCard>
      <ItemCard id="b" textValue="B" isCurrent>
        <ItemCard.Content>
          <ItemCard.Title>B</ItemCard.Title>
        </ItemCard.Content>
      </ItemCard>
    </ItemCardGroupCollection>
  ));
  assert.match(html, /role="grid"/);
  assert.match(html, /class="item-card-group item-card-group--list item-card-group--default"/);
  assert.equal((html.match(/role="row"/g) ?? []).length, 2);
  assert.match(html, /<div[^>]*data-key="a"[^>]*data-unread="true"|<div[^>]*data-unread="true"[^>]*data-key="a"/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /data-selected="true"/);
  assert.match(html, /class="item-card__indicator"/);
});

test("item card group SSR: without collection props the group stays a static role=group", async () => {
  const html = await renderToString(() => (
    <ItemCardGroup aria-label="Static">
      <ItemCard isUnread>
        <ItemCard.Content>
          <ItemCard.Title>A</ItemCard.Title>
        </ItemCard.Content>
      </ItemCard>
    </ItemCardGroup>
  ));
  assert.match(html, /role="group"/);
  assert.doesNotMatch(html, /role="grid"|role="row"/);
  assert.match(html, /data-unread="true"/);
});

test("kanban SSR: onCardMove = focusable described keyed cards; Composer trigger", async () => {
  const html = await renderToString(() => (
    <Kanban onCardMove={() => {}}>
      <Kanban.Column>
        <Kanban.ColumnBody>
          <Kanban.CardList data="todo">
            <Kanban.Card data="1" textValue="One">
              <Kanban.CardContent>One</Kanban.CardContent>
            </Kanban.Card>
          </Kanban.CardList>
          <KanbanComposer id="add" onSubmit={() => {}} />
        </Kanban.ColumnBody>
      </Kanban.Column>
    </Kanban>
  ));
  assert.match(html, /data-kanban-column="todo"/);
  assert.match(html, /data-kanban-key="1"/);
  assert.match(html, /tabindex="0"/);
  const described = /aria-describedby="([^"]+)"/.exec(html)?.[1];
  assert.ok(described);
  assert.match(html, new RegExp(`id="${described}"[^>]*hidden[^>]*>Press Space to pick up`));
  assert.match(html, /data-slot="kanban-composer-trigger"/);
  assert.match(html, />Add a card</);
  const plain = await renderToString(() => (
    <Kanban>
      <Kanban.Column>
        <Kanban.CardList data="todo">
          <Kanban.Card data="1">x</Kanban.Card>
        </Kanban.CardList>
      </Kanban.Column>
    </Kanban>
  ));
  assert.doesNotMatch(plain, /tabindex="0"|aria-describedby/);
});

test("sidebar SSR: Provider contained", async () => {
  const html = await renderToString(() => (
    <Sidebar.Provider contained>
      <Sidebar.Inset />
    </Sidebar.Provider>
  ));
  assert.match(html, /class="sidebar-wrapper sidebar-wrapper--contained"/);
});
