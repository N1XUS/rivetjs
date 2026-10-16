import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Text } from "@rivetjs/cdk/text";
import { RangeCalendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/range-calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "RangeCalendar: invalid, disabled, read-only" };

// #region demo
export default function States() {
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* The value ends after maxValue: invalid, the error message shows and describes the range. */}
        <RangeCalendar id="invalid" aria-label="Too long" defaultValue={{ start: "2026-10-20", end: "2026-10-28" }} maxValue="2026-10-25">
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
          <Text slot="errorMessage">Stays end by October 25.</Text>
        </RangeCalendar>
        <RangeCalendar id="readonly" aria-label="Read-only" defaultValue={{ start: "2026-10-05", end: "2026-10-07" }} isReadOnly>
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
        <RangeCalendar id="disabled" aria-label="Disabled" defaultValue={{ start: "2026-10-05", end: "2026-10-07" }} isDisabled>
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
      </main>
    </I18nProvider>
  );
}
// #endregion
