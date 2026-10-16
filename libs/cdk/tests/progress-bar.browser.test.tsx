// Ported from react-aria-components test/ProgressBar.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); `getByRole` → `container.querySelector`;
// render props are accessors (`percentage()`, `valueText()`); `className` → `class`; jest-dom matchers from
// `@rivetjs/testing/jest-dom`; default class `rv-ProgressBar`;
// `toHaveStyle("width: N%")` → `style.width` (Chromium's computed style resolves % to px; jsdom keeps it).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
// Rivet additions: accessor value / isIndeterminate, formatOptions / valueLabel, ProgressBarContext id (Button pending).
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Label } from "../label/index.tsx";
import { ProgressBar, ProgressBarContext, type ProgressBarProps } from "../progress-bar/index.tsx";

afterEach(cleanup);

const TestProgressBar = (props: ProgressBarProps) => (
  <ProgressBar value={25} data-foo="bar" {...props}>
    {({ percentage, valueText }) => (
      <>
        <Label>Loading…</Label>
        <span class="value">{valueText()}</span>
        <span class="percentage">{percentage()}</span>
        <div class="bar" style={{ width: percentage() + "%" }} />
      </>
    )}
  </ProgressBar>
);

const barOf = (container: Element | DocumentFragment) => container.querySelector('[role="progressbar"]') as HTMLElement;

describe("ProgressBar", () => {
  it("renders", async () => {
    const { container } = render(() => <TestProgressBar />);
    await flush();
    const progressbar = barOf(container);
    expect(progressbar).toHaveClass("rv-ProgressBar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "25");
    expect(progressbar).toHaveAttribute("aria-labelledby");
    expect(progressbar).toHaveAttribute("data-foo", "bar");
    expect(document.getElementById(progressbar.getAttribute("aria-labelledby")!)).toHaveTextContent("Loading…");

    const value = progressbar.querySelector(".value");
    expect(value).toHaveTextContent("25%");

    const bar = progressbar.querySelector(".bar") as HTMLElement;
    expect(bar.style.width).toBe("25%");
  });

  it("supports a custom range", () => {
    const { container } = render(() => <TestProgressBar value={3} minValue={0} maxValue={6} />);
    const progressbar = barOf(container);
    expect(progressbar).toHaveAttribute("aria-valuenow", "3");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "6");
    expect(progressbar).toHaveAttribute("aria-valuetext", "50%");

    expect(progressbar.querySelector(".value")).toHaveTextContent("50%");
    expect(progressbar.querySelector(".percentage")).toHaveTextContent("50");
    expect((progressbar.querySelector(".bar") as HTMLElement).style.width).toBe("50%");
  });

  it("renders 0 percent for an empty range", () => {
    const { container } = render(() => <TestProgressBar value={0} minValue={0} maxValue={0} />);
    const progressbar = barOf(container);
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "0");
    expect(progressbar).toHaveAttribute("aria-valuetext", "0%");
    expect(progressbar).not.toHaveAttribute("aria-valuetext", "NaN%");

    expect(progressbar.querySelector(".value")).toHaveTextContent("0%");
    expect(progressbar.querySelector(".percentage")).toHaveTextContent("0");
    expect((progressbar.querySelector(".bar") as HTMLElement).style.width).toBe("0%");
  });

  it("renders 0 percent for an empty range with a non-zero bound", () => {
    const { container } = render(() => <TestProgressBar value={5} minValue={5} maxValue={5} />);
    const progressbar = barOf(container);
    expect(progressbar).toHaveAttribute("aria-valuenow", "5");
    expect(progressbar).toHaveAttribute("aria-valuemin", "5");
    expect(progressbar).toHaveAttribute("aria-valuemax", "5");
    expect(progressbar).toHaveAttribute("aria-valuetext", "0%");
    expect(progressbar.querySelector(".percentage")).toHaveTextContent("0");
    expect((progressbar.querySelector(".bar") as HTMLElement).style.width).toBe("0%");
  });

  it("supports indeterminate state", () => {
    let renderedPercentage: number | undefined = -1;
    const { container } = render(() => (
      <ProgressBar isIndeterminate class={({ isIndeterminate }) => `progressbar ${isIndeterminate() ? "indeterminate" : ""}`}>
        {({ percentage }) => {
          renderedPercentage = percentage();
          return (
            <>
              <Label>Loading…</Label>
              <div class="bar" style={{ width: percentage() === undefined ? undefined : percentage() + "%" }} />
            </>
          );
        }}
      </ProgressBar>
    ));
    const progressbar = barOf(container);
    expect(progressbar).toHaveAttribute("class", "progressbar indeterminate");
    expect(progressbar).not.toHaveAttribute("aria-valuenow");
    expect(renderedPercentage).toBeUndefined();
    const bar = progressbar.querySelector(".bar") as HTMLElement;
    expect(bar.style.width).toBe("");
  });

  it("should support slot", () => {
    const { container } = render(() => (
      <Provider token={ProgressBarContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestProgressBar slot="test" />
      </Provider>
    ));
    const progressbar = barOf(container);
    expect(progressbar).toHaveAttribute("slot", "test");
    expect(progressbar).toHaveAttribute("aria-label", "test");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.
});

describe("ProgressBar (Rivet additions)", () => {
  it("formats with formatOptions and valueLabel; no valuetext while indeterminate", () => {
    const { container } = render(() => (
      <div>
        <ProgressBar id="a" value={30} maxValue={60} formatOptions={{ style: "unit", unit: "second" }} aria-label="A" />
        <ProgressBar id="b" value={1} maxValue={4} valueLabel="1 of 4" aria-label="B" />
        <ProgressBar id="c" isIndeterminate valueLabel="ignored" aria-label="C" />
      </div>
    ));
    expect(container.querySelector("#a")).toHaveAttribute("aria-valuetext", "30 sec");
    expect(container.querySelector("#b")).toHaveAttribute("aria-valuetext", "1 of 4");
    expect(container.querySelector("#c")).not.toHaveAttribute("aria-valuetext");
    expect(container.querySelector("#c")).toHaveAttribute("aria-valuemin", "0");
  });

  it("accessor value / isIndeterminate update attributes and render props in place", () => {
    const value = signal(20);
    const indeterminate = signal(false);
    const { container } = render(() => (
      <ProgressBar value={() => value()} isIndeterminate={() => indeterminate()} aria-label="Upload">
        {({ percentage, valueText }) => (
          <>
            <span class="value">{valueText()}</span>
            <div class="bar" style={{ width: percentage() === undefined ? undefined : percentage() + "%" }} />
          </>
        )}
      </ProgressBar>
    ));
    const progressbar = barOf(container);
    const bar = progressbar.querySelector(".bar") as HTMLElement;
    expect(progressbar).toHaveAttribute("aria-valuenow", "20");
    value.set(70);
    expect(progressbar).toHaveAttribute("aria-valuenow", "70");
    expect(progressbar).toHaveAttribute("aria-valuetext", "70%");
    expect(progressbar.querySelector(".value")).toHaveTextContent("70%");
    expect(bar.style.width).toBe("70%");
    expect(progressbar.querySelector(".bar")).toBe(bar);
    indeterminate.set(true);
    expect(progressbar).not.toHaveAttribute("aria-valuenow");
    expect(progressbar).not.toHaveAttribute("aria-valuetext");
  });

  it("takes its id from ProgressBarContext", () => {
    const { container } = render(() => (
      <Provider token={ProgressBarContext} value={{ id: "pending-progress" }}>
        <ProgressBar isIndeterminate aria-label="Saving" />
      </Provider>
    ));
    expect(barOf(container)).toHaveAttribute("id", "pending-progress");
  });
});
