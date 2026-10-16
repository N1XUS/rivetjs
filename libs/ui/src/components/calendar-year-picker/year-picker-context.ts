// Ported from HeroUI v3.2.6 packages/react/src/components/calendar-year-picker/year-picker-context.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `createContext` → `resumableContext(createContext(null, { id: "rv-ui-year-picker" }))` (re-created regions on a resumed page are
//   re-provided).
// - The value is a getter object built by Calendar / RangeCalendar: `isYearPickerOpen` reads the controllable state (readers see a
//   boolean, as upstream); `setIsYearPickerOpen` is an inline arrow over that state (resumable). `calendarRef` is a `ref()` signal
//   (accessor `() => element`) instead of a React `RefObject`. Rivet-only `isOpen` accessor: parts bind it (`data-open={() => …}`) so the
//   binding re-runs on change without re-creating the part.
import { createContext, useContext } from "@rivetjs/reactivity";
import { resumableContext } from "@rivetjs/runtime/resume-format";

/* -------------------------------------------------------------------------------------------------
 * YearPickerContext
 *
 * Context provided by Calendar (and RangeCalendar) to control year-picker visibility.
 * Internal child components consume this to toggle the year-picker open/close state,
 * keeping the public API clean and wrapper-free.
 * -----------------------------------------------------------------------------------------------*/
interface YearPickerContextValue {
  isYearPickerOpen: boolean;
  setIsYearPickerOpen: (open: boolean) => void;
  /** Rivet: the calendar root element (`ref()` signal; upstream `RefObject`). */
  calendarRef: () => HTMLDivElement | undefined;
  calendarGridSlot: "calendar-grid" | "range-calendar-grid";
  /** Rivet: accessor of `isYearPickerOpen` for bindings. @internal */
  isOpen: () => boolean;
}

const YearPickerContext = resumableContext(createContext<YearPickerContextValue | null>(null, { id: "rv-ui-year-picker" }));

/**
 * Hook to consume YearPickerContext.
 * Must be used inside Calendar or RangeCalendar.
 */
function useYearPicker(): YearPickerContextValue {
  const context = useContext(YearPickerContext);

  if (!context) {
    throw new Error("useYearPicker must be used within a <Calendar> or <RangeCalendar> component.");
  }

  return context;
}

export { YearPickerContext, useYearPicker };
export type { YearPickerContextValue };
