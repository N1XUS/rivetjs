// Ported from react-aria-components test/Select.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium) + `within(document.body)` queries; jest fake timers →
// real timers (`flush()`); `jest.fn` → `vi.fn`; `userEvent.setup({delay: null, pointerMap})` → `userEvent.setup()`;
// `@react-aria/test-utils` `User` → `@rivetjs/testing/user`; default classes `rv-*`; `<SelectContext.Provider value>`
// → slots `<Provider values>`; `useState` → signals (a `selectedKey` Signal is two-way); `rerender(<X />)` → a second
// render; render props are accessors (`isOpen()`, `selectedItem()`); jsdom's validation message
// "Constraints not satisfied" → Chromium's "Please select an item in the list.".
// Skipped: "should support custom render function" (covered here by the `render` case below on the parts root);
// "has a value immediately after rendering" (React effect timing; the hidden select carries the value at render —
// asserted directly).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { useContext } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { User } from "@rivetjs/testing/user";
import { Button } from "../button/index.tsx";
import { Dialog } from "../dialog/index.tsx";
import { FieldError } from "../form/field-error.tsx";
import { Form } from "../form/index.tsx";
import { Label } from "../label/index.tsx";
import { ListBox, ListBoxItem, ListBoxLoadMoreItem } from "../listbox/index.tsx";
import { Popover } from "../popover/index.tsx";
import { Select, SelectContext, SelectStateContext, SelectValue, setSelectValue, type Key, type SelectPartsProps } from "../select/index.tsx";
import { Provider } from "../slots/index.tsx";
import { Text } from "../text/index.tsx";

// The popover's FocusScope restores focus one frame after unmount, by id when its trigger is gone (resumed regions):
// let that frame pass before the next test renders a trigger with the same id.
afterEach(async () => {
  cleanup();
  await new Promise(requestAnimationFrame);
});

const TestSelect = (props: Partial<SelectPartsProps<any>>) => (
  <Select data-testid="select" data-foo="bar" {...(props as {})}>
    <Label>Favorite Animal</Label>
    <Button>
      <SelectValue />
    </Button>
    <Text slot="description">Description</Text>
    <Text slot="errorMessage">Error</Text>
    <Popover>
      <ListBox>
        <ListBoxItem id="cat">Cat</ListBoxItem>
        <ListBoxItem id="dog">Dog</ListBoxItem>
        <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
      </ListBox>
    </Popover>
  </Select>
);

const screen = () => within(document.body);
const renderIn = (ui: () => unknown) => {
  render(ui as never);
  return screen();
};

describe("Select", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const testUtilUser = new User();
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("provides slots", async () => {
    const { getByTestId } = renderIn(() => <TestSelect />);
    await flush();
    const wrapper = getByTestId("select");
    const selectTester = testUtilUser.createTester("Select", { root: wrapper });

    const trigger = selectTester.getTrigger();
    expect(trigger).toHaveTextContent("Select an item");
    expect(trigger).not.toHaveAttribute("data-pressed");

    expect(wrapper).toHaveAttribute("data-foo", "bar");

    expect(trigger).toHaveAttribute("aria-labelledby");
    const label = document.getElementById(trigger.getAttribute("aria-labelledby")!.split(" ")[1]!);
    expect(label).toHaveAttribute("class", "rv-Label");
    expect(label).toHaveTextContent("Favorite Animal");

    const valueOrPlaceholder = document.getElementById(trigger.getAttribute("aria-labelledby")!.split(" ")[0]!);
    expect(valueOrPlaceholder).toHaveAttribute("class", "rv-SelectValue");
    expect(valueOrPlaceholder).toHaveTextContent("Select an item");

    expect(trigger).toHaveAttribute("aria-describedby");
    expect(
      trigger
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.textContent)
        .join(" "),
    ).toBe("Description Error");

    await selectTester.open();

    expect(trigger).toHaveAttribute("data-pressed", "true");
    const listbox = selectTester.getListbox()!;
    expect(listbox).toHaveAttribute("class", "rv-ListBox");
    expect(listbox.closest(".rv-Popover")).toBeInTheDocument();
    expect(listbox.closest(".rv-Popover")).toHaveAttribute("data-trigger", "Select");

    const options = selectTester.getOptions();
    expect(options).toHaveLength(3);

    await user.click(options[1]!);
    await flush();
    expect(trigger).toHaveTextContent("Dog");
  });

  it("should support slot", async () => {
    const { getByTestId } = renderIn(() => (
      <Provider values={[[SelectContext, { slots: { test: { "aria-label": "test" } } } as never]]}>
        <TestSelect slot="test" />
      </Provider>
    ));
    await flush();

    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    const trigger = selectTester.getTrigger();
    expect(trigger.closest(".rv-Select")).toHaveAttribute("slot", "test");
    expect(trigger).toHaveAttribute("aria-label", "test");
  });

  it("should support custom render function", async () => {
    const { getByTestId } = renderIn(() => <TestSelect render={(props) => <div {...(props as {})} data-custom="true" />} />);
    await flush();
    const field = getByTestId("select");
    expect(field).toHaveAttribute("data-custom", "true");
    expect(field).toHaveClass("rv-Select");
    expect(within(field).getByRole("button")).toHaveTextContent("Select an item");
  });

  it("supports items with render props", async () => {
    const MyItem = (props: { id: string; children: string }) => (
      <ListBoxItem id={props.id} textValue={props.children}>
        {({ isSelected }: { isSelected: () => boolean }) => (
          <>
            {props.children}
            {isSelected() ? " (selected)" : ""}
          </>
        )}
      </ListBoxItem>
    );

    const { getByTestId } = renderIn(() => (
      <Select data-testid="select" defaultSelectedKey="cat">
        <Label>Favorite Animal</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            <MyItem id="cat">Cat</MyItem>
            <MyItem id="dog">Dog</MyItem>
            <MyItem id="kangaroo">Kangaroo</MyItem>
          </ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    const trigger = selectTester.getTrigger();
    expect(trigger).toHaveTextContent("Cat");
  });

  it("supports custom select value", async () => {
    const items = [
      { id: 1, name: "Cat" },
      { id: 2, name: "Dog" },
    ];

    const { getByTestId } = renderIn(() => (
      <Select data-testid="select" defaultSelectedKey={1}>
        <Label>Favorite Animal</Label>
        <Button>
          <SelectValue>{({ selectedItem, selectedText }) => <span>{selectedItem() ? `${selectedItem().id} - ${selectedText()}` : ""}</span>}</SelectValue>
        </Button>
        <Popover>
          <ListBox items={items}>{(item: { id: number; name: string }) => <ListBoxItem>{item.name}</ListBoxItem>}</ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    const trigger = selectTester.getTrigger();
    expect(trigger).toHaveTextContent("1 - Cat");
  });

  it("supports placeholder", async () => {
    const { getByTestId } = renderIn(() => <TestSelect placeholder="Select an animal" />);
    await flush();
    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    expect(selectTester.getTrigger()).toHaveTextContent("Select an animal");
  });

  it("should support empty state", async () => {
    const { getByTestId, getByRole } = renderIn(() => (
      <Select data-testid="select" allowsEmptyCollection>
        <Label>Favorite Animal</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox aria-label="Test" renderEmptyState={() => "No results"}>
            {[]}
          </ListBox>
        </Popover>
      </Select>
    ));
    await flush();
    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    await selectTester.open();

    const listbox = getByRole("listbox");
    expect(listbox).toHaveAttribute("data-empty", "true");

    const option = getByRole("option");
    expect(option).toHaveTextContent("No results");
  });

  it("should support render props", async () => {
    const { getByTestId } = renderIn(() => (
      <Select data-testid="select">
        {({ isOpen }: { isOpen: () => boolean }) => (
          <>
            <Label>Favorite Animal</Label>
            <Button>
              <SelectValue />
              <span aria-hidden>{isOpen() ? "close" : "open"}</span>
            </Button>
            <Popover>
              <ListBox>
                <ListBoxItem>Cat</ListBoxItem>
                <ListBoxItem>Dog</ListBoxItem>
                <ListBoxItem>Kangaroo</ListBoxItem>
              </ListBox>
            </Popover>
          </>
        )}
      </Select>
    ));
    await flush();

    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    const trigger = selectTester.getTrigger();
    expect(trigger).toHaveTextContent("open");

    await selectTester.open();
    await flush();
    expect(selectTester.getTrigger()).toHaveTextContent("close");
  });

  it("should stay open on selecting an option if shouldCloseOnSelect is false and single selection mode", async () => {
    const { getByTestId } = renderIn(() => (
      <Select data-testid="select" shouldCloseOnSelect={false}>
        <Label>Favorite Animal</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            <ListBoxItem>Cat</ListBoxItem>
            <ListBoxItem>Dog</ListBoxItem>
            <ListBoxItem>Kangaroo</ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    const trigger = selectTester.getTrigger();

    await selectTester.open();
    expect(trigger).toHaveAttribute("data-pressed", "true");

    await selectTester.toggleOptionSelection({ option: "Dog", closesOnSelect: false });
    await flush();
    expect(trigger).toHaveTextContent("Dog");
    expect(trigger).toHaveAttribute("data-pressed", "true");
  });

  it("should close on selecting an option if shouldCloseOnSelect is true and multiple selection mode", async () => {
    const { getByTestId } = renderIn(() => (
      <Select data-testid="select" shouldCloseOnSelect selectionMode="multiple">
        <Label>Favorite Animal</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            <ListBoxItem>Cat</ListBoxItem>
            <ListBoxItem>Dog</ListBoxItem>
            <ListBoxItem>Kangaroo</ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    const trigger = selectTester.getTrigger();

    await selectTester.open();
    expect(trigger).toHaveAttribute("data-pressed", "true");

    await selectTester.toggleOptionSelection({ option: "Dog", closesOnSelect: true });
    await flush();
    expect(trigger).toHaveTextContent("Dog");
    expect(trigger).not.toHaveAttribute("data-pressed", "true");
  });

  it("should send disabled prop to the hidden field", async () => {
    renderIn(() => <TestSelect name="select" isDisabled />);
    await flush();
    const input = document.querySelector("[name=select]");
    expect(input).toBeDisabled();
  });

  it("should render data- attributes only on the outer element", async () => {
    const { getAllByTestId } = renderIn(() => <TestSelect data-testid="select-test" />);
    await flush();
    const outerEl = getAllByTestId("select-test");
    expect(outerEl).toHaveLength(1);
    expect(outerEl[0]).toHaveClass("rv-Select");
  });

  it("supports validation errors", async () => {
    const { getByTestId } = renderIn(() => (
      <form data-testid="form">
        <Select data-testid="test-select" name="select" isRequired>
          <Label>Favorite Animal</Label>
          <Button>
            <SelectValue />
          </Button>
          <FieldError />
          <Popover>
            <ListBox>
              <ListBoxItem>Cat</ListBoxItem>
              <ListBoxItem>Dog</ListBoxItem>
              <ListBoxItem>Kangaroo</ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
      </form>
    ));
    await flush();

    const wrapper = getByTestId("test-select");
    const selectTester = testUtilUser.createTester("Select", { root: wrapper });
    const trigger = selectTester.getTrigger();
    const select = wrapper;
    const input = document.querySelector("[name=select]") as HTMLSelectElement;
    expect(input).toHaveAttribute("required");
    expect(trigger.getAttribute("aria-describedby")?.split(" ").length ?? 0).toBeLessThanOrEqual(1);
    expect(input.validity.valid).toBe(false);
    expect(select).not.toHaveAttribute("data-invalid");

    (getByTestId("form") as HTMLFormElement).checkValidity();
    await flush();

    const describedBy = trigger.getAttribute("aria-describedby")!.split(" ");
    const error = describedBy.map((id) => document.getElementById(id)).find((el) => el?.classList.contains("rv-FieldError"));
    expect(error).toHaveTextContent(input.validationMessage);
    expect(select).toHaveAttribute("data-invalid");
    expect(document.activeElement).toBe(trigger);

    await selectTester.toggleOptionSelection({ option: "Cat" });
    await flush();
    expect(selectTester.getTrigger().getAttribute("aria-describedby") ?? "").not.toContain("error");
    expect(select).not.toHaveAttribute("data-invalid");
  });

  it("should support arrow key navigation to a falsy key", async () => {
    const onSelectionChange = vi.fn();
    const items = Array.from({ length: 3 }).map((_, i) => ({ id: i, label: `${i}` }));
    const { getByRole } = renderIn(() => (
      <Select onSelectionChange={onSelectionChange} aria-label="Pick a number">
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox items={items}>
            {(item: { id: number; label: string }) => (
              <ListBoxItem id={item.id} textValue={item.label}>
                {item.label}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    const button = getByRole("button");
    button.focus();

    await user.keyboard("{ArrowRight}");
    await flush();
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith(0);
    expect(button).toHaveTextContent("0");
  });

  it("should support repeat keydown events when holding an arrow key", async () => {
    const onChange = vi.fn();
    const items = Array.from({ length: 3 }).map((_, i) => ({ id: i, label: `${i}` }));
    const { getByRole } = renderIn(() => (
      <Select onChange={onChange} aria-label="Pick a number">
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox items={items}>
            {(item: { id: number; label: string }) => (
              <ListBoxItem id={item.id} textValue={item.label}>
                {item.label}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    const button = getByRole("button");
    await user.tab();
    expect(button).toHaveFocus();

    // Arrow key navigation while closed moves the selection.
    await user.keyboard("{ArrowRight>2/}");
    await flush();

    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(button).toHaveTextContent("1");
  });

  it("should support falsy (0) as a valid default value", async () => {
    const items = Array.from({ length: 5 }).map((_, i) => ({ id: i, label: i }));
    const { getByRole } = renderIn(() => (
      <Select placeholder="pick a number">
        <Label>Pick a number</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox items={items}>
            {(item: { id: number; label: number }) => (
              <ListBoxItem id={item.id} textValue={`${item.label}`}>
                {item.label}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    const button = getByRole("button");
    await user.click(button);
    await flush();

    const listbox = getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    await user.click(options[0]!);
    await flush();

    expect(button).toHaveTextContent("0");
  });

  it("should support extra children for use with the state", async () => {
    const onChangeSpy = vi.fn();

    function SelectClearButton() {
      const state = useContext(SelectStateContext);
      return (
        <Button
          data-testid="clear"
          // Don't inherit behavior from Select.
          slot={null}
          onPress={() => {
            if (state) setSelectValue(state, null);
          }}
        >
          Clear
        </Button>
      );
    }

    const { getByTestId } = renderIn(() => (
      <>
        <input data-testid="before" />
        <Select onSelectionChange={onChangeSpy}>
          <Label>Favorite Animal</Label>
          <Button data-testid="select">
            <SelectValue />
          </Button>
          <SelectClearButton />
          <Popover>
            <ListBox>
              <ListBoxItem id="cat">Cat</ListBoxItem>
              <ListBoxItem id="dog">Dog</ListBoxItem>
              <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        <input data-testid="after" />
      </>
    ));
    await flush();

    const beforeInput = getByTestId("before");
    const afterInput = getByTestId("after");
    const wrapper = getByTestId("select");
    const clearButton = getByTestId("clear");
    const selectTester = testUtilUser.createTester("Select", { root: wrapper });

    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(selectTester.getTrigger());

    await user.tab();
    expect(document.activeElement).toBe(clearButton);

    await user.tab();
    expect(document.activeElement).toBe(afterInput);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(clearButton);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(selectTester.getTrigger());

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(beforeInput);

    await user.tab();
    await selectTester.toggleOptionSelection({ option: "Dog" });
    await flush();

    expect(onChangeSpy).toHaveBeenCalledTimes(1);
    expect(onChangeSpy).toHaveBeenLastCalledWith("dog");

    await user.click(clearButton);
    await flush();
    expect(onChangeSpy).toHaveBeenCalledTimes(2);
    expect(onChangeSpy).toHaveBeenLastCalledWith(null);
  });

  it("select can select an option via keyboard", async () => {
    const { getByTestId } = renderIn(() => <TestSelect name="select" />);
    await flush();

    const wrapper = getByTestId("select");
    const selectTester = testUtilUser.createTester("Select", { root: wrapper, interactionType: "keyboard" });
    const trigger = selectTester.getTrigger();
    expect(trigger).toHaveTextContent("Select an item");
    expect(trigger).not.toHaveAttribute("data-pressed");

    await selectTester.toggleOptionSelection({ option: "Kangaroo" });
    await flush();
    expect(trigger).toHaveTextContent("Kangaroo");
  });

  describe("typeahead", () => {
    it("can select an option via typeahead", async () => {
      const { getByTestId } = renderIn(() => (
        <Select data-testid="select">
          <Label>Favorite Animal</Label>
          <Button>
            <SelectValue />
          </Button>
          <Text slot="description">Description</Text>
          <Text slot="errorMessage">Error</Text>
          <Popover>
            <ListBox>
              <ListBoxItem>Australian Capital Territory</ListBoxItem>
              <ListBoxItem>New South Wales</ListBoxItem>
              <ListBoxItem>Northern Territory</ListBoxItem>
              <ListBoxItem>Queensland</ListBoxItem>
              <ListBoxItem>South Australia</ListBoxItem>
              <ListBoxItem>Tasmania</ListBoxItem>
              <ListBoxItem>Victoria</ListBoxItem>
              <ListBoxItem>Western Australia</ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
      ));
      await flush();

      const wrapper = getByTestId("select");
      await user.tab();
      await user.keyboard("Northern Terr");
      await flush();
      const selectTester = testUtilUser.createTester("Select", { root: wrapper, interactionType: "keyboard" });
      const trigger = selectTester.getTrigger();
      expect(trigger).toHaveTextContent("Northern Territory");
      expect(trigger).not.toHaveAttribute("data-pressed");
    });
  });

  it("should support autoFocus", async () => {
    const { getByTestId } = renderIn(() => <TestSelect autoFocus />);
    await flush();
    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    expect(document.activeElement).toBe(selectTester.getTrigger());
  });

  it("should clear contexts inside popover", async () => {
    const { getByTestId } = renderIn(() => (
      <Select data-testid="select" defaultSelectedKey="cat">
        <Label>Favorite Animal</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover data-testid="popover">
          <Label>Hello</Label>
          <Button>Yo</Button>
          <Text>hi</Text>
          <ListBox>
            <ListBoxItem id="cat">Cat</ListBoxItem>
            <ListBoxItem id="dog">Dog</ListBoxItem>
            <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    await selectTester.open();

    const popover = getByTestId("popover");
    const label = popover.querySelector(".rv-Label");
    expect(label).not.toHaveAttribute("for");

    const button = popover.querySelector(".rv-Button");
    expect(button).not.toHaveAttribute("aria-expanded");

    const text = popover.querySelector(".rv-Text");
    expect(text).not.toHaveAttribute("id");
  });

  it("shouldn't allow the user to open the select if there are no items", async () => {
    let r = renderIn(() => (
      <Select data-testid="select" defaultSelectedKey="cat">
        <Label>Favorite Animal</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover data-testid="popover">
          <Label>Hello</Label>
          <Button>Yo</Button>
          <Text>hi</Text>
          <ListBox>{[]}</ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    let selectTester = testUtilUser.createTester("Select", { root: r.getByTestId("select") });
    await user.click(selectTester.getTrigger());
    await flush();
    expect(r.queryByTestId("popover")).toBeFalsy();

    cleanup();
    r = renderIn(() => (
      <Select data-testid="select" defaultSelectedKey="cat">
        <Label>Favorite Animal</Label>
        <Button>
          <SelectValue />
        </Button>
        <Popover data-testid="popover">
          <Label>Hello</Label>
          <Button>Yo</Button>
          <Text>hi</Text>
          <ListBox>
            <ListBoxLoadMoreItem isLoading>Loading more</ListBoxLoadMoreItem>
          </ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    selectTester = testUtilUser.createTester("Select", { root: r.getByTestId("select") });
    await user.click(selectTester.getTrigger());
    await flush();
    expect(r.queryByTestId("popover")).toBeFalsy();
  });

  it("should support form prop", async () => {
    renderIn(() => <TestSelect name="select" form="test" />);
    await flush();
    const input = document.querySelector("[name=select]");
    expect(input).toHaveAttribute("form", "test");
  });

  it("should not submit if required and selectedKey is null", async () => {
    const onSubmit = vi.fn().mockImplementation((e: Event) => e.preventDefault());

    function Test() {
      const selectedKey = signal<Key | null>(null);
      return (
        <Form onSubmit={onSubmit}>
          <TestSelect isRequired name="select" selectedKey={selectedKey} />
          <Button data-testid="submit" type="submit">
            Submit
          </Button>
          <Button data-testid="clear" onPress={() => selectedKey.set(null)}>
            Reset
          </Button>
        </Form>
      );
    }

    const { getByTestId } = renderIn(() => <Test />);
    await flush();
    const wrapper = getByTestId("select");
    const selectTester = testUtilUser.createTester("Select", { root: wrapper });
    const trigger = selectTester.getTrigger();
    const submit = getByTestId("submit");

    expect(trigger).toHaveTextContent("Select an item");
    await selectTester.toggleOptionSelection({ option: "Cat" });
    await flush();
    expect(trigger).toHaveTextContent("Cat");
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await user.click(getByTestId("clear"));
    await flush();
    expect(trigger).toHaveTextContent("Select an item");
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect((document.querySelector("[name=select]") as HTMLSelectElement).value).toBe("");
  });

  it("should support multiple selection", async () => {
    const onChange = vi.fn();
    const { getByTestId } = renderIn(() => (
      <Form data-testid="form">
        <TestSelect name="select" selectionMode="multiple" onChange={onChange} />
      </Form>
    ));
    await flush();
    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });

    const trigger = selectTester.getTrigger();
    expect(trigger).toHaveTextContent("Select an item");

    await selectTester.open();

    const listbox = selectTester.getListbox()!;
    expect(listbox).toHaveAttribute("aria-multiselectable", "true");

    const options = selectTester.getOptions();
    expect(options).toHaveLength(3);

    await selectTester.toggleOptionSelection({ option: options[0]! });
    await selectTester.toggleOptionSelection({ option: options[1]! });
    await flush();
    expect(trigger).toHaveTextContent("Cat and Dog");
    await selectTester.close();

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(["cat", "dog"]);

    const formData = new FormData(getByTestId("form") as HTMLFormElement);
    expect(formData.getAll("select")).toEqual(["cat", "dog"]);
  });

  it("should support deselection if multiple selection is enabled", async () => {
    const onChange = vi.fn();
    const { getByTestId } = renderIn(() => <TestSelect selectionMode="multiple" onChange={onChange} />);
    await flush();
    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });

    await selectTester.toggleOptionSelection({ option: "Cat" });
    await selectTester.toggleOptionSelection({ option: "Dog" });
    await flush();
    expect(selectTester.getOptions()[0]).toHaveAttribute("aria-selected", "true");
    expect(selectTester.getOptions()[1]).toHaveAttribute("aria-selected", "true");
    expect(onChange).toHaveBeenLastCalledWith(["cat", "dog"]);

    await selectTester.toggleOptionSelection({ option: "Cat" });
    await flush();
    expect(selectTester.getOptions()[0]).toHaveAttribute("aria-selected", "false");
    expect(selectTester.getOptions()[1]).toHaveAttribute("aria-selected", "true");
    expect(onChange).toHaveBeenLastCalledWith(["dog"]);

    await selectTester.toggleOptionSelection({ option: "Dog" });
    await flush();
    expect(selectTester.getOptions()[0]).toHaveAttribute("aria-selected", "false");
    expect(selectTester.getOptions()[1]).toHaveAttribute("aria-selected", "false");
    expect(onChange).toHaveBeenLastCalledWith([]);

    await selectTester.close();
  });

  it("should support multiple selection form integration with many items", async () => {
    const items: { id: number; name: string }[] = [];
    for (let i = 0; i < 320; i++) items.push({ id: i, name: "item" + i });

    const { getByTestId } = renderIn(() => (
      <Form data-testid="form" onSubmit={(e: Event) => e.preventDefault()}>
        <Select data-testid="select" name="select" selectionMode="multiple" isRequired>
          <Label>Select</Label>
          <Button>
            <SelectValue />
          </Button>
          <FieldError />
          <Popover>
            <ListBox items={items}>{(item: { id: number; name: string }) => <ListBoxItem>{item.name}</ListBoxItem>}</ListBox>
          </Popover>
        </Select>
        <Button data-testid="submit" type="submit">
          Submit
        </Button>
      </Form>
    ));
    await flush();
    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });

    const trigger = selectTester.getTrigger();
    expect(trigger).toHaveTextContent("Select an item");

    await user.click(getByTestId("submit"));
    await flush();

    let fieldError = document.querySelector(".rv-FieldError");
    expect(fieldError?.textContent).toBeTruthy();

    await selectTester.open();

    const options = selectTester.getOptions();
    await user.click(options[0]!);
    await user.click(options[1]!);
    await selectTester.close();
    await flush();
    expect(trigger).toHaveTextContent("item0 and item1");

    const formData = new FormData(getByTestId("form") as HTMLFormElement);
    expect(formData.getAll("select")).toEqual(["0", "1"]);

    await user.click(getByTestId("submit"));
    await flush();
    fieldError = document.querySelector(".rv-FieldError");
    expect(fieldError).toBe(null);
  });

  it("should support controlled multi-selection", async () => {
    const { getByTestId } = renderIn(() => <TestSelect selectionMode="multiple" value={["dog", "kangaroo"]} />);
    await flush();
    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });

    const trigger = selectTester.getTrigger();
    expect(trigger).toHaveTextContent("Dog and Kangaroo");

    await selectTester.open();

    const options = selectTester.getOptions();
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[2]).toHaveAttribute("aria-selected", "true");
  });

  it("supports custom select value with multi-selection", async () => {
    const items = [
      { id: 1, name: "Cat" },
      { id: 2, name: "Dog" },
    ];

    const { getByTestId } = renderIn(() => (
      <Select data-testid="select" selectionMode="multiple" defaultValue={[1]}>
        <Label>Favorite Animal</Label>
        <Button>
          <SelectValue>
            {({ selectedItems }) => (selectedItems().length === 1 ? selectedItems()[0]?.name : `${selectedItems().length} selected items`)}
          </SelectValue>
        </Button>
        <Popover>
          <ListBox items={items}>{(item: { id: number; name: string }) => <ListBoxItem>{item.name}</ListBoxItem>}</ListBox>
        </Popover>
      </Select>
    ));
    await flush();

    const selectTester = testUtilUser.createTester("Select", { root: getByTestId("select") });
    const trigger = selectTester.getTrigger();
    expect(trigger).toHaveTextContent("Cat");

    await selectTester.toggleOptionSelection({ option: "Dog" });
    await flush();
    expect(trigger).toHaveTextContent("2 selected items");
  });

  it("has a value immediately after rendering (hidden select)", async () => {
    let form: HTMLFormElement | null = null;
    renderIn(() => (
      <form ref={(el: HTMLFormElement | null) => (form = el)}>
        <Select name="select" defaultValue="1" aria-label="Select">
          <Button>
            <SelectValue />
          </Button>
          <Popover>
            <ListBox>
              <ListBoxItem id="1">value</ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
      </form>
    ));
    expect(new FormData(form!).get("select")).toBe("1");
  });

  it("should not throw when rendered inside a Dialog with a Text errorMessage slot", async () => {
    renderIn(() => (
      <Dialog aria-label="Dialog">
        <TestSelect isInvalid />
      </Dialog>
    ));
    await flush();
  });

  it("should not throw when rendered inside an alertdialog with a Text errorMessage slot", async () => {
    renderIn(() => (
      <Dialog role="alertdialog" aria-label="Dialog">
        <TestSelect isInvalid />
      </Dialog>
    ));
    await flush();
  });
});
