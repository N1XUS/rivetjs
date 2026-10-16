import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateRangePicker, type DateValue, type RangeValue } from "@rivetjs/cdk/date-picker";
import { Label } from "@rivetjs/cdk/label";
import { FieldError, Form } from "@rivetjs/cdk/form";
import { RangeFields, RangePopover } from "../components/RangePickerParts.tsx";

export const head = { title: "DateRangePicker: validation" };

// #region demo
export default function Validation() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
        {/* Native validation (default): both inputs are required; the error shows on submit (Form). */}
        <Form id="trip-form" class="grid justify-items-start gap-2" onSubmit={(event) => event.preventDefault()}>
          <DateRangePicker id="trip" startName="from" endName="to" isRequired placeholderValue="2026-10-14">
            <Label>Trip dates</Label>
            <RangeFields />
            <FieldError />
            <RangePopover />
          </DateRangePicker>
          <button id="submit" type="submit" class="rounded border px-2 py-1">
            Submit
          </button>
        </Form>
        {/* validationBehavior="aria": errors show as soon as the value is invalid, server-rendered too. */}
        <DateRangePicker
          id="october"
          defaultValue={{ start: "2026-10-26", end: "2026-11-03" }}
          minValue="2026-10-01"
          maxValue="2026-10-31"
          validationBehavior="aria"
        >
          <Label>October only</Label>
          <RangeFields />
          <FieldError />
          <RangePopover />
        </DateRangePicker>
        <DateRangePicker id="reversed" defaultValue={{ start: "2026-10-20", end: "2026-10-10" }} validationBehavior="aria">
          <Label>Reversed</Label>
          <RangeFields />
          <FieldError />
          <RangePopover />
        </DateRangePicker>
        {/* validate: gets the range of date objects; return a message when invalid. */}
        <DateRangePicker
          id="short"
          defaultValue={{ start: "2026-10-01", end: "2026-10-20" }}
          validate={(range: RangeValue<DateValue>) => (range && range.end.compare(range.start) > 14 ? "At most 14 nights." : null)}
          validationBehavior="aria"
        >
          <Label>Short stay</Label>
          <RangeFields />
          <FieldError />
          <RangePopover />
        </DateRangePicker>
        {/* FieldError children: a function of the validation result (accessors). */}
        <DateRangePicker id="custom" defaultValue={{ start: "2026-09-28", end: "2026-10-02" }} minValue="2026-10-01" validationBehavior="aria">
          <Label>Custom message</Label>
          <RangeFields />
          <FieldError>{({ validationDetails }) => (validationDetails().rangeUnderflow ? "Bookings open on October 1." : "Invalid range")}</FieldError>
          <RangePopover />
        </DateRangePicker>
      </section>
    </I18nProvider>
  );
}
// #endregion
