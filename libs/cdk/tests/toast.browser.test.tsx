// Ported from react-aria-components (packages/react-aria-components/test/Toast.test.js) and react-aria
// (packages/react-aria/test/toast/useToast.test.js), react-spectrum, Apache-2.0, © Adobe.
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`
// on `document.body` (the region is portalled); `jest.useFakeTimers` → `vi.useFakeTimers({ toFake: [timers] })`
// (microtasks stay real: Rivet runs effects after mount in a microtask); `userEvent.setup({ delay: null })`;
// `installPointerEvent` dropped (real PointerEvent); `act(fn)` → `fn()`; RAC names imported from
// `@rivetjs/cdk/toast` (`UNSTABLE_*`), default classes `rv-*`; `UNSAFE_PortalProvider getContainer` →
// `PortalProvider container` (a `ref()`); `useState` in "programmatically closing" → a local variable.
// useToast hook cases: `renderHook(() => useToast(props, state, ref))` → `toastProps(props, state)` inside a
// root; `useToast.stories` `Default` (ToastContainer from stories/toast/Example.tsx) → a ToastRegion with
// maxVisibleToasts 1 (same DOM roles and keys).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { createRoot } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { Text } from "../text/index.tsx";
import { PortalProvider } from "../portal/index.tsx";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
  toastProps,
  type ToastOptions,
} from "../toast/index.tsx";
import { Timer } from "../state/toast.ts";

const screen = () => within(document.body);
const advance = (ms: number) => vi.advanceTimersByTime(ms);

function Example(options: ToastOptions = {}) {
  const queue = new ToastQueue<{ title: string; description: string }>();
  return (
    <>
      <ToastRegion queue={queue}>
        {({ toast }) => (
          <Toast toast={toast}>
            <ToastContent>
              <Text slot="title">{toast.content.title}</Text>
              <Text slot="description">{toast.content.description}</Text>
            </ToastContent>
            <Button slot="close">x</Button>
          </Toast>
        )}
      </ToastRegion>
      <Button onPress={() => queue.add({ title: "Toast", description: "Description" }, options)}>Toast</Button>
    </>
  );
}

afterEach(() => {
  if (vi.isFakeTimers()) vi.runOnlyPendingTimers();
  vi.useRealTimers();
  cleanup();
});

describe("Toast", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup({ delay: null });
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  });

  it("should trigger a toast", async () => {
    render(() => <Example />);
    const { getByRole, queryByRole } = screen();
    let button = getByRole("button");

    expect(queryByRole("alertdialog")).toBeNull();
    expect(queryByRole("alert")).toBeNull();
    await user.click(button);

    advance(100);
    await Promise.resolve();

    const region = getByRole("region");
    expect(region).toHaveAttribute("aria-label", "1 notification.");
    expect(region).toHaveAttribute("class", "rv-ToastRegion");

    const toast = getByRole("alertdialog");
    expect(toast).toBeVisible();
    expect(toast).toHaveAttribute("class", "rv-Toast");
    expect(toast).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(toast.getAttribute("aria-labelledby")!)).toHaveTextContent("Toast");
    expect(toast).toHaveAttribute("aria-describedby");
    expect(document.getElementById(toast.getAttribute("aria-describedby")!)).toHaveTextContent("Description");
    expect(toast).toHaveAttribute("aria-modal", "false");

    const alert = within(toast).getByRole("alert");
    expect(alert).toBeVisible();
    expect(alert).toHaveAttribute("class", "rv-ToastContent");

    button = within(toast).getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Close");
    await user.click(button);

    expect(queryByRole("alertdialog")).toBeNull();
    expect(queryByRole("alert")).toBeNull();
  });

  it("removes a toast via timeout", async () => {
    render(() => <Example timeout={5000} />);
    const { getByRole, queryByRole } = screen();
    const button = getByRole("button");

    await user.click(button);

    const toast = getByRole("alertdialog");
    expect(toast).toBeVisible();

    advance(1000);
    advance(5000);
    expect(queryByRole("alertdialog")).toBeNull();
  });

  it("pauses timers when hovering", async () => {
    render(() => <Example timeout={5000} />);
    const { getByRole, queryByRole } = screen();
    const button = getByRole("button");

    await user.click(button);

    const toast = getByRole("alertdialog");
    expect(toast).toBeVisible();

    advance(1000);
    await user.hover(toast);

    advance(7000);

    await user.unhover(toast);
    advance(4000);

    expect(queryByRole("alertdialog")).toBeNull();
  });

  it("pauses timers when focusing", async () => {
    render(() => <Example timeout={5000} />);
    const { getByRole, queryByRole } = screen();
    const button = getByRole("button");

    await user.click(button);

    const toast = getByRole("alertdialog");
    expect(toast).toBeVisible();

    advance(1000);
    within(toast).getByRole("button").focus();

    advance(7000);

    within(toast).getByRole("button").blur();
    advance(4000);

    expect(queryByRole("alertdialog")).toBeNull();
  });

  it("can focus toast region using F6", async () => {
    render(() => <Example timeout={5000} />);
    const { getByRole } = screen();
    const button = getByRole("button");

    await user.click(button);

    const toast = getByRole("alertdialog");
    expect(toast).toBeVisible();

    expect(document.activeElement).toBe(button);
    await user.keyboard("{F6}");

    const region = getByRole("region");
    expect(document.activeElement).toBe(region);
  });

  it("should restore focus when a toast exits", async () => {
    render(() => <Example />);
    const { getByRole, queryByRole } = screen();
    const button = getByRole("button");

    await user.click(button);

    const toast = getByRole("alertdialog");
    const closeButton = within(toast).getByRole("button");

    await user.click(closeButton);
    expect(queryByRole("alertdialog")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("should restore focus when removing with the mouse", async () => {
    render(() => <Example />);
    const { getAllByRole, getByRole, queryByRole } = screen();
    const button = getByRole("button");

    await user.click(button);
    await user.click(button);

    let toast = getAllByRole("alertdialog")[0]!;
    let closeButton = within(toast).getByRole("button");
    await user.click(closeButton);

    expect(document.activeElement).toBe(button);

    toast = getAllByRole("alertdialog")[0]!;
    closeButton = within(toast).getByRole("button");
    await user.click(closeButton);

    expect(queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("should move focus to remaining toast when a toast exits and there are more", async () => {
    render(() => <Example />);
    const { getAllByRole, getByRole, queryByRole } = screen();
    const button = getByRole("button");

    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    let toast = getAllByRole("alertdialog")[0]!;
    let closeButton = within(toast).getByRole("button");
    await user.keyboard("{F6}");
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
    await user.keyboard("{Enter}");

    toast = getByRole("alertdialog");
    expect(document.activeElement).toBe(toast);

    closeButton = within(toast).getByRole("button");
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
    await user.keyboard("{Enter}");

    expect(queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("should move focus from the last toast to remaining toast when a the last toast is closed", async () => {
    render(() => <Example />);
    const { getAllByRole, getByRole, queryByRole } = screen();
    const button = getByRole("button");

    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    let toast = getAllByRole("alertdialog")[0]!;
    let closeButton = within(toast).getByRole("button");
    await user.keyboard("{F6}");
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
    await user.keyboard("{Enter}");

    toast = getByRole("alertdialog");
    expect(document.activeElement).toBe(toast);
    expect(toast).toHaveAttribute("data-focused", "true");

    closeButton = within(toast).getByRole("button");
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
    await user.keyboard("{Enter}");

    expect(queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("should support programmatically closing toasts", async () => {
    const queue = new ToastQueue<string>();
    function ToastToggle() {
      let key: string | null = null;
      return (
        <>
          <ToastRegion queue={queue}>
            {({ toast }) => (
              <Toast toast={toast}>
                <ToastContent>
                  <Text slot="title">{toast.content}</Text>
                </ToastContent>
                <Button slot="close">x</Button>
              </Toast>
            )}
          </ToastRegion>
          <Button
            onPress={() => {
              if (key) {
                queue.close(key);
                key = null;
              } else {
                key = queue.add("Toast is done!");
              }
            }}
          >
            Toggle Toast
          </Button>
        </>
      );
    }

    render(() => <ToastToggle />);
    const { getByRole, queryByRole } = screen();
    const button = getByRole("button");

    await user.click(button);

    advance(100);
    const toast = getByRole("alertdialog");
    const alert = within(toast).getByRole("alert");
    expect(toast).toBeVisible();
    expect(alert).toBeVisible();

    await user.click(button);
    expect(queryByRole("alertdialog")).toBeNull();
    expect(queryByRole("alert")).toBeNull();
  });

  it("restarts the countdown when a queued toast's timer is replaced in place (useToast [timer, timeout] effect)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    const queue = new ToastQueue<string>();
    render(() => (
      <ToastRegion queue={queue}>
        {({ toast }) => (
          <Toast toast={toast}>
            <ToastContent>
              <Text slot="title">{toast.content}</Text>
            </ToastContent>
          </Toast>
        )}
      </ToastRegion>
    ));
    const key = queue.add("Persistent");
    await Promise.resolve();
    expect(screen().getByRole("alertdialog")).toBeVisible();
    const queued = queue.visibleToasts[0]!;
    queued.timeout = 1000;
    queued.timer = new Timer(() => queue.close(key), 1000);
    (queue as unknown as { updateVisibleToasts(action: string): void }).updateVisibleToasts("add");
    advance(999);
    expect(screen().queryByRole("alertdialog")).not.toBeNull();
    advance(1);
    await Promise.resolve();
    expect(screen().queryByRole("alertdialog")).toBeNull();
  });

  it("should support custom aria-label", async () => {
    const queue = new ToastQueue<string>();
    render(() => (
      <>
        <ToastRegion queue={queue} aria-label="Toasts">
          {({ toast }) => (
            <Toast toast={toast}>
              <ToastContent>
                <Text slot="title">{toast.content}</Text>
              </ToastContent>
              <Button slot="close">x</Button>
            </Toast>
          )}
        </ToastRegion>
        <Button onPress={() => queue.add("Toast")}>Toast</Button>
      </>
    ));
    const { getByRole } = screen();

    const button = getByRole("button");
    await user.click(button);

    const region = getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Toasts");
  });

  it("should render the toast region in the portal container provided by PortalProvider", async () => {
    const queue = new ToastQueue<string>();
    const container = ref<HTMLDivElement>();

    function LocalToast() {
      return (
        <>
          <ToastRegion queue={queue}>
            {({ toast }) => (
              <Toast toast={toast}>
                <ToastContent>
                  <Text slot="title">{toast.content}</Text>
                </ToastContent>
                <Button slot="close">x</Button>
              </Toast>
            )}
          </ToastRegion>

          <Button onPress={() => queue.add("Toast")}>Add toast</Button>
        </>
      );
    }

    render(() => (
      <>
        <PortalProvider container={container}>
          <LocalToast />
        </PortalProvider>
        <div ref={container} data-testid="custom-container" />
      </>
    ));
    const { getByRole, getByTestId } = screen();

    const button = getByRole("button");
    await user.click(button);
    await Promise.resolve();

    expect(within(getByTestId("custom-container")).getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("useToast", () => {
  const close = vi.fn();

  afterEach(() => {
    close.mockClear();
  });

  const renderToastHook = (props: Record<string, unknown>, state: { close: (key: string) => void }) =>
    createRoot(() => toastProps(props as never, state)).value;

  it("handles defaults", function () {
    const { closeButtonProps, toastProps: toast, contentProps, titleProps } = renderToastHook({ toast: {} }, { close });

    expect(toast.role).toBe("alertdialog");
    expect(contentProps.role).toBe("alert");
    expect(closeButtonProps["aria-label"]).toBe("Close");
    expect(typeof closeButtonProps.onPress).toBe("function");
    expect(titleProps.id).toEqual(toast["aria-labelledby"]);
  });

  it("handles close button", function () {
    const { closeButtonProps } = renderToastHook({ toast: { key: 1 } }, { close });
    closeButtonProps.onPress();

    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(1);
  });

  it("passes through data attributes", function () {
    const { toastProps: toast } = renderToastHook({ toast: {}, "data-test-id": "toast" }, { close });

    expect(toast["data-test-id"]).toBe("toast");
  });
});

describe("single toast at a time", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup({ delay: null });
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  });

  // useToast.stories Default: maxVisibleToasts 1, a plain button adding "Mmmmm toast <n>x".
  function Default() {
    const queue = new ToastQueue<string>({ maxVisibleToasts: 1 });
    let count = 0;
    return (
      <>
        <ToastRegion queue={queue}>
          {({ toast }) => (
            <Toast toast={toast}>
              <ToastContent>
                <Text slot="title">{toast.content}</Text>
              </ToastContent>
              <Button slot="close">x</Button>
            </Toast>
          )}
        </ToastRegion>
        <button onClick={() => queue.add("Mmmmm toast " + ++count + "x")}>Add toast</button>
      </>
    );
  }

  it("moves focus to the next toast when it appears", async () => {
    render(() => <Default />);
    const tree = screen();
    const button = tree.getByRole("button");

    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    let toast = tree.getByRole("alertdialog");
    expect(toast.textContent).toContain("Mmmmm toast 2x");
    let closeButton = within(toast).getByRole("button");
    await user.keyboard("{F6}");
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
    await user.keyboard("{Enter}");

    toast = tree.getByRole("alertdialog");
    expect(toast.textContent).toContain("Mmmmm toast 1x");
    expect(toast).toHaveFocus();

    closeButton = within(toast).getByRole("button");
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
    await user.keyboard("{Enter}");

    expect(tree.queryByRole("alertdialog")).toBeNull();
    expect(button).toHaveFocus();
  });
});
