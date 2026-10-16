import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DatePicker } from "@rivetjs/cdk/date-picker";
import { DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { Group } from "@rivetjs/cdk/group";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Label } from "@rivetjs/cdk/label";
import { FieldError } from "@rivetjs/cdk/form";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DatePicker: plain CSS" };

// #region demo
export default function Plain() {
  return (
    <I18nProvider locale="en-US">
      <main>
        <DatePicker id="css" defaultValue="2026-10-14" minValue="2026-10-05" validationBehavior="aria">
          <Label>Check-in</Label>
          <Group>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <Button>
              <Icon icon={ChevronDown} />
            </Button>
          </Group>
          <FieldError />
          <Popover>
            <Dialog>
              <Calendar>
                <header>
                  <Button slot="previous">
                    <Icon icon={ChevronLeft} />
                  </Button>
                  <Heading />
                  <Button slot="next">
                    <Icon icon={ChevronRight} />
                  </Button>
                </header>
                <CalendarGrid>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGrid>
              </Calendar>
            </Dialog>
          </Popover>
        </DatePicker>
      </main>
    </I18nProvider>
  );
}
// #endregion
