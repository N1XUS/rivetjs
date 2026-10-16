import { signal } from "@rivetjs/reactivity";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "DateField: forms" };

// #region demo
export default function Signup() {
  const submitted = signal("nothing yet");
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md gap-3 text-sm">
        <form
          id="signup"
          class="grid justify-items-start gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget as HTMLFormElement);
            submitted.set([...data].map(([key, value]) => key + "=" + value).join("&"));
          }}
        >
          {/* name: a hidden input posts the ISO string. isRequired: native validation blocks an empty submit. */}
          <DateField id="birthday" name="birthday" isRequired defaultValue="1999-12-24" autoFocus>
            <Label>Birthday</Label>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          </DateField>
          <DateField id="start" name="start" defaultValue="2026-10-14">
            <Label>Start</Label>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
          </DateField>
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
        {/* form: belong to a form elsewhere in the page, by its id. */}
        <DateField id="remote" name="remote" form="signup" defaultValue="2026-12-01">
          <Label>Outside the form</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        <p id="value" class="text-slate-600">
          Submitted: {submitted()}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
