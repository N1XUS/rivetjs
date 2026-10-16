import { signal } from "@rivetjs/reactivity";
import { GregorianCalendar, JapaneseCalendar, type CalendarDate, type CalendarIdentifier } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Calendar: locales and calendar systems" };

// #region demo
export default function Locales() {
  // Values stay Gregorian ISO strings whatever calendar the locale displays.
  const hijri = signal<string | null>("2026-10-14");
  // createCalendar: only the calendar systems you return get bundled (a local const resumes).
  const japanese = (id: CalendarIdentifier) => (id === "japanese" ? new JapaneseCalendar() : new GregorianCalendar());
  return (
    <main>
      {/* The nearest I18nProvider sets language, week start, digits and (-u-ca-) calendar system. */}
      <I18nProvider locale="de-DE">
        <Calendar id="de" aria-label="Datum" defaultValue="2026-10-14">
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
      </I18nProvider>
      <div>
        <I18nProvider locale="ar-EG-u-ca-islamic-umalqura">
          <Calendar id="islamic" aria-label="Hijri" value={hijri}>
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
        </I18nProvider>
        <output id="hijri-value">Value: {hijri()}</output>
      </div>
      <I18nProvider locale="ja-JP-u-ca-japanese">
        <Calendar id="ja" aria-label="和暦" defaultValue="2026-10-14" createCalendar={japanese}>
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
      </I18nProvider>
      {/* Arrow keys follow the reading direction of the nearest dir ancestor (the chevrons are yours to mirror). */}
      <div dir="rtl">
        <I18nProvider locale="he-IL">
          <Calendar id="he" aria-label="תאריך" defaultValue="2026-10-14">
            <header>
              <Button slot="previous">
                <Icon icon={ChevronRight} />
              </Button>
              <Heading />
              <Button slot="next">
                <Icon icon={ChevronLeft} />
              </Button>
            </header>
            <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
          </Calendar>
        </I18nProvider>
      </div>
    </main>
  );
}
// #endregion
