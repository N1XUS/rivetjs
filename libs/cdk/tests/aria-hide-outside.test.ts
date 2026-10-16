// Port of React Aria's ariaHideOutside.test.js (light DOM part; Apache-2.0, © Adobe). Shadow DOM
// cases are not ported: the Rivet port does not observe shadow roots (see the spec). happy-dom.
import { describe, test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

const dom = installDom();
const { ariaHideOutside } = await import("../overlay/aria-hide-outside.ts");

/** RTL `render`: markup in a container div appended to the body. */
function render(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  return container;
}
const $ = (root: ParentNode, selector: string) => root.querySelector<HTMLElement>(selector)!;
const $$ = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];
/** Hidden from the accessibility tree (getByRole would not find it). */
const isHidden = (el: Element) => !!el.closest('[aria-hidden="true"]');
const visible = (root: ParentNode, selector: string) => $$(root, selector).filter((el) => !isHidden(el));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => dom.reset());

describe("ariaHideOutside", () => {
  test("should hide everything except the provided element [button]", () => {
    const root = render('<input type="checkbox"><button>Button</button><input type="checkbox">');
    const checkboxes = $$(root, "input"),
      button = $(root, "button");
    const revert = ariaHideOutside([button]);
    assert.equal(checkboxes[0]!.getAttribute("aria-hidden"), "true");
    assert.equal(checkboxes[1]!.getAttribute("aria-hidden"), "true");
    assert.equal(button.hasAttribute("aria-hidden"), false);
    assert.equal(visible(root, "input").length, 0);
    assert.equal(visible(root, "button").length, 1);
    revert();
    for (const el of [...checkboxes, button]) assert.equal(el.hasAttribute("aria-hidden"), false);
  });

  test("should hide everything except multiple elements", () => {
    const root = render('<input type="checkbox"><button>Button</button><input type="checkbox">');
    const checkboxes = $$(root, "input"),
      button = $(root, "button");
    const revert = ariaHideOutside(checkboxes);
    assert.notEqual(checkboxes[0]!.getAttribute("aria-hidden"), "true");
    assert.notEqual(checkboxes[1]!.getAttribute("aria-hidden"), "true");
    assert.equal(button.hasAttribute("aria-hidden"), true);
    revert();
    for (const el of [...checkboxes, button]) assert.equal(el.hasAttribute("aria-hidden"), false);
  });

  test("should not traverse into an already hidden container", () => {
    const root = render('<div><input type="checkbox"></div><button>Button</button><input type="checkbox">');
    const checkboxes = $$(root, "input"),
      button = $(root, "button");
    const revert = ariaHideOutside([button]);
    assert.equal(checkboxes[0]!.parentElement!.getAttribute("aria-hidden"), "true");
    assert.equal(checkboxes[0]!.hasAttribute("aria-hidden"), false, "not traversed");
    assert.equal(checkboxes[1]!.getAttribute("aria-hidden"), "true");
    assert.equal(button.hasAttribute("aria-hidden"), false);
    revert();
    assert.equal(checkboxes[0]!.parentElement!.hasAttribute("aria-hidden"), false);
    assert.equal(checkboxes[1]!.hasAttribute("aria-hidden"), false);
  });

  test("should not overwrite an existing aria-hidden prop", () => {
    const root = render('<input type="checkbox" aria-hidden="true"><button>Button</button><input type="checkbox">');
    const checkboxes = $$(root, "input"),
      button = $(root, "button");
    const revert = ariaHideOutside([button]);
    assert.equal(checkboxes[0]!.getAttribute("aria-hidden"), "true");
    assert.equal(checkboxes[1]!.getAttribute("aria-hidden"), "true");
    revert();
    assert.equal(checkboxes[0]!.getAttribute("aria-hidden"), "true", "author's aria-hidden kept");
    assert.equal(checkboxes[1]!.hasAttribute("aria-hidden"), false);
    assert.equal(visible(root, "input").length, 1);
  });

  test("should handle when a new element is added outside while active", async () => {
    const root = render("<button>Button</button>");
    const button = $(root, "button");
    const revert = ariaHideOutside([button]);
    const a = document.createElement("input"),
      b = document.createElement("input");
    a.type = b.type = "checkbox";
    button.before(a);
    button.after(b);
    await tick();
    assert.equal(visible(root, "input").length, 0);
    assert.equal(visible(root, "button").length, 1);
    revert();
    assert.equal(visible(root, "input").length, 2);
  });

  test("should handle when a new element is added to an already hidden container", async () => {
    const root = render('<div data-testid="test"></div><button>Button</button>');
    const button = $(root, "button"),
      testDiv = $(root, '[data-testid="test"]');
    const revert = ariaHideOutside([button]);
    assert.equal(testDiv.hasAttribute("aria-hidden"), true);
    const a = document.createElement("input"),
      b = document.createElement("input");
    testDiv.append(a);
    button.after(b);
    await tick();
    assert.equal(visible(root, "input").length, 0);
    assert.equal(visible(root, "button").length, 1);
    assert.equal(testDiv.hasAttribute("aria-hidden"), true);
    assert.equal(a.hasAttribute("aria-hidden"), false, "inside a hidden container: left alone");
    assert.equal(b.getAttribute("aria-hidden"), "true");
    revert();
    assert.equal(visible(root, "input").length, 2);
  });

  test("should handle when a new element is added along with a top layer element", async () => {
    const root = render("<button>Button</button>");
    const button = $(root, "button");
    const revert = ariaHideOutside([button]);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = '<div role="alert" data-react-aria-top-layer="true">Top layer</div><input type="checkbox">';
    root.append(wrapper);
    await tick();
    assert.equal(visible(root, "input").length, 0);
    assert.equal(visible(root, "button").length, 1);
    assert.equal(visible(root, '[role="alert"]').length, 1, "top layer stays visible");
    revert();
    assert.equal(visible(root, "input").length, 1);
  });

  test('should recognize dynamically added top layer element with data-react-aria-top-layer="" (attribute presence)', async () => {
    const root = render("<button>Button</button>");
    const button = $(root, "button");
    const revert = ariaHideOutside([button]);
    const status = document.createElement("div");
    status.setAttribute("role", "status");
    status.setAttribute("data-react-aria-top-layer", "");
    const checkbox = document.createElement("input");
    root.append(status, checkbox);
    await tick();
    assert.equal(status.hasAttribute("aria-hidden"), false);
    assert.equal(checkbox.getAttribute("aria-hidden"), "true");
    revert();
    assert.equal(visible(root, "input").length, 1);
  });

  test("data-rv-top-layer elements stay visible (Rivet attribute)", async () => {
    const root = render('<button>Button</button><div data-rv-top-layer="">toast</div>');
    const revert = ariaHideOutside([$(root, "button")]);
    assert.equal($(root, "[data-rv-top-layer]").hasAttribute("aria-hidden"), false);
    revert();
  });

  test("should handle when a new element is added inside a target element", async () => {
    const root = render('<input type="checkbox"><div data-testid="test"><button>Button</button></div><input type="checkbox">');
    const testDiv = $(root, '[data-testid="test"]');
    const revert = ariaHideOutside([testDiv]);
    assert.equal(visible(root, "input").length, 0);
    const radio = document.createElement("input");
    radio.type = "radio";
    testDiv.append(radio);
    await tick();
    assert.equal(visible(root, 'input[type="checkbox"]').length, 0);
    assert.equal(visible(root, 'input[type="radio"]').length, 1);
    assert.equal(visible(root, "button").length, 1);
    revert();
    assert.equal(visible(root, "input").length, 3);
  });

  test("should handle when a new element is added and then reparented", async () => {
    const root = render('<div data-testid="test"><button>Mutate</button></div>');
    const target = $(root, '[data-testid="test"]');
    const revert = ariaHideOutside([target]);
    const parent = document.createElement("ul"),
      child = document.createElement("li");
    target.append(parent);
    parent.appendChild(child);
    parent.remove();
    const newParent = document.createElement("ul");
    newParent.appendChild(child);
    target.append(newParent);
    await tick();
    assert.equal(visible(root, "li").length, 1);
    revert();
  });

  test("should handle when a new element is added and then reparented to a hidden container", async () => {
    const root = render('<div data-testid="test"><button>Mutate</button></div><div data-testid="sibling"></div>');
    const target = $(root, '[data-testid="test"]'),
      sibling = $(root, '[data-testid="sibling"]');
    const revert = ariaHideOutside([target]);
    const parent = document.createElement("ul"),
      child = document.createElement("li");
    sibling.append(parent);
    parent.appendChild(child);
    parent.remove();
    const newParent = document.createElement("ul");
    newParent.appendChild(child);
    sibling.append(newParent);
    await tick();
    assert.equal(visible(root, "li").length, 0);
    revert();
  });

  const multi = '<input type="checkbox"><input type="radio"><button>Button</button><input type="radio"><input type="checkbox">';

  test("work when called multiple times", () => {
    const root = render(multi);
    const radios = $$(root, '[type="radio"]'),
      button = $(root, "button");
    const counts = () => [visible(root, '[type="checkbox"]').length, visible(root, '[type="radio"]').length, visible(root, "button").length];
    const revert1 = ariaHideOutside([button, ...radios]);
    assert.deepEqual(counts(), [0, 2, 1]);
    const revert2 = ariaHideOutside([button]);
    assert.deepEqual(counts(), [0, 0, 1]);
    revert2();
    assert.deepEqual(counts(), [0, 2, 1]);
    revert1();
    assert.deepEqual(counts(), [2, 2, 1]);
  });

  test("work when called multiple times and restored out of order", () => {
    const root = render(multi);
    const radios = $$(root, '[type="radio"]'),
      button = $(root, "button");
    const counts = () => [visible(root, '[type="checkbox"]').length, visible(root, '[type="radio"]').length, visible(root, "button").length];
    const revert1 = ariaHideOutside([button, ...radios]);
    const revert2 = ariaHideOutside([button]);
    revert1();
    assert.deepEqual(counts(), [0, 0, 1]);
    revert2();
    assert.deepEqual(counts(), [2, 2, 1]);
  });

  test("should hide everything except the provided element [row]", () => {
    const root = render(
      '<div role="grid"><div role="row"><div role="gridcell"><span data-testid="test-span">Cell 1</span></div></div><div role="row"><div role="gridcell">Cell 2</div></div></div>',
    );
    const cells = $$(root, '[role="gridcell"]'),
      rows = $$(root, '[role="row"]'),
      span = $(root, "span");
    const revert = ariaHideOutside([rows[1]!]);
    // Row and cell both hidden despite aria-hidden being recursive (WebKit bug 222623).
    assert.equal(rows[0]!.getAttribute("aria-hidden"), "true");
    assert.equal(cells[0]!.getAttribute("aria-hidden"), "true");
    assert.equal(span.hasAttribute("aria-hidden"), false);
    assert.notEqual(rows[1]!.getAttribute("aria-hidden"), "true");
    assert.notEqual(cells[1]!.getAttribute("aria-hidden"), "true");
    revert();
    for (const el of [...rows, ...cells, span]) assert.notEqual(el.getAttribute("aria-hidden"), "true");
  });

  test("should unhide after item reorder", async () => {
    const root = render(
      "<button>press</button>" +
        ["row1", "row2", "row3", "row4", "row5"]
          .map((id) => `<div role="presentation"><div data-testid="${id}" role="row"><div role="gridcell"></div></div></div>`)
          .join(""),
    );
    const button = $(root, "button"),
      row = $(root, '[data-testid="row1"]');
    const revert = ariaHideOutside([button]);
    const item = (id: string) => $(root, `[data-testid="${id}"]`).parentElement!;
    // Keyed reorder: the moved node is removed and re-inserted.
    item("row2").after(item("row1"));
    await tick();
    item("row3").after(item("row1"));
    await tick();
    revert();
    assert.notEqual(row.parentElement!.getAttribute("aria-hidden"), "true");
  });
});
