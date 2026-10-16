// Ported from react-aria-components test/SearchField.test.js and react-aria test/searchfield/useSearchField.test.js
// (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within(container)`;
// `jest.fn` → `vi.fn`; `userEvent.setup({delay: null, pointerMap})` → `userEvent.setup()`; default classes `rv-*`;
// `<SearchFieldContext.Provider value>` → runtime `<Provider token value>`; render props are accessors / the
// `state` object (`searchFieldValue(state)` for `state.value`); jsdom's validation message "Constraints not
// satisfied" → Chromium's "Please fill out this field.".
// useSearchField: `renderHook(() => useSearchField(props, state, ref))` → `searchFieldProps(props, state, ref)`;
// the fake state is a plain-controlled `ControlledState` whose `onChange` is the `setValue` spy and whose value
// signal the test sets by hand; `inputProps.value` is an accessor; keydown handlers get real `KeyboardEvent`s
// dispatched on an input (Rivet's `useKeyboard` port ignores events whose target is outside `currentTarget`);
// the de-DE label comes from the `locale` option instead of a Provider.
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal, type Signal } from "@rivetjs/reactivity";
import { Provider, ref as createRef } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { FieldError } from "../form/field-error.tsx";
import { Input } from "../input/index.tsx";
import { Label } from "../label/index.tsx";
import { Text } from "../text/index.tsx";
import { SearchField, SearchFieldContext, type SearchFieldProps } from "../search-field/index.tsx";
import { searchFieldProps } from "../search-field/behaviour.tsx";
import { searchFieldValue, type SearchFieldState } from "../state/search-field.ts";
import type { ControlledState } from "../interactions/controllable.ts";
import { strings as intlMessages } from "../search-field/intl.ts";

afterEach(cleanup);

const TestSearchField = (props: SearchFieldProps) => (
  <SearchField defaultValue="test" data-foo="bar" {...props}>
    <Label>Test</Label>
    <Input />
    <Button>x</Button>
    <Text slot="description">Description</Text>
    <Text slot="errorMessage">Error</Text>
  </SearchField>
);

const renderIn = (ui: () => unknown) => within(render(ui as never).container as HTMLElement);

describe("SearchField", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("provides slots", async () => {
    const { getByRole } = renderIn(() => <TestSearchField />);
    await flush();

    const input = getByRole("searchbox");
    expect(input).toHaveValue("test");

    expect(input.closest(".rv-SearchField")).toHaveAttribute("data-foo", "bar");

    expect(input).toHaveAttribute("aria-labelledby");
    const label = document.getElementById(input.getAttribute("aria-labelledby")!);
    expect(label).toHaveAttribute("class", "rv-Label");
    expect(label).toHaveTextContent("Test");

    expect(input).toHaveAttribute("aria-describedby");
    expect(
      input
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.textContent)
        .join(" "),
    ).toBe("Description Error");

    const button = getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Clear search");
  });

  it("should support slot", () => {
    const { getByRole } = renderIn(() => (
      <Provider token={SearchFieldContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestSearchField slot="test" />
      </Provider>
    ));

    const searchbox = getByRole("searchbox");
    expect(searchbox.closest(".rv-SearchField")).toHaveAttribute("slot", "test");
    expect(searchbox).toHaveAttribute("aria-label", "test");
  });

  it("should support render props", async () => {
    const { getByRole } = renderIn(() => (
      <SearchField defaultValue="test">
        {({ state }: { state: SearchFieldState }) => (
          <>
            <Label>Test</Label>
            <Input />
            <Button>x</Button>
            <Text slot="description">You are looking for "{searchFieldValue(state)}"</Text>
          </>
        )}
      </SearchField>
    ));
    await flush();

    const searchbox = getByRole("searchbox");
    const description = document.getElementById(searchbox.getAttribute("aria-describedby")!);
    expect(description).toHaveTextContent('You are looking for "test"');
  });

  it("should render data- attributes only on the outer element", () => {
    const { getAllByTestId } = renderIn(() => (
      <SearchField data-testid="search-field">
        <Label>Search</Label>
        <Input />
        <Button>x</Button>
      </SearchField>
    ));
    const outerEl = getAllByTestId("search-field");
    expect(outerEl).toHaveLength(1);
    expect(outerEl[0]).toHaveClass("rv-SearchField");
  });

  it("supports validation errors", async () => {
    const { getByRole, getByTestId } = renderIn(() => (
      <form data-testid="form">
        <SearchField isRequired>
          <Label>Test</Label>
          <Input />
          <FieldError />
        </SearchField>
      </form>
    ));
    await flush();

    const input = getByRole("searchbox") as HTMLInputElement;
    expect(input).toHaveAttribute("required");
    expect(input).not.toHaveAttribute("aria-required");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(false);

    (getByTestId("form") as HTMLFormElement).checkValidity();
    await flush();

    expect(input).toHaveAttribute("aria-describedby");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent("Please fill out this field.");
    expect(document.activeElement).toBe(input);

    expect(input.parentElement).toHaveAttribute("data-invalid");
    expect(input.parentElement).toHaveAttribute("data-required");

    await user.keyboard("Devon");

    expect(input).toHaveAttribute("aria-describedby");
    expect(input.validity.valid).toBe(true);

    await user.tab();
    await flush();
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("supports readonly", () => {
    const { getByRole } = renderIn(() => (
      <form data-testid="form">
        <SearchField isReadOnly>
          <Label>Test</Label>
          <Input />
          <FieldError />
        </SearchField>
      </form>
    ));

    const input = getByRole("searchbox");

    expect(input.parentElement).toHaveAttribute("data-readonly");
  });

  it("should support form prop", () => {
    const { getByRole } = renderIn(() => <TestSearchField form="test" />);

    const input = getByRole("searchbox");
    expect(input).toHaveAttribute("form", "test");
  });

  // Rivet additions (behaviour the upstream component has, exercised end to end).
  it("Escape clears and calls onClear; Enter calls onSubmit; clear button clears and keeps focus", async () => {
    const onClear = vi.fn();
    const onSubmit = vi.fn();
    const value = signal("abc");
    const { getByRole } = renderIn(() => (
      <SearchField value={value} onClear={onClear} onSubmit={onSubmit}>
        <Label>Search</Label>
        <Input />
        <Button>x</Button>
      </SearchField>
    ));
    const input = getByRole("searchbox") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("abc");
    await user.keyboard("{Escape}");
    expect(value()).toBe("");
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input.closest(".rv-SearchField")).toHaveAttribute("data-empty", "true");
    await user.keyboard("xy");
    expect(value()).toBe("xy");
    await user.click(getByRole("button"));
    expect(value()).toBe("");
    expect(onClear).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(input);
    expect(getByRole("button")).toHaveAttribute("tabindex", "-1");
  });
});

describe("useSearchField hook", () => {
  let value: Signal<string>;
  let state: SearchFieldState;
  const setValue = vi.fn();
  let ref = createRef<HTMLInputElement>();
  let focus: ReturnType<typeof vi.spyOn>;
  const onClear = vi.fn();

  const renderSearchHook = (props: Record<string, unknown> = {}) => searchFieldProps({ ...props, "aria-label": "testLabel" }, state, ref);

  beforeEach(() => {
    value = signal("");
    const controlled: ControlledState<string> = {
      value,
      isControlled: true,
      isSignal: false,
      isAccessor: false,
      onChange: setValue,
      pending: { has: false, v: undefined },
    };
    state = { value: controlled };
    ref = createRef<HTMLInputElement>();
    const input = document.createElement("input");
    (ref as unknown as Signal<HTMLInputElement | undefined>).set(input);
    focus = vi.spyOn(input, "focus");
  });

  afterEach(() => {
    setValue.mockClear();
    focus.mockClear();
    onClear.mockClear();
  });

  describe("should return inputProps", () => {
    it("with base props and value equal to state.value", () => {
      const { inputProps } = renderSearchHook({});
      expect(inputProps.type).toBe("search");
      expect((inputProps.value as () => string)()).toBe(value());
      expect(typeof inputProps.onKeyDown).toBe("function");
    });

    describe("with specific onKeyDown behavior", () => {
      const onSubmit = vi.fn();
      const onKeyDown = vi.fn();
      let preventDefault: Mock<() => void>;
      let stopPropagation: Mock<() => void>;
      /** Dispatches a keydown for `key` on an input wired to `handler`; spies on preventDefault / stopPropagation. */
      const press = (handler: unknown, key: string) => {
        const input = document.createElement("input");
        document.body.append(input);
        input.addEventListener("keydown", handler as EventListener);
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        const pd = event.preventDefault.bind(event);
        const sp = event.stopPropagation.bind(event);
        event.preventDefault = () => (preventDefault(), pd());
        event.stopPropagation = () => (stopPropagation(), sp());
        input.dispatchEvent(event);
        input.remove();
      };

      beforeEach(() => {
        preventDefault = vi.fn();
        stopPropagation = vi.fn();
      });

      afterEach(() => {
        onSubmit.mockClear();
      });

      it("preventDefault and stopPropagation are not called for Escape", () => {
        const { inputProps } = renderSearchHook({});
        press(inputProps.onKeyDown, "Escape");
        expect(preventDefault).toHaveBeenCalledTimes(0);
        expect(stopPropagation).toHaveBeenCalledTimes(0);
      });

      it("preventDefault is not called for Enter if onSubmit is not provided", () => {
        const { inputProps } = renderSearchHook();
        press(inputProps.onKeyDown, "Enter");
        expect(preventDefault).toHaveBeenCalledTimes(0);
      });

      it("preventDefault and onSubmit are called for Enter if submit is provided", () => {
        const { inputProps } = renderSearchHook({ onSubmit });
        press(inputProps.onKeyDown, "Enter");
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit).toHaveBeenCalledWith(value());
      });

      it('pressing the Escape key sets the state value to "", if state.value is not empty, and calls onClear if provided and will not call onClear if escape pressed again', () => {
        const { inputProps } = renderSearchHook({ onClear });
        expect(inputProps.type).toBe("search");
        expect((inputProps.value as () => string)()).toBe(value());

        // manually updating fake state
        value.set("search");

        press(inputProps.onKeyDown, "Escape");
        expect(setValue).toHaveBeenCalledTimes(1);
        expect(setValue).toHaveBeenCalledWith("");
        expect(onClear).toHaveBeenCalledTimes(1);

        // manually updating fake state
        value.set("");

        press(inputProps.onKeyDown, "Escape");
        expect(setValue).toHaveBeenCalledTimes(1);
        expect(onClear).toHaveBeenCalledTimes(1);
      });

      it("does not return an onKeyDown prop if isDisabled is true", () => {
        const { inputProps } = renderSearchHook({ isDisabled: true, onClear, onSubmit });
        expect(inputProps.onKeyDown).not.toBeDefined();
      });

      it("does not return an defaultValue prop", () => {
        const { inputProps } = renderSearchHook({ onClear, onSubmit, defaultValue: "ABC" });
        expect(inputProps.defaultValue).not.toBeDefined();
      });

      it("onKeyDown prop is called", () => {
        const { inputProps } = renderSearchHook({ onKeyDown });
        press(inputProps.onKeyDown, "Enter");
        expect(onKeyDown).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("should return clearButtonProps", () => {
    it("with a localized aria-label", () => {
      const locale = "de-DE";
      const expectedIntl = intlMessages[locale]!["Clear search"];
      const { clearButtonProps } = renderSearchHook({ locale });
      expect(clearButtonProps["aria-label"]).toBe(expectedIntl);
    });

    it("clear button should not be tabbable", () => {
      const { clearButtonProps } = renderSearchHook({});
      expect(clearButtonProps.excludeFromTabOrder).toBe(true);
    });

    describe("with specific onPress behavior", () => {
      it('sets the state to "" and focuses the search field', () => {
        const { clearButtonProps } = renderSearchHook({});
        value.set("search"); // Rivet: the state's setter skips an unchanged value (the upstream fake does not)
        clearButtonProps.onPressStart();
        clearButtonProps.onPress();
        expect(setValue).toHaveBeenCalledTimes(1);
        expect(setValue).toHaveBeenCalledWith("");
        expect(focus).toHaveBeenCalledTimes(1);
      });

      it("calls the user provided onClear if provided", () => {
        const { clearButtonProps } = renderSearchHook({ onClear });
        value.set("search"); // Rivet: the state's setter skips an unchanged value (the upstream fake does not)
        clearButtonProps.onPressStart();
        clearButtonProps.onPress();
        // Verify that onClearButtonClick stuff still triggers
        expect(setValue).toHaveBeenCalledTimes(1);
        expect(setValue).toHaveBeenCalledWith("");
        expect(focus).toHaveBeenCalledTimes(1);
        // Verify that props.onClear is triggered as well with the same event
        expect(onClear).toHaveBeenCalledTimes(1);
        expect(onClear).toHaveBeenCalledWith();
      });
    });
  });
});
