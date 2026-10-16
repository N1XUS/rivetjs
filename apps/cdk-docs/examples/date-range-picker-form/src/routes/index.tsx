import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateRangePicker } from "@rivetjs/cdk/date-picker";
import { Label } from "@rivetjs/cdk/label";
import { RangeFields, RangePopover } from "../components/RangePickerParts.tsx";
import { FieldError } from "@rivetjs/cdk/form";

export const head = { title: "DateRangePicker: forms" };

// #region demo
export default function Booking() {
  const submitted = signal("nothing yet");
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md gap-3 text-sm">
        <form
          id="booking"
          class="grid justify-items-start gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget as HTMLFormElement);
            submitted.set([...data].map(([key, value]) => key + "=" + value).join("&"));
          }}
        >
          {/* startName / endName: one hidden input per end. */}
          <DateRangePicker id="stay" startName="checkin" endName="checkout" isRequired defaultValue={{ start: "2026-10-14", end: "2026-10-18" }}>
            <Label>Stay</Label>
            <RangeFields />
            <FieldError />
            <RangePopover />
          </DateRangePicker>
          {/* Read-only: submitted. */}
          <DateRangePicker id="fixed" startName="from" endName="to" isReadOnly defaultValue={{ start: "2026-06-01", end: "2026-08-31" }}>
            <Label>Season (read-only)</Label>
            <RangeFields />
            <RangePopover />
          </DateRangePicker>
          {/* Disabled: not submitted. */}
          <DateRangePicker id="off" startName="x" endName="y" isDisabled defaultValue={{ start: "2026-01-01", end: "2026-01-02" }}>
            <Label>Disabled</Label>
            <RangeFields />
            <RangePopover />
          </DateRangePicker>
          <div class="flex gap-2">
            <button id="submit" type="submit" class="rounded border px-2 py-1">
              Submit
            </button>
            <button id="reset" type="reset" class="rounded border px-2 py-1">
              Reset
            </button>
          </div>
        </form>
        <p id="value" class="text-slate-600">
          Submitted: {submitted()}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
