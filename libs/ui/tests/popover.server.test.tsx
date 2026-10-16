// Server-target suite: `Popover` SSR (upstream popover.ssr.test.tsx: closed + defaultOpen render without errors) — closed: only
// the trigger; defaultOpen: the cdk overlay renders the popover in the server HTML (resumable, deliberate cdk deviation) with the
// `popover` / `popover__dialog` / `popover__heading` classes and data-slots; `Popover.Trigger` markup; Rivet fold (Content without
// a Dialog, `title`) = the explicit form.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Button, Popover } from "../index.ts";

const Fixture = (props: { defaultOpen?: boolean }) => (
  <Popover defaultOpen={props.defaultOpen}>
    <Button>Open popover</Button>
    <Popover.Content class="max-w-64">
      <Popover.Dialog>
        <Popover.Arrow />
        <Popover.Heading>Popover heading</Popover.Heading>
        <p>This is the popover content</p>
      </Popover.Dialog>
    </Popover.Content>
  </Popover>
);

test("popover SSR: closed renders the trigger only", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /<button[^>]*aria-expanded="false"/);
  assert.match(html, />Open popover</);
  assert.doesNotMatch(html, /popover__dialog/);
  assert.doesNotMatch(html, /This is the popover content/);
});

test("popover SSR: defaultOpen renders the popover with HeroUI classes + data-slots", async () => {
  const html = await renderToString(() => <Fixture defaultOpen />);
  assert.match(html, /class="popover max-w-64"/);
  assert.match(html, /<section[^>]*data-slot="popover-dialog"/);
  assert.match(html, /class="popover__dialog"/);
  assert.match(html, /class="popover__heading"[^>]*>Popover heading</);
  assert.match(html, /data-slot="popover-overlay-arrow-group"/);
  assert.match(html, /data-slot="popover-overlay-arrow"/);
  assert.match(html, /This is the popover content/);
});

test("popover SSR: Popover.Trigger is a div role=button with the trigger slot class", async () => {
  const html = await renderToString(() => (
    <Popover>
      <Popover.Trigger aria-label="User profile">x</Popover.Trigger>
      <Popover.Content>
        <Popover.Dialog>y</Popover.Dialog>
      </Popover.Content>
    </Popover>
  ));
  assert.match(html, /<div[^>]*class="popover__trigger"/);
  assert.match(html, /data-slot="popover-trigger"/);
  assert.match(html, /role="button"/);
  assert.match(html, /aria-label="User profile"/);
  assert.match(html, /aria-expanded="false"/);
});

const maskIds = (html: string) => html.replace(/ (id|aria-labelledby|aria-describedby|aria-controls|data-rv-focus-scope)="[^"]*"/g, "");

test("popover SSR: folded Content (title, no Dialog) = Content dialog={false} + Popover.Dialog + Heading", async () => {
  const explicit = await renderToString(() => (
    <Popover defaultOpen>
      <Button>Open popover</Button>
      <Popover.Content class="max-w-64" dialog={false}>
        <Popover.Dialog>
          <Popover.Heading>Popover heading</Popover.Heading>
          <p>This is the popover content</p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  ));
  const folded = await renderToString(() => (
    <Popover defaultOpen>
      <Button>Open popover</Button>
      <Popover.Content class="max-w-64" title="Popover heading">
        <p>This is the popover content</p>
      </Popover.Content>
    </Popover>
  ));
  assert.match(folded, /class="popover__heading"[^>]*>Popover heading</);
  assert.equal(maskIds(folded), maskIds(explicit));
});
