// Ported from HeroUI v3.2.6 packages/react/src/components/calendar-year-picker/use-calendar-state.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: RAC `CalendarStateContext` / `RangeCalendarStateContext` → the cdk tokens (`@rivetjs/cdk/calendar`); `use` → `useContext`.
import { CalendarStateContext, RangeCalendarStateContext } from "@rivetjs/cdk/calendar";
import type { AnyCalendarState } from "@rivetjs/cdk/state/calendar";
import { useContext } from "@rivetjs/reactivity";

/**
 * Returns the active Calendar or RangeCalendar state from RAC context.
 * Must be used inside <Calendar> or <RangeCalendar>.
 */
function useCalendarOrRangeState(): AnyCalendarState {
  const calendarState = useContext(CalendarStateContext);
  const rangeCalendarState = useContext(RangeCalendarStateContext);
  const state = calendarState ?? rangeCalendarState;

  if (!state) {
    throw new Error("useCalendarOrRangeState must be used within a <Calendar> or <RangeCalendar> component.");
  }

  return state;
}

export { useCalendarOrRangeState };
