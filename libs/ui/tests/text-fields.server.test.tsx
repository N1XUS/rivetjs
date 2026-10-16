// Server-target suite: `Input`, `TextArea`, `TextField`, `Form`, `Fieldset` SSR markup (upstream textfield / form `ssrSmoke` cases + classes;
// `aria-describedby` names only the parts that render).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Input } from "../src/components/input/index.ts";
import { TextArea } from "../src/components/textarea/index.ts";
import { TextField } from "../src/components/textfield/index.ts";
import { Form } from "../src/components/form/index.ts";
import { Fieldset } from "../src/components/fieldset/index.ts";
import { Label } from "../src/components/label/index.ts";
import { Description } from "../src/components/description/index.ts";
import { InputGroup } from "../src/components/input-group/index.ts";

test("input / textarea SSR: classes + data-slot", async () => {
  const html = await renderToString(() => (
    <div>
      <Input aria-label="Name" variant="secondary" />
      <TextArea aria-label="Bio" fullWidth />
    </div>
  ));
  assert.match(html, /<input[^>]* class="input input--secondary"/);
  assert.match(html, /<input[^>]* data-slot="input"/);
  assert.match(html, /<textarea[^>]* data-slot="textarea"/);
  assert.match(html, /<textarea[^>]* class="textarea textarea--full-width textarea--primary"/);
});

test("textfield SSR: Label, Input and Description (upstream ssrSmoke) + context variant", async () => {
  const html = await renderToString(() => (
    <TextField defaultValue="Ada" name="name" variant="secondary">
      <Label>Your name</Label>
      <Input placeholder="John" />
      <Description>Visible to other users</Description>
    </TextField>
  ));
  assert.match(html, /data-slot="textfield"/);
  assert.match(html, /class="textfield"/);
  assert.match(html, /<input[^>]* class="input input--secondary"/);
  assert.match(html, /value="Ada"/);
  assert.match(html, /data-slot="description"/);
});

test("textfield SSR: shorthand props render Label, Input (placeholder) and Description", async () => {
  const html = await renderToString(() => <TextField name="email" label="Email" description="Work address" placeholder="you@example.com" />);
  assert.match(html, /<label[^>]* data-slot="label"[^>]*>Email<\/label>|<label[^>]*>Email<\/label>/);
  assert.match(html, /<input[^>]* placeholder="you@example.com"/);
  assert.match(html, /data-slot="description"[^>]*>Work address</);
});

test("form SSR: a form with a nested TextField (upstream ssrSmoke)", async () => {
  const html = await renderToString(() => (
    <Form aria-label="Profile">
      <TextField defaultValue="Ada" name="name">
        <Label>Your name</Label>
        <Input />
      </TextField>
    </Form>
  ));
  assert.match(html, /^<form/);
  assert.match(html, /data-slot="textfield"/);
});

test("fieldset SSR: parts, slots, data-disabled", async () => {
  const html = await renderToString(() => (
    <Fieldset disabled>
      <Fieldset.Legend>Profile</Fieldset.Legend>
      <Fieldset.Group>Fields</Fieldset.Group>
      <Fieldset.Actions>Actions</Fieldset.Actions>
    </Fieldset>
  ));
  assert.match(html, /^<fieldset[^>]* class="fieldset"/);
  assert.match(html, /data-disabled="true"/);
  assert.match(html, /<legend[^>]* class="fieldset__legend"[^>]*>Profile<\/legend>/);
  assert.match(html, /class="fieldset__field-group" data-slot="fieldset-field-group"|data-slot="fieldset-field-group" class="fieldset__field-group"/);
  assert.match(html, /data-slot="fieldset-actions"/);
});

test("textfield SSR: aria-describedby names only the parts that render (no IDREF to a missing Description)", async () => {
  const bare = await renderToString(() => (
    <TextField id="profile-name" name="name">
      <Label>Display name</Label>
      <Input />
    </TextField>
  ));
  assert.doesNotMatch(bare, /aria-describedby/);
  const described = await renderToString(() => (
    <TextField id="profile-bio" name="bio">
      <Label>About</Label>
      <Input />
      <Description>Shown on your storefront</Description>
    </TextField>
  ));
  const ref = /<input[^>]* aria-describedby="([^"]+)"/.exec(described)?.[1];
  assert.ok(ref, described);
  for (const id of ref!.split(" ")) assert.match(described, new RegExp(` id="${id}"`));
});

// RA mergeIds: an own `id` on the Input becomes the field's input id; the Label renders first, so the server merges it
// during the field's slot probe (CDK-PINS 2026-10-12) — also through an InputGroup.
test("textfield SSR: Label `for` = the Input's own id (Input, InputGroup.Input, TextArea)", async () => {
  const html = await renderToString(() => (
    <div>
      <TextField name="name">
        <Label>Name</Label>
        <Input id="tf-input" />
      </TextField>
      <TextField name="amount">
        <Label>Amount</Label>
        <InputGroup>
          <InputGroup.Prefix>$</InputGroup.Prefix>
          <InputGroup.Input id="ig-input" />
        </InputGroup>
      </TextField>
      <TextField name="bio">
        <Label>Bio</Label>
        <TextArea id="ta-input" />
      </TextField>
    </div>
  ));
  for (const id of ["tf-input", "ig-input", "ta-input"]) {
    assert.match(html, new RegExp(`<(?:input|textarea)[^>]* id="${id}"`), html);
    assert.match(html, new RegExp(`<label[^>]* for="${id}"`), html);
  }
});
