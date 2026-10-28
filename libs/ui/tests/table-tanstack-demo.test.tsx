// DOM-target suite: the ui-docs `table-tanstack-table` demo (`@rivetjs/ui/table-tanstack` `createTable` + ui `Table` +
// `Pagination`) in happy-dom: header press sorts through `sortingAtom` (TanStack sorted row model), descending on the
// second press, pagination links / next / previous page through the paginated row model, summary + disabled states.
// Resumed page (first click sorts on the server nodes): ui-docs example check + `tests-components/table-tanstack.test.ts`.
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { TanstackTable } = await import("../../../apps/ui-docs/examples/table-tanstack-table/src/routes/index.tsx");

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const q = (sel: string) => document.querySelector(sel) as HTMLElement;
const qa = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];
const firstCells = () => qa("tbody tr").map((tr) => tr.children[0]!.textContent);

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

test("tanstack demo: headers from column defs, first page, Chip cells", async () => {
  unmount = render(() => <TanstackTable />).unmount;
  await flush();
  assert.deepEqual(
    qa("thead th").map((th) => th.textContent),
    ["Name", "Role", "Status", "Email"],
  );
  assert.equal(q("table").getAttribute("role"), "grid");
  assert.deepEqual(firstCells(), ["Kate Moore", "John Smith", "Sara Johnson", "Michael Brown"]);
  assert.equal(q("tbody tr:nth-child(3) [data-slot=chip]")?.textContent, "On Leave");
  assert.equal(q("[data-slot=pagination-summary]").textContent, "1 to 4 of 8 results");
  assert.deepEqual(
    qa("[data-slot=pagination-link]").map((a) => a.textContent),
    ["1", "2"],
  );
  assert.equal(q("[data-slot=pagination-link][aria-current]").textContent, "1");
});

test("tanstack demo: header press sorts ascending, then descending; pages follow the sorted model", async () => {
  unmount = render(() => <TanstackTable />).unmount;
  await flush();
  const name = () => q("thead th:nth-child(1)");
  press(name());
  await flush();
  assert.deepEqual(firstCells(), ["Davis Wilson", "Emily Davis", "James Taylor", "John Smith"]);
  assert.equal(name().getAttribute("aria-sort"), "ascending");
  press(name());
  await flush();
  assert.deepEqual(firstCells(), ["Sara Johnson", "Olivia Martinez", "Michael Brown", "Kate Moore"]);
  assert.equal(name().getAttribute("aria-sort"), "descending");
  // Page 2 link.
  press(qa("[data-slot=pagination-link]").find((a) => a.textContent === "2")!);
  await flush();
  assert.deepEqual(firstCells(), ["John Smith", "James Taylor", "Emily Davis", "Davis Wilson"]);
  assert.equal(q("[data-slot=pagination-summary]").textContent, "5 to 8 of 8 results");
  // A new sort resets to the first page (table-core autoResetPageIndex).
  press(q("thead th:nth-child(2)"));
  await flush();
  assert.equal(q("[data-slot=pagination-summary]").textContent, "1 to 4 of 8 results");
  assert.deepEqual(firstCells(), ["James Taylor", "Kate Moore", "Michael Brown", "Sara Johnson"]);
});

test("tanstack demo: next / previous buttons and their disabled state", async () => {
  unmount = render(() => <TanstackTable />).unmount;
  await flush();
  const prev = () => q("[data-slot=pagination-previous]");
  const next = () => q("[data-slot=pagination-next]");
  const disabled = (el: HTMLElement) => el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-disabled");
  assert.equal(disabled(prev()), true, "prev disabled on page 1");
  assert.equal(disabled(next()), false);
  press(next());
  await flush();
  assert.deepEqual(firstCells(), ["Emily Davis", "Davis Wilson", "Olivia Martinez", "James Taylor"]);
  assert.equal(disabled(next()), true, "next disabled on the last page");
  assert.equal(disabled(prev()), false);
  assert.equal(q("[data-slot=pagination-link][aria-current]").textContent, "2");
  press(prev());
  await flush();
  assert.deepEqual(firstCells(), ["Kate Moore", "John Smith", "Sara Johnson", "Michael Brown"]);
});
