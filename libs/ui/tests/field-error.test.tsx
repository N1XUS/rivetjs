// DOM-target suite: `FieldError` (upstream field-error tests ported): shown only while invalid, `data-slot`, render props.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Provider } = await import("@rivetjs/runtime/dom");
const { FieldErrorContext } = await import("@rivetjs/cdk/form");
const { TextField, TextFieldContext } = await import("@rivetjs/cdk/text-field");
const { FieldError, FieldErrorRoot, fieldErrorVariants } = await import("../src/components/field-error/index.ts");

const invalid = signal(true);
const validation = () => ({
  isInvalid: invalid(),
  validationErrors: invalid() ? ["Enter a valid email"] : [],
  validationDetails: {} as never,
});

test("field-error: shown while invalid, removed when valid (accessor context)", () => {
  invalid.set(true);
  const r = render(() => (
    <Provider token={FieldErrorContext} value={validation}>
      {() => <FieldError class="mt-1">Enter a valid email</FieldError>}
    </Provider>
  ));
  const e = r.container.querySelector('[data-slot="field-error"]')!;
  assert.ok(e);
  assert.equal(e.className, "field-error mt-1");
  assert.equal(e.textContent, "Enter a valid email");
  invalid.set(false);
  assert.equal(r.container.querySelector('[data-slot="field-error"]'), null);
  r.unmount();
});

test("field-error: render-prop children (isInvalid accessor) + default children = validation errors", () => {
  invalid.set(true);
  const r = render(() => (
    <Provider token={FieldErrorContext} value={validation}>
      {() => (
        <>
          <FieldError>{({ isInvalid }: { isInvalid: () => boolean }) => (isInvalid() ? "Rendered via props" : null)}</FieldError>
          <FieldError data-x="1" />
        </>
      )}
    </Provider>
  ));
  const [a, b] = Array.from(r.container.querySelectorAll('[data-slot="field-error"]'));
  assert.equal(a.textContent, "Rendered via props");
  assert.equal(b.textContent, "Enter a valid email");
  assert.equal(b.getAttribute("data-x"), "1");
  r.unmount();
});

test("field-error: class function composes with the BEM base", () => {
  invalid.set(true);
  const r = render(() => (
    <Provider token={FieldErrorContext} value={validation}>
      {() => <FieldError class={({ isInvalid }: { isInvalid: () => boolean }) => (isInvalid() ? "text-red" : "")}>m</FieldError>}
    </Provider>
  ));
  assert.equal(r.container.querySelector('[data-slot="field-error"]')?.className, "field-error text-red");
  r.unmount();
});

test("field-error: inside a cdk TextField with isInvalid", () => {
  const r = render(() => (
    <TextField isInvalid name="email">
      <FieldError>Enter a valid email</FieldError>
    </TextField>
  ));
  assert.ok(r.container.querySelector('[data-slot="field-error"]'));
  r.unmount();
  const v = render(() => (
    <TextField name="email">
      <FieldError>Enter a valid email</FieldError>
    </TextField>
  ));
  assert.equal(v.container.querySelector('[data-slot="field-error"]'), null);
  v.unmount();
  assert.equal(FieldError, FieldErrorRoot);
  assert.equal(fieldErrorVariants(), "field-error");
  void TextFieldContext;
});
