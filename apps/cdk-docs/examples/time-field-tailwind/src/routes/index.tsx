import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateInput, DateSegment, TimeField, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";

export const head = { title: "TimeField: Tailwind" };

// `class` replaces the rv-* default; style states with data-* variants or render-prop functions.
const input =
  "inline-flex w-fit items-center rounded-md border border-slate-300 bg-white px-2 py-1 shadow-sm focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/30 data-[invalid]:border-red-600 data-[disabled]:opacity-50";

// #region demo
export default function Styled() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm gap-4 text-sm">
        <TimeField id="tw" placeholderValue="08:00" class="group grid gap-1">
          <Label class="font-medium text-slate-700">Departure time</Label>
          <DateInput class={input}>
            {(segment: DateSegmentItem) => (
              <DateSegment
                segment={segment}
                // A render-prop function: the states are accessors.
                class={({ isPlaceholder, type }) =>
                  "rounded px-0.5 tabular-nums outline-none focus:bg-teal-600 focus:text-white " +
                  (isPlaceholder() ? "text-slate-400" : "") +
                  (type === "literal" ? " px-0" : "")
                }
              />
            )}
          </DateInput>
          <Text slot="description" class="text-xs text-slate-500">
            Type or spin a time.
          </Text>
        </TimeField>
        <TimeField id="tw-bad" defaultValue="23:30" maxValue="22:00" validationBehavior="aria" class="group grid gap-1">
          <Label class="font-medium text-slate-700">Last call</Label>
          <DateInput class={input}>
            {(segment: DateSegmentItem) => (
              <DateSegment segment={segment} class="rounded px-0.5 tabular-nums outline-none focus:bg-teal-600 focus:text-white data-[invalid]:text-red-700" />
            )}
          </DateInput>
          <FieldError class="text-xs text-red-700" />
        </TimeField>
      </section>
    </I18nProvider>
  );
}
// #endregion
