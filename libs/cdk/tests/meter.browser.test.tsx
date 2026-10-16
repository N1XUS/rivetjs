// Ported from react-aria-components test/Meter.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); `getByRole` → `container.querySelector`;
// render props are accessors (`percentage()`, `valueText()`); `className` → `class`; jest-dom matchers from
// `@rivetjs/testing/jest-dom`; default class `rv-Meter`;
// `toHaveStyle("width: N%")` → `style.width` (Chromium's computed style resolves % to px; jsdom keeps it).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
// Rivet additions: no Label → no aria-labelledby (client render); explicit aria-label; formatOptions / valueLabel.
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Label } from "../label/index.tsx";
import { Meter, MeterContext, type MeterProps } from "../meter/index.tsx";

afterEach(cleanup);

const TestMeter = (props: MeterProps) => (
  <Meter value={25} data-foo="bar" {...props}>
    {({ percentage, valueText }) => (
      <>
        <Label>Storage space</Label>
        <span class="value">{valueText()}</span>
        <span class="percentage">{percentage()}</span>
        <div class="bar" style={{ width: percentage() + "%" }} />
      </>
    )}
  </Meter>
);

const meterOf = (container: Element | DocumentFragment) => container.querySelector('[role="meter"]') as HTMLElement;

describe("Meter", () => {
  it("renders", async () => {
    const { container } = render(() => <TestMeter />);
    await flush();
    const meter = meterOf(container);
    expect(meter).toHaveClass("rv-Meter");
    expect(meter).toHaveAttribute("aria-valuenow", "25");
    expect(meter).toHaveAttribute("aria-labelledby");
    expect(meter).toHaveAttribute("data-foo", "bar");
    expect(document.getElementById(meter.getAttribute("aria-labelledby")!)).toHaveTextContent("Storage space");

    const value = meter.querySelector(".value");
    expect(value).toHaveTextContent("25%");

    const bar = meter.querySelector(".bar") as HTMLElement;
    expect(bar.style.width).toBe("25%");
  });

  it("supports a custom range", () => {
    const { container } = render(() => <TestMeter value={3} minValue={0} maxValue={6} />);
    const meter = meterOf(container);
    expect(meter).toHaveAttribute("aria-valuenow", "3");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "6");
    expect(meter).toHaveAttribute("aria-valuetext", "50%");

    expect(meter.querySelector(".value")).toHaveTextContent("50%");
    expect(meter.querySelector(".percentage")).toHaveTextContent("50");
    expect((meter.querySelector(".bar") as HTMLElement).style.width).toBe("50%");
  });

  it("renders 0 percent for an empty range", () => {
    const { container } = render(() => <TestMeter value={0} minValue={0} maxValue={0} />);
    const meter = meterOf(container);
    expect(meter).toHaveAttribute("aria-valuenow", "0");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "0");
    expect(meter).toHaveAttribute("aria-valuetext", "0%");
    expect(meter).not.toHaveAttribute("aria-valuetext", "NaN%");

    expect(meter.querySelector(".value")).toHaveTextContent("0%");
    expect(meter.querySelector(".percentage")).toHaveTextContent("0");
    expect((meter.querySelector(".bar") as HTMLElement).style.width).toBe("0%");
  });

  it("should support slot", () => {
    const { container } = render(() => (
      <Provider token={MeterContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestMeter slot="test" />
      </Provider>
    ));
    const meter = meterOf(container);
    expect(meter).toHaveAttribute("slot", "test");
    expect(meter).toHaveAttribute("aria-label", "test");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.
});

describe("Meter (Rivet additions)", () => {
  it("has no aria-labelledby without a Label", async () => {
    const { container } = render(() => <Meter value={10}>{({ valueText }) => <span>{valueText()}</span>}</Meter>);
    await flush();
    expect(meterOf(container)).not.toHaveAttribute("aria-labelledby");
  });

  it("uses aria-label and no labelledby", () => {
    const { container } = render(() => <Meter value={10} aria-label="Usage" />);
    const meter = meterOf(container);
    expect(meter).toHaveAttribute("aria-label", "Usage");
    expect(meter).not.toHaveAttribute("aria-labelledby");
    expect(meter).toHaveClass("rv-Meter");
  });

  it("formats with formatOptions and valueLabel", () => {
    const { container } = render(() => (
      <div>
        <Meter id="a" value={512} maxValue={1024} formatOptions={{ style: "unit", unit: "megabyte" }} aria-label="A" />
        <Meter id="b" value={3} maxValue={4} valueLabel="3 of 4" aria-label="B" />
      </div>
    ));
    expect(container.querySelector("#a")).toHaveAttribute("aria-valuetext", "512 MB");
    expect(container.querySelector("#b")).toHaveAttribute("aria-valuetext", "3 of 4");
  });

  it("class and style render props get the values", () => {
    const { container } = render(() => (
      <Meter
        value={40}
        aria-label="x"
        class={({ percentage }) => (percentage() > 30 ? "high" : "low")}
        style={({ percentage }) => ({ "--p": String(percentage()) })}
      />
    ));
    const meter = meterOf(container);
    expect(meter).toHaveAttribute("class", "high");
    expect(meter.style.getPropertyValue("--p")).toBe("40");
  });
});
