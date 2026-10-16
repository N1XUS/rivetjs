// Ported from react-aria test/textfield/useTextField.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `renderHook(() => useTextField(props, ref))` → `textFieldProps(props)` inside a reactive root
// (`createRoot`); state-dependent values are accessors (`props["aria-invalid"]()`); React's `onChange` (fired per
// keystroke) is the DOM `input` event, so the user `onChange(value)` is reached through the bag's `onInput` with a
// real `<input>` as the event target; the dev warning needs `process.env.NODE_ENV === "development"` (set on
// `globalThis.process` for that case).
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "@rivetjs/reactivity";
import { textFieldProps, type AriaTextFieldProps } from "../text-field/behaviour.tsx";

const renderTextFieldHook = (props: AriaTextFieldProps & Record<string, unknown>) => {
  const root = createRoot(() => textFieldProps(props).inputProps as Record<string, any>);
  root.dispose();
  return root.value;
};

const read = (v: unknown) => (typeof v === "function" ? (v as () => unknown)() : v);

describe("useTextField hook", () => {
  describe("should return textFieldProps", () => {
    it("with default textfield props if no props are provided", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      (globalThis as { process?: unknown }).process = { env: { NODE_ENV: "development" } };
      try {
        const props = renderTextFieldHook({});
        expect(props.type).toBe("text");
        expect(props.disabled).toBeFalsy();
        expect(props.readOnly).toBeFalsy();
        expect(read(props["aria-invalid"])).toBeUndefined();
        expect(props["aria-required"]).toBeUndefined();
        expect(typeof props.onChange).toBe("function");
        expect(props.autoFocus).toBeFalsy();
        expect(consoleWarnSpy).toHaveBeenLastCalledWith(
          // Rivet: the upstream text, prefixed with its origin; a location line may follow in dev.
          expect.stringContaining(
            "[rivet:cdk] labelProps: If you do not provide a visible label, you must specify an aria-label or aria-labelledby attribute for accessibility",
          ),
        );
      } finally {
        delete (globalThis as { process?: unknown }).process;
        consoleWarnSpy.mockRestore();
      }
    });

    it("with appropriate props if type is defined", () => {
      const props = renderTextFieldHook({ type: "search", "aria-label": "mandatory label" });
      expect(props.type).toBe("search");
    });

    it("with appropriate props if isDisabled is defined", () => {
      let props = renderTextFieldHook({ isDisabled: true, "aria-label": "mandatory label" });
      expect(props.disabled).toBeTruthy();
      props = renderTextFieldHook({ isDisabled: false, "aria-label": "mandatory label" });
      expect(props.disabled).toBeFalsy();
    });

    it("with appropriate props if isRequired is defined", () => {
      // RA's hook defaults to validationBehavior "aria".
      let props = renderTextFieldHook({ isRequired: true, validationBehavior: "aria", "aria-label": "mandatory label" });
      expect(props["aria-required"]).toBeTruthy();
      props = renderTextFieldHook({ isRequired: false, validationBehavior: "aria", "aria-label": "mandatory label" });
      expect(props["aria-required"]).toBeUndefined();
    });

    it("with appropriate props if isReadOnly is defined", () => {
      let props = renderTextFieldHook({ isReadOnly: true, "aria-label": "mandatory label" });
      expect(props.readOnly).toBeTruthy();
      props = renderTextFieldHook({ isReadOnly: false, "aria-label": "mandatory label" });
      expect(props.readOnly).toBeFalsy();
    });

    it("with appropriate props if validationState is defined", () => {
      let props = renderTextFieldHook({ validationState: "invalid", "aria-label": "mandatory label" });
      expect(read(props["aria-invalid"])).toBeTruthy();
      props = renderTextFieldHook({ validationState: "valid", "aria-label": "mandatory label" });
      expect(read(props["aria-invalid"])).toBeUndefined();
    });

    it("with appropriate props if autoCapitalize is defined", () => {
      let props = renderTextFieldHook({ autoCapitalize: "on", "aria-label": "mandatory label" });
      expect(props.autoCapitalize).toBe("on");
      props = renderTextFieldHook({ autoCapitalize: "off", "aria-label": "mandatory label" });
      expect(props.autoCapitalize).toBe("off");
    });

    it("with an onChange that calls user specified onChange with appropriate values", () => {
      const onChange = vi.fn();
      const bag = createRoot(() => textFieldProps({ onChange, "aria-label": "mandatory label" }).inputProps as Record<string, any>).value;
      const input = document.createElement("input");
      input.value = "1";
      input.addEventListener("input", (e) => bag.onInput(e));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("1");
    });

    it("without type prop if inputElementType is textarea", () => {
      const props = renderTextFieldHook({
        type: "search",
        pattern: "pattern",
        inputElementType: "textarea",
        "aria-label": "mandatory label",
      });
      expect(props.type).toBeUndefined();
      expect(props.pattern).toBeUndefined();
    });
  });
});
