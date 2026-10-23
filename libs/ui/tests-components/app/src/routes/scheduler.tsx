// Scheduler UI: production-resume fixture with string dates, live appearance and portal checks.
import { signal } from "@rivetjs/reactivity";
import { Scheduler, type SchedulerEvent, type SchedulerView } from "@rivetjs/ui/scheduler";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";

const initial: SchedulerEvent[] = [
  { id: "span", title: "Team offsite", start: "2031-03-03", end: "2031-03-06", allDay: true, color: "accent" },
  { id: "a", title: "Design review", start: "2031-03-04T09:00", end: "2031-03-04T10:30", color: "accent" },
  { id: "b", title: "Launch planning", start: "2031-03-04T10:00", end: "2031-03-04T11:00", color: "success" },
  { id: "c", title: "Customer research", start: "2031-03-04T12:00", end: "2031-03-04T13:00", color: "warning" },
  { id: "d", title: "Release checkpoint", start: "2031-03-04T14:00", end: "2031-03-04T15:00", color: "danger" },
  { id: "e", title: "Focus time", start: "2031-03-04T15:00", end: "2031-03-04T16:00", color: "default" },
  { id: "f", title: "Partner sync", start: "2031-03-04T16:00", end: "2031-03-04T17:00", cssColor: "#8055cf" },
  { id: "g", title: "Team retro", start: "2031-03-04T17:00", end: "2031-03-04T18:00", color: "success" },
];

export default function SchedulerStory() {
  const events = signal<readonly SchedulerEvent[]>(initial);
  const date = signal("2031-03-04");
  const view = signal<SchedulerView>("month");
  const density = signal<"compact" | "default" | "comfortable">("default");
  const variant = signal<"default" | "secondary">("default");
  const dark = signal(false);
  const rtl = signal(false);
  const toolbar = signal(true);
  const locale = signal("en-US");
  const custom = signal("first-override");
  const menuActions = signal(0);
  const hiddenDays = signal<number[]>([]);
  return (
    <section
      id="scheduler-story"
      data-ui-theme="rivet"
      data-theme={dark() ? "dark" : "light"}
      dir={rtl() ? "rtl" : "ltr"}
      lang={rtl() ? "ar" : "en"}
      class="min-h-screen bg-background p-6 text-foreground"
    >
      <div class="mb-4 flex flex-wrap gap-2">
        <Button id="compact" size="sm" onPress={() => density.set("compact")}>
          Compact
        </Button>
        <Button id="comfortable" size="sm" onPress={() => density.set("comfortable")}>
          Comfortable
        </Button>
        <Button id="secondary" size="sm" onPress={() => variant.set(variant() === "default" ? "secondary" : "default")}>
          Surface
        </Button>
        <Button id="dark" size="sm" onPress={() => dark.set(!dark())}>
          Dark
        </Button>
        <Button id="rtl" size="sm" onPress={() => rtl.set(!rtl())}>
          RTL
        </Button>
        <Button id="toolbar" size="sm" onPress={() => toolbar.set(!toolbar())}>
          Toolbar
        </Button>
        <Button id="locale" size="sm" onPress={() => locale.set(locale() === "en-US" ? "fr-FR" : "en-US")}>
          Locale
        </Button>
        <Button id="classes" size="sm" onPress={() => custom.set("second-override")}>
          Classes
        </Button>
        <Button id="hidden-days" size="sm" onPress={() => hiddenDays.set(hiddenDays().length ? [] : [0, 6])}>
          Hide weekends
        </Button>
        <Button id="jump-date" size="sm" onPress={() => date.set(date().startsWith("2031-04") ? "2031-03-04" : "2031-04-04")}>
          Jump date
        </Button>
      </div>
      <output id="menu-actions">{String(menuActions())}</output>
      <output id="scheduler-event-count">{String(events().length)}</output>
      <Scheduler
        id="agenda"
        aria-label="Team schedule"
        events={events}
        date={date}
        view={view}
        density={density()}
        variant={variant()}
        toolbar={toolbar()}
        locale={locale()}
        timeZone="UTC"
        firstDayOfWeek="mon"
        minTime="08:00"
        maxTime="20:00"
        businessHours={{ start: "09:00", end: "17:00" }}
        showWeekNumbers
        hiddenDays={hiddenDays()}
        classNames={{ cell: custom(), slot: custom(), event: custom(), morePanel: custom(), menu: custom() }}
        renderSlotMenu={() => (
          <Dropdown.Item id="create" onAction={() => menuActions.set(menuActions() + 1)}>
            Create event
          </Dropdown.Item>
        )}
        renderEventMenu={(event) => (
          <Dropdown.Item id="inspect" onAction={() => menuActions.set(menuActions() + 1)}>
            {"Inspect " + event.title}
          </Dropdown.Item>
        )}
      />
    </section>
  );
}
