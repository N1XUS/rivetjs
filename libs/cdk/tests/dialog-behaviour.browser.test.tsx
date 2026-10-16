// Ported from packages/react-aria/test/dialog/useDialog.test.js, Apache-2.0, © Adobe.
// Changes: React `useDialog(props, ref)` → `dialogProps(props, slots)` + `dialogFocus(element)` from a
// client effect; `render` from `@rivetjs/runtime/testing` (Chromium); `autoFocus` → `autofocus`
// attribute focused by the fixture's effect before the dialog's (React focuses autoFocus inputs on
// commit, before effects); `jest.fn` → `vi.fn`. Title / content parts report `rendered` through a
// slot id (`{ id, rendered }`, the slots/ `createSlotId()` shape) — RA's useSlotId DOM check.
// "should not warn" cases assert the dialog warning only (Rivet dev a11y also reports the dangling "some-id").
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { dialogFocus, dialogProps, dialogTitleWarning, type AriaDialogProps } from "../dialog/behaviour.tsx";

afterEach(cleanup);

const slot = (id: string) => {
  const rendered = signal<boolean | string>(false);
  return { id, rendered };
};

interface ExampleProps extends AriaDialogProps {
  showTitle?: boolean;
  autoFocusInput?: boolean;
}

function Example(props: ExampleProps) {
  const el = ref<HTMLDivElement>();
  const title = slot("title-id");
  if (props.showTitle) title.rendered.set(true);
  const { dialogProps: d, titleProps } = dialogProps(props, { title });
  const input = ref<HTMLInputElement>();
  if (props.autoFocusInput) clientEffect(() => input()?.focus());
  clientEffect(() => dialogFocus(el()));
  clientEffect(() => dialogTitleWarning(el()));
  return (
    <div ref={el} id={d.id} role={d.role} tabIndex={d.tabIndex} aria-label={d["aria-label"]} aria-labelledby={d["aria-labelledby"]()} aria-describedby={d["aria-describedby"]()} data-testid="test">
      {props.showTitle ? <h2 id={titleProps.id}>Title</h2> : null}
      {props.autoFocusInput ? <input ref={input} data-testid="input" autoFocus /> : null}
    </div>
  );
}

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

describe("useDialog", function () {
  it('should have role="dialog" by default', function () {
    render(() => <Example aria-label="Test dialog" />);
    expect(byTestId("test").getAttribute("role")).toBe("dialog");
  });

  it('should accept role="alertdialog"', function () {
    render(() => <Example role="alertdialog" aria-label="Test dialog" aria-describedby="content-id" />);
    expect(byTestId("test").getAttribute("role")).toBe("alertdialog");
  });

  it("should focus the overlay on mount", async function () {
    render(() => <Example aria-label="Test dialog" />);
    await flush();
    const el = byTestId("test");
    expect(el.getAttribute("tabIndex")).toBe("-1");
    expect(document.activeElement).toBe(el);
  });

  it("should not focus the overlay if something inside is auto focused", async function () {
    render(() => <Example aria-label="Test dialog" autoFocusInput />);
    await flush();
    expect(document.activeElement).toBe(byTestId("input"));
  });

  describe("aria-describedby for alertdialog", function () {
    function AlertDialogExample(props: AriaDialogProps & { showContent?: boolean }) {
      const content = slot("content-id");
      if (props.showContent) content.rendered.set(true);
      const { dialogProps: d, titleProps, contentProps } = dialogProps({ role: "alertdialog", ...props }, { content });
      return (
        <div role={d.role} tabIndex={-1} aria-label={d["aria-label"]} aria-labelledby={d["aria-labelledby"]()} aria-describedby={d["aria-describedby"]()} data-testid="test">
          <h2 id={titleProps.id}>Alert Title</h2>
          {props.showContent ? <p id={contentProps.id}>Alert message content</p> : null}
        </div>
      );
    }

    it("should set aria-describedby on alertdialog when content is rendered", function () {
      render(() => <AlertDialogExample aria-label="Test" showContent />);
      const el = byTestId("test");
      const contentEl = el.querySelector("p")!;
      expect(el.getAttribute("aria-describedby")).toBe(contentEl.id);
    });

    it("should not auto-wire aria-describedby on regular dialog, but contentProps.id is still provided", function () {
      function RegularDialogExample(props: AriaDialogProps) {
        const { dialogProps: d, titleProps, contentProps } = dialogProps(props);
        return (
          <div role={d.role} aria-describedby={d["aria-describedby"]()} data-testid="test">
            <h2 id={titleProps.id}>Title</h2>
            <p id={contentProps.id}>Content</p>
          </div>
        );
      }
      render(() => <RegularDialogExample aria-label="Test" />);
      expect(byTestId("test").hasAttribute("aria-describedby")).toBe(false);
    });

    it("should allow aria-describedby override on alertdialog", function () {
      render(() => <AlertDialogExample aria-label="Test" aria-describedby="custom-id" showContent />);
      expect(byTestId("test").getAttribute("aria-describedby")).toBe("custom-id");
    });

    it("should not generate contentProps.id when aria-describedby is provided", function () {
      render(() => <AlertDialogExample aria-label="Test" aria-describedby="custom-id" showContent />);
      expect(byTestId("test").querySelector("p")!.hasAttribute("id")).toBe(false);
    });
  });

  describe("dev warnings", function () {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(function () {
      // Rivet: dev warnings are gated on NODE_ENV=development (Vite `development` condition).
      (globalThis as { process?: unknown }).process = { env: { NODE_ENV: "development" } };
      warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(function () {
      warn.mockRestore();
      delete (globalThis as { process?: unknown }).process;
    });

    it("should warn when dialog has no accessible title", async function () {
      render(() => <Example />);
      await flush();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("A dialog must have a title for accessibility"));
    });

    it("should not warn when aria-label is provided", async function () {
      render(() => <Example aria-label="My dialog" />);
      await flush();
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("A dialog must have a title")); // Rivet: the dev a11y checker may warn about the dangling id
    });

    it("should not warn when aria-labelledby is provided", async function () {
      render(() => <Example aria-labelledby="some-id" />);
      await flush();
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("A dialog must have a title")); // Rivet: the dev a11y checker may warn about the dangling id
    });

    it("should not warn when a title element is rendered", async function () {
      render(() => <Example showTitle />);
      await flush();
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("A dialog must have a title")); // Rivet: the dev a11y checker may warn about the dangling id
    });
  });

  // Rivet: the title slot drives aria-labelledby (RA useSlotId drops a missing title's id).
  it("drops the title id while no title part renders", function () {
    render(() => <Example />);
    expect(byTestId("test").hasAttribute("aria-labelledby")).toBe(false);
    cleanup();
    render(() => <Example showTitle />);
    expect(byTestId("test").getAttribute("aria-labelledby")).toBe("title-id");
  });
});
