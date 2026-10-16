// Ported from react-aria (packages/react-aria/test/landmark/useLandmark.test.tsx, useLandmark.ssr.test.js),
// react-spectrum, Apache-2.0, © Adobe.
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium) + `await flush()` after mounting (landmarks
// register in a `clientEffect`); `useLandmark(props, ref)` → `landmarkProps(props, ref)` with a `ref()`;
// Spectrum `TextField` → `<label>` + `<input>`, `Checkbox` → `<label>` + native checkbox, `Button` → `<button>`;
// `tree.rerender(...)` → a signal switching the rendered tree (`Show`); `jest.fn` / `jest.spyOn` → `vi.fn` /
// `vi.spyOn`; `act(fn)` → `fn()`; `fireEvent` → `fire`; `jest.useFakeTimers` / `jest.runAllTimers` →
// `vi.*` (`flush()` never waits on the faked clock); the `clientWidth` / `clientHeight` mocks are dropped
// (real layout); `toggleBrowserTabs` defines
// `visibilityState` / `hidden` as configurable and deletes them afterwards (real document).
// The singleton tests use Rivet's symbol `rivet-cdk-landmark-manager` and change event `rv-landmark-manager-change`.
// Skipped: "components that already handle focus management, should handle focus themselves" — renders
// Spectrum `ActionGroup` + `TableView` (no Rivet equivalents in this package's scope).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { ref, Show } from "@rivetjs/runtime/dom";
import { cleanup, fire, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { landmarkProps, UNSTABLE_createLandmarkController, type AriaLandmarkProps } from "../landmark/index.tsx";

type LandmarkTestProps = Omit<AriaLandmarkProps, "role"> & { children?: Content };

function Main(props: LandmarkTestProps) {
  const r = ref<HTMLElement>();
  const lp = landmarkProps({ ...props, role: "main" }, r);
  return (
    <main ref={r} {...(lp as unknown as Record<string, unknown>)}>
      {props.children}
    </main>
  );
}

function Navigation(props: LandmarkTestProps) {
  const r = ref<HTMLElement>();
  const lp = landmarkProps({ ...props, role: "navigation" }, r);
  return (
    <nav ref={r} {...(lp as unknown as Record<string, unknown>)}>
      {props.children}
    </nav>
  );
}

function Region(props: LandmarkTestProps) {
  const r = ref<HTMLElement>();
  const lp = landmarkProps({ ...props, role: "region" }, r);
  return (
    <article ref={r} {...(lp as unknown as Record<string, unknown>)}>
      {props.children}
    </article>
  );
}

function TextField(props: { label: string }) {
  return (
    <label>
      {props.label}
      <input type="text" />
    </label>
  );
}

function Checkbox(props: { children: string }) {
  return (
    <label>
      <input type="checkbox" />
      {props.children}
    </label>
  );
}

function Links() {
  return (
    <ul>
      <li>
        <a href="/home">Home</a>
      </li>
      <li>
        <a href="/about">About</a>
      </li>
      <li>
        <a href="/contact">Contact</a>
      </li>
    </ul>
  );
}

function NavAndMain() {
  return (
    <div>
      <Navigation>
        <Links />
      </Navigation>
      <Main>
        <TextField label="First Name" />
      </Main>
    </div>
  );
}

const screen = () => within(document.body);

const devWarnSpy = () => {
  const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
  return Object.assign(spy, { restore: () => spy.mockRestore() });
};

async function mount(factory: () => unknown) {
  const result = render(factory as never);
  await flush();
  return { ...result, ...screen() };
}

// taken from useFocusVisible tests
function toggleBrowserTabs() {
  // this describes Chrome behaviour only, for other browsers visibilitychange fires after all focus events.
  // leave tab
  const lastActiveElement = document.activeElement!;
  fire(lastActiveElement, "blur", { bubbles: false });
  fire(window, "blur", { bubbles: false });
  Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true, configurable: true });
  Object.defineProperty(document, "hidden", { value: true, writable: true, configurable: true });
  fire(document, "visibilitychange");
  // return to tab
  Object.defineProperty(document, "visibilityState", { value: "visible", writable: true, configurable: true });
  Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
  fire(document, "visibilitychange");
  fire(window, "focus", { bubbles: false });
  fire(lastActiveElement, "focus", { bubbles: false });
  delete (document as unknown as Record<string, unknown>).visibilityState;
  delete (document as unknown as Record<string, unknown>).hidden;
}

function toggleBrowserWindow() {
  fire(window, "blur", { bubbles: false });
  fire(window, "focus", { bubbles: false });
}

describe("LandmarkManager", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeAll(() => {
    user = userEvent.setup({ delay: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    cleanup();
    (document.activeElement as HTMLElement | null)?.blur?.();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("can tab into a landmark region", async () => {
    const tree = await mount(() => <NavAndMain />);
    const navigation = tree.getByRole("navigation");
    const main = tree.getByRole("main");
    expect(navigation).toBeInTheDocument();
    expect(main).toBeInTheDocument();

    await user.tab();
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[0]);
  });

  it("can F6 to a landmark region", async () => {
    const tree = await mount(() => <NavAndMain />);
    const navigation = tree.getByRole("navigation");
    const main = tree.getByRole("main");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(navigation);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);
  });

  it("can F6 to a landmark region when there is only one landmark", async () => {
    const tree = await mount(() => (
      <div>
        <Main>
          <TextField label="First Name" />
        </Main>
      </div>
    ));
    const main = tree.getByRole("main");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);
  });

  it("can F6 to a nested landmark region that is first", async () => {
    const tree = await mount(() => (
      <div>
        <Main>
          <Region>
            <Checkbox>Checkbox label</Checkbox>
          </Region>

          <TextField label="First Name" />
        </Main>
      </div>
    ));
    const main = tree.getByRole("main");
    const region = tree.getByRole("region");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(region);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(region);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(region);
  });

  it("can F6 to a nested landmark region that is last", async () => {
    const tree = await mount(() => (
      <div>
        <Main>
          <TextField label="First Name" />

          <Region>
            <Checkbox>Checkbox label</Checkbox>
          </Region>
        </Main>
      </div>
    ));
    const main = tree.getByRole("main");
    const region = tree.getByRole("region");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(region);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(region);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(region);
  });

  it("goes in dom order with two nested landmarks", async () => {
    const tree = await mount(() => (
      <div>
        <Main>
          <Region aria-label="Region 1">
            <Checkbox>Checkbox label 1</Checkbox>
          </Region>

          <TextField label="First Name" />

          <Region aria-label="Region 2">
            <Checkbox>Checkbox label 2</Checkbox>
          </Region>

          <TextField label="Last Name" />
        </Main>
      </div>
    ));
    const main = tree.getByRole("main");
    const region1 = tree.getAllByRole("region")[0];
    const region2 = tree.getAllByRole("region")[1];

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(region1);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(region2);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(region2);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(region1);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(main);
  });

  it("can F6 to the next landmark region", async () => {
    const tree = await mount(() => <NavAndMain />);
    const main = tree.getByRole("main");

    await user.tab();
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[0]);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);
  });

  it("landmark navigation forward wraps", async () => {
    const tree = await mount(() => <NavAndMain />);
    const main = tree.getByRole("main");

    await user.tab();
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[0]);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[0]);
  });

  it("can shift+tab into a landmark region", async () => {
    const tree = await mount(() => <NavAndMain />);

    await user.tab({ shift: true });
    expect(document.activeElement!).toBe(tree.getByRole("textbox"));

    await user.tab({ shift: true });
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[2]);
  });

  it("can shift+F6 to a landmark region", async () => {
    const tree = await mount(() => <NavAndMain />);
    const navigation = tree.getByRole("navigation");
    const main = tree.getByRole("main");

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(navigation);
  });

  it("can shift+F6 to the previous landmark region", async () => {
    const tree = await mount(() => <NavAndMain />);

    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement!).toBe(tree.getByRole("textbox"));

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[2]);
  });

  it("landmark navigation backward wraps", async () => {
    const tree = await mount(() => <NavAndMain />);
    const main = tree.getByRole("main");

    await user.tab();
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[0]);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(main);
  });

  it("F6 should focus the last focused element in a landmark region", async () => {
    const tree = await mount(() => <NavAndMain />);

    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement!).toBe(tree.getByRole("textbox"));

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[2]);
  });

  it.skip("components that already handle focus management, should handle focus themselves (Spectrum ActionGroup / TableView)", () => {});

  it("Should allow 2+ landmarks with same role if they are labelled.", async () => {
    const spyWarn = devWarnSpy();
    try {
      await mount(() => (
        <div>
          <Navigation aria-label="First nav">
            <Links />
          </Navigation>
          <Navigation aria-label="Second nav">
            <Links />
          </Navigation>
          <Main>
            <TextField label="First Name" />
          </Main>
        </div>
      ));

      expect(spyWarn).not.toHaveBeenCalled();
    } finally {
      spyWarn.restore();
    }
  });

  it("Should warn if 2+ landmarks with same role are used but not labelled.", async () => {
    const spyWarn = devWarnSpy();
    try {
      const tree = await mount(() => (
        <div>
          <Navigation>
            <Links />
          </Navigation>
          <Navigation>
            <Links />
          </Navigation>
          <Main>
            <TextField label="First Name" />
          </Main>
        </div>
      ));

      const navs = tree.getAllByRole("navigation");

      expect(spyWarn).toHaveBeenCalledWith(
        "Page contains more than one landmark with the 'navigation' role. If two or more landmarks on a page share the same role, all must be labeled with an aria-label or aria-labelledby attribute: ",
        navs,
      );
    } finally {
      spyWarn.restore();
    }
  });

  it("Should warn if 2+ landmarks with same role and same label", async () => {
    const spyWarn = devWarnSpy();
    try {
      const tree = await mount(() => (
        <div>
          <Navigation aria-label="First nav">
            <Links />
          </Navigation>
          <Navigation aria-label="First nav">
            <Links />
          </Navigation>
          <Main>
            <TextField label="First Name" />
          </Main>
        </div>
      ));
      const navs = tree.getAllByRole("navigation");

      expect(spyWarn).toHaveBeenCalledWith(
        "Page contains more than one landmark with the 'navigation' role and 'First nav' label. If two or more landmarks on a page share the same role, they must have unique labels: ",
        navs,
      );
    } finally {
      spyWarn.restore();
    }
  });

  it("Should not navigate to a landmark that has been removed from the DOM", async () => {
    const withRegion = signal(true);
    const tree = await mount(() => (
      <div>
        <Navigation>
          <Links />
        </Navigation>
        <Show when={withRegion}>
          <Region>
            <TextField label="First Name" />
          </Region>
        </Show>
        <Main>
          <TextField label="Last Name" />
        </Main>
      </div>
    ));

    const navigation = tree.getByRole("navigation");
    const region = tree.getByRole("region");
    const main = tree.getByRole("main");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(navigation);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(region);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    withRegion.set(false);
    await flush();

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(navigation);
  });

  it("Should navigate to a landmark that has been added to the DOM", async () => {
    const withRegion = signal(false);
    const tree = await mount(() => (
      <div>
        <Navigation>
          <Links />
        </Navigation>
        <Main>
          <TextField label="Last Name" />
        </Main>
        <Show when={withRegion}>
          <Region>
            <TextField label="First Name" />
          </Region>
        </Show>
      </div>
    ));
    const navigation = tree.getByRole("navigation");
    const main = tree.getByRole("main");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(navigation);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    withRegion.set(true);
    await flush();

    const region = tree.getByRole("region");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(region);
  });

  it("Should navigate to a landmark that has been added as a child to an existing landmark.", async () => {
    const withRegion = signal(false);
    const tree = await mount(() => (
      <div>
        <Navigation>
          <Links />
        </Navigation>
        <Main>
          <TextField label="Last Name" />
          <Show when={withRegion}>
            <Region>
              <TextField label="First Name" />
            </Region>
          </Show>
        </Main>
      </div>
    ));

    withRegion.set(true);
    await flush();
    const main = tree.getByRole("main");
    const navigation = tree.getByRole("navigation");
    const region = tree.getByRole("region");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(navigation);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(region);
  });

  it("Should navigate to a landmark that has been added as a parent to an existing landmark.", async () => {
    function Contained() {
      return (
        <div>
          <Navigation>
            <Links />
          </Navigation>
          <Region>
            <TextField label="Last Name" />
          </Region>
        </div>
      );
    }

    const wrapped = signal(false);
    const tree = await mount(() => (
      <>
        <Show when={() => !wrapped()}>
          <Contained />
        </Show>
        <Show when={wrapped}>
          <Main>
            <TextField label="Last Name" />
            <Contained />
          </Main>
        </Show>
      </>
    ));

    wrapped.set(true);
    await flush();

    const main = tree.getByRole("main");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);
  });

  it("can alt+F6 to main landmark", async () => {
    const tree = await mount(() => (
      <div>
        <Navigation>
          <Links />
        </Navigation>
        <Region>
          <TextField label="Last Name" />
        </Region>
        <Main>
          <TextField label="First Name" />
        </Main>
      </div>
    ));
    const navigation = tree.getByRole("navigation");
    const main = tree.getByRole("main");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(navigation);

    await user.keyboard("{Alt>}{F6}{/Alt}}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{Alt>}{F6}{/Alt}}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(navigation);
  });

  it("alt+F6 does nothing if no main landmark", async () => {
    const tree = await mount(() => (
      <div>
        <Navigation>
          <Links />
        </Navigation>
        <Region>
          <TextField label="Last Name" />
        </Region>
      </div>
    ));
    const navigation = tree.getByRole("navigation");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(navigation);

    await user.keyboard("{Alt>}{F6}{/Alt}}");
    expect(document.activeElement!).toBe(navigation);
  });

  it("can alt+F6 to main landmark if main is the only landmark", async () => {
    const tree = await mount(() => (
      <div>
        <Main>
          <TextField label="First Name" />
        </Main>
      </div>
    ));
    const main = tree.getByRole("main");

    await user.keyboard("{Alt>}{F6}{/Alt}}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{Alt>}{F6}{/Alt}}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);
  });

  it('landmark has tabIndex="-1" when focused', async () => {
    const tree = await mount(() => <NavAndMain />);
    const navigation = tree.getByRole("navigation");
    const main = tree.getByRole("main");
    expect(navigation).not.toHaveAttribute("tabIndex");
    expect(main).not.toHaveAttribute("tabIndex");

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(navigation);
    expect(navigation).toHaveAttribute("tabIndex", "-1");
    expect(main).not.toHaveAttribute("tabIndex");

    await user.keyboard("{F6}");
    expect(main).toHaveAttribute("tabIndex", "-1");
    expect(navigation).not.toHaveAttribute("tabIndex");
  });

  it("cannot focus landmark with mouse", async () => {
    const tree = await mount(() => <NavAndMain />);
    const navigation = tree.getByRole("navigation");

    fire(navigation, "mousedown");
    fire(navigation, "mouseup");

    expect(document.activeElement!).toBe(document.body);
  });

  it("focuses the landmark again after toggling browser tabs", async () => {
    const { getByRole } = await mount(() => <NavAndMain />);
    const nav = getByRole("navigation");

    await user.keyboard("{F6}");
    expect(nav).toHaveAttribute("tabIndex", "-1");
    expect(document.activeElement!).toBe(nav);

    toggleBrowserTabs();

    expect(document.activeElement!).toBe(nav);
    expect(nav).toHaveAttribute("tabIndex", "-1");
  });

  it("focuses the landmark again after toggling browser windows", async () => {
    const { getByRole } = await mount(() => <NavAndMain />);
    const nav = getByRole("navigation");

    await user.keyboard("{F6}");
    expect(nav).toHaveAttribute("tabIndex", "-1");
    expect(document.activeElement!).toBe(nav);

    toggleBrowserWindow();

    expect(document.activeElement!).toBe(nav);
    expect(nav).toHaveAttribute("tabIndex", "-1");
  });

  it("loses the tabIndex=-1 if something else is focused", async () => {
    const { getByRole, getAllByRole } = await mount(() => <NavAndMain />);
    const nav = getByRole("navigation");

    await user.keyboard("{F6}");
    expect(nav).toHaveAttribute("tabIndex", "-1");
    expect(document.activeElement!).toBe(nav);

    await user.tab();

    expect(document.activeElement!).toBe(getAllByRole("link")[0]);
    expect(nav).not.toHaveAttribute("tabIndex");
  });

  it("cleans up event listeners if all landmarks are unmounted", async () => {
    // Because our listener stops propagation of the F6 key to prevent anything
    // else from handling it, we can render with landmarks to make sure the propagation is stopped
    // and then when everything is unmounted, we can check again.
    const onKeyDown = vi.fn();
    const withNav = signal(true);
    const { getByRole } = await mount(() => (
      <div>
        <button type="button" onKeyDown={onKeyDown}>
          Focusable
        </button>
        <Show when={withNav}>
          <Navigation>
            <Links />
          </Navigation>
        </Show>
      </div>
    ));
    const nav = getByRole("navigation");
    let button = getByRole("button");

    button.focus();
    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(nav);

    expect(onKeyDown).not.toHaveBeenCalled();

    withNav.set(false);
    await flush();
    button = getByRole("button");

    button.focus();
    await user.keyboard("{F6}");

    expect(onKeyDown).toHaveBeenCalled();
  });

  it("updates the landmark if the label changes", async () => {
    const spyWarn = devWarnSpy();
    try {
      const label = signal("nav label 2");
      const tree = await mount(() => (
        <div>
          <Navigation aria-label="nav label 1">
            <Links />
          </Navigation>
          <Navigation aria-label={() => label()}>
            <ul>
              <li>
                <a href="/product">Product</a>
              </li>
              <li>
                <a href="/support">Support</a>
              </li>
            </ul>
          </Navigation>
          <Main>
            <TextField label="First Name" />
          </Main>
        </div>
      ));
      const navs = tree.getAllByRole("navigation");

      expect(spyWarn).not.toHaveBeenCalled();
      label.set("nav label 1");
      await flush();
      expect(spyWarn).toHaveBeenCalledWith(
        "Page contains more than one landmark with the 'navigation' role and 'nav label 1' label. If two or more landmarks on a page share the same role, they must have unique labels: ",
        navs,
      );
    } finally {
      spyWarn.restore();
    }
  });

  it("focus restores to previously focused landmark after blur and F6.", async () => {
    const { getByRole } = await mount(() => <NavAndMain />);
    const nav = getByRole("navigation");

    await user.keyboard("{F6}");
    expect(nav).toHaveAttribute("tabIndex", "-1");
    expect(document.activeElement).toBe(nav);

    (document.activeElement as HTMLElement).blur();
    expect(nav).not.toHaveAttribute("tabIndex", "-1");
    expect(document.activeElement!).toBe(document.body);

    await user.keyboard("{F6}");
    expect(nav).toHaveAttribute("tabIndex", "-1");
    expect(document.activeElement!).toBe(nav);
  });

  it("landmark navigation fires custom event when wrapping forward", async () => {
    const tree = await mount(() => <NavAndMain />);
    const main = tree.getByRole("main");

    const onLandmarkNavigation = vi.fn().mockImplementation((e: Event) => e.preventDefault());
    window.addEventListener("react-aria-landmark-navigation", onLandmarkNavigation);

    await user.tab();
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[0]);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");

    expect(document.activeElement!).toBe(main);

    expect(onLandmarkNavigation).toHaveBeenCalledTimes(1);
    expect(onLandmarkNavigation.mock.calls[0]![0].detail).toEqual({ direction: "forward" });

    window.removeEventListener("react-aria-landmark-navigation", onLandmarkNavigation);
  });

  it("landmark navigation fires custom event when wrapping backward", async () => {
    const tree = await mount(() => <NavAndMain />);

    const onLandmarkNavigation = vi.fn().mockImplementation((e: Event) => e.preventDefault());
    window.addEventListener("react-aria-landmark-navigation", onLandmarkNavigation);

    await user.tab();
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[0]);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(tree.getAllByRole("link")[0]);

    expect(onLandmarkNavigation).toHaveBeenCalledTimes(1);
    expect(onLandmarkNavigation.mock.calls[0]![0].detail).toEqual({ direction: "backward" });

    window.removeEventListener("react-aria-landmark-navigation", onLandmarkNavigation);
  });

  it("skips over aria-hidden landmarks", async () => {
    const tree = await mount(() => (
      <div>
        <Main>
          <div aria-hidden="true">
            <Region aria-label="Region 1">
              <Checkbox>Checkbox label 1</Checkbox>
            </Region>
          </div>

          <TextField label="First Name" />

          <Region aria-label="Region 2">
            <Checkbox>Checkbox label 2</Checkbox>
          </Region>

          <TextField label="Last Name" />
        </Main>
      </div>
    ));
    const main = tree.getByRole("main");
    const region2 = tree.getAllByRole("region")[0];

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(region2);

    await user.keyboard("{F6}");
    expect(document.activeElement!).toBe(main);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(region2);

    await user.keyboard("{Shift>}{F6}{/Shift}}");
    expect(document.activeElement!).toBe(main);
  });

  describe("LandmarkController", () => {
    it("should ensure keyboard listeners are active", async () => {
      const onLandmarkNavigation = vi.fn().mockImplementation((e: Event) => e.preventDefault());
      window.addEventListener("react-aria-landmark-navigation", onLandmarkNavigation);

      await user.keyboard("{F6}");
      expect(onLandmarkNavigation).not.toHaveBeenCalled();

      const controller = UNSTABLE_createLandmarkController();

      await user.keyboard("{F6}");
      expect(onLandmarkNavigation).toHaveBeenCalledTimes(1);

      controller.dispose();
      onLandmarkNavigation.mockReset();

      await user.keyboard("{F6}");
      expect(onLandmarkNavigation).not.toHaveBeenCalled();

      window.removeEventListener("react-aria-landmark-navigation", onLandmarkNavigation);
    });

    it("should navigate forward", async () => {
      const tree = await mount(() => <NavAndMain />);

      await user.tab();
      expect(document.activeElement).toBe(tree.getAllByRole("link")[0]);

      const controller = UNSTABLE_createLandmarkController();

      controller.focusNext();
      expect(document.activeElement).toBe(tree.getByRole("main"));

      controller.navigate("forward");
      expect(document.activeElement).toBe(tree.getAllByRole("link")[0]);

      controller.dispose();
    });

    it("should navigate backward", async () => {
      const tree = await mount(() => <NavAndMain />);

      tree.getByRole("textbox").focus();

      const controller = UNSTABLE_createLandmarkController();

      controller.focusPrevious();
      expect(document.activeElement).toBe(tree.getByRole("navigation"));

      controller.navigate("backward");
      expect(document.activeElement).toBe(tree.getByRole("textbox"));

      controller.dispose();
    });

    it("should focus main", async () => {
      const tree = await mount(() => <NavAndMain />);

      tree.getByRole("textbox").focus();

      const controller = UNSTABLE_createLandmarkController();

      controller.focusMain();
      expect(document.activeElement).toBe(tree.getByRole("main"));

      controller.dispose();
    });
  });

  describe("singleton", () => {
    const key = Symbol.for("rivet-cdk-landmark-manager");
    type ManagerDoc = Record<symbol, { version: number; createLandmarkController: unknown; registerLandmark: unknown } | undefined>;

    it("should store the landmark manager on the document", () => {
      // ensure a manager exists.
      const controller = UNSTABLE_createLandmarkController();
      const manager = (document as unknown as ManagerDoc)[key]!;
      expect(manager).toBeDefined();
      expect(typeof manager.version).toBe("number");
      expect(typeof manager.createLandmarkController).toBe("function");
      expect(typeof manager.registerLandmark).toBe("function");
      controller.dispose();
    });

    it("should replace the singleton with a new version", async () => {
      const tree = await mount(() => (
        <div>
          <Main>
            <TextField label="First Name" />
          </Main>
        </div>
      ));

      const controller = UNSTABLE_createLandmarkController();
      const newController = {
        navigate: vi.fn(),
        focusNext: vi.fn(),
        focusPrevious: vi.fn(),
        focusMain: vi.fn(),
        dispose: vi.fn(),
      };

      const doc = document as unknown as ManagerDoc;
      const manager = doc[key]!;
      const unregister = vi.fn();
      const testLandmarkManager = {
        version: manager.version + 1,
        createLandmarkController: vi.fn().mockReturnValue(newController),
        registerLandmark: vi.fn().mockReturnValue(unregister),
      };

      doc[key] = testLandmarkManager;
      try {
        document.dispatchEvent(new CustomEvent("rv-landmark-manager-change"));

        expect(testLandmarkManager.registerLandmark).toHaveBeenCalledTimes(1);
        expect(testLandmarkManager.createLandmarkController).toHaveBeenCalledTimes(1);

        // Controller should now proxy to the new version.
        controller.navigate("forward");
        expect(newController.navigate).toHaveBeenCalledTimes(1);
        expect(newController.navigate).toHaveBeenCalledWith("forward", undefined);

        controller.focusNext();
        expect(newController.focusNext).toHaveBeenCalledTimes(1);

        controller.focusPrevious();
        expect(newController.focusNext).toHaveBeenCalledTimes(1);

        controller.focusMain();
        expect(newController.focusMain).toHaveBeenCalledTimes(1);

        controller.dispose();
        expect(newController.dispose).toHaveBeenCalledTimes(1);

        // Component should now point to the new manager.
        tree.unmount();
        expect(unregister).toHaveBeenCalledTimes(1);
      } finally {
        // Rivet: restore the real manager so later files in this browser context keep working.
        doc[key] = manager;
      }
    });
  });
});
