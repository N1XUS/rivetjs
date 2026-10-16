// Server-target suite: `AvatarGroup` SSR markup: classes, data-slot, inherited size / color / variant, `max` truncation + `+N`,
// explicit `Count`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Avatar, AvatarGroup } from "../index.ts";

const fallbacks = (html: string) => [...html.matchAll(/data-slot="avatar-fallback"[^>]*>([^<]*)</g)].map((m) => m[1]);

test("avatar-group SSR: group classes, inherited size / color / variant, max + automatic +N", async () => {
  const html = await renderToString(() => (
    <AvatarGroup max={2} size="sm" color="accent" variant="soft" overlap="ring">
      {["A", "B", "C", "D"].map((t) => (
        <Avatar>
          <Avatar.Fallback>{t}</Avatar.Fallback>
        </Avatar>
      ))}
    </AvatarGroup>
  ));
  assert.match(
    html,
    /<div[^>]*class="avatar-group avatar-group--ring"[^>]*data-slot="avatar-group"|<div[^>]*data-slot="avatar-group"[^>]*class="avatar-group avatar-group--ring"/,
  );
  assert.deepEqual(fallbacks(html), ["A", "B", "+2"]);
  assert.match(html, /class="avatar avatar--sm avatar--soft"/);
  assert.match(html, /avatar__fallback--accent/);
  assert.match(html, /class="avatar avatar--sm avatar--soft avatar-group__count"[^>]*data-slot="avatar-group-count"|data-slot="avatar-group-count"/);
});

test("avatar-group SSR: explicit Count, no automatic count; no max renders every avatar", async () => {
  const html = await renderToString(() => (
    <AvatarGroup max={1}>
      <Avatar>
        <Avatar.Fallback>A</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>B</Avatar.Fallback>
      </Avatar>
      <AvatarGroup.Count>+99</AvatarGroup.Count>
    </AvatarGroup>
  ));
  assert.deepEqual(fallbacks(html), ["A", "+99"]);
  assert.equal(html.match(/data-slot="avatar-group-count"/g)?.length, 1);
  const all = await renderToString(() => (
    <AvatarGroup isGrid>
      {["A", "B", "C"].map((t) => (
        <Avatar>
          <Avatar.Fallback>{t}</Avatar.Fallback>
        </Avatar>
      ))}
    </AvatarGroup>
  ));
  assert.deepEqual(fallbacks(all), ["A", "B", "C"]);
  assert.match(all, /avatar-group--grid/);
  assert.doesNotMatch(all, /avatar-group-count/);
});
