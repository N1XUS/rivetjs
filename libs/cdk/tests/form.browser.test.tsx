// Ported from react-aria-components test/Form.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `useState` server errors → a signal read by an accessor `validationErrors`; default classes `rv-*`; slot ids
// (`aria-describedby`) settle after a microtask (RA `useSlotId` effect).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
// "shows focus-visible …": the pre-check after the click is dropped (Chromium focuses the invalid field natively).
// Rivet additions (end of file): `onInvalid` sees each invalid field; `preventDefault()` there keeps focus put.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { FieldError } from "../form/field-error.tsx";
import { Form } from "../form/index.tsx";
import { Input } from "../input/index.tsx";
import { Label } from "../label/index.tsx";
import { TextField } from "../text-field/index.tsx";

afterEach(cleanup);

function renderUI(ui: () => unknown) {
  const result = render(ui as never);
  return { ...within(result.container as HTMLElement), container: result.container as HTMLElement };
}

const microtasks = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

describe("Form", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("supports server validation errors", async () => {
    const serverErrors = signal<Record<string, string>>({});
    const { getByTestId, getByRole } = renderUI(() => (
      <Form
        data-testid="form"
        onSubmit={(e) => {
          e.preventDefault();
          serverErrors.set({ name: "Invalid name." });
        }}
        validationErrors={() => serverErrors()}
      >
        <TextField name="name">
          <Label>Name</Label>
          <Input />
          <FieldError />
        </TextField>
        <Button type="submit">Submit</Button>
      </Form>
    ));
    await microtasks();

    const form = getByTestId("form") as HTMLFormElement;
    expect(form).toHaveClass("rv-Form");

    const input = getByRole("textbox") as HTMLInputElement;
    expect(input).not.toHaveAttribute("aria-describedby");

    await user.click(getByRole("button"));
    await microtasks();
    form.checkValidity();
    await microtasks();

    expect(input).toHaveAttribute("aria-describedby");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent("Invalid name.");
    expect(input.validity.valid).toBe(false);
    expect(document.activeElement).toBe(input);

    // Clicking twice doesn't clear server errors.
    await user.click(getByRole("button"));
    await microtasks();
    form.checkValidity();
    await microtasks();

    expect(input).toHaveAttribute("aria-describedby");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent("Invalid name.");
    expect(input.validity.valid).toBe(false);
    expect(document.activeElement).toBe(input);

    await user.clear(input);
    await user.keyboard("Devon");
    await user.tab();
    await microtasks();

    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(true);
  });

  it('should use validationBehavior="native" by default', () => {
    const { getByTestId, getByRole } = renderUI(() => (
      <Form data-testid="form">
        <TextField name="name" isRequired>
          <Label>Name</Label>
          <Input />
          <FieldError />
        </TextField>
        <Button type="submit">Submit</Button>
      </Form>
    ));
    const form = getByTestId("form");
    expect(form).toHaveClass("rv-Form");
    expect(form).not.toHaveAttribute("novalidate");
    const input = getByRole("textbox");
    expect(input).toHaveAttribute("required");
    expect(input).not.toHaveAttribute("aria-required");
  });

  it('supports validationBehavior="aria"', () => {
    const { getByTestId, getByRole } = renderUI(() => (
      <Form data-testid="form" validationBehavior="aria">
        <TextField name="name" isRequired>
          <Label>Name</Label>
          <Input />
          <FieldError />
        </TextField>
        <Button type="submit">Submit</Button>
      </Form>
    ));
    const form = getByTestId("form");
    expect(form).toHaveClass("rv-Form");
    expect(form).toHaveAttribute("novalidate");
    const input = getByRole("textbox");
    expect(input).not.toHaveAttribute("required");
    expect(input).toHaveAttribute("aria-required");
  });

  it('Form element\'s validationBehavior="aria" should override Form\'s default validationBehavior="native"', () => {
    const { getByTestId, getByRole } = renderUI(() => (
      <Form data-testid="form">
        <TextField name="name" isRequired validationBehavior="aria">
          <Label>Name</Label>
          <Input />
          <FieldError />
        </TextField>
        <Button type="submit">Submit</Button>
      </Form>
    ));
    const form = getByTestId("form");
    expect(form).not.toHaveAttribute("novalidate");
    const input = getByRole("textbox");
    expect(input).not.toHaveAttribute("required");
    expect(input).toHaveAttribute("aria-required");
  });

  it('Form element\'s validationBehavior="native" should override Form\'s validationBehavior="aria"', () => {
    const { getByTestId, getByRole } = renderUI(() => (
      <Form data-testid="form" validationBehavior="aria">
        <TextField name="name" isRequired validationBehavior="native">
          <Label>Name</Label>
          <Input />
          <FieldError />
        </TextField>
        <Button type="submit">Submit</Button>
      </Form>
    ));
    const form = getByTestId("form");
    expect(form).toHaveAttribute("novalidate");
    const input = getByRole("textbox");
    expect(input).toHaveAttribute("required");
    expect(input).not.toHaveAttribute("aria-required");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("shows focus-visible when a form library moves focus to the first invalid field on submit", async () => {
    const { getByRole } = renderUI(() => (
      <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
        <Input aria-label="Name" name="name" required />
        <Button type="submit">Submit</Button>
      </form>
    ));
    const input = getByRole("textbox") as HTMLInputElement;
    const button = getByRole("button");

    await user.click(button);
    // Chromium (unlike jsdom) runs interactive validation on submit and focuses the field itself; the
    // upstream "not focus-visible yet" assertion only holds in jsdom.

    input.checkValidity();
    input.focus();
    await microtasks();

    expect(document.activeElement).toBe(input);
    expect(input).toHaveAttribute("data-focus-visible");
  });

  it("should not throw when form contains elements without validity property", async () => {
    const { getByTestId, getByRole } = renderUI(() => (
      <Form data-testid="form">
        <TextField name="name" isRequired>
          <Label>Name</Label>
          <Input />
          <FieldError />
        </TextField>
        <Button type="submit">Submit</Button>
      </Form>
    ));
    const form = getByTestId("form") as HTMLFormElement;
    const input = getByRole("textbox");

    const originalElements = form.elements;
    const mockElement = { name: "custom-element" };
    Object.defineProperty(form, "elements", {
      get: () => ({
        length: originalElements.length + 1,
        [Symbol.iterator]: function* () {
          yield mockElement;
          yield* originalElements;
        },
        0: mockElement,
        ...Array.from(originalElements).reduce((acc, el, i) => ({ ...acc, [i + 1]: el }), {}),
      }),
      configurable: true,
    });

    await user.click(getByRole("button"));
    expect(document.activeElement).toBe(input);

    Object.defineProperty(form, "elements", { get: () => originalElements, configurable: true });
  });
});

describe("Form (Rivet)", () => {
  it("onInvalid sees each invalid field; preventDefault keeps the field from focusing itself", async () => {
    const user = userEvent.setup();
    const onInvalid = vi.fn((e: Event) => e.preventDefault());
    const { getByRole, getAllByRole } = renderUI(() => (
      <Form onInvalid={onInvalid}>
        <TextField name="a" isRequired>
          <Label>A</Label>
          <Input />
        </TextField>
        <TextField name="b" isRequired>
          <Label>B</Label>
          <Input />
        </TextField>
        <Button type="submit">Submit</Button>
      </Form>
    ));
    await user.click(getByRole("button"));
    expect(onInvalid).toHaveBeenCalledTimes(2);
    expect(getAllByRole("textbox")).not.toContain(document.activeElement);
  });
});
