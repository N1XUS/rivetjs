// Ported from react-aria test/progress/useProgressBar.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `renderHook(() => useProgressBar(props))` → `progressBarProps(props, "en-US")`; `using` spy → spy
// restored in `finally`; value attributes of the bag are accessors (Rivet accessor rule: `["aria-valuenow"]()`); the a11y warning is dev-only in Rivet (`NODE_ENV=development` set around that case);
// Jest globals from @rivetjs/testing/jest.
// Rivet additions: `meterProps` (RA useMeter: role="meter"), formatOptions / clamping / percentageOf cases.
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { describe, expect, it, jest } from "@rivetjs/testing/jest";
import { percentageOf, progressBarProps as aria, type AriaProgressBarProps } from "../progress-bar/behaviour.tsx";
import { meterProps } from "../meter/behaviour.tsx";

describe("useProgressBar", function () {
  let renderProgressBarHook = (props: AriaProgressBarProps) => aria(props, "en-US");

  it("with default props if no props are provided", () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      let { progressBarProps } = renderProgressBarHook({});
      expect(progressBarProps.role).toBe("progressbar");
      expect(progressBarProps["aria-valuemin"]()).toBe(0);
      expect(progressBarProps["aria-valuemax"]()).toBe(100);
      expect(progressBarProps["aria-valuenow"]()).toBe(0);
      expect(progressBarProps["aria-valuetext"]()).toBe("0%");
      expect(progressBarProps["aria-label"]).toBeUndefined();
      expect(progressBarProps["aria-labelledby"]).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenLastCalledWith(
        // Rivet: the upstream text, prefixed with its origin; a location line may follow in dev.
        expect.stringContaining(
          "[rivet:cdk] labelProps: If you do not provide a visible label, you must specify an aria-label or aria-labelledby attribute for accessibility",
        ),
      );
    } finally {
      consoleWarnSpy.mockRestore();
      process.env.NODE_ENV = env;
    }
  });

  it("supports labeling", () => {
    let { progressBarProps, labelProps } = renderProgressBarHook({ label: "Test" });
    expect(labelProps.id).toBeDefined();
    expect(progressBarProps["aria-labelledby"]).toBe(labelProps.id);
  });

  it("with value of 25%", () => {
    let { progressBarProps } = renderProgressBarHook({ value: 25, "aria-label": "mandatory label" });
    expect(progressBarProps["aria-valuenow"]()).toBe(25);
    expect(progressBarProps["aria-valuetext"]()).toBe("25%");
  });

  it("with indeterminate prop", () => {
    let { progressBarProps } = renderProgressBarHook({
      isIndeterminate: true,
      "aria-label": "mandatory label",
    });
    expect(progressBarProps["aria-valuemin"]()).toBe(0);
    expect(progressBarProps["aria-valuemax"]()).toBe(100);
    expect(progressBarProps["aria-valuenow"]()).toBeUndefined();
    expect(progressBarProps["aria-valuetext"]()).toBeUndefined();
  });

  it("with custom text value", () => {
    let props = { value: 25, valueLabel: "¥25", "aria-label": "mandatory label" };
    let { progressBarProps } = renderProgressBarHook(props);
    expect(progressBarProps["aria-valuenow"]()).toBe(25);
    expect(progressBarProps["aria-valuetext"]()).toBe("¥25");
  });

  it("with custom label", () => {
    let props = { label: "React test", value: 25 };
    let { progressBarProps, labelProps } = renderProgressBarHook(props);
    expect(progressBarProps["aria-labelledby"]).toBe(labelProps.id);
  });
});

describe("progressBarProps (Rivet additions)", () => {
  it("clamps the value into [minValue, maxValue]", () => {
    const { progressBarProps } = aria({ value: 150, "aria-label": "x" }, "en-US");
    expect(progressBarProps["aria-valuenow"]()).toBe(100);
    expect(progressBarProps["aria-valuetext"]()).toBe("100%");
  });

  it("formats the raw value when formatOptions is not a percent style", () => {
    const { progressBarProps } = aria({ value: 3, minValue: 0, maxValue: 6, formatOptions: { style: "unit", unit: "megabyte" }, "aria-label": "x" }, "en-US");
    expect(progressBarProps["aria-valuetext"]()).toBe("3 MB");
  });

  it("formats with the given locale", () => {
    const { progressBarProps } = aria({ value: 50, "aria-label": "x" }, "de-DE");
    expect(progressBarProps["aria-valuetext"]()).toBe("50\u00a0%");
  });

  it("derives the label id from an explicit id", () => {
    const { progressBarProps, labelProps } = aria({ id: "pb", label: true }, "en-US");
    expect(progressBarProps.id).toBe("pb");
    expect(labelProps.id).toBe("pb-label");
    expect(progressBarProps["aria-labelledby"]).toBe("pb-label");
  });

  it("forwards aria-describedby / aria-details", () => {
    const { progressBarProps } = aria({ "aria-label": "x", "aria-describedby": "d", "aria-details": "e" }, "en-US");
    expect(progressBarProps["aria-describedby"]).toBe("d");
    expect(progressBarProps["aria-details"]).toBe("e");
  });

  it("percentageOf: 0–100 of the range, 0 for an empty range", () => {
    expect(percentageOf(25)).toBe(25);
    expect(percentageOf(3, 0, 6)).toBe(50);
    expect(percentageOf(0, 0, 0)).toBe(0);
    expect(percentageOf(5, 5, 5)).toBe(0);
    expect(percentageOf(-5)).toBe(0);
  });
});

describe("meterProps", () => {
  it("is a progress bar with role meter", () => {
    const { meterProps: attrs, labelProps } = meterProps({ value: 25, label: true }, "en-US");
    expect(attrs.role).toBe("meter");
    expect(attrs["aria-valuenow"]()).toBe(25);
    expect(attrs["aria-valuetext"]()).toBe("25%");
    expect(attrs["aria-labelledby"]).toBe(labelProps.id);
  });
});

describe("progressBarProps accessors", () => {
  it("value attributes follow accessor props", () => {
    let value = 10;
    let indeterminate = false;
    const { progressBarProps } = aria({ value: () => value, isIndeterminate: () => indeterminate, "aria-label": "x" }, "en-US");
    expect(progressBarProps["aria-valuetext"]()).toBe("10%");
    value = 60;
    expect(progressBarProps["aria-valuenow"]()).toBe(60);
    expect(progressBarProps["aria-valuetext"]()).toBe("60%");
    indeterminate = true;
    expect(progressBarProps["aria-valuenow"]()).toBeUndefined();
    expect(progressBarProps["aria-valuetext"]()).toBeUndefined();
  });
});
