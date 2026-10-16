// Ported from react-aria-components test/ComboBox.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium) + `within(container)` / `screen` queries; jest fake
// timers → real timers (`flush()` / `waitFor`); `jest.fn` → `vi.fn`; `userEvent.setup({delay: null, pointerMap})` →
// `userEvent.setup()`; `@react-aria/test-utils` `User` → `@rivetjs/testing/user`; default classes `rv-*`;
// `<ComboBoxContext.Provider value>` → slots `<Provider values>`; `useState` → signals (`value` / `inputValue`
// Signals are two-way; `items` an accessor); `rerender(<X a />)` → a second render; jsdom's validation message
// "Constraints not satisfied" → Chromium's "Please fill out this field.".
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files); "should support virtualizer"
// (Virtualizer + ListLayout inside a ComboBox popover: not wired yet); the two `useAsyncList` cases (no
// react-stately `useAsyncList` port).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal, type Signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { User } from "@rivetjs/testing/user";
import { Button } from "../button/index.tsx";
import { ComboBox, ComboBoxContext, ComboBoxValue, type ComboBoxProps, type Key } from "../combobox/index.tsx";
import { Dialog } from "../dialog/index.tsx";
import { FieldError } from "../form/field-error.tsx";
import { Form } from "../form/index.tsx";
import { Header } from "../header/index.tsx";
import { Input } from "../input/index.tsx";
import { Label } from "../label/index.tsx";
import { ListBox, ListBoxItem, ListBoxLoadMoreItem, ListBoxSection } from "../listbox/index.tsx";
import { Popover } from "../popover/index.tsx";
import { Provider } from "../slots/index.tsx";
import { Text } from "../text/index.tsx";

afterEach(cleanup);

const renderEmptyState = () => <div>No results</div>;

const TestComboBox = (props: Partial<ComboBoxProps<any, any>>) => (
  <ComboBox name="test-combobox" defaultInputValue="C" data-foo="bar" {...props}>
    <Label>Favorite Animal</Label>
    <Input />
    <Button />
    {props.selectionMode === "multiple" ? <ComboBoxValue placeholder="No items selected" /> : null}
    <Text slot="description">Description</Text>
    <Text slot="errorMessage">Error</Text>
    <Popover>
      <ListBox renderEmptyState={renderEmptyState}>
        <ListBoxItem id="1">Cat</ListBoxItem>
        <ListBoxItem id="2">Dog</ListBoxItem>
        <ListBoxItem id="3">Kangaroo</ListBoxItem>
        <ListBoxLoadMoreItem>loading</ListBoxLoadMoreItem>
      </ListBox>
    </Popover>
  </ComboBox>
);

const renderIn = (ui: () => unknown) => {
  const result = render(ui as never);
  const container = result.container as HTMLElement;
  return { container, ...within(document.body), getByTestId: within(document.body).getByTestId };
};

const SectionsComboBox = (props: Partial<ComboBoxProps<any, any>>) => (
  <ComboBox {...props}>
    <Label>Preferred fruit or vegetable</Label>
    <Input />
    <Button />
    <Popover>
      <ListBox>
        <ListBoxSection>
          <Header>Fruit</Header>
          <ListBoxItem id="Apple">Apple</ListBoxItem>
          <ListBoxItem id="Banana">Banana</ListBoxItem>
        </ListBoxSection>
        <ListBoxSection>
          <Header>Vegetable</Header>
          <ListBoxItem id="Cabbage">Cabbage</ListBoxItem>
          <ListBoxItem id="Broccoli">Broccoli</ListBoxItem>
        </ListBoxSection>
      </ListBox>
    </Popover>
  </ComboBox>
);

const AnimalsComboBox = (props: Partial<ComboBoxProps<any, any>> & { withFieldError?: boolean }) => {
  const { withFieldError, ...rest } = props;
  return (
    <ComboBox {...rest}>
      <Label>Favorite Animal</Label>
      <Input />
      <Button />
      {withFieldError ? <FieldError /> : null}
      <Popover>
        <ListBox>
          <ListBoxItem id="1">Cat</ListBoxItem>
          <ListBoxItem id="2">Dog</ListBoxItem>
          <ListBoxItem id="3">Kangaroo</ListBoxItem>
        </ListBox>
      </Popover>
    </ComboBox>
  );
};

describe("ComboBox", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const testUtilUser = new User();
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("provides slots", async () => {
    const { getByRole } = renderIn(() => <TestComboBox />);
    await flush();

    const input = getByRole("combobox");
    expect(input).toHaveValue("C");

    const combobox = input.closest(".rv-ComboBox");
    expect(combobox).toHaveAttribute("data-foo", "bar");

    expect(input).toHaveAttribute("aria-labelledby");
    const label = document.getElementById(input.getAttribute("aria-labelledby")!.split(" ")[0]!);
    expect(label).toHaveAttribute("class", "rv-Label");
    expect(label).toHaveTextContent("Favorite Animal");

    expect(input).toHaveAttribute("aria-describedby");
    expect(
      input
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.textContent)
        .join(" "),
    ).toBe("Description Error");

    const button = getByRole("button");
    await user.click(button);
    await flush();

    const listbox = getByRole("listbox");
    expect(listbox).toHaveAttribute("class", "rv-ListBox");
    expect(listbox.closest(".rv-Popover")).toBeInTheDocument();
    expect(listbox.closest(".rv-Popover")).toHaveAttribute("data-trigger", "ComboBox");

    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(3);

    await user.click(options[1]!);
    await flush();
    expect(input).toHaveValue("Dog");
  });

  it("should support slot", async () => {
    const { getByRole } = renderIn(() => (
      <Provider values={[[ComboBoxContext, { slots: { test: { "aria-label": "test" } } }]]}>
        <TestComboBox slot="test" />
      </Provider>
    ));
    await flush();

    const combobox = getByRole("combobox");
    expect(combobox.closest(".rv-ComboBox")).toHaveAttribute("slot", "test");
    expect(combobox).toHaveAttribute("aria-label", "test");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should apply isPressed state to button when expanded", async () => {
    const { getByRole } = renderIn(() => <TestComboBox />);
    await flush();
    const button = getByRole("button");

    expect(button).not.toHaveAttribute("data-pressed");
    await user.click(button);
    await flush();
    expect(button).toHaveAttribute("data-pressed");
  });

  it("should support filtering sections", async () => {
    const { container } = renderIn(() => <SectionsComboBox />);
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    comboboxTester.getCombobox().focus();
    await user.keyboard("p");
    await flush();

    const groups = comboboxTester.getSections();
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(groups[0]!.getAttribute("aria-labelledby")!)).toHaveTextContent("Fruit");

    const options = within(groups[0]!).getAllByRole("option");
    expect(options).toHaveLength(1);
  });

  it("should support undefined defaultFilter", async () => {
    const { container } = renderIn(() => <SectionsComboBox defaultFilter={undefined} />);
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    comboboxTester.getCombobox().focus();
    await user.keyboard("p");
    await flush();

    const groups = comboboxTester.getSections();
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(groups[0]!.getAttribute("aria-labelledby")!)).toHaveTextContent("Fruit");

    const options = within(groups[0]!).getAllByRole("option");
    expect(options).toHaveLength(1);
  });

  it("should support dynamic collections", async () => {
    const defaultItems = [
      { id: 1, name: "Cat" },
      { id: 2, name: "Dog" },
      { id: 3, name: "Kangaroo" },
    ];
    const { container } = renderIn(() => (
      <ComboBox defaultItems={defaultItems}>
        <Label>Favorite Animal</Label>
        <Input />
        <Button />
        <Text slot="description">Description</Text>
        <Text slot="errorMessage">Error</Text>
        <Popover>
          <ListBox>{(item: { name: string }) => <ListBoxItem>{item.name}</ListBoxItem>}</ListBox>
        </Popover>
      </ComboBox>
    ));
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    comboboxTester.getCombobox().focus();
    await user.keyboard("c");
    await flush();
    const options = comboboxTester.getOptions();
    expect(options).toHaveLength(1);
  });

  it("should support render props", async () => {
    const { getByRole } = renderIn(() => (
      <ComboBox>
        {({ isOpen }: { isOpen: () => boolean }) => (
          <>
            <Label>Favorite Animal</Label>
            <Input />
            <Button>{isOpen() ? "close" : "open"}</Button>
            <Popover>
              <ListBox>
                <ListBoxItem>Cat</ListBoxItem>
                <ListBoxItem>Dog</ListBoxItem>
                <ListBoxItem>Kangaroo</ListBoxItem>
              </ListBox>
            </Popover>
          </>
        )}
      </ComboBox>
    ));
    await flush();

    const button = getByRole("button");
    expect(button).toHaveTextContent("open");

    await user.click(button);
    await flush();
    expect(button).toHaveTextContent("close");
  });

  it("should support formValue", async () => {
    let view = renderIn(() => <TestComboBox name="test" value="2" />);
    await flush();
    let input = view.getByRole("combobox");
    expect(input).not.toHaveAttribute("name");
    expect(input).toHaveValue("Dog");
    const hiddenInput = document.querySelector("input[type=hidden]");
    expect(hiddenInput).toHaveAttribute("name", "test");
    expect(hiddenInput).toHaveValue("2");

    // Rivet: rerender → a fresh render.
    cleanup();
    view = renderIn(() => <TestComboBox name="test" formValue="text" value="2" />);
    await flush();
    input = view.getByRole("combobox");
    expect(input).toHaveAttribute("name", "test");
    expect(document.querySelector("input[type=hidden]")).toBeNull();
  });

  it("should support selecting an option via keyboard", async () => {
    const onSelectionChange = vi.fn();
    const { container } = renderIn(() => <AnimalsComboBox onSelectionChange={onSelectionChange} />);
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container, interactionType: "keyboard" });

    await comboboxTester.toggleOptionSelection({ option: "Dog" });
    await flush();
    expect(onSelectionChange).toHaveBeenCalledWith("2");
    expect(comboboxTester.getCombobox()).toHaveValue("Dog");
    expect(comboboxTester.getListbox()).toBeNull();
  });

  it.each(["click", "tab"])("should not fire extra onSelectionChange calls after focus moves away in fully controlled mode via %s", async (focusMove) => {
    const onSelectionChange = vi.fn();
    const keyToText: Record<string, string> = { 1: "Cat", 2: "Dog", 3: "Kangaroo" };

    function ControlledComboBox() {
      const selectedKey: Signal<Key | null> = signal<Key | null>(null);
      const inputValue = signal("");
      return (
        <>
          <AnimalsComboBox
            value={selectedKey as Signal<Key | readonly Key[] | null>}
            inputValue={inputValue}
            onChange={(value) => {
              const key = value as Key | null;
              onSelectionChange(key);
              selectedKey.set(key);
              inputValue.set(key != null ? keyToText[key as string]! : "");
            }}
            onInputChange={(v: string) => inputValue.set(v)}
          />
          <button type="button">Next</button>
        </>
      );
    }

    const view = renderIn(() => <ControlledComboBox />);
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: view.container });

    await comboboxTester.toggleOptionSelection({ option: "Dog" });
    await flush();
    expect(onSelectionChange).toHaveBeenCalledTimes(1);

    if (focusMove === "click") {
      await user.click(view.getByRole("button", { name: "Next" }));
    } else {
      comboboxTester.getCombobox().focus();
      await user.tab();
    }
    await flush();

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });

  it("should support form reset", async () => {
    const { container } = renderIn(() => (
      <form>
        <AnimalsComboBox defaultValue="2" name="combobox" withFieldError />
        <input type="reset" />
      </form>
    ));
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    const combobox = comboboxTester.getCombobox();

    expect(combobox).toHaveValue("Dog");
    await comboboxTester.open();
    await flush();

    const options = comboboxTester.getOptions();
    await user.click(options[0]!);
    await flush();
    expect(combobox).toHaveValue("Cat");

    await user.click(document.querySelector('input[type="reset"]')!);
    await flush();
    expect(combobox).toHaveValue("Dog");
    expect(document.querySelector("input[name=combobox]")).toHaveValue("2");
  });

  it("should render data- attributes on outer element", async () => {
    const { getAllByTestId } = renderIn(() => <TestComboBox data-testid="combo-box" />);
    await flush();
    const outerEl = getAllByTestId("combo-box");
    expect(outerEl).toHaveLength(1);
    expect(outerEl[0]).toHaveClass("rv-ComboBox");
  });

  it("should support validation errors", async () => {
    const view = renderIn(() => (
      <form data-testid="form">
        <AnimalsComboBox isRequired withFieldError />
      </form>
    ));
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: view.container });
    const combobox = comboboxTester.getCombobox() as HTMLInputElement;

    expect(combobox).toHaveAttribute("required");
    expect(combobox).not.toHaveAttribute("aria-required");
    expect(combobox).not.toHaveAttribute("aria-describedby");
    expect(combobox.validity.valid).toBe(false);
    expect(combobox).not.toHaveAttribute("data-invalid");

    (view.getByTestId("form") as HTMLFormElement).checkValidity();
    await flush();

    expect(document.activeElement).toBe(combobox);
    expect(combobox).toHaveAttribute("aria-describedby");
    expect(document.getElementById(combobox.getAttribute("aria-describedby")!)).toHaveTextContent("Please fill out this field.");
    const comboboxWrapper = combobox.closest(".rv-ComboBox");
    expect(comboboxWrapper).toHaveAttribute("data-invalid");

    comboboxTester.getCombobox().focus();
    await user.keyboard("C");
    await flush();

    const options = comboboxTester.getOptions();
    await user.click(options[0]!);
    await flush();

    expect(combobox).toHaveAttribute("aria-describedby");
    expect(combobox.validity.valid).toBe(true);

    await user.tab();
    await flush();
    expect(combobox).not.toHaveAttribute("aria-describedby");
    expect(combobox).not.toHaveAttribute("data-invalid");
  });

  it("should close on scroll", async () => {
    const { getByRole, queryByRole } = renderIn(() => <TestComboBox />);
    await flush();

    const button = getByRole("button");
    await user.click(button);
    await flush();
    const listbox = getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    fireEvent.scroll(document.body);
    await flush();
    expect(queryByRole("listbox")).toBeNull();
  });

  it("should not close on input scrolling for cursor placement", async () => {
    const { getByRole } = renderIn(() => <TestComboBox />);
    await flush();

    const input = getByRole("combobox");
    const button = getByRole("button");
    await user.click(button);
    await flush();
    const listbox = getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(input).toHaveFocus();
    fireEvent.scroll(input); // simulate what happens when the text is long and overflows
    await flush();
    expect(listbox).toBeInTheDocument();
  });

  it("should not open the menu when isReadOnly", async () => {
    const { getByRole, queryByRole } = renderIn(() => <TestComboBox isReadOnly menuTrigger="focus" />);
    await flush();

    const input = getByRole("combobox");
    await user.click(input);
    await flush();

    expect(queryByRole("listbox")).not.toBeInTheDocument();
  });

  it.skip("should support virtualizer (Virtualizer in a ComboBox popover: not wired yet)", () => {});

  it("should clear contexts inside popover", async () => {
    const view = renderIn(() => (
      <ComboBox>
        <Label>Preferred fruit or vegetable</Label>
        <Input />
        <Button />
        <Popover data-testid="popover">
          <Label>Hello</Label>
          <Button>Yo</Button>
          <Input />
          <Text>hi</Text>
          <ListBox>
            <ListBoxItem id="cat">Cat</ListBoxItem>
            <ListBoxItem id="dog">Dog</ListBoxItem>
            <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
          </ListBox>
        </Popover>
      </ComboBox>
    ));
    await flush();

    const selectTester = testUtilUser.createTester("Select", { root: view.container });

    await selectTester.open();
    await flush();

    const popover = view.getByTestId("popover");
    const label = popover.querySelector(".rv-Label");
    expect(label).not.toHaveAttribute("for");

    const button = popover.querySelector(".rv-Button");
    expect(button).not.toHaveAttribute("aria-expanded");

    const input = popover.querySelector(".rv-Input");
    expect(input).not.toHaveAttribute("role");

    const text = popover.querySelector(".rv-Text");
    expect(text).not.toHaveAttribute("id");
  });

  it("should support form prop", async () => {
    const { getByRole } = renderIn(() => <TestComboBox form="test" />);
    await flush();
    const input = getByRole("combobox");
    expect(input).toHaveAttribute("form", "test");
  });

  it("should render empty state even when there is a loader provided and allowsEmptyCollection is true", async () => {
    const { container } = renderIn(() => <TestComboBox allowsEmptyCollection />);
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    comboboxTester.getCombobox().focus();
    await user.keyboard("p");
    await flush();

    const options = comboboxTester.getOptions();
    expect(options).toHaveLength(1);
    expect(comboboxTester.getListbox()).toBeTruthy();
    expect(options[0]).toHaveTextContent("No results");
  });

  it.each(["keyboard", "mouse"])("should support onAction with %s", async (interactionType) => {
    const onAction = vi.fn();
    function WithCreateOption() {
      const inputValue = signal("");
      // Rivet: the conditional "Create" item is a dynamic `{() => …}` child (tracked by the build pass), together with
      // the items that follow it (a dynamic child registers after its eager JSX siblings); an explicit `id` keeps the
      // generated ids of the static items stable, `textValue` because its children are not a string.
      return (
        <ComboBox allowsEmptyCollection inputValue={inputValue}>
          <Label style={{ display: "block" }}>Favorite Animal</Label>
          <div style={{ display: "flex" }}>
            <Input />
            <Button>
              <span aria-hidden="true" style={{ padding: "0 2px" }}>
                open
              </span>
            </Button>
          </div>
          <Popover placement="bottom end">
            <ListBox>
              {() => [
                inputValue().length > 0 ? (
                  <ListBoxItem id="create" textValue={`Create "${inputValue()}"`} onAction={onAction}>
                    Create "{inputValue()}"
                  </ListBoxItem>
                ) : null,
                <ListBoxItem>Aardvark</ListBoxItem>,
                <ListBoxItem>Cat</ListBoxItem>,
                <ListBoxItem>Dog</ListBoxItem>,
                <ListBoxItem>Kangaroo</ListBoxItem>,
                <ListBoxItem>Panda</ListBoxItem>,
                <ListBoxItem>Snake</ListBoxItem>,
              ]}
            </ListBox>
          </Popover>
        </ComboBox>
      );
    }

    const { container } = renderIn(() => <WithCreateOption />);
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    comboboxTester.getCombobox().focus();

    await user.keyboard("L");
    await flush();

    let options = comboboxTester.getOptions();
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Create "L"');

    if (interactionType === "keyboard") {
      await user.keyboard("{ArrowDown}{Enter}");
    } else {
      await user.click(options[0]!);
    }
    await flush();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(comboboxTester.getCombobox()).toHaveValue("");

    // Repeat with an option selected.
    await comboboxTester.toggleOptionSelection({ option: "Cat" });
    await flush();

    await user.keyboard("s");
    await flush();

    options = comboboxTester.getOptions();
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Create "Cats"');

    if (interactionType === "keyboard") {
      await user.keyboard("{ArrowDown}{Enter}");
    } else {
      await user.click(options[0]!);
    }
    await flush();
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(comboboxTester.getCombobox()).toHaveValue("Cat");
  });

  it("should not close the combobox when clicking on a section header", async () => {
    const view = renderIn(() => <SectionsComboBox />);
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: view.container });
    const button = view.getByRole("button");

    // Open the combobox
    await user.click(button);
    await flush();

    // Verify the listbox is open
    let listbox = view.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(listbox).toBeVisible();

    // Find and click on a section header
    const fruitHeader = view.getByText("Fruit");
    expect(fruitHeader).toBeInTheDocument();

    await user.click(fruitHeader);
    await flush();

    // Verify the listbox is still open
    listbox = view.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(listbox).toBeVisible();

    // Verify we can still interact with options
    const options = comboboxTester.getOptions();
    expect(options.length).toBeGreaterThan(0);

    // Click an option
    await user.click(options[0]!);
    await flush();

    // Verify the combobox is closed and the value is updated
    expect(view.queryByRole("listbox")).toBeNull();
    expect(comboboxTester.getCombobox()).toHaveValue("Apple");
  });

  it("should support multiple selection", async () => {
    const onChange = vi.fn();
    const { container, getByTestId } = renderIn(() => (
      <Form data-testid="form">
        <TestComboBox name="combobox" selectionMode="multiple" defaultInputValue="" onChange={onChange} />
        <input type="reset" />
      </Form>
    ));
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    const value = container.querySelector(".rv-ComboBoxValue")!;

    expect(value).toHaveTextContent("No items selected");
    expect(comboboxTester.getCombobox().getAttribute("aria-describedby")).toContain(value.id);

    expect(comboboxTester.getCombobox()).toHaveValue("");
    await comboboxTester.open();
    await flush();

    const listbox = comboboxTester.getListbox();
    expect(listbox).toHaveAttribute("aria-multiselectable", "true");

    const options = comboboxTester.getOptions();
    expect(options).toHaveLength(3);

    await comboboxTester.toggleOptionSelection({ option: options[0]! });
    await flush();
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(comboboxTester.getCombobox()).toHaveValue("");
    expect(comboboxTester.getListbox()).toBeInTheDocument();
    expect(value).toHaveTextContent("Cat");
    await comboboxTester.toggleOptionSelection({ option: options[1]! });
    await flush();
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(comboboxTester.getCombobox()).toHaveValue("");
    expect(comboboxTester.getListbox()).toBeInTheDocument();
    expect(value).toHaveTextContent("Cat and Dog");
    await comboboxTester.close();
    await flush();

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(["1", "2"]);

    let formData = new FormData(getByTestId("form") as HTMLFormElement);
    expect(formData.getAll("combobox")).toEqual(["1", "2"]);

    await user.click(document.querySelector('input[type="reset"]')!);
    await flush();
    expect(comboboxTester.getCombobox()).toHaveValue("");
    formData = new FormData(getByTestId("form") as HTMLFormElement);
    expect(formData.getAll("combobox")).toEqual([""]);
  });

  it("should support deselection if multiple selection is enabled", async () => {
    const onChange = vi.fn();
    const { container } = renderIn(() => <TestComboBox name="combobox" selectionMode="multiple" defaultInputValue="" onChange={onChange} />);
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });

    await comboboxTester.toggleOptionSelection({ option: "Cat" });
    await flush();
    await comboboxTester.toggleOptionSelection({ option: "Dog" });
    await flush();
    expect(comboboxTester.getOptions()[0]).toHaveAttribute("aria-selected", "true");
    expect(comboboxTester.getOptions()[1]).toHaveAttribute("aria-selected", "true");
    expect(onChange).toHaveBeenLastCalledWith(["1", "2"]);

    await comboboxTester.toggleOptionSelection({ option: "Cat" });
    await flush();
    expect(comboboxTester.getOptions()[0]).toHaveAttribute("aria-selected", "false");
    expect(comboboxTester.getOptions()[1]).toHaveAttribute("aria-selected", "true");
    expect(onChange).toHaveBeenLastCalledWith(["2"]);

    await comboboxTester.toggleOptionSelection({ option: "Dog" });
    await flush();
    expect(comboboxTester.getOptions()[0]).toHaveAttribute("aria-selected", "false");
    expect(comboboxTester.getOptions()[1]).toHaveAttribute("aria-selected", "false");
    expect(onChange).toHaveBeenLastCalledWith([]);

    await comboboxTester.close();
  });

  it("should support controlled multi-selection", async () => {
    const { container } = renderIn(() => <TestComboBox selectionMode="multiple" defaultInputValue={undefined} value={["2", "3"]} />);
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    expect(comboboxTester.getCombobox()).toHaveValue("");
    await comboboxTester.open();
    await flush();

    const options = comboboxTester.getOptions();
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[2]).toHaveAttribute("aria-selected", "true");
  });

  it("should support controlled multi-selection with both inputValue and value controlled", async () => {
    const onChange = vi.fn();
    const onInputChange = vi.fn();
    const { container } = renderIn(() => (
      <TestComboBox
        selectionMode="multiple"
        defaultInputValue={undefined}
        inputValue="C"
        onInputChange={onInputChange}
        value={["2", "3"]}
        onChange={onChange}
      />
    ));
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    const combobox = comboboxTester.getCombobox();
    expect(combobox).toHaveValue("C");
    await comboboxTester.open();
    await flush();

    await user.keyboard("a");
    await flush();

    expect(combobox).toHaveValue("C");
    expect(onInputChange).toHaveBeenCalledTimes(1);
    expect(onInputChange).toHaveBeenCalledWith("Ca");
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    await flush();

    expect(combobox).toHaveValue("C");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["3"]);
  });

  it("should support multi-select with custom value", async () => {
    // allowsCustomValue doesn't really make sense to use with multi-selection, but test it anyway.
    const { container } = renderIn(() => <TestComboBox selectionMode="multiple" allowsCustomValue />);
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });

    await user.tab();
    await user.keyboard("Test");
    await flush();
    expect(comboboxTester.getCombobox()).toHaveValue("Test");

    await user.tab();
    await flush();
    expect(comboboxTester.getCombobox()).toHaveValue("Test");
  });

  it.each(["{Escape}", "{Enter}", "{Tab}"])("should preserve multi-select value with custom input on %s", async (key) => {
    const { container, queryByRole } = renderIn(() => (
      <TestComboBox selectionMode="multiple" allowsCustomValue defaultValue={["1", "2"]} defaultInputValue="" />
    ));
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    const value = container.querySelector(".rv-ComboBoxValue");

    expect(value).toHaveTextContent("Cat and Dog");

    await user.tab();
    await user.keyboard("Den");
    await flush();
    expect(comboboxTester.getCombobox()).toHaveValue("Den");

    await user.keyboard(key);
    await flush();

    expect(queryByRole("listbox")).toBeNull();
    expect(comboboxTester.getCombobox()).toHaveValue("Den");
    expect(value).toHaveTextContent("Cat and Dog");
  });

  it("should allow the user to deselect items with keyboard when multiselect (uncontrolled)", async () => {
    const onChange = vi.fn();
    const { container } = renderIn(() => <TestComboBox defaultValue={["1", "2"]} selectionMode="multiple" onChange={onChange} />);
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    await comboboxTester.open();
    await flush();

    await user.keyboard("{Enter}");
    await flush();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(["2"]);

    await user.keyboard("{ArrowDown}{Enter}");
    await flush();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("should allow the user to deselect items with keyboard when multiselect (controlled)", async () => {
    const onChange = vi.fn();
    const { container } = renderIn(() => <TestComboBox value={["1", "2"]} selectionMode="multiple" onChange={onChange} />);
    await flush();

    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    await comboboxTester.open();
    await flush();

    await user.keyboard("{Enter}");
    await flush();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(["2"]);

    await user.keyboard("{ArrowDown}{Enter}");
    await flush();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(["1"]);
  });

  it("should support isRequired with multiple selection", async () => {
    const { container, getByTestId } = renderIn(() => (
      <Form data-testid="form">
        <AnimalsComboBox name="combobox" selectionMode="multiple" isRequired withFieldError />
      </Form>
    ));
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    const combobox = comboboxTester.getCombobox() as HTMLInputElement;

    expect(combobox).toHaveAttribute("required");
    expect(combobox.validity.valid).toBe(false);

    (getByTestId("form") as HTMLFormElement).checkValidity();
    await flush();
    expect(combobox).toHaveAttribute("aria-describedby");
    expect(container.querySelector(".rv-ComboBox")).toHaveAttribute("data-invalid");

    await comboboxTester.open();
    await flush();
    let options = comboboxTester.getOptions();
    await user.click(options[0]!);
    await flush();

    combobox.blur();
    await flush();
    expect(combobox).not.toHaveAttribute("required");
    expect(combobox.validity.valid).toBe(true);
    expect(container.querySelector(".rv-ComboBox")).not.toHaveAttribute("data-invalid");

    let hiddenInputs = container.querySelectorAll('input[type="hidden"]');
    expect(hiddenInputs).toHaveLength(1);
    expect(hiddenInputs[0]).toHaveAttribute("name", "combobox");
    expect(hiddenInputs[0]).toHaveAttribute("value", "1");

    await comboboxTester.open();
    await flush();
    options = comboboxTester.getOptions();
    await user.click(options[0]!);
    await flush();
    combobox.blur();
    await flush();
    expect(combobox).toHaveAttribute("required");
    expect(combobox.validity.valid).toBe(false);
    expect(combobox).toHaveAttribute("aria-describedby");

    hiddenInputs = container.querySelectorAll('input[type="hidden"]');
    expect(hiddenInputs).toHaveLength(1);
    expect(hiddenInputs[0]).toHaveAttribute("name", "combobox");
    expect(hiddenInputs[0]).toHaveAttribute("value", "");
  });

  it("should not close the combobox when clicking on the input", async () => {
    const onOpenChange = vi.fn();
    const { container, getByRole } = renderIn(() => <TestComboBox onOpenChange={onOpenChange} />);
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    await comboboxTester.open();
    await flush();
    expect(comboboxTester.getListbox()).toBeVisible();
    expect(comboboxTester.getCombobox()).toHaveFocus();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    onOpenChange.mockClear();

    await user.click(getByRole("combobox"));
    await flush();
    expect(comboboxTester.getListbox()).toBeVisible();
    expect(comboboxTester.getCombobox()).toHaveFocus();
    expect(onOpenChange).toHaveBeenCalledTimes(0);
  });

  it("should close the combobox when clicking on the button, and it should reopen if clicked again", async () => {
    const onOpenChange = vi.fn();
    const { container, getByRole, getAllByRole } = renderIn(() => <TestComboBox onOpenChange={onOpenChange} />);
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    await comboboxTester.open();
    await flush();
    expect(comboboxTester.getListbox()).toBeVisible();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    onOpenChange.mockClear();

    await user.click(getAllByRole("button", { hidden: true })[0]!);
    await flush();
    expect(comboboxTester.getListbox()).toBeNull();
    expect(comboboxTester.getCombobox()).toHaveFocus();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    onOpenChange.mockClear();

    await user.click(getByRole("button"));
    await flush();
    expect(comboboxTester.getListbox()).toBeVisible();
    expect(comboboxTester.getCombobox()).toHaveFocus();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  // Rivet: the input's focus handler opens a menuTrigger="focus" combobox inside the button press; the press toggle must not
  // close it again (React batches both and opens).
  it("should open with menuTrigger=focus when the button is clicked while the input is not focused", async () => {
    const { getByRole, queryByRole } = renderIn(() => <TestComboBox menuTrigger="focus" />);
    await flush();
    expect(queryByRole("listbox")).toBeNull();
    await user.click(getByRole("button"));
    await flush();
    expect(getByRole("listbox")).toBeVisible();
    expect(getByRole("combobox")).toHaveFocus();
    await user.click(getByRole("button"));
    await flush();
    expect(queryByRole("listbox")).toBeNull();
  });

  it("should support read-only state", async () => {
    let view = renderIn(() => <TestComboBox />);
    await flush();
    expect(view.getByRole("combobox").closest(".rv-ComboBox")).not.toHaveAttribute("data-readonly");
    // Rivet: rerender → a fresh render.
    cleanup();
    view = renderIn(() => <TestComboBox isReadOnly />);
    await flush();
    expect(view.getByRole("combobox").closest(".rv-ComboBox")).toHaveAttribute("data-readonly");
  });

  const swItems = [{ id: 1, name: "Luke Skywalker" }];
  const SwComboBox = (props: Partial<ComboBoxProps<any, any>>) => (
    <ComboBox {...props}>
      <Label>SW Characters</Label>
      <Input />
      <Button>{"<"}</Button>
      <Popover>
        <ListBox>{(item: { id: number; name: string }) => <ListBoxItem id={item.id}>{item.name}</ListBoxItem>}</ListBox>
      </Popover>
    </ComboBox>
  );

  it("should re-open the menu when controlled items go from empty to non-empty controlled items", async () => {
    const onOpenChange = vi.fn();
    const onInputChange = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);

    function ControlledComboBox() {
      const items = signal<{ id: number; name: string }[]>(swItems);
      return (
        <SwComboBox
          items={() => items()}
          onInputChange={() => {
            if (onInputChange()) items.set([]);
            else items.set([{ id: 1, name: "Luke Skywalker" }]);
          }}
          onOpenChange={onOpenChange}
        />
      );
    }

    const { container, queryByRole } = renderIn(() => <ControlledComboBox />);
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    await user.tab();
    await user.keyboard("{ArrowDown}");
    await flush();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(comboboxTester.getListbox()).toBeVisible();
    onOpenChange.mockClear();

    await user.keyboard("L");
    await flush();
    expect(queryByRole("listbox")).toBeNull();

    await user.keyboard("{Backspace}");
    await flush();
    expect(comboboxTester.getListbox()).toBeVisible();
  });

  it.skip("should re-open the menu with useAsyncList after an empty async result then backspace (no useAsyncList port)", () => {});
  it.skip("should re-open the menu when using Collection pattern (items on ListBox, not ComboBox) (no useAsyncList port)", () => {});

  it("should still close the menu when uncontrolled items are empty", async () => {
    const onOpenChange = vi.fn();
    const { container, queryByRole } = renderIn(() => <SwComboBox defaultItems={swItems} onOpenChange={onOpenChange} />);
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    await user.tab();
    await user.keyboard("{ArrowDown}");
    await flush();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(comboboxTester.getListbox()).toBeVisible();
    onOpenChange.mockClear();

    await user.keyboard("Z");
    await flush();
    expect(queryByRole("listbox")).toBeNull();
  });

  it("should not re-open after user dismisses with Escape (revert) controlled items", async () => {
    const onOpenChange = vi.fn();
    const onInputChange = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);

    function ControlledComboBox() {
      const items = signal<{ id: number; name: string }[]>(swItems);
      return (
        <SwComboBox
          items={() => items()}
          onInputChange={() => {
            if (onInputChange()) items.set([]);
            else items.set([{ id: 1, name: "Luke Skywalker" }]);
          }}
          onOpenChange={onOpenChange}
        />
      );
    }

    const { container, queryByRole } = renderIn(() => <ControlledComboBox />);
    await flush();
    const comboboxTester = testUtilUser.createTester("ComboBox", { root: container });
    await user.tab();
    await user.keyboard("{ArrowDown}");
    await flush();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(comboboxTester.getListbox()).toBeVisible();
    onOpenChange.mockClear();

    await user.keyboard("L");
    await flush();
    expect(queryByRole("listbox")).toBeNull();

    await user.keyboard("{Escape}");
    await flush();
    expect(queryByRole("listbox")).toBeNull();
  });

  it("should not throw when rendered inside a Dialog with a Text errorMessage slot", async () => {
    renderIn(() => (
      <Dialog aria-label="Dialog">
        <TestComboBox isInvalid />
      </Dialog>
    ));
    await flush();
    expect(document.querySelector(".rv-ComboBox")).toBeInTheDocument();
  });

  it("should not throw when rendered inside an alertdialog with a Text errorMessage slot", async () => {
    renderIn(() => (
      <Dialog role="alertdialog" aria-label="Dialog">
        <TestComboBox isInvalid />
      </Dialog>
    ));
    await flush();
    expect(document.querySelector(".rv-ComboBox")).toBeInTheDocument();
  });
});
