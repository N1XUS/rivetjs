// `@rivetjs/cdk/native-select` (Rivet addition, no upstream suite; cases follow TextField.test.js where they apply to a select):
// standalone select + state attributes, options `selected` from the value, TextField wiring (label `for`, description /
// error ids in `aria-describedby`, two-way Signal value, onChange, native required validation + FieldError after a change,
// disabled), keyboard focus-visible, optgroups.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { NativeSelect, NativeSelectOption, NativeSelectOptGroup } from "../native-select/index.tsx";
import { TextField } from "../text-field/index.tsx";
import { Label } from "../label/index.tsx";
import { Text } from "../text/index.tsx";
import { FieldError } from "../form/field-error.tsx";

afterEach(cleanup);

const microtasks = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

function renderUI(ui: () => unknown) {
  const result = render(ui as never);
  return { ...within(result.container as HTMLElement), container: result.container as HTMLElement };
}

describe("NativeSelect", () => {
  it("standalone: default class, options, selected follows value", () => {
    const { getByRole } = renderUI(() => (
      <NativeSelect aria-label="Fruit" value="b">
        <NativeSelectOption value="a">Apple</NativeSelectOption>
        <NativeSelectOption value="b">Banana</NativeSelectOption>
      </NativeSelect>
    ));
    const select = getByRole("combobox") as HTMLSelectElement;
    expect(select).toHaveClass("rv-NativeSelect");
    expect(select.value).toBe("b");
    expect(select.options[1]!.hasAttribute("selected")).toBe(true);
    expect(select.options[0]!.hasAttribute("selected")).toBe(false);
  });

  it("inside a TextField: label, description, two-way value, onChange, optgroup", async () => {
    const value = signal("fr");
    const onChange = vi.fn();
    const { getByRole, getByText } = renderUI(() => (
      <TextField value={value} onChange={onChange}>
        <Label>Country</Label>
        <NativeSelect>
          <NativeSelectOptGroup label="Europe">
            <NativeSelectOption value="fr">France</NativeSelectOption>
            <NativeSelectOption value="de">Germany</NativeSelectOption>
          </NativeSelectOptGroup>
          <NativeSelectOption value="jp">Japan</NativeSelectOption>
        </NativeSelect>
        <Text slot="description">Where you live</Text>
      </TextField>
    ));
    await microtasks();
    const select = getByRole("combobox", { name: "Country" }) as HTMLSelectElement;
    expect(select.value).toBe("fr");
    expect(select).toHaveAttribute("aria-describedby", getByText("Where you live").id);
    expect(select.querySelector("optgroup")).toHaveAttribute("label", "Europe");
    await userEvent.selectOptions(select, "jp");
    expect(value()).toBe("jp");
    expect(onChange).toHaveBeenLastCalledWith("jp");
    value.set("de");
    await microtasks();
    expect(select.value).toBe("de");
    expect(select.options[1]!.hasAttribute("selected")).toBe(true);
  });

  it("native required validation: invalid after commit, FieldError text, cleared on a valid choice", async () => {
    const { getByRole, container } = renderUI(() => (
      <form>
        <TextField isRequired name="size">
          <Label>Size</Label>
          <NativeSelect>
            <NativeSelectOption value="">Choose</NativeSelectOption>
            <NativeSelectOption value="m">Medium</NativeSelectOption>
          </NativeSelect>
          <FieldError />
        </TextField>
      </form>
    ));
    const select = getByRole("combobox") as HTMLSelectElement;
    expect(select).toBeRequired();
    expect(select).not.toHaveAttribute("aria-invalid");
    (container.querySelector("form") as HTMLFormElement).checkValidity();
    await microtasks();
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select.closest(".rv-TextField")).toHaveAttribute("data-invalid", "true");
    expect(container.querySelector(".rv-FieldError")?.textContent).toBe(select.validationMessage);
    await userEvent.selectOptions(select, "m");
    await microtasks();
    expect(select).not.toHaveAttribute("aria-invalid");
  });

  it("disabled field and keyboard focus-visible", async () => {
    const { getAllByRole } = renderUI(() => (
      <>
        <TextField isDisabled>
          <Label>Off</Label>
          <NativeSelect>
            <NativeSelectOption value="a">A</NativeSelectOption>
          </NativeSelect>
        </TextField>
        <NativeSelect aria-label="On">
          <NativeSelectOption value="a">A</NativeSelectOption>
        </NativeSelect>
      </>
    ));
    const [off, on] = getAllByRole("combobox") as HTMLSelectElement[];
    expect(off).toBeDisabled();
    expect(off).toHaveAttribute("data-disabled", "true");
    await userEvent.tab();
    expect(document.activeElement).toBe(on);
    expect(on).toHaveAttribute("data-focus-visible", "true");
    expect(on).toHaveAttribute("data-focused", "true");
  });
});
