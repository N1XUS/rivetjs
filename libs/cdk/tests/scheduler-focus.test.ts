// Ported from @malva-ui/scheduler (src/lib/layout/scheduler-focus.spec.ts), MIT, © 2026 Malva UI.
// Rivet: titles unchanged; `data-event-id` / `data-day-index` / `data-minutes` → `data-rv-*`; `nextVisibleDate` over
// day numbers (`dn()` of the malva `new Date(2031, 2, day)` literals).
import "./dom.ts";
import { describe, expect, it } from "vitest";
import { findCellElement, findEventElement } from "../scheduler/behaviour.ts";
import { nextVisibleDate } from "../scheduler/layout.ts";
import { date, dn } from "./scheduler-fixtures.ts";

// March 2031: the 1st is a Saturday, so 7 Mar is a Friday and 10 Mar a Monday.
const d = (day: number, month = 2) => dn(date(2031, month, day));

describe("scheduler-focus", () => {
  describe("findEventElement", () => {
    /** Builds a detached root holding one chip per id. */
    const rootWith = (...ids: string[]): HTMLElement => {
      const root = document.createElement("div");
      for (const id of ids) {
        const chip = document.createElement("div");
        chip.setAttribute("data-rv-event-id", id);
        root.appendChild(chip);
      }
      return root;
    };

    it("returns the element carrying the id, and null for an unknown one", () => {
      const root = rootWith("a", "b");
      expect(findEventElement(root, "b")?.getAttribute("data-rv-event-id")).toBe("b");
      expect(findEventElement(root, "c")).toBeNull();
    });

    /** Two segments of one event, each inside its own day cell. */
    const rootWithSegments = (id: string, ...dayIndexes: number[]) => {
      const root = document.createElement("div");
      for (const dayIndex of dayIndexes) {
        const cell = document.createElement("div");
        cell.setAttribute("data-rv-day-index", String(dayIndex));
        const chip = document.createElement("div");
        chip.setAttribute("data-rv-event-id", id);
        cell.appendChild(chip);
        root.appendChild(cell);
      }
      return root;
    };

    const ownerOf = (element: HTMLElement | null) => element?.closest<HTMLElement>("[data-rv-day-index]")?.getAttribute("data-rv-day-index");

    it("picks the segment in the requested day, not the first chip of the id", () => {
      // Every segment of a multi-day event carries the same event id, so without `dayIndex` a keyboard move made from
      // the second segment restores focus onto the first one — another day, possibly another row.
      const root = rootWithSegments("e", 3, 4, 5);
      expect(ownerOf(findEventElement(root, "e", 4))).toBe("4");
      expect(ownerOf(findEventElement(root, "e", 5))).toBe("5");
    });

    it("falls back to the first chip when the requested day has none", () => {
      const root = rootWithSegments("e", 3, 4);
      expect(ownerOf(findEventElement(root, "e", 9))).toBe("3");
      expect(ownerOf(findEventElement(root, "e", undefined))).toBe("3");
    });

    it("matches ids that would break a CSS attribute selector", () => {
      // The reason the implementation compares attributes instead of building a `[data-rv-event-id="…"]` selector:
      // consumer ids are arbitrary strings.
      const root = rootWith('quote"and space', "plain");
      expect(findEventElement(root, 'quote"and space')?.getAttribute("data-rv-event-id")).toBe('quote"and space');
    });
  });

  describe("findCellElement", () => {
    /** A root with one all-day cell and one 09:30 slot, both on day 2. */
    const root = (): HTMLElement => {
      const element = document.createElement("div");
      element.innerHTML =
        '<div data-rv-day-index="2" data-rv-minutes="all-day" id="lane"></div>' + '<div data-rv-day-index="2" data-rv-minutes="570" id="slot"></div>';
      return element;
    };

    it("resolves the all-day cell for null minutes and the slot for a number", () => {
      expect(findCellElement(root(), 2, null)?.id).toBe("lane");
      expect(findCellElement(root(), 2, 570)?.id).toBe("slot");
    });

    it("returns null when neither the day nor the minute matches", () => {
      expect(findCellElement(root(), 3, null)).toBeNull();
      expect(findCellElement(root(), 2, 600)).toBeNull();
    });
  });

  describe("nextVisibleDate", () => {
    it("steps a single calendar day when no weekday is hidden", () => {
      expect(nextVisibleDate(d(5), 1, [])).toBe(d(6));
      expect(nextVisibleDate(d(5), -1, [])).toBe(d(4));
    });

    it("skips hidden weekdays in both directions", () => {
      // Fri 7 → Sat/Sun hidden → Mon 10, and back again.
      expect(nextVisibleDate(d(7), 1, [0, 6])).toBe(d(10));
      expect(nextVisibleDate(d(10), -1, [0, 6])).toBe(d(7));
    });

    it("ignores an all-seven hiddenDays, exactly as the rendered grid does", () => {
      // `hiddenWeekdays()` drops a set covering every weekday — `visibleDays` and `rowLength` render the full week
      // rather than nothing — so an arrow step lands one calendar day away instead of walking seven columns it
      // believes are hidden and landing eight days out.
      expect(nextVisibleDate(d(5), 1, [0, 1, 2, 3, 4, 5, 6])).toBe(d(6));
      expect(nextVisibleDate(d(5), -1, [0, 1, 2, 3, 4, 5, 6])).toBe(d(4));
    });

    it("drops weekday indices that can hide nothing", () => {
      // Duplicates and out-of-range entries never reach seven distinct weekdays, so they must not trip the all-seven
      // repair either.
      expect(nextVisibleDate(d(7), 1, [0, 0, 6, 6, 7, -1])).toBe(d(10));
    });
  });
});
