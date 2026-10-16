// Server-target suite: the field slot probe (`@rivetjs/cdk/slot-probe` `probeSlots`) — every `aria-describedby` /
// `aria-labelledby` token in the SSR markup names an element of that markup (a resumed page never re-renders, so a kept
// id would stay an IDREF to nothing): render-function and nested lazy Description children, FieldError validity, the
// fields that probe (TextField, DateField, DatePicker, ColorField) and the parts whose ids follow their children (ListBox /
// Menu items, Dialog); field children render twice on the server, effects never run in the probe.
import { test } from "vitest";
import assert from "node:assert/strict";
import { effect } from "@rivetjs/reactivity";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CalendarDate } from "@rivetjs/cdk/date";
import { parseColor } from "@rivetjs/cdk/color";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { AlertDialog, ColorField, DateField, DatePicker, Description, Dropdown, FieldError, Input, Label, ListBox, Modal, TextField } from "../index.ts";

/** Every IDREF token of `aria-describedby` / `aria-labelledby` resolves to an `id` in `html`; returns the attributes. */
function assertIdrefs(html: string): string[] {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  const refs = [...html.matchAll(/\saria-(?:describedby|labelledby)="([^"]*)"/g)].map((m) => m[0].trim());
  for (const ref of refs)
    for (const token of /"([^"]*)"/.exec(ref)![1]!.split(/\s+/).filter(Boolean)) assert.ok(ids.has(token), `dangling IDREF ${token} in ${ref}`);
  return refs;
}
const describedBy = (html: string, tag: string): string | undefined => new RegExp(`<${tag}[^>]*\\saria-describedby="([^"]*)"`).exec(html)?.[1];

test("text-field: render-function Description child is probed", async () => {
  const html = await renderToString(() => (
    <TextField name="a">
      <Label>A</Label>
      <Input />
      {() => <Description>Hint</Description>}
    </TextField>
  ));
  assertIdrefs(html);
  assert.ok(describedBy(html, "input"), "input names the render-function Description");
});

test("text-field: Description nested in a lazy wrapper is probed", async () => {
  const Wrap = (props: { children?: unknown }) => <div class="wrap">{props.children as never}</div>;
  const html = await renderToString(() => (
    <TextField name="a">
      <Label>A</Label>
      <Input />
      <Wrap>
        <Description>Hint</Description>
      </Wrap>
    </TextField>
  ));
  assertIdrefs(html);
  assert.ok(describedBy(html, "input"));
});

test("text-field: FieldError id only while invalid; no Description → no describedby", async () => {
  const valid = await renderToString(() => (
    <TextField name="a">
      <Label>A</Label>
      <Input />
      <FieldError>Bad</FieldError>
    </TextField>
  ));
  assertIdrefs(valid);
  assert.equal(describedBy(valid, "input"), undefined);
  const invalid = await renderToString(() => (
    <TextField name="a" isInvalid>
      <Label>A</Label>
      <Input />
      <FieldError>Bad</FieldError>
    </TextField>
  ));
  assertIdrefs(invalid);
  assert.ok(describedBy(invalid, "input"), "invalid field names its FieldError");
});

test("text-field: children render twice on the server, a child's effect runs at most once", async () => {
  let renders = 0;
  let effects = 0;
  const Counted = () => {
    renders++;
    effect(() => void effects++);
    return <Description>Hint</Description>;
  };
  const html = await renderToString(() => (
    <TextField name="a">
      <Label>A</Label>
      <Input />
      {() => <Counted />}
    </TextField>
  ));
  assertIdrefs(html);
  // Probe + real render; the probe's root is disposed before its effects could run (server effects: the real render only).
  assert.equal(renders, 2);
  assert.ok(effects <= 1, `effects ${effects}`);
});

test("date-field / date-picker / color-field: describedby names only the parts that render", async () => {
  for (const withDescription of [false, true]) {
    const html = await renderToString(() => (
      <I18nProvider locale="en-US">
        <DateField name="d" defaultValue={new CalendarDate(2026, 8, 15)}>
          <Label>Date</Label>
          <DateField.Group>
            <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          </DateField.Group>
          {withDescription && <Description>When</Description>}
        </DateField>
        <DatePicker name="p" defaultValue={new CalendarDate(2026, 8, 15)}>
          <Label>Pick</Label>
          <DateField.Group>
            <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          </DateField.Group>
          {withDescription && <Description>When</Description>}
        </DatePicker>
        <ColorField name="c" defaultValue={parseColor("#0485F7")}>
          <Label>Color</Label>
          <ColorField.Group>
            <ColorField.Input />
          </ColorField.Group>
          {withDescription && <Description>Pick a color</Description>}
        </ColorField>
      </I18nProvider>
    ));
    const refs = assertIdrefs(html);
    if (withDescription) assert.ok(refs.filter((r) => r.startsWith("aria-describedby")).length >= 3, refs.join("\n"));
  }
});

test("listbox / menu items and dialog: label / description ids follow their parts", async () => {
  const html = await renderToString(() => (
    <div>
      <ListBox aria-label="Options">
        <ListBox.Item id="a" textValue="A">
          <Label>A</Label>
          <Description>First</Description>
        </ListBox.Item>
        <ListBox.Item id="b" textValue="B">
          <Label>B</Label>
        </ListBox.Item>
      </ListBox>
      <Dropdown defaultOpen>
        <Dropdown.Trigger aria-label="Menu">Actions</Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu>
            <Dropdown.Item id="x" textValue="X">
              <Label>X</Label>
              <Description>Ex</Description>
            </Dropdown.Item>
            <Dropdown.Item id="y" textValue="Y">
              <Label>Y</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <Modal defaultOpen>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Welcome</Modal.Heading>
              </Modal.Header>
              <Modal.Body>Body</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <AlertDialog defaultOpen>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>Delete?</AlertDialog.Heading>
              </AlertDialog.Header>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
      <AlertDialog defaultOpen>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>Delete all?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <Description>Cannot be undone.</Description>
              </AlertDialog.Body>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  ));
  const refs = assertIdrefs(html);
  // Items with a Description name it; the Label-only items (ui Label is not the item's label Text slot) name nothing dangling.
  const option = (key: string) => new RegExp(`<div[^>]*id="[^"]*option-${key}"[^>]*>`).exec(html)?.[0] ?? "";
  assert.match(option("a"), /aria-describedby="[^"]*option-a-description"/);
  assert.doesNotMatch(option("b"), /aria-describedby/);
  assert.ok(
    refs.some((r) => /^aria-describedby="[^"]*-description"/.test(r) && r.includes("x")),
    refs.join("\n"),
  );
  // Alert dialogs: the content id only while a Description takes it (it used to be kept, an IDREF to nothing without one).
  const dialogs = html.match(/<[a-z]+[^>]*role="alertdialog"[^>]*>/g) ?? [];
  assert.equal(dialogs.length, 2);
  assert.doesNotMatch(dialogs[0]!, /aria-describedby/);
  assert.match(dialogs[1]!, /aria-describedby=/);
});
