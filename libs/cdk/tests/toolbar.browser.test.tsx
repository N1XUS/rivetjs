// Ported from react-aria-components test/Toolbar.test.tsx (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); `screen` from `@testing-library/dom`;
// `className` → `class`; render props are accessors (`orientation()`); refs are Rivet `ref()`s; `act` / fake timers
// dropped (real timers); `fireEvent.blur(x)` → `x.blur()`; `<Text>` → `<span>`; `rerender` → a second render;
// default class `rv-Toolbar`. "supports all the aria example children" renders the story's controls inline
// (input before, B / U / I buttons, a checkbox, a link).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
// Rivet additions: nested Toolbar renders role="group" (server-safe, from context); data-rk / data-orientation.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { Provider, ref as createRef } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { screen } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Toolbar, ToolbarContext } from "../toolbar/index.tsx";
import { Button } from "../button/index.tsx";
import { Link } from "../link/index.tsx";
import { I18nProvider } from "../i18n/i18n-provider.tsx";

afterEach(cleanup);

const renderUI = (ui: () => unknown) => render(ui as never);

function Tools(props: { orientation?: "horizontal" | "vertical" }) {
  return (
    <>
      <Button>Before</Button>
      <Toolbar orientation={props.orientation} aria-label="Tools">
        <Toolbar aria-label="Align text">
          <Button>
            <span>Align left</span>
          </Button>
          <Button>
            <span>Align center</span>
          </Button>
          <Button>
            <span>Align right</span>
          </Button>
        </Toolbar>
        <hr />
        <Toolbar aria-label="Zoom">
          <Button>
            <span>Zoom in</span>
          </Button>
          <Button>
            <span>Zoom out</span>
          </Button>
        </Toolbar>
      </Toolbar>
      <Button>After</Button>
    </>
  );
}

const button = (name: string) => screen.getByRole("button", { name });

describe("Toolbar", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("renders", () => {
    const ref = createRef<HTMLDivElement>();
    renderUI(() => (
      <Toolbar ref={ref}>
        <Button>
          <span>Align left</span>
        </Button>
        <Button>
          <span>Align center</span>
        </Button>
        <Button>
          <span>Align right</span>
        </Button>
      </Toolbar>
    ));
    const toolbar = screen.getByRole("toolbar");
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(toolbar).toHaveAttribute("class", "rv-Toolbar");
    expect(ref()).toBe(toolbar);
  });

  it("renders a custom classname and data-attributes", () => {
    renderUI(() => (
      <Toolbar class="test" data-testid="foo">
        <Button>
          <span>Align left</span>
        </Button>
      </Toolbar>
    ));
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar).toHaveAttribute("class", "test");
    expect(toolbar).toHaveAttribute("data-testid", "foo");
  });

  it("supports slots", () => {
    renderUI(() => (
      <Provider token={ToolbarContext} value={{ slots: { test: { "aria-label": "test label" } } }}>
        <Toolbar slot="test">
          <Button>
            <span>Align left</span>
          </Button>
        </Toolbar>
      </Provider>
    ));
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar).toHaveAttribute("slot", "test");
    expect(toolbar).toHaveAttribute("aria-label", "test label");
  });

  it("support render props", () => {
    renderUI(() => (
      <Toolbar>
        {({ orientation }) => (
          <div data-testid="foo" data-test={orientation()}>
            <Button>
              <span>Align left</span>
            </Button>
          </div>
        )}
      </Toolbar>
    ));
    expect(screen.getByTestId("foo")).toHaveAttribute("data-test", "horizontal");
  });

  it("renders dividers", () => {
    for (const orientation of ["horizontal", "vertical"] as const) {
      renderUI(() => (
        <Toolbar orientation={orientation}>
          <Button>
            <span>Align left</span>
          </Button>
          <hr />
          <Button>
            <span>Align center</span>
          </Button>
          <hr />
          <Button>
            <span>Align right</span>
          </Button>
        </Toolbar>
      ));
      expect(screen.getAllByRole("separator")).toHaveLength(2);
      cleanup();
    }
  });

  it("sets aria-label", () => {
    renderUI(() => (
      <>
        <span id="toolbar-label">Toolbar aria-labelledby</span>
        <Toolbar aria-label="Toolbar aria-label">
          <Button>
            <span>Align Left</span>
          </Button>
        </Toolbar>
        <Toolbar aria-label="Toolbar aria-label 2" aria-labelledby="toolbar-id">
          <Button>
            <span>Align Right</span>
          </Button>
        </Toolbar>
      </>
    ));
    expect(screen.getByLabelText("Toolbar aria-label")).not.toHaveAttribute("aria-labelledby");
    expect(screen.getByLabelText("Toolbar aria-label 2")).not.toHaveAttribute("aria-labelledby");
  });

  for (const orientation of ["horizontal", "vertical"] as const) {
    const [next, prev, crossNext, crossPrev] =
      orientation === "horizontal" ? ["{ArrowRight}", "{ArrowLeft}", "{ArrowDown}", "{ArrowUp}"] : ["{ArrowDown}", "{ArrowUp}", "{ArrowRight}", "{ArrowLeft}"];
    it(`supports keyboard navigation${orientation === "vertical" ? " with orientation vertical" : ""}`, async () => {
      renderUI(() => <Tools orientation={orientation} />);
      const before = button("Before");
      const alignLeft = button("Align left");
      const alignCenter = button("Align center");
      const alignRight = button("Align right");
      const zoomIn = button("Zoom in");
      const zoomOut = button("Zoom out");
      const after = button("After");

      await user.tab();
      // Tab enters the toolbar
      await user.tab();
      expect(alignLeft).toHaveFocus();

      // Next arrow key navigates to next action buttons
      await user.keyboard(next);
      expect(alignCenter).toHaveFocus();
      // The cross-axis arrow does nothing
      await user.keyboard(crossNext);
      expect(alignCenter).toHaveFocus();

      await user.keyboard(next);
      // Arrow keys navigate across dividers to other action groups
      await user.keyboard(next);
      expect(zoomIn).toHaveFocus();
      await user.keyboard(prev);
      expect(alignRight).toHaveFocus();

      // Tab exits and shift-tab re-enters the toolbar at the last focused action button
      await user.tab();
      after.focus();
      expect(after).toHaveFocus();

      await user.tab({ shift: true });
      expect(alignRight).toHaveFocus();

      await user.tab({ shift: true });
      before.focus();
      expect(before).toHaveFocus();

      await user.tab();
      expect(alignRight).toHaveFocus();

      // Previous arrow key navigates to previous action buttons
      await user.keyboard(prev);
      expect(alignCenter).toHaveFocus();
      await user.keyboard(crossPrev);
      expect(alignCenter).toHaveFocus();

      await user.keyboard(prev);
      // Blurring then tabbing re-enters toolbar at the last focused action button
      alignLeft.blur();
      before.focus();
      await user.tab();
      expect(alignLeft).toHaveFocus();

      // Arrow keys do not wrap across collection
      await user.keyboard(prev);
      expect(alignLeft).toHaveFocus();
      await user.click(zoomOut);
      await user.keyboard(next);
      expect(zoomOut).toHaveFocus();

      // Other keys don't affect focus
      await user.keyboard("{Enter}");
      expect(zoomOut).toHaveFocus();
    });
  }

  it("supports RTL", async () => {
    renderUI(() => (
      <I18nProvider locale="he-IL">
        <Tools />
      </I18nProvider>
    ));
    await user.tab();
    await user.tab();
    expect(button("Align left")).toHaveFocus();
    // Left arrow key navigates to next action buttons
    await user.keyboard("{ArrowLeft}");
    expect(button("Align center")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(button("Align center")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    // Right arrow key navigates to previous action buttons
    await user.keyboard("{ArrowRight}");
    expect(button("Align center")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(button("Align center")).toHaveFocus();
  });

  it("supports RTL with orientation vertical", async () => {
    renderUI(() => (
      <I18nProvider locale="he-IL">
        <Tools orientation="vertical" />
      </I18nProvider>
    ));
    await user.tab();
    await user.tab();
    expect(button("Align left")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(button("Align center")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(button("Align left")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(button("Align left")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(button("Align left")).toHaveFocus();
  });

  it("supports all the aria example children", async () => {
    renderUI(() => (
      <>
        <input aria-label="Input Before Toolbar" />
        <Toolbar aria-label="Text formatting">
          <Toolbar aria-label="Style">
            <Button>B</Button>
            <Button>U</Button>
            <Button>I</Button>
          </Toolbar>
          <hr />
          <label>
            <input type="checkbox" /> Night Mode
          </label>
          <Link href="#help">Help</Link>
        </Toolbar>
      </>
    ));
    const before = screen.getByRole("textbox", { name: "Input Before Toolbar" });
    await user.tab();
    expect(before).toHaveFocus();
    await user.tab();
    expect(button("B")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(button("U")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(button("I")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("checkbox", { name: "Night Mode" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("link", { name: "Help" })).toHaveFocus();
    // reached the end, should not wrap
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("link", { name: "Help" })).toHaveFocus();
  });
});

describe("Toolbar (Rivet)", () => {
  it("nested toolbar renders role=group without data-rk; outer has data-orientation + data-rk", () => {
    renderUI(() => <Tools orientation="vertical" />);
    const outer = screen.getByRole("toolbar");
    expect(outer).toHaveAttribute("aria-label", "Tools");
    expect(outer).toHaveAttribute("data-orientation", "vertical");
    expect(outer).toHaveAttribute("aria-orientation", "vertical");
    expect(outer).toHaveAttribute("data-rk", "ArrowUp ArrowDown");
    const groups = screen.getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual(["Align text", "Zoom"]);
    for (const g of groups) expect(g).not.toHaveAttribute("data-rk");
  });
});
