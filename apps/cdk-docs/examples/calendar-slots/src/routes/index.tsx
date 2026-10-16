import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Text } from "@rivetjs/cdk/text";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: slots" };

// #region demo
export default function Slots() {
  return (
    <I18nProvider locale="en-US">
      <main>
        <section>
          {/* aria-labelledby: a visible heading names the calendar and its grids. */}
          <h3 id="trip-label">Departure</h3>
          <Calendar id="cal" aria-labelledby="trip-label" defaultValue="2026-10-14" isInvalid>
            <header>
              {/* Button slots: any content; the localized aria-label stays. */}
              <Button slot="previous" class="arrow">
                <Icon icon={ChevronLeft} /> Prev
              </Button>
              {/* Heading: the visible range. */}
              <Heading />
              <Button slot="next" class="arrow">
                Next <Icon icon={ChevronRight} />
              </Button>
            </header>
            <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
            {/* Text slot="errorMessage": gets an id; invalid cells point at it with aria-describedby. */}
            <Text slot="errorMessage">
              <strong>Sold out.</strong> Pick another day.
            </Text>
          </Calendar>
        </section>
      </main>
    </I18nProvider>
  );
}
// #endregion
