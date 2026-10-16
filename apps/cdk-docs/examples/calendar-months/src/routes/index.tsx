import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid, CalendarHeading } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: visible duration" };

// #region demo
export default function Months() {
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* Two months: one CalendarHeading + CalendarGrid per month, offset by { months: 1 }.
            The buttons page by both months (pageBehavior "visible", the default). */}
        <Calendar id="two" aria-label="Two months" defaultValue="2026-10-14" visibleDuration={{ months: 2 }}>
          <div class="months">
            <div class="month">
              <header>
                <Button slot="previous">
                  <Icon icon={ChevronLeft} />
                </Button>
                <CalendarHeading />
              </header>
              <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
            </div>
            <div class="month">
              <header>
                <CalendarHeading offset={{ months: 1 }} />
                <Button slot="next">
                  <Icon icon={ChevronRight} />
                </Button>
              </header>
              <CalendarGrid offset={{ months: 1 }}>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
            </div>
          </div>
        </Calendar>
        {/* pageBehavior "single": one month per page. One Heading (the visible range) above both grids. */}
        <Calendar id="single" aria-label="Paged by one" defaultValue="2026-10-14" visibleDuration={{ months: 2 }} pageBehavior="single">
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            <Heading />
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          <div class="months">
            <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
            <CalendarGrid offset={{ months: 1 }}>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
          </div>
        </Calendar>
        {/* Three months with the value in the last one. */}
        <Calendar id="end" aria-label="Aligned end" defaultValue="2026-10-14" visibleDuration={{ months: 3 }} selectionAlignment="end">
          <header>
            <Button slot="previous">
              <Icon icon={ChevronLeft} />
            </Button>
            <Heading />
            <Button slot="next">
              <Icon icon={ChevronRight} />
            </Button>
          </header>
          <div class="months">
            <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
            <CalendarGrid offset={{ months: 1 }}>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
            <CalendarGrid offset={{ months: 2 }}>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
          </div>
        </Calendar>
        {/* One week: a single row; Home / End go to the ends of the week. */}
        <Calendar id="week" aria-label="This week" defaultValue="2026-10-14" visibleDuration={{ weeks: 1 }}>
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
        </Calendar>
      </main>
    </I18nProvider>
  );
}
// #endregion
