// Ported from react-aria test/numberfield/useNumberField.test.ts (react-spectrum, Apache-2.0, © Adobe).
// Changes: `renderHook(useNumberFieldState)` + `renderHook(useNumberField)` → `createNumberFieldState` +
// `numberFieldProps(props, state)` inside a root (no component); `jest` → `vi`; RA leaves the spin button's
// `aria-value*` as `null` after its merge, Rivet's bag omits them (`== null` either way); attribute values that change
// are accessors, so they are read by calling them; RA's handlers built from the hook (`onPaste`, `onBeforeInput`,
// `onCompositionStart` / `End`, `onInput`) are the free functions `numberFieldPaste` / `BeforeInput` /
// `CompositionStart` / `CompositionEnd` / `numberFieldInput`; `onCopy` / `onCut` / `onSelect` / `onCompositionUpdate`
// pass through `inputProps` as upstream; `onChange` (React's input event) is `numberFieldInput`.
import { describe, expect, it, vi } from "vitest";
import { createRoot } from "@rivetjs/reactivity";
import { createNumberFieldState } from "../number/index.tsx";
import {
  numberFieldBeforeInput,
  numberFieldCompositionEnd,
  numberFieldCompositionStart,
  numberFieldInput,
  numberFieldPaste,
  numberFieldProps,
  type AriaNumberFieldProps,
} from "../number-field/behaviour.tsx";

type Bag = Record<string, unknown>;
const value = (v: unknown) => (typeof v === "function" ? (v as () => unknown)() : v);

describe("useNumberField hook", () => {
  const renderNumberFieldHook = (props: Partial<AriaNumberFieldProps>) =>
    createRoot(() => {
      const full = { ...props, locale: "en-US" } as AriaNumberFieldProps;
      const state = createNumberFieldState(full);
      return { props: full, state, aria: numberFieldProps(full, state) };
    }).value;

  describe("should return numberFieldProps", () => {
    it("with default numberField props if no props are provided", () => {
      // The label warning is development-only (label/behaviour.ts `isDev`), as RA's in tests.
      const g = globalThis as { process?: { env: Record<string, string | undefined> } };
      const hadProcess = !!g.process;
      g.process ??= { env: {} };
      const previousEnv = g.process.env.NODE_ENV;
      g.process.env.NODE_ENV = "development";
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const inputProps = renderNumberFieldHook({}).aria.inputProps as Bag;
        expect(inputProps.type).toBe("text");
        expect(value(inputProps.disabled)).toBeFalsy();
        expect(value(inputProps.readOnly)).toBeFalsy();
        expect(value(inputProps["aria-invalid"])).toBeUndefined();
        expect(value(inputProps["aria-required"])).toBeUndefined();
        expect(value(inputProps["aria-valuenow"]) == null).toBe(true);
        expect(value(inputProps["aria-valuetext"]) == null).toBe(true);
        expect(value(inputProps["aria-valuemin"]) == null).toBe(true);
        expect(value(inputProps["aria-valuemax"]) == null).toBe(true);
        expect(typeof numberFieldInput).toBe("function");
        expect(inputProps.autoFocus).toBeFalsy();
        expect(consoleWarnSpy).toHaveBeenLastCalledWith(
          // Rivet: the upstream text, prefixed with its origin; a location line may follow in dev.
          expect.stringContaining(
            "[rivet:cdk] labelProps: If you do not provide a visible label, you must specify an aria-label or aria-labelledby attribute for accessibility",
          ),
        );
      } finally {
        consoleWarnSpy.mockRestore();
        if (hadProcess) g.process!.env.NODE_ENV = previousEnv;
        else delete g.process;
      }
    });

    it("with appropriate props if placeholder is defined", () => {
      const inputProps = renderNumberFieldHook({ placeholder: "Enter value", "aria-label": "mandatory label" }).aria.inputProps as Bag;
      expect(inputProps["placeholder"]).toBe("Enter value");
    });

    it("all events are merged into the input element", () => {
      const onCopy = vi.fn();
      const onCut = vi.fn();
      const onPaste = vi.fn();
      const onCompositionStart = vi.fn();
      const onCompositionEnd = vi.fn();
      const onCompositionUpdate = vi.fn();
      const onSelect = vi.fn();
      const onBeforeInput = vi.fn();
      const onInput = vi.fn();
      const { props, state, aria } = renderNumberFieldHook({
        "aria-label": "mandatory label",
        onCopy,
        onCut,
        onPaste,
        onCompositionStart,
        onCompositionEnd,
        onCompositionUpdate,
        onSelect,
        onBeforeInput,
        onInput,
      });
      const inputProps = aria.inputProps as Record<string, ((e: never) => void) | undefined>;
      const input = document.createElement("input");
      const event = <T,>(type: string) => {
        const e = new Event(type);
        Object.defineProperty(e, "target", { value: input });
        Object.defineProperty(e, "currentTarget", { value: input });
        return e as T;
      };
      inputProps.onCopy?.({} as never);
      expect(onCopy).toHaveBeenCalled();
      inputProps.onCut?.({} as never);
      expect(onCut).toHaveBeenCalled();
      numberFieldPaste(event<ClipboardEvent>("paste"), props, state);
      expect(onPaste).toHaveBeenCalled();
      numberFieldCompositionStart(event<CompositionEvent>("compositionstart"), props, state);
      expect(onCompositionStart).toHaveBeenCalled();
      numberFieldCompositionEnd(event<CompositionEvent>("compositionend"), props, state);
      expect(onCompositionEnd).toHaveBeenCalled();
      inputProps.onCompositionUpdate?.({} as never);
      expect(onCompositionUpdate).toHaveBeenCalled();
      inputProps.onSelect?.({} as never);
      expect(onSelect).toHaveBeenCalled();
      numberFieldBeforeInput(Object.assign(event<InputEvent>("beforeinput"), { data: "" }), props, state);
      expect(onBeforeInput).toHaveBeenCalled();
      numberFieldInput(event<Event>("input"), props, state);
      expect(onInput).toHaveBeenCalled();
    });
  });
});
