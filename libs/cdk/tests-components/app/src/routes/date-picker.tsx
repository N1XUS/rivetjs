import { signal } from "@rivetjs/reactivity";
import { DatePicker, DateRangePicker } from "@rivetjs/cdk/date-picker";
import { DateField, DateInput, DateSegment, TimeField, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Calendar, CalendarCell, CalendarGrid, RangeCalendar } from "@rivetjs/cdk/calendar";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Group } from "@rivetjs/cdk/group";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { Heading } from "@rivetjs/cdk/heading";
import { FieldError } from "@rivetjs/cdk/form";
import type { CalendarDate } from "@rivetjs/cdk/date";

export const head = { title: "DatePicker" };

/** RAC DatePicker anatomy below the label (group with the field + button, popover dialog with a calendar). */
function PickerBody() {
  return (
    <>
      <Group>
        <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        <Button />
      </Group>
      <Popover>
        <Dialog>
          <Calendar />
        </Dialog>
      </Popover>
    </>
  );
}

/** RAC DateRangePicker anatomy below the label. */
function RangePickerBody() {
  return (
    <>
      <Group>
        <DateInput slot="start">{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        <span aria-hidden="true">–</span>
        <DateInput slot="end">{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        <Button />
      </Group>
      <Popover>
        <Dialog>
          <RangeCalendar />
        </Dialog>
      </Popover>
    </>
  );
}

/** RAC anatomy of the pickers (explicit parts: labels, descriptions and errors are children). */
export default function DatePickerStory() {
  const date = signal<string | null>(null);
  const range = signal<{ start: string; end: string } | null>(null);
  const time = signal<string | null>(null);
  return (
    <I18nProvider locale="en-US">
      <section>
        <h1>DatePicker</h1>
        <DatePicker id="dp" value={date} name="birthday" placeholderValue="2019-02-15">
          <Label>Birth date</Label>
          <Group>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <Button />
          </Group>
          <Text slot="description">Description</Text>
          <Popover>
            <Dialog>
              <Calendar>
                <header>
                  <Button slot="previous" />
                  <Heading />
                  <Button slot="next" />
                </header>
                <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
              </Calendar>
            </Dialog>
          </Popover>
        </DatePicker>
        <p id="dp-out">Value: {date() ?? "none"}</p>
        <DatePicker id="dp-sel" defaultValue="2019-02-03">
          <Label>Selected</Label>
          <PickerBody />
        </DatePicker>
        <DatePicker id="dp-keep" defaultValue="2019-02-03" shouldCloseOnSelect={false}>
          <Label>Keep open</Label>
          <PickerBody />
        </DatePicker>
        <DatePicker id="dp-time" granularity="minute" shouldCloseOnSelect={false} placeholderValue="2019-02-03T00:00">
          <Label>Meeting</Label>
          <PickerBody />
        </DatePicker>
        <DatePicker id="dp-disabled" isDisabled>
          <Label>Disabled</Label>
          <PickerBody />
        </DatePicker>
        <DatePicker id="dp-min" minValue="2023-01-01" defaultValue="2020-02-03" validationBehavior="aria">
          <Label>Bounded</Label>
          <Group>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <Button />
          </Group>
          <FieldError>Too early</FieldError>
          <Popover>
            <Dialog>
              <Calendar />
            </Dialog>
          </Popover>
        </DatePicker>
        <form id="dp-form" action="/date-picker" method="get">
          <DatePicker id="dp-req" name="date" isRequired>
            <Label>Required</Label>
            <Group>
              <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
              <Button />
            </Group>
            <FieldError />
            <Popover>
              <Dialog>
                <Calendar />
              </Dialog>
            </Popover>
          </DatePicker>
          <button id="dp-submit" type="submit">
            Submit
          </button>
        </form>
        <h2>DateRangePicker</h2>
        <DateRangePicker id="drp" value={range} startName="start" endName="end" placeholderValue="2019-02-15">
          <Label>Trip dates</Label>
          <RangePickerBody />
        </DateRangePicker>
        <p id="drp-out">Range: {range() ? range()!.start + ".." + range()!.end : "none"}</p>
        <DateRangePicker id="drp-sel" defaultValue={{ start: "2023-01-10", end: "2023-01-20" }} startName="s" endName="e" form="test">
          <Label>Stay</Label>
          <RangePickerBody />
        </DateRangePicker>
        <DateRangePicker id="drp-keep" defaultValue={{ start: "2023-01-10", end: "2023-01-20" }} shouldCloseOnSelect={false}>
          <Label>Keep open</Label>
          <RangePickerBody />
        </DateRangePicker>
        <DateRangePicker id="drp-time" granularity="second" placeholderValue="2023-01-10T00:00:00">
          <Label>Times</Label>
          <RangePickerBody />
        </DateRangePicker>
        <DateRangePicker id="drp-disabled" isDisabled>
          <Label>Disabled range</Label>
          <RangePickerBody />
        </DateRangePicker>
        <form id="drp-form" action="/date-picker" method="get">
          <DateRangePicker id="drp-req" startName="from" endName="to" isRequired>
            <Label>Required range</Label>
            <Group>
              <DateInput slot="start">{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
              <span aria-hidden="true">–</span>
              <DateInput slot="end">{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
              <Button />
            </Group>
            <FieldError />
            <Popover>
              <Dialog>
                <RangeCalendar />
              </Dialog>
            </Popover>
          </DateRangePicker>
          <button id="drp-submit" type="submit">
            Submit
          </button>
        </form>
        <h2>DateField</h2>
        <DateField id="df" defaultValue="2020-02-03">
          <Label>Appointment</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </DateField>
        <h2>TimeField</h2>
        <TimeField id="tf" value={time} name="time">
          <Label>Start time</Label>
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
        </TimeField>
        <p id="tf-out">Time: {time() ?? "none"}</p>
        <div class="spacer"></div>
      </section>
    </I18nProvider>
  );
}
