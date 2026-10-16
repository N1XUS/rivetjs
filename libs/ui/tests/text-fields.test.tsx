// DOM-target suite: `Input`, `TextArea`, `TextField`, `Form`, `Fieldset` (upstream input / textarea / textfield / form / fieldset tests ported).
// Typing = `value` + an `input` event (happy-dom; upstream user-event `type`); focus-visible via Tab and form submit by a click run in
// Chromium (`tests-components/forms.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render, flush } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Input, InputRoot, inputVariants } = await import("../src/components/input/index.ts");
const { TextArea, TextAreaRoot, textAreaVariants } = await import("../src/components/textarea/index.ts");
const { TextField, TextFieldRoot, TextFieldContext, textFieldVariants } = await import("../src/components/textfield/index.ts");
const { Form, FormRoot } = await import("../src/components/form/index.ts");
const { Fieldset, FieldsetRoot, FieldsetLegend, FieldGroup, FieldsetActions, fieldsetVariants } = await import("../src/components/fieldset/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { Description } = await import("../src/components/description/index.ts");
const { FieldError } = await import("../src/components/field-error/index.ts");
const { Button } = await import("../src/components/button/index.ts");
const { Checkbox: CdkCheckbox, CheckboxGroup: CdkCheckboxGroup } = await import("@rivetjs/cdk/checkbox");

const type = (el: HTMLInputElement | HTMLTextAreaElement, text: string) => {
  for (const ch of text) {
    el.value += ch;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
};

/* ------------------------------------------------------------------ Input */

test("input: textbox with accessible name, BEM block + data-slot, variant modifier", () => {
  const r = render(() => (
    <div>
      <Input aria-label="Name" placeholder="John" />
      <Input aria-label="Other" variant="secondary" />
      <Input aria-label="Wide" fullWidth />
    </div>
  ));
  const [a, b, c] = [...r.container.querySelectorAll("input")];
  assert.equal(a!.getAttribute("aria-label"), "Name");
  assert.equal(a!.getAttribute("data-slot"), "input");
  assert.equal(a!.className, "input input--primary");
  assert.equal(b!.className, "input input--secondary");
  assert.equal(c!.className, "input input--full-width input--primary");
  r.unmount();
});

test("input: typing calls onChange; disabled", () => {
  const calls: unknown[] = [];
  const r = render(() => (
    <div>
      <Input aria-label="Name" onInput={(e: Event) => calls.push((e.target as HTMLInputElement).value)} />
      <Input aria-label="Off" disabled />
    </div>
  ));
  const [a, b] = [...r.container.querySelectorAll("input")];
  type(a!, "Ada");
  assert.equal(a!.value, "Ada");
  assert.deepEqual(calls, ["A", "Ad", "Ada"]);
  assert.equal(b!.disabled, true);
  r.unmount();
});

test("input: class composes after the variant classes; ref; index exports", () => {
  let el: Element | undefined;
  const r = render(() => <Input aria-label="Name" class="w-64" ref={(e: Element) => (el = e)} />);
  assert.equal(r.container.querySelector("input")!.className, "input input--primary w-64");
  assert.equal(el?.tagName, "INPUT");
  r.unmount();
  assert.equal(Input, InputRoot);
  assert.equal(Input.Root, InputRoot);
  assert.equal(inputVariants({ variant: "secondary" }), "input input--secondary");
});

test("input: live variant / fullWidth update the class in place", async () => {
  const variant = signal<"primary" | "secondary">("primary");
  const wide = signal(false);
  const r = render(() => <Input aria-label="Name" variant={variant()} fullWidth={wide()} />);
  const el = r.container.querySelector("input")!;
  variant.set("secondary");
  wide.set(true);
  await flush();
  assert.equal(r.container.querySelector("input"), el);
  assert.equal(el.className, "input input--full-width input--secondary");
  r.unmount();
});

/* ------------------------------------------------------------------ TextArea */

test("textarea: textarea element, BEM + data-slot, variant, typing, disabled", () => {
  const r = render(() => (
    <div>
      <TextArea aria-label="Bio" placeholder="Tell us about yourself" />
      <TextArea aria-label="Bio 2" variant="secondary" disabled />
    </div>
  ));
  const [a, b] = [...r.container.querySelectorAll("textarea")];
  assert.equal(a!.tagName, "TEXTAREA");
  assert.equal(a!.getAttribute("data-slot"), "textarea");
  assert.equal(a!.className, "textarea textarea--primary");
  assert.equal(b!.className, "textarea textarea--secondary");
  assert.equal(b!.disabled, true);
  type(a!, "Hello");
  assert.equal(a!.value, "Hello");
  r.unmount();
  assert.equal(TextArea, TextAreaRoot);
  assert.equal(textAreaVariants({ fullWidth: true }), "textarea textarea--full-width textarea--primary");
});

/* ------------------------------------------------------------------ TextField */

const field = (props: Record<string, unknown> = {}) =>
  render(() => (
    <TextField name="name" {...props}>
      <Label>Your name</Label>
      <Input placeholder="John" />
    </TextField>
  ));

test("textfield: label names the input; data-slots + BEM blocks", () => {
  const r = field();
  const input = r.container.querySelector("input")!;
  const label = r.container.querySelector("label")!;
  assert.equal(input.getAttribute("aria-labelledby"), label.id);
  assert.equal(label.getAttribute("for"), input.id);
  const root = r.container.querySelector('[data-slot="textfield"]')!;
  assert.equal(root.className, "textfield");
  assert.equal(input.className, "input input--primary");
  r.unmount();
});

test("textfield: Input / TextArea variant from the TextField context; fullWidth", () => {
  const r = render(() => (
    <div>
      <TextField name="a" variant="secondary" fullWidth>
        <Label>A</Label>
        <Input />
      </TextField>
      <TextField name="b" variant="secondary">
        <Label>B</Label>
        <TextArea />
      </TextField>
    </div>
  ));
  assert.equal(r.container.querySelector("input")!.className, "input input--secondary");
  assert.equal(r.container.querySelector("textarea")!.className, "textarea textarea--secondary");
  assert.equal(r.container.querySelector('[data-slot="textfield"]')!.className, "textfield textfield--full-width");
  r.unmount();
});

test("textfield: typing calls onChange with the value; TextArea composition", () => {
  const calls: string[] = [];
  const bio: string[] = [];
  const r = render(() => (
    <div>
      <TextField name="name" onChange={(v: string) => calls.push(v)}>
        <Label>Your name</Label>
        <Input />
      </TextField>
      <TextField name="bio" onChange={(v: string) => bio.push(v)}>
        <Label>Bio</Label>
        <TextArea />
      </TextField>
    </div>
  ));
  const input = r.container.querySelector("input")!;
  type(input, "Ada");
  assert.equal(input.value, "Ada");
  assert.equal(calls.at(-1), "Ada");
  const ta = r.container.querySelector("textarea")!;
  type(ta, "Hello");
  assert.equal(bio.at(-1), "Hello");
  r.unmount();
});

test("textfield: controlled value (two-way signal)", async () => {
  const value = signal("Ada");
  const r = render(() => (
    <TextField name="name" value={value}>
      <Label>Your name</Label>
      <Input />
    </TextField>
  ));
  const input = r.container.querySelector("input")!;
  assert.equal(input.value, "Ada");
  type(input, "!");
  assert.equal(value(), "Ada!");
  value.set("Grace");
  await flush();
  assert.equal(input.value, "Grace");
  r.unmount();
});

test("textfield: disabled state", () => {
  const r = field({ isDisabled: true });
  assert.equal(r.container.querySelector("input")!.disabled, true);
  assert.equal(r.container.querySelector('[data-slot="textfield"]')!.getAttribute("data-disabled"), "true");
  r.unmount();
});

test("textfield: FieldError renders while invalid, not while valid", () => {
  const r = render(() => (
    <div>
      <TextField isInvalid isRequired name="password" type="password">
        <Label>Password</Label>
        <Input />
        <FieldError>Password must be longer than 8 characters</FieldError>
      </TextField>
      <TextField name="other" type="password">
        <Label>Other</Label>
        <Input />
        <FieldError>Never shown</FieldError>
      </TextField>
    </div>
  ));
  const errors = r.container.querySelectorAll('[data-slot="field-error"]');
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.textContent, "Password must be longer than 8 characters");
  assert.equal(r.container.querySelector('[data-slot="textfield"]')!.getAttribute("data-invalid"), "true");
  r.unmount();
});

test("textfield: Description describes the input", async () => {
  const r = render(() => (
    <TextField name="name">
      <Label>Your name</Label>
      <Input />
      <Description>Visible to other users</Description>
    </TextField>
  ));
  await flush();
  const input = r.container.querySelector("input")!;
  const description = r.container.querySelector('[data-slot="description"]')!;
  assert.equal(input.getAttribute("aria-describedby"), description.id);
  assert.equal(description.textContent, "Visible to other users");
  r.unmount();
});

test("textfield: shorthand label / description / errorMessage / placeholder = the compound parts (Rivet addition)", async () => {
  const short = render(() => (
    <TextField isInvalid name="email" label="Email" description="Work address" errorMessage="Enter a valid email" placeholder="you@example.com" />
  ));
  const compound = render(() => (
    <TextField isInvalid name="email">
      <Label>Email</Label>
      <Input placeholder="you@example.com" />
      <Description>Work address</Description>
      <FieldError>Enter a valid email</FieldError>
    </TextField>
  ));
  await flush();
  const shape = (root: Element | DocumentFragment) =>
    [...root.querySelectorAll("[data-slot]")].map(
      (el) => `${el.tagName}.${el.className}[${el.getAttribute("data-slot")}] ${el.children.length ? "" : el.textContent}`,
    );
  assert.deepEqual(shape(short.container), shape(compound.container));
  const input = short.container.querySelector("input")!;
  assert.equal(input.placeholder, "you@example.com");
  assert.equal(short.container.querySelector("label")!.htmlFor, input.id);
  const described = input.getAttribute("aria-describedby")!.split(" ");
  assert.ok(described.includes(short.container.querySelector('[data-slot="description"]')!.id));
  short.unmount();
  compound.unmount();
});

test("textfield: shorthand props are live; explicit children win over the shorthand", async () => {
  const label = signal("First");
  const r = render(() => <TextField name="n" label={label()} />);
  await flush();
  const el = r.container.querySelector("label")!;
  assert.equal(el.textContent, "First");
  label.set("Second");
  await flush();
  assert.equal(r.container.querySelector("label"), el);
  assert.equal(el.textContent, "Second");
  assert.equal(r.container.querySelector('[data-slot="description"]'), null);
  assert.equal(r.container.querySelector('[data-slot="field-error"]'), null);
  r.unmount();
  const c = render(() => (
    <TextField name="n" label="ignored">
      <Input aria-label="own" />
    </TextField>
  ));
  assert.equal(c.container.querySelector("label"), null);
  c.unmount();
});

test("textfield: live variant reaches Input through the context in place", async () => {
  const variant = signal<"primary" | "secondary">("primary");
  const r = render(() => (
    <TextField name="name" variant={variant()}>
      <Label>Your name</Label>
      <Input />
    </TextField>
  ));
  const input = r.container.querySelector("input")!;
  variant.set("secondary");
  await flush();
  assert.equal(r.container.querySelector("input"), input);
  assert.equal(input.className, "input input--secondary");
  r.unmount();
});

test("textfield: render-prop children; index exports", () => {
  const r = render(() => (
    <TextField name="name" isDisabled>
      {({ isDisabled }: { isDisabled: () => boolean }) => (
        <>
          <Label>{isDisabled() ? "Disabled" : "Enabled"}</Label>
          <Input />
        </>
      )}
    </TextField>
  ));
  assert.equal(r.container.querySelector("label")!.textContent, "Disabled");
  r.unmount();
  assert.equal(TextField, TextFieldRoot);
  assert.ok(TextFieldContext);
  assert.equal(textFieldVariants({ fullWidth: true }), "textfield textfield--full-width");
});

/* ------------------------------------------------------------------ Form */

test("form: a form element that nests fields; onSubmit; index exports", () => {
  let submitted = 0;
  const r = render(() => (
    <Form
      aria-label="Profile"
      onSubmit={(e: Event) => {
        e.preventDefault();
        submitted++;
      }}
    >
      <TextField defaultValue="Ada" name="name">
        <Label>Your name</Label>
        <Input />
      </TextField>
      <Button type="submit">Save</Button>
    </Form>
  ));
  const form = r.container.querySelector("form")!;
  assert.equal(form.getAttribute("aria-label"), "Profile");
  assert.equal(r.container.querySelector("input")!.value, "Ada");
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(submitted, 1);
  r.unmount();
  assert.equal(Form, FormRoot);
});

test("form: validationErrors reach a nested FieldError", () => {
  const r = render(() => (
    <Form aria-label="Profile" validationErrors={{ name: "Name is required" }}>
      <TextField name="name">
        <Label>Your name</Label>
        <Input />
        <FieldError />
      </TextField>
    </Form>
  ));
  const error = r.container.querySelector('[data-slot="field-error"]');
  assert.equal(error?.textContent, "Name is required");
  r.unmount();
});

/* ------------------------------------------------------------------ Fieldset */

test("fieldset: composed legend / group / actions with data-slots + BEM", () => {
  const r = render(() => (
    <Fieldset>
      <Fieldset.Legend data-testid="legend">Profile</Fieldset.Legend>
      <Fieldset.Group data-testid="group">
        <span>Name field</span>
      </Fieldset.Group>
      <Fieldset.Actions data-testid="actions">
        <button type="submit">Save</button>
      </Fieldset.Actions>
    </Fieldset>
  ));
  const root = r.container.firstElementChild!;
  assert.equal(root.tagName, "FIELDSET");
  assert.equal(root.getAttribute("data-slot"), "fieldset");
  assert.equal(root.className, "fieldset");
  const q = (id: string) => r.container.querySelector(`[data-testid="${id}"]`)!;
  assert.equal(q("legend").getAttribute("data-slot"), "fieldset-legend");
  assert.equal(q("legend").className, "fieldset__legend");
  assert.equal(q("legend").textContent, "Profile");
  assert.equal(q("group").getAttribute("data-slot"), "fieldset-field-group");
  assert.equal(q("group").className, "fieldset__field-group");
  assert.equal(q("actions").getAttribute("data-slot"), "fieldset-actions");
  assert.equal(q("actions").className, "fieldset__actions");
  assert.equal(r.container.querySelector("button")!.textContent, "Save");
  r.unmount();
});

test("fieldset: data attribute passthrough; data-disabled from native disabled; parts outside a Fieldset", () => {
  const r = render(() => (
    <div>
      <Fieldset data-foo="bar" data-testid="a">
        Content
      </Fieldset>
      <Fieldset disabled data-testid="b">
        Content
      </Fieldset>
      <FieldsetLegend class="x">Loose</FieldsetLegend>
    </div>
  ));
  assert.equal(r.container.querySelector('[data-testid="a"]')!.getAttribute("data-foo"), "bar");
  assert.equal(r.container.querySelector('[data-testid="a"]')!.getAttribute("data-disabled"), null);
  assert.equal(r.container.querySelector('[data-testid="b"]')!.getAttribute("data-disabled"), "true");
  assert.equal(r.container.querySelector("legend")!.className, "x");
  r.unmount();
});

test("fieldset: disabled forwards isDisabled through the RAC contexts (Button, CheckboxGroup)", () => {
  const r = render(() => (
    <Fieldset disabled>
      <Button>Save</Button>
      <CdkCheckboxGroup aria-label="Options">
        <CdkCheckbox value="a">A</CdkCheckbox>
      </CdkCheckboxGroup>
    </Fieldset>
  ));
  assert.equal(r.container.querySelector("button")!.getAttribute("data-disabled"), "true");
  assert.equal(r.container.querySelector('[role="group"]')!.getAttribute("data-disabled"), "true");
  r.unmount();
  assert.equal(Fieldset, FieldsetRoot);
  assert.equal(Fieldset.Group, FieldGroup);
  assert.equal(Fieldset.Actions, FieldsetActions);
  assert.equal(fieldsetVariants().legend(), "fieldset__legend");
});
