// DOM-target suite (Rivet, identity T20): `Form` with a `@rivetjs/forms` store (`form` + `definition`): form id / method /
// action / noValidate, issues reach named fields (aria-invalid, FieldError text in the TextField shorthand, describedby),
// blur validation through the delegated `focusout`, submit validates + focuses the first invalid field, `initial` values
// echo into named TextFields, submit Buttons are pending while the store submits, a Form without `form` is the plain cdk Form. Resumed page + no-JS posts:
// `libs/forms/tests/app.test.ts` (route `ui-signup`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();
// The forms handlers read `new FormData(form)`: happy-dom's (Node's own rejects a happy-dom form).
globalThis.FormData = (window as unknown as typeof globalThis).FormData;
// The enhanced submit path loads the router client (reads `location`).
(globalThis as { location?: Location }).location ??= window.location;

const { render, flush } = await import("@rivetjs/runtime/testing");
const { createForm, defineForm, setIssues } = await import("@rivetjs/forms");
type StandardSchemaV1<I, O> = import("@rivetjs/forms").StandardSchemaV1<I, O>;
const { Form } = await import("../src/components/form/index.ts");
const { TextField } = await import("../src/components/textfield/index.ts");
const { Button } = await import("../src/components/button/index.ts");

type Signup = { name: string; email: string };
const signup = defineForm({
  name: "signup",
  schema: {
    "~standard": {
      version: 1,
      vendor: "test",
      validate(input: unknown) {
        const all = (input ?? {}) as Record<string, string | undefined>;
        const issues = [];
        if (!all.name) issues.push({ message: "Name is required", path: ["name"] });
        if (!all.email || !all.email.includes("@")) issues.push({ message: "Enter an email", path: ["email"] });
        return issues.length ? { issues } : { value: all as Signup };
      },
    },
  } as StandardSchemaV1<Signup, Signup>,
  validateOn: "blur",
});

const wait = () => new Promise((r) => setTimeout(r, 30));
let root: ParentNode = document;
const input = (name: string) => root.querySelector(`input[name=${name}]`) as HTMLInputElement;

const Fixture = (props: { initial?: Partial<Signup> }) => {
  const form = createForm(signup, { initial: props.initial as Signup });
  return (
    <Form form={form} definition={signup}>
      <TextField name="name" label="Name" />
      <TextField name="email" label="Email" />
      <Button type="submit">Sign up</Button>
    </Form>
  );
};

test("form store: id / method / action / noValidate from the store and definition", () => {
  const r = render(() => <Fixture />);
  root = r.container;
  const el = r.container.querySelector("form")!;
  assert.match(el.id, /\S/);
  assert.equal(el.getAttribute("method"), "post");
  assert.equal(el.getAttribute("action"), "?/signup");
  assert.equal(el.noValidate, true);
  r.unmount();
});

test("form store: blur validates (validateOn blur): the named field shows its issue with no per-field glue", async () => {
  const r = render(() => <Fixture />);
  root = r.container;
  const email = input("email");
  email.value = "nope";
  email.dispatchEvent(new Event("input", { bubbles: true }));
  email.dispatchEvent(new Event("focusout", { bubbles: true }));
  await wait();
  flush();
  assert.equal(email.getAttribute("aria-invalid"), "true");
  const error = r.container.querySelector('[data-slot="field-error"]') as HTMLElement;
  assert.equal(error?.textContent, "Enter an email");
  assert.ok(email.getAttribute("aria-describedby")?.split(" ").includes(error.id));
  assert.equal(input("name").getAttribute("aria-invalid"), null);
  r.unmount();
});

test("form store: setIssues reaches the field; submit validates every field and focuses the first invalid one", async () => {
  let store: ReturnType<typeof createForm<typeof signup>> | undefined;
  const r = render(() => {
    const form = (store = createForm(signup));
    return (
      <Form form={form} definition={signup}>
        <TextField name="name" label="Name" />
        <TextField name="email" label="Email" />
        <Button type="submit">Sign up</Button>
      </Form>
    );
  });
  root = r.container;
  setIssues(store!, { email: ["Taken"] });
  await wait();
  flush();
  assert.equal(input("email").getAttribute("aria-invalid"), "true");
  assert.match(r.container.textContent!, /Taken/);
  setIssues(store!, { email: [] });
  await wait();
  flush();
  r.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await wait();
  flush();
  assert.equal(input("name").getAttribute("aria-invalid"), "true");
  assert.equal(document.activeElement, input("name"));
  assert.match(r.container.textContent!, /Name is required/);
  r.unmount();
});

test("form store: a submit Button is pending while the store's submit runs", async () => {
  let finish = () => {};
  const slow = defineForm({ ...signup, name: "slow", submit: () => new Promise<void>((done) => (finish = done)) } as never);
  const r = render(() => {
    const form = createForm(slow as typeof signup, { initial: { name: "Ada", email: "ada@example.com" } });
    return (
      <Form form={form} definition={slow as typeof signup}>
        <TextField name="name" label="Name" />
        <TextField name="email" label="Email" />
        <Button type="submit">Sign up</Button>
        <Button>Other</Button>
      </Form>
    );
  });
  root = r.container;
  const [submit, other] = r.container.querySelectorAll("button");
  assert.equal(submit!.hasAttribute("data-pending"), false);
  r.container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await wait();
  flush();
  assert.equal(submit!.getAttribute("data-pending"), "true");
  assert.equal(other!.hasAttribute("data-pending"), false);
  finish();
  await wait();
  flush();
  assert.equal(submit!.hasAttribute("data-pending"), false);
  r.unmount();
});

test("form store: named TextFields start from the store's initial values; a Form without form is the cdk Form", () => {
  const r = render(() => <Fixture initial={{ name: "Ada" }} />);
  root = r.container;
  assert.equal(input("name").value, "Ada");
  assert.equal(input("email").value, "");
  r.unmount();
  const plain = render(() => (
    <Form>
      <TextField name="x" label="X" />
    </Form>
  ));
  const el = plain.container.querySelector("form")!;
  assert.equal(el.getAttribute("action"), null);
  assert.equal(el.noValidate, false);
  assert.equal(plain.container.querySelector('[data-slot="field-error"]'), null);
  plain.unmount();
});
