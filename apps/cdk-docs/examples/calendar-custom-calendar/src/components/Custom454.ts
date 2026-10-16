// The 4-5-4 retail calendar of the @internationalized/date docs ("Custom calendars"; react-spectrum, Apache-2.0, © Adobe).
import { CalendarDate, GregorianCalendar, startOfWeek, type AnyCalendarDate, type Calendar } from "@rivetjs/cdk/date";

/** Fiscal months of 4, 5 and 4 weeks; the year starts in the week of February 4. */
export class Custom454 extends GregorianCalendar {
  // The anchor date, in Gregorian calendar: it occurs in the first week of the first month of every fiscal year.
  anchorDate = new CalendarDate(2001, 2, 4);

  private getYear(year: number): [CalendarDate, number[]] {
    const anchor = this.anchorDate.set({ year });
    const startOfYear = startOfWeek(anchor, "en", "sun");
    const isBigYear = !startOfYear.add({ weeks: 53 }).compare(anchor.add({ years: 1 }));
    const weekPattern = [4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5, isBigYear ? 5 : 4];
    return [startOfYear, weekPattern];
  }

  override getDaysInMonth(date: AnyCalendarDate): number {
    const [, weekPattern] = this.getYear(date.year);
    return weekPattern[date.month - 1]! * 7;
  }

  override fromJulianDay(jd: number): CalendarDate {
    const gregorian = super.fromJulianDay(jd);
    let year = gregorian.year;
    let [monthStart, weekPattern] = this.getYear(year);
    if (gregorian.compare(monthStart) < 0) {
      year--;
      [monthStart, weekPattern] = this.getYear(year);
    }
    for (let month = 1; month <= 12; month++) {
      const nextMonth = monthStart.add({ weeks: weekPattern[month - 1]! });
      if (nextMonth.compare(gregorian) > 0) return new CalendarDate(this, year, month, gregorian.compare(monthStart) + 1);
      monthStart = nextMonth;
    }
    throw new Error("date not found");
  }

  override toJulianDay(date: AnyCalendarDate): number {
    let [monthStart, weekPattern] = this.getYear(date.year);
    for (let month = 1; month < date.month; month++) monthStart = monthStart.add({ weeks: weekPattern[month - 1]! });
    return super.toJulianDay(monthStart.add({ days: date.day - 1 }));
  }

  getFormattableMonth(date: AnyCalendarDate): CalendarDate {
    const anchorMonth = this.anchorDate.month - 1;
    const dateMonth = date.month - 1;
    const month = ((anchorMonth + dateMonth) % 12) + 1;
    const year = anchorMonth + dateMonth >= 12 ? date.year + 1 : date.year;
    return new CalendarDate(year, month, 1);
  }

  isEqual(other: Calendar): boolean {
    return other instanceof Custom454 && other.anchorDate.compare(this.anchorDate) === 0;
  }
}
