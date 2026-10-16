// Ported from @internationalized/date src/index.ts (react-spectrum), Apache-2.0, © Adobe.
// Changes: .ts import specifiers, type-only imports, override modifiers, strict-mode index types.
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export type {
  AnyCalendarDate,
  AnyTime,
  AnyDateTime,
  Calendar,
  CalendarIdentifier,
  DateDuration,
  TimeDuration,
  DateTimeDuration,
  DateFields,
  TimeFields,
  DateField,
  TimeField,
  Disambiguation,
  CycleOptions,
  CycleTimeOptions
} from './types.ts';
export type {DateValue} from './CalendarDate.ts';
export type {DayOfWeek} from './queries.ts';

export {CalendarDate, CalendarDateTime, Time, ZonedDateTime} from './CalendarDate.ts';
export {GregorianCalendar} from './calendars/GregorianCalendar.ts';
export {JapaneseCalendar} from './calendars/JapaneseCalendar.ts';
export {BuddhistCalendar} from './calendars/BuddhistCalendar.ts';
export {TaiwanCalendar} from './calendars/TaiwanCalendar.ts';
export {PersianCalendar} from './calendars/PersianCalendar.ts';
export {IndianCalendar} from './calendars/IndianCalendar.ts';
export {
  IslamicCivilCalendar,
  IslamicTabularCalendar,
  IslamicUmalquraCalendar
} from './calendars/IslamicCalendar.ts';
export {HebrewCalendar} from './calendars/HebrewCalendar.ts';
export {
  EthiopicCalendar,
  EthiopicAmeteAlemCalendar,
  CopticCalendar
} from './calendars/EthiopicCalendar.ts';
export {createCalendar} from './createCalendar.ts';
export {
  toCalendarDate,
  toCalendarDateTime,
  toTime,
  toCalendar,
  toZoned,
  toTimeZone,
  toLocalTimeZone,
  fromDate,
  fromDateToLocal,
  fromAbsolute
} from './conversion.ts';
export {
  isSameDay,
  isSameMonth,
  isSameYear,
  isEqualDay,
  isEqualMonth,
  isEqualYear,
  isToday,
  getDayOfWeek,
  now,
  today,
  getHoursInDay,
  getLocalTimeZone,
  setLocalTimeZone,
  resetLocalTimeZone,
  startOfMonth,
  startOfWeek,
  startOfYear,
  endOfMonth,
  endOfWeek,
  endOfYear,
  getMinimumMonthInYear,
  getMinimumDayInMonth,
  getWeeksInMonth,
  minDate,
  maxDate,
  isWeekend,
  isWeekday,
  isEqualCalendar
} from './queries.ts';
export {
  parseDate,
  parseDateTime,
  parseTime,
  parseAbsolute,
  parseAbsoluteToLocal,
  parseZonedDateTime,
  parseDuration
} from './string.ts';
export {DateFormatter} from './DateFormatter.ts';

// Rivet addition: string forms of date values for resumable state.
export {stringifyDateValue, parseDateValue, toDateValueString} from './serialize.ts';
export type {AnyDateValue, AnyTimeValue, DateValueString} from './serialize.ts';
