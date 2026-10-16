// Ported from react-aria-components test/Link.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isHovered()`); `jest.fn` → `vi.fn`; real timers;
// `<LinkContext.Provider value>` → runtime `Provider`; default class `rv-Link`; RouterProvider from
// `@rivetjs/cdk/link` (`navigate` / `useHref` inline arrows); navigation hrefs point at "#…" so a native
// follow cannot unload the test page.
// "should support custom render function" lives in render-core.browser.test.tsx. Skipped: "… without href".
// Rivet additions: zero render-time interaction state, accessor aria-current / isDisabled, LinkContext
// (onPress chain, ref), keyboard activation of a `<span role=link>`.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider, ref as createRef } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { FocusableProvider } from "../focus/focusable.tsx";
import { Link, LinkContext, RouterProvider } from "../link/index.tsx";

afterEach(cleanup);

function renderUI(ui: () => unknown) {
  const { container } = render(ui as never);
  return within(container as HTMLElement);
}

describe("Link", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a link with default class", () => {
    const { getByRole } = renderUI(() => <Link>Test</Link>);
    const link = getByRole("link");
    expect(link.tagName).toBe("SPAN");
    expect(link).toHaveAttribute("class", "rv-Link");
  });

  it("should render a link with custom class", () => {
    const { getByRole } = renderUI(() => <Link class="test">Test</Link>);
    expect(getByRole("link")).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { getByRole } = renderUI(() => <Link data-foo="bar">Test</Link>);
    expect(getByRole("link")).toHaveAttribute("data-foo", "bar");
  });

  it("should support id prop", () => {
    const { getByRole } = renderUI(() => <Link id="my-link-id">Test</Link>);
    expect(getByRole("link")).toHaveAttribute("id", "my-link-id");
  });

  it("should support accessibility props", () => {
    const { getByRole } = renderUI(() => <Link aria-current="page">Test</Link>);
    expect(getByRole("link")).toHaveAttribute("aria-current", "page");
  });

  it("should support render props", async () => {
    const { getByRole } = renderUI(() => <Link>{({ isHovered }) => (isHovered() ? "Hovered" : "Test")}</Link>);
    const link = getByRole("link");
    expect(link).toHaveTextContent("Test");
    await user.hover(link);
    expect(link).toHaveTextContent("Hovered");
  });

  it("should support slot", () => {
    const { getByRole } = renderUI(() => (
      <Provider token={LinkContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <Link slot="test">Test</Link>
      </Provider>
    ));
    const link = getByRole("link");
    expect(link).toHaveAttribute("slot", "test");
    expect(link).toHaveAttribute("aria-label", "test");
  });

  it("should render a link with <a> element", () => {
    const { getByRole } = renderUI(() => <Link href="test">Test</Link>);
    const link = getByRole("link");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("class", "rv-Link");
  });

  it("should support hover", async () => {
    const hoverStartSpy = vi.fn();
    const hoverChangeSpy = vi.fn();
    const hoverEndSpy = vi.fn();
    const { getByRole } = renderUI(() => (
      <Link class={({ isHovered }) => (isHovered() ? "hover" : "")} onHoverStart={hoverStartSpy} onHoverChange={hoverChangeSpy} onHoverEnd={hoverEndSpy}>
        Test
      </Link>
    ));
    const link = getByRole("link");
    expect(link).not.toHaveAttribute("data-hovered");
    expect(link).not.toHaveClass("hover");

    await user.hover(link);
    expect(link).toHaveAttribute("data-hovered", "true");
    expect(link).toHaveClass("hover");
    expect(hoverStartSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(1);

    await user.unhover(link);
    expect(link).not.toHaveAttribute("data-hovered");
    expect(link).not.toHaveClass("hover");
    expect(hoverEndSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(2);
  });

  it("should support focus ring", async () => {
    const { getByRole } = renderUI(() => <Link class={({ isFocusVisible }) => (isFocusVisible() ? "focus" : "")}>Test</Link>);
    const link = getByRole("link");
    expect(link).not.toHaveAttribute("data-focus-visible");
    expect(link).not.toHaveClass("focus");

    await user.tab();
    expect(document.activeElement).toBe(link);
    expect(link).toHaveAttribute("data-focus-visible", "true");
    expect(link).toHaveClass("focus");

    await user.tab();
    expect(link).not.toHaveAttribute("data-focus-visible");
    expect(link).not.toHaveClass("focus");
  });

  it("should support press state", async () => {
    const onPress = vi.fn();
    const onPressStart = vi.fn();
    const onPressEnd = vi.fn();
    const onPressChange = vi.fn();
    const onClick = vi.fn();
    const onClickCapture = vi.fn();
    const { getByRole } = renderUI(() => (
      <Link
        class={({ isPressed }) => (isPressed() ? "pressed" : "")}
        onPress={onPress}
        onPressStart={onPressStart}
        onPressEnd={onPressEnd}
        onPressChange={onPressChange}
        onClick={onClick}
        onClickCapture={onClickCapture}
      >
        Test
      </Link>
    ));
    const link = getByRole("link");
    expect(link).not.toHaveAttribute("data-pressed");
    expect(link).not.toHaveClass("pressed");

    await user.pointer({ target: link, keys: "[MouseLeft>]" });
    expect(link).toHaveAttribute("data-pressed", "true");
    expect(link).toHaveClass("pressed");

    await user.pointer({ target: link, keys: "[/MouseLeft]" });
    expect(link).not.toHaveAttribute("data-pressed");
    expect(link).not.toHaveClass("pressed");

    expect(onPressStart).toHaveBeenCalledTimes(1);
    expect(onPressEnd).toHaveBeenCalledTimes(1);
    expect(onPressChange).toHaveBeenCalledTimes(2);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClickCapture).toHaveBeenCalledTimes(1);
  });

  it("should support disabled state", () => {
    const { getByRole } = renderUI(() => (
      <Link isDisabled class={({ isDisabled }) => (isDisabled() ? "disabled" : "")}>
        Test
      </Link>
    ));
    const link = getByRole("link");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveClass("disabled");
  });

  it("should work with RouterProvider", async () => {
    const navigate = vi.fn();
    const { getByRole } = renderUI(() => (
      <RouterProvider navigate={(path, options) => navigate(path, options)} useHref={(href) => "#/base" + href}>
        <Link href="/foo" routerOptions={{ foo: "bar" } as never}>
          Test
        </Link>
      </RouterProvider>
    ));
    const link = getByRole("link");
    expect(link).toHaveAttribute("href", "#/base/foo");
    await user.click(link);
    expect(navigate).toHaveBeenCalledWith("/foo", { foo: "bar" });
  });

  it("should not navigate if disabled", async () => {
    const navigate = vi.fn();
    const onClick = vi.fn();
    const { getByRole } = renderUI(() => (
      <RouterProvider navigate={(path, options) => navigate(path, options)} useHref={(href) => "#/base" + href}>
        <Link isDisabled href="/foo" routerOptions={{ foo: "bar" } as never} onClick={onClick}>
          Test
        </Link>
      </RouterProvider>
    ));
    const link = getByRole("link");
    expect(link).toHaveAttribute("href", "#/base/foo");
    await user.click(link);
    expect(navigate).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Link (Rivet)", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("renders no interaction state before interaction; data-current from aria-current", () => {
    const { getByRole } = renderUI(() => (
      <Link href="#a" aria-current="page">
        A
      </Link>
    ));
    const link = getByRole("link");
    for (const name of ["data-hovered", "data-pressed", "data-focused", "data-focus-visible", "data-disabled"]) expect(link).not.toHaveAttribute(name);
    expect(link).toHaveAttribute("data-current", "true");
  });

  it('aria-current="false" is not current', () => {
    const { getByRole } = renderUI(() => (
      <Link href="#a" aria-current="false" class={({ isCurrent }) => (isCurrent() ? "current" : "")}>
        A
      </Link>
    ));
    expect(getByRole("link")).not.toHaveAttribute("data-current");
    expect(getByRole("link")).not.toHaveClass("current");
  });

  it("accessor aria-current updates without re-creating the link", () => {
    const current = signal<"page" | undefined>(undefined);
    const { getByRole } = renderUI(() => (
      <Link href="#a" aria-current={() => current()}>
        A
      </Link>
    ));
    const link = getByRole("link");
    expect(link).not.toHaveAttribute("aria-current");
    current.set("page");
    expect(getByRole("link")).toBe(link);
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveAttribute("data-current", "true");
  });

  it("accessor isDisabled switches <a> ⇄ <span role=link>", () => {
    const disabled = signal(false);
    const { getByRole } = renderUI(() => (
      <Link href="#a" isDisabled={disabled}>
        A
      </Link>
    ));
    expect(getByRole("link").tagName).toBe("A");
    disabled.set(true);
    expect(getByRole("link").tagName).toBe("SPAN");
    expect(getByRole("link")).toHaveAttribute("aria-disabled", "true");
    expect(getByRole("link")).toHaveAttribute("data-disabled", "true");
    disabled.set(false);
    expect(getByRole("link").tagName).toBe("A");
  });

  it("LinkContext: onPress chains (context first), ref from context", async () => {
    const calls: string[] = [];
    const el = createRef<HTMLElement>();
    const { getByRole } = renderUI(() => (
      <Provider token={LinkContext} value={{ ref: el as never, onPress: () => calls.push("ctx") }}>
        <Link onPress={() => calls.push("own")}>A</Link>
      </Provider>
    ));
    await user.click(getByRole("link"));
    expect(calls).toEqual(["ctx", "own"]);
    expect(el()).toBe(getByRole("link"));
  });

  it("keyboard Enter presses a <span role=link>", async () => {
    const onPress = vi.fn();
    const { getByRole } = renderUI(() => <Link onPress={onPress}>A</Link>);
    await user.tab();
    expect(document.activeElement).toBe(getByRole("link"));
    await user.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("FocusableContext (TooltipTrigger): focus / blur / keyboard handlers chain after the own, attributes fill in, ref synced", async () => {
    const calls: string[] = [];
    const el = createRef<Element>();
    const { getByRole } = renderUI(() => (
      <FocusableProvider
        ref={el}
        aria-describedby="tip"
        onFocus={() => calls.push("ctx-focus")}
        onBlur={() => calls.push("ctx-blur")}
        onKeyDown={(e: KeyboardEvent) => calls.push("ctx-key:" + e.key)}
        onPointerEnter={() => calls.push("ctx-enter")}
      >
        <Link onFocus={() => calls.push("own-focus")}>Trigger</Link>
      </FocusableProvider>
    ));
    const target = getByRole("link");
    expect(el()).toBe(target);
    expect(target).toHaveAttribute("aria-describedby", "tip");
    await user.hover(target);
    await user.tab();
    expect(document.activeElement).toBe(target);
    await user.keyboard("a");
    await user.tab();
    expect(calls).toEqual(["ctx-enter", "own-focus", "ctx-focus", "ctx-key:a", "ctx-key:Tab", "ctx-blur"]);
  });

  it("FocusableContext: a disabled link takes no context props", () => {
    const { getByRole } = renderUI(() => (
      <FocusableProvider aria-describedby="tip">
        <Link isDisabled>Trigger</Link>
      </FocusableProvider>
    ));
    expect(getByRole("link")).not.toHaveAttribute("aria-describedby");
  });

  it("FocusableContext DOM attributes: aria-haspopup, accessor aria-expanded, aria-controls, data-*; own props win", () => {
    const open = signal(false);
    const { getByRole } = renderUI(() => (
      <FocusableProvider aria-haspopup="dialog" aria-expanded={() => open()} aria-controls="pop" aria-describedby="ctx" data-trigger="preview">
        <Link aria-describedby="own">Trigger</Link>
      </FocusableProvider>
    ));
    const el = getByRole("link");
    expect(el).toHaveAttribute("aria-haspopup", "dialog");
    expect(el).toHaveAttribute("aria-expanded", "false");
    expect(el).toHaveAttribute("aria-controls", "pop");
    expect(el).toHaveAttribute("data-trigger", "preview");
    expect(el).toHaveAttribute("aria-describedby", "own");
    open.set(true);
    expect(el).toHaveAttribute("aria-expanded", "true");
  });
});
