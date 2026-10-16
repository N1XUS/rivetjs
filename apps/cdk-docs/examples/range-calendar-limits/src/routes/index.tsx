import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: limits and unavailable dates" };

// #region demo
export default function Limits() {
  const contiguous = signal<{ start: string; end: string } | null>(null);
  const spanning = signal<{ start: string; end: string } | null>(null);
  return (
    <I18nProvider locale="en-US">
      <main>
        <div>
          {/* The 14th is booked: once a start is picked, the range cannot cross it. */}
          <RangeCalendar
            id="contiguous"
            aria-label="Contiguous"
            value={contiguous}
            defaultFocusedValue="2026-10-12"
            minValue="2026-10-05"
            maxValue="2026-10-30"
            isDateUnavailable={(date) => date.day === 14}
          >
            <header>
              <Button slot="previous">
                <Icon icon={ChevronLeft} />
              </Button>
              <Heading />
              <Button slot="next">
                <Icon icon={ChevronRight} />
              </Button>
            </header>
            <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
          </RangeCalendar>
          <output id="contiguous-value">{contiguous() ? contiguous()!.start + " → " + contiguous()!.end : "none"}</output>
        </div>
        <div>
          {/* allowsNonContiguousRanges: the range may span the booked day (which stays unselected). */}
          <RangeCalendar
            id="spanning"
            aria-label="Spanning"
            value={spanning}
            defaultFocusedValue="2026-10-12"
            isDateUnavailable={(date) => date.day === 14}
            allowsNonContiguousRanges
          >
            <header>
              <Button slot="previous">
                <Icon icon={ChevronLeft} />
              </Button>
              <Heading />
              <Button slot="next">
                <Icon icon={ChevronRight} />
              </Button>
            </header>
            <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
          </RangeCalendar>
          <output id="spanning-value">{spanning() ? spanning()!.start + " → " + spanning()!.end : "none"}</output>
        </div>
      </main>
    </I18nProvider>
  );
}
// #endregion
