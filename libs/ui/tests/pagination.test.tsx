// DOM-target suite: `Pagination` (upstream tests/components/pagination/pagination.test.tsx ported to happy-dom): labelled navigation
// + data-slot + BEM block, list items, default md / sm / lg size modifiers, `aria-current` + `data-active` on the active link,
// aria-hidden ellipsis, `onPress` on Previous / Link / Next, disabled Previous, Summary, custom icons.
// Rivet: `@heroui/testing` user-event → direct pointer events; default lucide icons; live `isActive` / `size` / `class` update in
// place; parts outside a Pagination; index exports.
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const P = await import("../src/components/pagination/index.ts");
const { Pagination } = P;

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const buttonNamed = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent!.trim() === name) as HTMLButtonElement;

let unmount: (() => void) | undefined;
const mount = (fn: () => unknown) => {
  const r = render(fn as never);
  unmount = r.unmount;
  return r;
};
afterEach(() => {
  unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

const Fixture = () => (
  <Pagination>
    <Pagination.Content>
      <Pagination.Item>
        <Pagination.Previous>
          <Pagination.PreviousIcon />
          <span>Previous</span>
        </Pagination.Previous>
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Link isActive>1</Pagination.Link>
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Link>2</Pagination.Link>
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Ellipsis />
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Next>
          <span>Next</span>
          <Pagination.NextIcon />
        </Pagination.Next>
      </Pagination.Item>
    </Pagination.Content>
  </Pagination>
);

test("pagination: index exports", () => {
  assert.equal(Pagination, P.PaginationRoot);
  assert.equal(Pagination.Root, P.PaginationRoot);
  assert.equal(Pagination.Content, P.PaginationContent);
  assert.equal(Pagination.Item, P.PaginationItem);
  assert.equal(Pagination.Link, P.PaginationLink);
  assert.equal(Pagination.Previous, P.PaginationPrevious);
  assert.equal(Pagination.PreviousIcon, P.PaginationPreviousIcon);
  assert.equal(Pagination.Next, P.PaginationNext);
  assert.equal(Pagination.NextIcon, P.PaginationNextIcon);
  assert.equal(Pagination.Ellipsis, P.PaginationEllipsis);
  assert.equal(Pagination.Summary, P.PaginationSummary);
  assert.equal(P.paginationVariants().base(), "pagination pagination--md");
});

test("pagination (upstream): exposes a labelled navigation role with data-slot and BEM block", () => {
  mount(() => <Fixture />);
  const nav = q("nav")!;
  assert.equal(nav.getAttribute("role"), "navigation");
  assert.equal(nav.getAttribute("aria-label"), "pagination");
  assert.equal(nav.getAttribute("data-slot"), "pagination");
  assert.match(nav.className, /\bpagination\b/);
});

test("pagination (upstream): renders a list of items with data-slot", () => {
  mount(() => <Fixture />);
  assert.equal(q("ul")!.getAttribute("data-slot"), "pagination-content");
  assert.equal(q("ul")!.className, "pagination__content");
  const items = document.querySelectorAll('[data-slot="pagination-item"]');
  assert.equal(items.length, 5);
  assert.equal(items[0]!.className, "pagination__item");
});

test("pagination (upstream): exposes default md size BEM modifier", () => {
  mount(() => <Fixture />);
  assert.match(q("nav")!.className, /pagination--md/);
});

for (const size of ["sm", "lg"] as const) {
  test(`pagination (upstream): maps size=${size} to the matching BEM modifier`, () => {
    mount(() => (
      <Pagination size={size}>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Link isActive>1</Pagination.Link>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    ));
    assert.match(q("nav")!.className, new RegExp(`pagination--${size}`));
  });
}

test("pagination (upstream): exposes aria-current and data-active on the active link", () => {
  mount(() => <Fixture />);
  const active = buttonNamed("1");
  assert.equal(active.getAttribute("aria-current"), "page");
  assert.equal(active.getAttribute("data-active"), "true");
  assert.equal(active.getAttribute("data-slot"), "pagination-link");
  assert.match(active.className, /\bpagination__link\b/);
  assert.equal(buttonNamed("2").getAttribute("aria-current"), null);
  assert.equal(buttonNamed("2").getAttribute("data-active"), null);
});

test("pagination (upstream): renders an aria-hidden ellipsis", () => {
  mount(() => <Fixture />);
  const ellipsis = q('[data-slot="pagination-ellipsis"]')!;
  assert.equal(ellipsis.getAttribute("aria-hidden"), "true");
  assert.equal(ellipsis.textContent, "…");
  assert.equal(ellipsis.className, "pagination__ellipsis");
});

test("pagination (upstream): calls onPress on Previous/Next/Link buttons", async () => {
  let previous = 0;
  let next = 0;
  let selected = 0;
  mount(() => (
    <Pagination>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous onPress={() => previous++}>Previous</Pagination.Previous>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link onPress={() => selected++}>2</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next onPress={() => next++}>Next</Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  ));
  press(buttonNamed("Previous"));
  press(buttonNamed("2"));
  press(buttonNamed("Next"));
  await flush();
  assert.deepEqual([previous, selected, next], [1, 1, 1]);
  assert.match(buttonNamed("Previous").className, /pagination__link pagination__link--nav/);
  assert.equal(buttonNamed("Previous").getAttribute("data-slot"), "pagination-previous");
  assert.equal(buttonNamed("Next").getAttribute("data-slot"), "pagination-next");
});

test("pagination (upstream): supports disabled Previous/Next without interaction", async () => {
  let presses = 0;
  mount(() => (
    <Pagination>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled onPress={() => presses++}>
            Previous
          </Pagination.Previous>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  ));
  const previous = buttonNamed("Previous");
  assert.equal(previous.disabled, true);
  press(previous);
  await flush();
  assert.equal(presses, 0);
});

test("pagination (upstream): renders an optional Summary with data-slot", () => {
  mount(() => (
    <Pagination>
      <Pagination.Summary>1 to 5 of 10 invoices</Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Link isActive>1</Pagination.Link>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  ));
  const summary = q('[data-slot="pagination-summary"]')!;
  assert.equal(summary.textContent, "1 to 5 of 10 invoices");
  assert.equal(summary.className, "pagination__summary");
  assert.equal(summary.getAttribute("dir"), "auto");
});

test("pagination (upstream): supports custom Previous/Next icons", () => {
  mount(() => (
    <Pagination>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous>
            <Pagination.PreviousIcon>
              <span data-testid="custom-prev-icon" />
            </Pagination.PreviousIcon>
            Back
          </Pagination.Previous>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  ));
  assert.ok(q("[data-testid=custom-prev-icon]"));
  assert.equal(q('[data-slot="pagination-previous-icon"] svg'), null);
});

test("pagination: default icons are lucide chevrons in aria-hidden spans", () => {
  mount(() => <Fixture />);
  const prev = q('[data-slot="pagination-previous-icon"]')!;
  const next = q('[data-slot="pagination-next-icon"]')!;
  assert.equal(prev.getAttribute("aria-hidden"), "true");
  assert.equal(next.getAttribute("aria-hidden"), "true");
  // lucide ChevronLeft / ChevronRight path data
  assert.equal(prev.querySelector("svg path")!.getAttribute("d"), "m15 18-6-6 6-6");
  assert.equal(next.querySelector("svg path")!.getAttribute("d"), "m9 18 6-6-6-6");
  assert.equal(prev.querySelector("svg")!.getAttribute("width"), "16");
});

test("pagination: live isActive / isDisabled / size / class update in place", async () => {
  const page = signal(1);
  const size = signal<"sm" | "md" | "lg">("sm");
  const extra = signal("a");
  mount(() => (
    <Pagination size={size()}>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page() === 1} onPress={() => page.set(page() - 1)}>
            Previous
          </Pagination.Previous>
        </Pagination.Item>
        {[1, 2, 3].map((p) => (
          <Pagination.Item>
            <Pagination.Link class={`x-${extra()}`} isActive={page() === p} onPress={() => page.set(p)}>
              {String(p)}
            </Pagination.Link>
          </Pagination.Item>
        ))}
      </Pagination.Content>
    </Pagination>
  ));
  const nav = q("nav")!;
  const two = buttonNamed("2");
  assert.equal(buttonNamed("1").getAttribute("aria-current"), "page");
  assert.equal(buttonNamed("Previous").disabled, true);
  press(two);
  await flush();
  assert.equal(page(), 2);
  assert.equal(buttonNamed("2"), two);
  assert.equal(two.getAttribute("aria-current"), "page");
  assert.equal(two.getAttribute("data-active"), "true");
  assert.equal(buttonNamed("1").getAttribute("aria-current"), null);
  assert.equal(buttonNamed("Previous").disabled, false);
  press(buttonNamed("Previous"));
  await flush();
  assert.equal(page(), 1);
  assert.equal(buttonNamed("Previous").disabled, true);
  size.set("lg");
  extra.set("b");
  await flush();
  assert.equal(q("nav"), nav);
  assert.match(nav.className, /pagination--lg/);
  assert.match(two.className, /\bx-b\b/);
  assert.match(two.className, /\bpagination__link\b/);
});

test("pagination: parts outside a Pagination keep only the caller's class", () => {
  mount(() => (
    <ul>
      <Pagination.Item class="i">
        <Pagination.Link class="l">1</Pagination.Link>
      </Pagination.Item>
      <Pagination.Ellipsis class="e" />
    </ul>
  ));
  assert.equal(q('[data-slot="pagination-item"]')!.className, "i");
  assert.equal(buttonNamed("1").className.trim(), "l");
  assert.equal(q('[data-slot="pagination-ellipsis"]')!.className, "e");
});

test("pagination: paginationRange — boundaries, siblings, one ellipsis per gap, constant length", () => {
  const { paginationRange } = P;
  assert.deepEqual(paginationRange(1, 3), [1, 2, 3]);
  assert.deepEqual(paginationRange(1, 12), [1, 2, 3, 4, 5, "end-ellipsis", 12]);
  assert.deepEqual(paginationRange(6, 12), [1, "start-ellipsis", 5, 6, 7, "end-ellipsis", 12]);
  assert.deepEqual(paginationRange(12, 12), [1, "start-ellipsis", 8, 9, 10, 11, 12]);
  assert.deepEqual(paginationRange(5, 10, 2, 2), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(paginationRange(10, 20, 2, 2), [1, 2, "start-ellipsis", 8, 9, 10, 11, 12, "end-ellipsis", 19, 20]);
  for (let p = 1; p <= 20; p++) assert.equal(paginationRange(p, 20).length, 7);
  assert.deepEqual(paginationRange(1, 0), []);
});

test("pagination: paginationRange edge cases — tiny totals, zero siblings / boundaries, out-of-range page, bad numbers", () => {
  const { paginationRange } = P;
  assert.deepEqual(paginationRange(1, 1), [1]);
  assert.deepEqual(paginationRange(1, 2), [1, 2]);
  assert.deepEqual(paginationRange(2, 2), [1, 2]);
  // out-of-range / fractional page = the clamped page
  assert.deepEqual(paginationRange(50, 12), paginationRange(12, 12));
  assert.deepEqual(paginationRange(-3, 12), paginationRange(1, 12));
  assert.deepEqual(paginationRange(6.7, 12), paginationRange(6, 12));
  assert.deepEqual(paginationRange(Number.NaN, 12), paginationRange(1, 12));
  // non-finite / fractional totals: nothing, or the whole part
  assert.deepEqual(paginationRange(1, Number.POSITIVE_INFINITY), []);
  assert.deepEqual(paginationRange(1, Number.NaN), []);
  assert.deepEqual(paginationRange(1, 3.9), [1, 2, 3]);
  // Every combination: sorted unique pages, the current page shown, an ellipsis only over a gap of two or more pages,
  // ends shown when boundaries > 0, constant length per (total, siblings, boundaries).
  for (let total = 1; total <= 14; total++)
    for (let siblings = 0; siblings <= 2; siblings++)
      for (let boundaries = 0; boundaries <= 2; boundaries++) {
        const lengths = new Set<number>();
        for (let page = 1; page <= total; page++) {
          const r = paginationRange(page, total, siblings, boundaries);
          const at = `page ${page} / ${total}, siblings ${siblings}, boundaries ${boundaries}: ${JSON.stringify(r)}`;
          lengths.add(r.length);
          assert.ok(r.includes(page), at);
          if (boundaries > 0) assert.ok(r.includes(1) && r.includes(total), at);
          let prev = 0;
          for (let i = 0; i < r.length; i++) {
            const item = r[i]!;
            if (typeof item === "number") {
              assert.ok(item > prev && item <= total, at);
              prev = item;
            } else {
              const next = r[i + 1] ?? total + 1;
              assert.ok(typeof next === "number" && next - prev >= 3, at);
            }
          }
        }
        assert.equal(lengths.size, 1, `constant length: total ${total}, siblings ${siblings}, boundaries ${boundaries}`);
      }
});

test("pagination: auto form clamps a page outside 1…total (active link, Previous / Next step from the clamped page)", async () => {
  const page = signal(5);
  mount(() => <Pagination total={3} page={page} />);
  assert.equal(buttonNamed("3").getAttribute("aria-current"), "page");
  const disabled = (b: HTMLElement) => b.hasAttribute("disabled") || b.getAttribute("aria-disabled") === "true" || b.hasAttribute("data-disabled");
  assert.ok(disabled(buttonNamed("Next")));
  assert.ok(!disabled(buttonNamed("Previous")));
  press(buttonNamed("Previous"));
  await flush();
  assert.equal(page(), 2);
});

test("pagination: auto form (total + Signal page) — links, ellipses, Previous / Next, two-way page", async () => {
  const page = signal(1);
  mount(() => <Pagination total={12} page={page} />);
  const labels = () => [...document.querySelectorAll('[data-slot="pagination-item"]')].map((li) => li.textContent!.trim());
  assert.deepEqual(labels(), ["Previous", "1", "2", "3", "4", "5", "\u2026", "12", "Next"]);
  assert.equal(buttonNamed("1").getAttribute("aria-current"), "page");
  assert.ok(
    buttonNamed("Previous").hasAttribute("disabled") ||
      buttonNamed("Previous").getAttribute("aria-disabled") === "true" ||
      buttonNamed("Previous").hasAttribute("data-disabled"),
  );
  press(buttonNamed("5"));
  await flush();
  assert.equal(page(), 5);
  assert.deepEqual(labels(), ["Previous", "1", "\u2026", "4", "5", "6", "\u2026", "12", "Next"]);
  assert.equal(buttonNamed("5").getAttribute("aria-current"), "page");
  press(buttonNamed("Next"));
  await flush();
  assert.equal(page(), 6);
  page.set(12);
  await flush();
  assert.equal(buttonNamed("12").getAttribute("aria-current"), "page");
  assert.ok(buttonNamed("Next").hasAttribute("disabled") || buttonNamed("Next").hasAttribute("data-disabled"));
});

test("pagination: auto form uncontrolled (defaultPage + onPageChange), labels", async () => {
  const changes: number[] = [];
  mount(() => <Pagination total={3} defaultPage={2} onPageChange={(p: number) => changes.push(p)} previousLabel="Back" nextLabel="Forward" />);
  assert.equal(buttonNamed("2").getAttribute("aria-current"), "page");
  press(buttonNamed("Forward"));
  await flush();
  assert.deepEqual(changes, [3]);
  assert.equal(buttonNamed("3").getAttribute("aria-current"), "page");
  press(buttonNamed("Back"));
  await flush();
  assert.deepEqual(changes, [3, 2]);
});
