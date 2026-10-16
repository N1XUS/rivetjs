import type { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DatePicker } from "@rivetjs/cdk/date-picker";
import { DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { Calendar, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader, CalendarHeaderCell, CalendarHeading } from "@rivetjs/cdk/calendar";
import { Group } from "@rivetjs/cdk/group";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "DatePicker: content" };

// #region demo
export default function Content() {
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-md justify-items-start gap-4 text-sm">
        {/* Label and description take any content; the button holds an icon (it keeps its "Calendar" name). */}
        <DatePicker id="rich" defaultValue="2026-10-14">
          <Label>
            Check-in <em class="text-slate-500">(required)</em>
          </Label>
          <Group>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <Button>
              <Icon icon={CalendarDays} />
            </Button>
          </Group>
          <Text slot="description">
            Times are <strong>local</strong> to the hotel.
          </Text>
          <Popover>
            <Dialog>
              {/* Any Calendar composition: two months, one heading per month, custom header and day cells. */}
              <Calendar visibleDuration={{ months: 2 }}>
                <div class="months">
                  <div>
                    <header>
                      <Button slot="previous">
                        <Icon icon={ChevronLeft} />
                      </Button>
                      <CalendarHeading />
                    </header>
                    <CalendarGrid>
                      <CalendarGridHeader>{(day: string) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}</CalendarGridHeader>
                      <CalendarGridBody>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGridBody>
                    </CalendarGrid>
                  </div>
                  <div>
                    <header>
                      <CalendarHeading offset={{ months: 1 }} />
                      <Button slot="next">
                        <Icon icon={ChevronRight} />
                      </Button>
                    </header>
                    <CalendarGrid offset={{ months: 1 }}>
                      <CalendarGridHeader>{(day: string) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}</CalendarGridHeader>
                      <CalendarGridBody>{(day: CalendarDate) => <CalendarCell date={day} />}</CalendarGridBody>
                    </CalendarGrid>
                  </div>
                </div>
              </Calendar>
            </Dialog>
          </Popover>
        </DatePicker>
        {/* No visible label: aria-label names the group, the segments and the dialog. A text button. */}
        <DatePicker id="bare" aria-label="Reminder date" defaultValue="2026-10-14">
          <Group>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <Button>Pick</Button>
          </Group>
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
      </section>
    </I18nProvider>
  );
}
// #endregion
