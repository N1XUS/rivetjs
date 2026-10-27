// DatePicker opening must not scroll the page (UI-BUGS 2026-10-27, ui-docs home "Book a demo" tile): a static route (no
// signal: the picker is its own boundary, as on the home), tall content around it. `#dps-portal`: overlays portal into
// `#dps-overlays` (an in-flow div at the top of the panel, `PortalProvider`, as the home collage); `#dps-body`: body portal.
import { PortalProvider } from "@rivetjs/cdk/portal";
import { parseDate } from "@rivetjs/cdk/date";
import { Calendar } from "@rivetjs/ui/calendar";
import { Card } from "@rivetjs/ui/card";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "DatePicker scroll" };

function Picker(props: { id: string }) {
  return (
    <Card id={props.id} class="w-80">
      <Card.Header>
        <Card.Title>Book a demo</Card.Title>
      </Card.Header>
      <DatePicker name={props.id} defaultValue={parseDate("2026-11-12")} class="w-full">
        <Label>Date</Label>
        <DateField.Group fullWidth>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          <Calendar aria-label="Demo date">
            <Calendar.Header>
              <Calendar.Heading />
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </Card>
  );
}

export default function DatePickerScroll() {
  return (
    <div class="bg-background p-10 text-foreground">
      <div style={{ height: "1400px" }}>Above</div>
      <div class="rounded-3xl border p-6">
        <div id="dps-overlays" />
        <PortalProvider container="#dps-overlays">
          <div style={{ height: "900px" }}>Collage</div>
          <Picker id="dps-portal" />
        </PortalProvider>
      </div>
      <div style={{ height: "600px" }}>Between</div>
      <Picker id="dps-body" />
      <div style={{ height: "1600px" }}>Below</div>
    </div>
  );
}
