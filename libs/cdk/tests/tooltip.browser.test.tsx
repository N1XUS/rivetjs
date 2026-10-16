// Ported from react-aria-components (packages/react-aria-components/test/Tooltip.test.js), react-spectrum,
// Apache-2.0, © Adobe.
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium, real timers: `wait` stands in for
// `jest.runAllTimers`, the global warmup is reset between tests with `_resetTooltips`); queries via
// `@testing-library/dom` `within(document.body)` (tooltips are portalled); default classes `rv-*`; render
// props are accessors (`placement()`); `rerender(<TestTooltip isEntering />)` → `isEntering` / `isExiting`
// passed as signals; `UNSAFE_PortalProvider getContainer` → `PortalProvider container`; the emoji icon →
// text, the arrow's SVG path → a CSS-shaped span (icons rule); `<Focusable>` / `<Pressable>` take a
// render-function child (Rivet: spread its props); `fireEvent.mouseMove(document.body)` (jsdom: pointer
// modality from mouse events) → `fireEvent.pointerMove`; triggers render below a 120px spacer so the
// default "top" placement fits the Chromium viewport (jsdom has no layout: never flips).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files);
// "portalContainer" (deprecated `UNSTABLE_portalContainer` deleted: PortalProvider only).
// Added: collection build pass renders children directly (RAC `useIsHidden`); OverlayArrow's own
// style wins over the positioning offset.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { Focusable } from "../focus/focusable.tsx";
import { OverlayArrow } from "../overlay-arrow/index.tsx";
import { Pressable } from "../interactions/pressable.tsx";
import { Tooltip, TooltipTrigger, type TooltipProps } from "../tooltip/index.tsx";
import { _resetTooltips } from "../state/tooltip.ts";
import { PortalProvider } from "../portal/index.tsx";
import { ListBoxItem } from "../listbox/index.tsx";
import { buildCollectionFrom } from "../collections/components.tsx";

const screen = () => within(document.body);
const wait = async (ms = 50) => {
  await flush();
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flush();
};

const Arrow = () => <span style={{ display: "block", width: "8px", height: "4px", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />;

const Spacer = () => <div style={{ height: "120px" }} />;

function TestTooltip(props: TooltipProps) {
  return (
    <>
      <Spacer />
      <TooltipTrigger delay={0}>
        <Button>
          <span aria-hidden="true">E</span>
        </Button>
        <Tooltip data-test="tooltip" {...props}>
          <OverlayArrow>
            <Arrow />
          </OverlayArrow>
          Edit
        </Tooltip>
      </TooltipTrigger>
    </>
  );
}

describe("Tooltip", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    user = userEvent.setup({ delay: null });
  });
  afterEach(async () => {
    cleanup();
    _resetTooltips();
    await flush();
  });

  it("shows on hover", async () => {
    render(() => <TestTooltip />);
    const button = screen().getByRole("button");
    fireEvent.pointerMove(document.body, { pointerType: "mouse" });
    await user.hover(button);
    await wait();

    const tooltip = screen().getByRole("tooltip");
    expect(button).toHaveAttribute("aria-describedby", tooltip.id);
    expect(tooltip).toHaveClass("rv-Tooltip");
    expect(tooltip).toHaveAttribute("data-placement", "top");
    expect(tooltip).toHaveStyle("position: absolute");
    expect(tooltip).toHaveAttribute("data-test", "tooltip");
    const arrow = tooltip.querySelector(".rv-OverlayArrow");
    expect(arrow).toHaveStyle("position: absolute");
  });

  it("shows on hover when button has isPending", async () => {
    render(() => (
      <TooltipTrigger delay={0}>
        <Button isPending>Pending Button</Button>
        <Tooltip>Tooltip content</Tooltip>
      </TooltipTrigger>
    ));
    const button = screen().getByRole("button");
    fireEvent.pointerMove(document.body, { pointerType: "mouse" });
    await user.hover(button);
    await wait();

    const tooltip = screen().getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Tooltip content");
  });

  it("shows on focus", async () => {
    render(() => <TestTooltip />);
    const button = screen().getByRole("button");
    await user.tab();
    await wait();

    const tooltip = screen().getByRole("tooltip");
    expect(button).toHaveAttribute("aria-describedby", tooltip.id);
    expect(tooltip).toHaveClass("rv-Tooltip");
    expect(tooltip).toHaveAttribute("data-placement", "top");
    expect(tooltip).toHaveStyle("position: absolute");
    const arrow = tooltip.querySelector(".rv-OverlayArrow");
    expect(arrow).toHaveStyle("position: absolute");
  });

  it("should support render props", async () => {
    render(() => (
      <TooltipTrigger delay={0}>
        <Button>
          <span aria-hidden="true">E</span>
        </Button>
        <Tooltip placement="bottom start">{({ placement }) => `Content at ${placement()}`}</Tooltip>
      </TooltipTrigger>
    ));
    await user.tab();
    await wait();

    expect(screen().getByRole("tooltip")).toHaveTextContent("Content at bottom");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("supports isEntering and isExiting props", async () => {
    const isEntering = signal<boolean | undefined>(true);
    const isExiting = signal<boolean | undefined>(undefined);
    render(() => <TestTooltip isEntering={isEntering} isExiting={isExiting} />);
    const button = screen().getByRole("button");
    fireEvent.pointerMove(document.body, { pointerType: "mouse" });
    await user.hover(button);
    await wait();

    const tooltip = screen().getByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-entering");

    isEntering.set(undefined);
    await wait();
    expect(tooltip).not.toHaveAttribute("data-entering");

    isExiting.set(true);
    await user.unhover(button);
    await wait(600);

    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute("data-exiting");

    isExiting.set(undefined);
    await wait();
    expect(tooltip).not.toBeInTheDocument();
  });

  it("supports overriding styles", async () => {
    render(() => <TestTooltip style={{ zIndex: 5 }} />);
    const button = screen().getByRole("button");
    fireEvent.pointerMove(document.body, { pointerType: "mouse" });
    await user.hover(button);
    await wait();

    expect(screen().getByRole("tooltip")).toHaveAttribute("style", expect.stringContaining("z-index: 5"));
    await user.unhover(button);
    await wait();
  });

  it("should hide tooltip on scroll", async () => {
    render(() => (
      <div style={{ display: "flex", flexDirection: "column", gap: "30px", overflow: "scroll", height: "200px" }} data-testid="scroll-container">
        {Array.from({ length: 10 }, (_, idx) => (
          <TooltipTrigger delay={0}>
            <Button aria-label={`trigger-${idx}`}>
              <span aria-hidden="true">E</span>
            </Button>
            <Tooltip>{`Tooltip-${idx}`}</Tooltip>
          </TooltipTrigger>
        ))}
      </div>
    ));

    // Tooltip should be visible on focus
    const button1 = screen().getByLabelText("trigger-1");
    fireEvent.pointerMove(document.body, { pointerType: "mouse" });
    await user.hover(button1);
    await wait();

    const tooltip1 = screen().getByText("Tooltip-1");
    expect(tooltip1).toBeVisible();

    // Tooltip should not be visible on scroll
    const scrollContainer = screen().getByTestId("scroll-container");
    expect(scrollContainer).toBeInTheDocument();
    fireEvent.scroll(scrollContainer, { target: { top: 100 } });
    await wait();
    expect(tooltip1).not.toBeVisible();
  });

  describe("portalProvider", () => {
    it("should render the tooltip in the portal container provided by the PortalProvider", async () => {
      const container = ref<HTMLDivElement>();
      render(() => (
        <>
          <PortalProvider container={container}>
            <TestTooltip />
          </PortalProvider>
          <div ref={container} data-testid="custom-container" />
        </>
      ));
      const button = screen().getByRole("button");
      fireEvent.pointerMove(document.body, { pointerType: "mouse" });
      await user.hover(button);
      await wait();

      expect(screen().getByRole("tooltip").closest('[data-testid="custom-container"]')).toBe(screen().getByTestId("custom-container"));
      await user.unhover(button);
      await wait();
    });
  });

  it.skip("portalContainer: should render the tooltip in the portal container", () => {
    // Deprecated `UNSTABLE_portalContainer` deleted: PortalProvider only (covered above).
  });

  it("should support custom Focusable trigger on focus", async () => {
    render(() => (
      <TooltipTrigger>
        <Focusable>
          {(props) => (
            <span role="button" {...props}>
              Trigger
            </span>
          )}
        </Focusable>
        <Tooltip>Test</Tooltip>
      </TooltipTrigger>
    ));
    const button = screen().getByRole("button");
    expect(button).toHaveAttribute("tabindex", "0");
    await user.tab();
    await wait();
    expect(document.activeElement).toBe(button);
    expect(screen().getByRole("tooltip")).toBeInTheDocument();
  });

  it("should support custom Focusable trigger on hover", async () => {
    render(() => (
      <TooltipTrigger>
        <Focusable>
          {(props) => (
            <span role="button" {...props}>
              Trigger
            </span>
          )}
        </Focusable>
        <Tooltip>Test</Tooltip>
      </TooltipTrigger>
    ));
    const button = screen().getByRole("button");
    expect(button).toHaveAttribute("tabindex", "0");
    fireEvent.pointerMove(document.body, { pointerType: "mouse" });
    await user.hover(button);
    // Default delay 1500 ms.
    await wait(1600);
    expect(screen().getByRole("tooltip")).toBeInTheDocument();
  });

  it("should support custom Pressable trigger", async () => {
    render(() => (
      <TooltipTrigger>
        <Pressable>
          {(props) => (
            <span role="button" {...props}>
              Trigger
            </span>
          )}
        </Pressable>
        <Tooltip>Test</Tooltip>
      </TooltipTrigger>
    ));
    const button = screen().getByRole("button");
    fireEvent.pointerMove(document.body, { pointerType: "mouse" });
    await user.hover(button);
    await wait(1600);
    expect(screen().getByRole("tooltip")).toBeInTheDocument();
  });

  it("should not override child properties for excludeFromTabOrder", () => {
    render(() => (
      <TooltipTrigger>
        <Button excludeFromTabOrder>Check my tabindex</Button>
        <Tooltip>hello world</Tooltip>
      </TooltipTrigger>
    ));
    expect(screen().getByRole("button")).toHaveAttribute("tabindex", "-1");
  });

  // Skipped: Rivet's Button renders no `tabindex` (RA useFocusable always sets 0, for Safari) — button/ lane.
  it.skip("should not override child properties", () => {
    render(() => (
      <TooltipTrigger>
        <Button>Check my tabindex</Button>
        <Tooltip>hello world</Tooltip>
      </TooltipTrigger>
    ));
    expect(screen().getByRole("button")).toHaveAttribute("tabindex", "0");
  });

  // Rivet: RAC useIsHidden — in a collection's build pass the tooltip renders its children directly.
  it("renders its children directly in a collection build pass", () => {
    const collection = buildCollectionFrom(() => (
      <Tooltip>
        <ListBoxItem id="inside">inside</ListBoxItem>
      </Tooltip>
    ));
    expect([...collection.getKeys()]).toEqual(["inside"]);
    expect(document.querySelector(".rv-Tooltip")).toBeNull();
  });

  // Rivet: RAC merges `{...arrowProps.style, ...renderProps.style}` — the arrow's own style wins over the
  // positioning's cross-axis offset.
  it("OverlayArrow's own style wins over the positioning offset", async () => {
    render(() => (
      <TooltipTrigger delay={0}>
        <Button>Trigger</Button>
        <Tooltip placement="bottom">
          <OverlayArrow style={{ left: "3px" }} data-testid="arrow">
            <Arrow />
          </OverlayArrow>
          Tip
        </Tooltip>
      </TooltipTrigger>
    ));
    await user.tab();
    await wait();
    const arrow = screen().getByTestId("arrow");
    expect(arrow).toHaveAttribute("data-placement", "bottom");
    expect(arrow.style.left).toBe("3px");
    window.dispatchEvent(new Event("resize"));
    await wait();
    expect(arrow.style.left).toBe("3px");
  });
});
