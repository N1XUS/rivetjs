// Ported from react-spectrum (Apache-2.0, © Adobe): @react-aria/i18n `useDateFormatter` cache.
// Rivet: leaf of `./index.ts` (re-exported there) so `useLocale` callers do not import the date formatter.
import { DateFormatter } from "../date/DateFormatter.ts";

const formatters = new Map<string, DateFormatter>();
/** Cached `DateFormatter` for `locale` + `options` (react-aria `useDateFormatter`). */
export function getDateFormatter(locale: string, options: Intl.DateTimeFormatOptions = {}): DateFormatter {
  const key = locale + JSON.stringify(options);
  let formatter = formatters.get(key);
  if (!formatter) {
    if (formatters.size > 256) formatters.clear();
    formatters.set(key, (formatter = new DateFormatter(locale, options)));
  }
  return formatter;
}
