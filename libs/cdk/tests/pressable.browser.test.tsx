// Ported from react-aria test/interactions/Pressable.test.js, PressResponder.test.js, Focusable.test.js
// (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); `getByRole` → `@testing-library/dom` `within(container)`;
// `jest.fn` / `jest.spyOn` → `vi.fn` / `vi.spyOn`; `userEvent.setup({ delay: null, pointerMap })` → `userEvent.setup()`;
// `React.createRef()` → Rivet `ref()`. Rivet cannot clone a child element: the child of `<Pressable>` /
// `<Focusable>` is a render function receiving the props (incl. `ref`) — `<button>` → `{(p) => <button {...p} ref={p.ref as never}>…</button>}`;
// "merge with existing props / ref" = the child merges its own props over them (`mergeProps(p, own)`); a spread
// never sets `ref`, so the child passes `ref={p.ref}`. Dev checks run in a client effect (`await flush()`), gated on
// `NODE_ENV === "development"` (set on `globalThis.process` here).
// Skipped: "should error if component does not forward its ref to a DOM element" (React `useImperativeHandle`
// has no Rivet equivalent; covered by "does not forward its ref").
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { mergeProps } from "../interactions/merge-props.tsx";
import { pressProps } from "../interactions/press.tsx";
import { PressResponder, Pressable, ClearPressResponder } from "../interactions/pressable.tsx";
import { Focusable, FocusableProvider } from "../focus/focusable.tsx";

beforeEach(() => {
  (globalThis as { process?: unknown }).process = { env: { NODE_ENV: "development" } };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (globalThis as { process?: unknown }).process;
});

const q = (container: Element | DocumentFragment) => within(container as HTMLElement);

describe("Pressable", () => {
  it("should apply press events to child element", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    const { container } = render(() => (
      <Pressable onPress={(e) => onPress(e)}>
        {(p) => (
          <button {...p} ref={p.ref as never}>
            Button
          </button>
        )}
      </Pressable>
    ));
    await user.click(q(container).getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should should merge with existing props, not overwrite", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    const onClick = vi.fn();
    const { container } = render(() => (
      <Pressable onPress={(e) => onPress(e)}>
        {(p) => (
          <button {...mergeProps(p, { onClick: (e: MouseEvent) => onClick(e) })} ref={mergeProps(p, { onClick: (e: MouseEvent) => onClick(e) }).ref as never}>
            Button
          </button>
        )}
      </Pressable>
    ));
    await user.click(q(container).getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should should merge with existing ref", async () => {
    const ref1 = ref<HTMLElement>();
    const ref2 = ref<HTMLElement>();
    const { container } = render(() => (
      <Pressable ref={ref1}>
        {(p) => (
          <button {...mergeProps(p, { ref: ref2 })} ref={mergeProps(p, { ref: ref2 }).ref as never}>
            Button
          </button>
        )}
      </Pressable>
    ));
    await flush();
    const button = q(container).getByRole("button");
    expect(ref1()).toBe(button);
    expect(ref2()).toBe(button);
  });

  it("should automatically make child focusable", () => {
    const { container } = render(() => (
      <Pressable>
        {(p) => (
          <span {...p} ref={p.ref as never} role="button">
            Button
          </span>
        )}
      </Pressable>
    ));
    expect(q(container).getByRole("button")).toHaveAttribute("tabindex", "0");
  });

  it("should error if component does not forward its ref", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(() => <Pressable>{() => <button>Hi</button>}</Pressable>);
    await flush();
    expect(spy).toHaveBeenCalledWith("<Pressable> child must forward its ref to a DOM element.");
  });

  it.skip("should error if component does not forward its ref to a DOM element (no useImperativeHandle)", () => {});

  it("should warn if child is not focusable", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(() => (
      <Pressable>
        {(p) => (
          <span role="button" ref={p.ref as never}>
            Hi
          </span>
        )}
      </Pressable>
    ));
    await flush();
    expect(spy).toHaveBeenCalledWith("<Pressable> child must be focusable. Please ensure the tabIndex prop is passed through.");
  });

  it("should not warn if focusable child is inside a hidden subtree", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(() => (
      <div hidden>
        <Pressable>
          {(p) => (
            <span {...p} ref={p.ref as never} role="button">
              Button
            </span>
          )}
        </Pressable>
      </div>
    ));
    await flush();
    expect(spy).not.toHaveBeenCalledWith("<Pressable> child must be focusable. Please ensure the tabIndex prop is passed through.");
  });

  it("supports isDisabled", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(() => (
      <Pressable isDisabled>
        {(p) => (
          <span {...p} ref={p.ref as never} role="button">
            Button
          </span>
        )}
      </Pressable>
    ));
    await flush();
    expect(q(container).getByRole("button")).not.toHaveAttribute("tabindex");
    expect(spy).not.toHaveBeenCalled();
  });

  it("should warn if child does not have a role", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(() => (
      <Pressable>
        {(p) => (
          <span {...p} ref={p.ref as never}>
            Trigger
          </span>
        )}
      </Pressable>
    ));
    await flush();
    expect(spy).toHaveBeenCalledWith("<Pressable> child must have an interactive ARIA role.");
  });

  it("should warn if child does not have an interactive role", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(() => (
      <Pressable>
        {(p) => (
          <span {...p} ref={p.ref as never} role="presentation">
            Trigger
          </span>
        )}
      </Pressable>
    ));
    await flush();
    expect(spy).toHaveBeenCalledWith('<Pressable> child must have an interactive ARIA role. Got "presentation".');
  });
});

describe("PressResponder", () => {
  it("should handle press events on nested pressable children", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    const { container } = render(() => (
      <PressResponder onPress={(e) => onPress(e)}>
        <div>
          <Pressable>
            {(p) => (
              <button {...p} ref={p.ref as never}>
                Button
              </button>
            )}
          </Pressable>
        </div>
      </PressResponder>
    ));
    await user.click(q(container).getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should handle forward refs to nested pressable children", async () => {
    const r = ref<HTMLElement>();
    const { container } = render(() => (
      <PressResponder ref={r}>
        <div>
          <Pressable>
            {(p) => (
              <button {...p} ref={p.ref as never}>
                Button
              </button>
            )}
          </Pressable>
        </div>
      </PressResponder>
    ));
    await flush();
    expect(r()).toBe(q(container).getByRole("button"));
  });

  it("should warn if there is no pressable child", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(() => (
      <PressResponder>
        <div>
          <button>Button</button>
        </div>
      </PressResponder>
    ));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("should not warn if there is a pressable child", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(() => (
      <PressResponder>
        <div>
          <Pressable>
            {(p) => (
              <button {...p} ref={p.ref as never}>
                Button
              </button>
            )}
          </Pressable>
        </div>
      </PressResponder>
    ));
    await flush();
    expect(warn).not.toHaveBeenCalled();
  });

  it("Rivet: does not warn for a pressable child passed through a wrapper's children", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const Wrapper = (props: { children?: unknown }) => <div>{props.children as never}</div>;
    render(() => (
      <PressResponder>
        <Wrapper>
          <Pressable>
            {(p) => (
              <button {...p} ref={p.ref as never}>
                Button
              </button>
            )}
          </Pressable>
        </Wrapper>
      </PressResponder>
    ));
    await flush();
    expect(warn).not.toHaveBeenCalled();
  });

  it("should merge with existing props, not overwrite", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    const onClick = vi.fn();
    const { container } = render(() => (
      <PressResponder>
        <div>
          <Pressable onPress={(e) => onPress(e)}>
            {(p) => (
              <button
                {...mergeProps(p, { onClick: (e: MouseEvent) => onClick(e) })}
                ref={mergeProps(p, { onClick: (e: MouseEvent) => onClick(e) }).ref as never}
              >
                Button
              </button>
            )}
          </Pressable>
        </div>
      </PressResponder>
    ));
    await user.click(q(container).getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("Rivet: passes accessor values through to pressProps; ClearPressResponder stops them", async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    let pressed: (() => boolean) | undefined;
    function Child() {
      const press = pressProps();
      pressed = press.isPressed;
      return <button {...press.pressProps}>Child</button>;
    }
    const { container } = render(() => (
      <PressResponder onPress={() => outer()} isPressed={() => true}>
        <Child />
        <ClearPressResponder>
          <Pressable>
            {(p) => (
              <button {...p} ref={p.ref as never}>
                Cleared
              </button>
            )}
          </Pressable>
        </ClearPressResponder>
      </PressResponder>
    ));
    expect(pressed!()).toBe(true);
    await user.click(q(container).getByText("Cleared"));
    expect(outer).not.toHaveBeenCalled();
    await user.click(q(container).getByText("Child"));
    expect(outer).toHaveBeenCalledTimes(1);
  });
});

describe("Focusable", () => {
  it("should apply focusable props to child element", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    const { container } = render(() => (
      <Focusable onFocus={(e) => onFocus(e)} onKeyDown={(e) => onKeyDown(e)} onBlur={(e) => onBlur(e)}>
        {(p) => (
          <span {...p} ref={p.ref as never} role="button">
            Button
          </span>
        )}
      </Focusable>
    ));
    const button = q(container).getByRole("button");
    expect(button).toHaveAttribute("tabindex", "0");
    await user.tab();
    expect(onFocus).toHaveBeenCalled();
    await user.keyboard("a");
    expect(onKeyDown).toHaveBeenCalled();
    await user.tab();
    expect(onBlur).toHaveBeenCalled();
  });

  it("supports isDisabled", () => {
    const { container } = render(() => (
      <Focusable isDisabled>
        {(p) => (
          <span {...p} ref={p.ref as never} role="button">
            Button
          </span>
        )}
      </Focusable>
    ));
    expect(q(container).getByRole("button")).not.toHaveAttribute("tabindex");
  });

  it("supports excludeFromTabOrder", () => {
    const { container } = render(() => (
      <Focusable excludeFromTabOrder>
        {(p) => (
          <span {...p} ref={p.ref as never} role="button">
            Button
          </span>
        )}
      </Focusable>
    ));
    expect(q(container).getByRole("button")).toHaveAttribute("tabindex", "-1");
  });

  it("supports autoFocus", async () => {
    const { container } = render(() => (
      <Focusable autoFocus>
        {(p) => (
          <span {...p} ref={p.ref as never} role="button">
            Button
          </span>
        )}
      </Focusable>
    ));
    await flush();
    expect(document.activeElement).toBe(q(container).getByRole("button"));
  });

  it("should should merge with existing props", () => {
    const { container } = render(() => (
      <Focusable>
        {(p) => (
          <button {...mergeProps(p, { tabIndex: -1 })} ref={mergeProps(p, { tabIndex: -1 }).ref as never}>
            Button
          </button>
        )}
      </Focusable>
    ));
    expect(q(container).getByRole("button")).toHaveAttribute("tabindex", "-1");
  });

  it("should should merge with existing ref", async () => {
    const ref1 = ref<HTMLElement>();
    const ref2 = ref<HTMLElement>();
    const { container } = render(() => (
      <Focusable ref={ref1}>
        {(p) => (
          <button {...mergeProps(p, { ref: ref2 })} ref={mergeProps(p, { ref: ref2 }).ref as never}>
            Button
          </button>
        )}
      </Focusable>
    ));
    await flush();
    const button = q(container).getByRole("button");
    expect(ref1()).toBe(button);
    expect(ref2()).toBe(button);
  });

  it("should error if component does not forward its ref", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(() => <Focusable>{() => <span role="button">Hi</span>}</Focusable>);
    await flush();
    expect(spy).toHaveBeenCalledWith("<Focusable> child must forward its ref to a DOM element.");
  });

  it("should warn if child is not focusable", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(() => (
      <Focusable>
        {(p) => (
          <span role="button" ref={p.ref as never}>
            Hi
          </span>
        )}
      </Focusable>
    ));
    await flush();
    expect(spy).toHaveBeenCalledWith("<Focusable> child must be focusable. Please ensure the tabIndex prop is passed through.");
  });

  it("should warn if child does not have a role", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(() => (
      <Focusable>
        {(p) => (
          <span {...p} ref={p.ref as never}>
            Trigger
          </span>
        )}
      </Focusable>
    ));
    await flush();
    expect(spy).toHaveBeenCalledWith("<Focusable> child must have an interactive ARIA role.");
  });

  it("should warn if child does not have an interactive role", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(() => (
      <Focusable>
        {(p) => (
          <span {...p} ref={p.ref as never} role="presentation">
            Trigger
          </span>
        )}
      </Focusable>
    ));
    await flush();
    expect(spy).toHaveBeenCalledWith('<Focusable> child must have an interactive ARIA role. Got "presentation".');
  });

  it("Rivet: FocusableProvider passes DOM props to the focusable child", () => {
    const { container } = render(() => (
      <FocusableProvider aria-describedby="tip">
        <Focusable>
          {(p) => (
            <span {...p} ref={p.ref as never} role="button">
              Button
            </span>
          )}
        </Focusable>
      </FocusableProvider>
    ));
    expect(q(container).getByRole("button")).toHaveAttribute("aria-describedby", "tip");
  });
});
