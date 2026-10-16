import { signal } from "@rivetjs/reactivity";
import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: disabled and read-only" };

// #region demo
export default function States() {
  const fixed = signal<string | null>("2026-10-14");
  return (
    <I18nProvider locale="en-US">
      <main>
        {/* isDisabled: no tab stop, every cell and both page buttons disabled. */}
        <Calendar id="disabled" aria-label="Disabled" defaultValue="2026-10-14" isDisabled>
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
        {/* isReadOnly: focus and paging work, the value never changes. */}
        <div>
          <Calendar id="readonly" aria-label="Read-only" value={fixed} isReadOnly>
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
          <output id="value">Value: {fixed()}</output>
        </div>
      </main>
    </I18nProvider>
  );
}
// #endregion
