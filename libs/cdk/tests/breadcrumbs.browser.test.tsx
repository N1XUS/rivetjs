// Ported from react-aria-components test/Breadcrumbs.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isCurrent()`); refs are Rivet `ref()`s;
// `<BreadcrumbsContext.Provider value>` → runtime `Provider`; default classes `rv-Breadcrumbs` / `rv-Breadcrumb` / `rv-Link`;
// hrefs point at "#…" (a followed link must not unload the test page).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
// Rivet additions: localized default aria-label, onAction + isDisabled (RAC useBreadcrumbItem semantics),
// accessor isDisabled, current item moves when items are appended.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider, ref as createRef } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Breadcrumb, Breadcrumbs, BreadcrumbsContext, type BreadcrumbProps, type BreadcrumbsProps } from "../breadcrumbs/index.tsx";
import { Link } from "../link/index.tsx";
import { I18nProvider } from "../i18n/i18n-provider.tsx";

afterEach(cleanup);

function renderUI(ui: () => unknown) {
  const { container } = render(ui as never);
  return within(container as HTMLElement);
}

const renderBreadcrumbs = (breadcrumbsProps: Partial<BreadcrumbsProps<unknown>> = {}, itemProps: Partial<BreadcrumbProps> = {}) =>
  renderUI(() => (
    <Breadcrumbs {...breadcrumbsProps}>
      <Breadcrumb {...itemProps}>
        <Link href="#/">Home</Link>
      </Breadcrumb>
      <Breadcrumb {...itemProps}>
        <Link href="#/react-aria">React Aria</Link>
      </Breadcrumb>
      <Breadcrumb {...itemProps}>
        <Link>useBreadcrumbs</Link>
      </Breadcrumb>
    </Breadcrumbs>
  ));

describe("Breadcrumbs", () => {
  it("should render with default class", () => {
    const { getByRole, getAllByRole } = renderBreadcrumbs();
    expect(getByRole("list")).toHaveClass("rv-Breadcrumbs");
    for (const item of getAllByRole("listitem")) expect(item).toHaveClass("rv-Breadcrumb");
    const links = getAllByRole("link");
    expect(links[0]).toHaveAttribute("class", "rv-Link");
    expect(links[0]).not.toHaveAttribute("aria-current");
    expect(links[2]).toHaveAttribute("aria-current", "page");
  });

  it("should render with custom class", () => {
    const { getByRole, getAllByRole } = renderBreadcrumbs({ class: "breadcrumbs" }, { class: "item" });
    expect(getByRole("list")).toHaveClass("breadcrumbs");
    for (const item of getAllByRole("listitem")) expect(item).toHaveClass("item");
  });

  it("should support DOM props", () => {
    const { getByRole, getAllByRole } = renderBreadcrumbs(
      { "data-foo": "bar", "aria-label": "test group" } as Partial<BreadcrumbsProps<unknown>>,
      { "data-bar": "foo", "aria-label": "test item" } as Partial<BreadcrumbProps>,
    );
    const breadcrumbs = getByRole("list");
    expect(breadcrumbs).toHaveAttribute("data-foo", "bar");
    expect(breadcrumbs).toHaveAttribute("aria-label", "test group");
    for (const item of getAllByRole("listitem")) {
      expect(item).toHaveAttribute("data-bar", "foo");
      expect(item).toHaveAttribute("aria-label", "test item");
    }
  });

  it("should support slot", () => {
    const { getByRole } = renderUI(() => (
      <Provider token={BreadcrumbsContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <Breadcrumbs slot="test">
          <Breadcrumb>
            <Link>Test</Link>
          </Breadcrumb>
        </Breadcrumbs>
      </Provider>
    ));
    const breadcrumbs = getByRole("list");
    expect(breadcrumbs).toHaveAttribute("slot", "test");
    expect(breadcrumbs).toHaveAttribute("aria-label", "test");
  });

  it("should support dynamic collections", () => {
    const items = [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
      { id: 3, name: "Item 3" },
    ];
    const { getAllByRole } = renderUI(() => <Breadcrumbs items={items}>{(item: (typeof items)[number]) => <Breadcrumb>{item.name}</Breadcrumb>}</Breadcrumbs>);
    expect(getAllByRole("listitem").map((it) => it.textContent)).toEqual(["Item 1", "Item 2", "Item 3"]);
  });

  it("should support refs", () => {
    const breadcrumbsRef = createRef<HTMLOListElement>();
    const breadcrumbRef = createRef<HTMLLIElement>();
    const { getByRole } = renderUI(() => (
      <Breadcrumbs ref={breadcrumbsRef}>
        <Breadcrumb ref={breadcrumbRef}>
          <Link>Test</Link>
        </Breadcrumb>
      </Breadcrumbs>
    ));
    expect(breadcrumbsRef()).toBe(getByRole("list"));
    expect(breadcrumbRef()).toBe(getByRole("listitem"));
  });

  it("should support render props", () => {
    const items = [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
      { id: 3, name: "Item 3" },
    ];
    const { getAllByRole } = renderUI(() => (
      <Breadcrumbs items={items}>
        {(item: (typeof items)[number]) => <Breadcrumb>{({ isCurrent }) => (isCurrent() ? "Current" : item.name)}</Breadcrumb>}
      </Breadcrumbs>
    ));
    expect(getAllByRole("listitem").map((it) => it.textContent)).toEqual(["Item 1", "Item 2", "Current"]);
  });
});

describe("Breadcrumbs (Rivet)", () => {
  it('default aria-label "Breadcrumbs", localized (fr-FR)', () => {
    const { getAllByRole } = renderUI(() => (
      <>
        <Breadcrumbs>
          <Breadcrumb>
            <Link>A</Link>
          </Breadcrumb>
        </Breadcrumbs>
        <I18nProvider locale="fr-FR">
          <Breadcrumbs>
            <Breadcrumb>
              <Link>A</Link>
            </Breadcrumb>
          </Breadcrumbs>
        </I18nProvider>
      </>
    ));
    const [en, fr] = getAllByRole("list");
    expect(en).toHaveAttribute("aria-label", "Breadcrumbs");
    expect(fr).toHaveAttribute("aria-label", "Chemin de navigation");
  });

  it("onAction gets the pressed breadcrumb's id; the current one is disabled (span, no press)", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const { getAllByRole } = renderUI(() => (
      <Breadcrumbs onAction={(key) => onAction(key)}>
        <Breadcrumb id="home">
          <Link>Home</Link>
        </Breadcrumb>
        <Breadcrumb id="current">
          <Link>Current</Link>
        </Breadcrumb>
      </Breadcrumbs>
    ));
    const [home, current] = getAllByRole("link");
    expect(current!.tagName).toBe("SPAN");
    expect(current).toHaveAttribute("aria-disabled", "true");
    const items = getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("data-current", "true");
    expect(items[1]).toHaveAttribute("data-disabled", "true");
    expect(items[0]).not.toHaveAttribute("data-current");
    expect(items[0]).not.toHaveAttribute("id");
    await user.click(home!);
    await user.click(current!);
    expect(onAction.mock.calls).toEqual([["home"]]);
  });

  it("accessor isDisabled disables every breadcrumb", () => {
    const disabled = signal(false);
    const { getAllByRole } = renderUI(() => (
      <Breadcrumbs isDisabled={disabled}>
        <Breadcrumb>
          <Link href="#a">A</Link>
        </Breadcrumb>
        <Breadcrumb>
          <Link>B</Link>
        </Breadcrumb>
      </Breadcrumbs>
    ));
    expect(getAllByRole("listitem")[0]).not.toHaveAttribute("data-disabled");
    expect(getAllByRole("link")[0]!.tagName).toBe("A");
    disabled.set(true);
    expect(getAllByRole("listitem")[0]).toHaveAttribute("data-disabled", "true");
    expect(getAllByRole("link")[0]!.tagName).toBe("SPAN");
  });

  it("appending an item moves the current breadcrumb", () => {
    const items = signal([
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]);
    const { getAllByRole } = renderUI(() => (
      <Breadcrumbs items={() => items()}>
        {(item: { id: string; name: string }) => (
          <Breadcrumb>
            <Link href={"#" + item.id}>{item.name}</Link>
          </Breadcrumb>
        )}
      </Breadcrumbs>
    ));
    expect(getAllByRole("link").map((l) => l.getAttribute("aria-current"))).toEqual([null, "page"]);
    items.set([...items(), { id: "c", name: "C" }]);
    expect(getAllByRole("link").map((l) => l.getAttribute("aria-current"))).toEqual([null, null, "page"]);
    expect(getAllByRole("listitem").map((l) => l.getAttribute("data-current"))).toEqual([null, null, "true"]);
  });
});
