import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateInput, DateSegment, TimeField, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";
import { FieldError } from "@rivetjs/cdk/form";

export const head = { title: "TimeField: forms" };

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
          {/* name: a hidden input posts the ISO time. isRequired: native validation blocks an empty submit. */}
          <TimeField id="time" name="time" isRequired>
            <Label>Appointment time</Label>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <FieldError />
          </TimeField>
          <TimeField id="end" name="end" defaultValue="17:00">
            <Label>Closing time</Label>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          </TimeField>
          <div class="flex gap-2">
            <button id="submit" type="submit" class="rounded border px-2 py-1">
              Submit
            </button>
            {/* A form reset restores every field's defaultValue. */}
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
