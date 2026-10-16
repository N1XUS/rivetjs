// Ported from react-aria-components test/FieldError.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`.
// Skipped: "does not warn when render prop returns element matching elementType" and "warns when render prop
// returns element that does not match elementType" (no RAC `render` prop in Rivet).
// Rivet additions (end of file): renders nothing while the field is valid; default children join the errors;
// accessor validation in `FieldErrorContext`.
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { FieldError, FieldErrorContext } from "../form/field-error.tsx";
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

describe("FieldError", () => {
  it("supports data attributes passed as props", () => {
    const TEST_ID = "testid";
    const { getByTestId } = renderUI(() => (
      <TextField isInvalid>
        <Label>Email</Label>
        <Input />
        <FieldError data-testid={TEST_ID}>An error</FieldError>
      </TextField>
    ));
    expect(getByTestId(TEST_ID)).toHaveTextContent("An error");
  });

  it("renders as span by default", () => {
    const { getByText } = renderUI(() => (
      <TextField isInvalid>
        <Label>Email</Label>
        <Input />
        <FieldError>An error</FieldError>
      </TextField>
    ));
    expect(getByText("An error").tagName).toBe("SPAN");
  });

  it("supports elementType prop", () => {
    const { getByText } = renderUI(() => (
      <TextField isInvalid>
        <Label>Email</Label>
        <Input />
        <FieldError elementType="div">An error</FieldError>
      </TextField>
    ));
    expect(getByText("An error").tagName).toBe("DIV");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.
  // RAC custom render function: covered in the render-*.browser.test.tsx files.
});

describe("FieldError (Rivet)", () => {
  it("renders nothing while the field is valid", () => {
    const { queryByText } = renderUI(() => (
      <TextField>
        <Label>Email</Label>
        <Input />
        <FieldError>An error</FieldError>
      </TextField>
    ));
    expect(queryByText("An error")).toBeNull();
  });

  it("default children join the validation errors; class default rv-FieldError", () => {
    const { getByText } = renderUI(() => (
      <Provider token={FieldErrorContext} value={{ isInvalid: true, validationErrors: ["One.", "Two."], validationDetails: {} as ValidityState }}>
        <FieldError />
      </Provider>
    ));
    const el = getByText("One. Two.");
    expect(el).toHaveClass("rv-FieldError");
  });

  it("accessor validation in FieldErrorContext follows changes", async () => {
    const invalid = signal(false);
    const { queryByText } = renderUI(() => (
      <Provider token={FieldErrorContext} value={() => ({ isInvalid: invalid(), validationErrors: ["Bad"], validationDetails: {} as ValidityState })}>
        <FieldError />
      </Provider>
    ));
    expect(queryByText("Bad")).toBeNull();
    invalid.set(true);
    await microtasks();
    expect(queryByText("Bad")).not.toBeNull();
    invalid.set(false);
    await microtasks();
    expect(queryByText("Bad")).toBeNull();
  });
});
