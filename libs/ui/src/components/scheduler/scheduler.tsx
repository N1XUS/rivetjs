// Rivet-authored Scheduler presentation; all state, interaction, layout and accessibility come from the CDK.
import {
  Scheduler as SchedulerPrimitive,
  type SchedulerProps as SchedulerPrimitiveProps,
  type SchedulerHeaderApi,
  type SchedulerClassNames as CdkClasses,
} from "@rivetjs/cdk/scheduler";
import { Icon } from "@rivetjs/kit/icon";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide";
import { Show } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { schedulerVariants, type SchedulerVariants } from "../../../styles/src/components/scheduler/index.ts";
import { Button } from "../button/index.ts";
import { ButtonGroup } from "../button-group/index.ts";
import { Segment } from "../segment/index.ts";
import { splitLive } from "../../utils/live.tsx";
import { portalTheme } from "../../utils/portal-theme.ts";

export type SchedulerClassNames = CdkClasses & { base?: string };
export interface SchedulerProps<T = unknown> extends Omit<SchedulerPrimitiveProps<T>, "classNames">, SchedulerVariants {
  /** Classes merged into the tv slots, including overflow and context-menu portals. */
  classNames?: SchedulerClassNames;
}

type Slots = ReturnType<typeof schedulerVariants>;
const SLOTS: Record<string, Slots> = {};
const slotsFor = (variant: SchedulerVariants["variant"], density: SchedulerVariants["density"]): Slots =>
  (SLOTS[`${variant}|${density}`] ??= schedulerVariants({ variant, density }));

/** Thin typed wrapper: CDK owns the semantics; density changes both server lane packing and CSS geometry. */
export function Scheduler<T = unknown>(props: SchedulerProps<T>): JSX.Element {
  portalTheme();
  const [local, rest] = splitLive(props, ["class", "classNames", "variant", "density", "visibleLanes", "toolbar", "renderHeader"]);
  const slots = () => slotsFor(local.variant, local.density);
  const visibleLanes = () => {
    const value = typeof local.visibleLanes === "function" ? local.visibleLanes() : local.visibleLanes;
    return value === undefined || value === "auto" ? (local.density === "compact" ? 3 : local.density === "comfortable" ? 5 : 4) : value;
  };
  const classes = (): CdkClasses => ({
    toolbar: slots().toolbar({ class: local.classNames?.toolbar }),
    title: slots().title({ class: local.classNames?.title }),
    grid: slots().grid({ class: local.classNames?.grid }),
    header: slots().header({ class: local.classNames?.header }),
    cell: slots().cell({ class: local.classNames?.cell }),
    slot: slots().slot({ class: local.classNames?.slot }),
    allDay: slots().allDay({ class: local.classNames?.allDay }),
    event: slots().event({ class: local.classNames?.event }),
    eventTitle: slots().eventTitle({ class: local.classNames?.eventTitle }),
    eventTime: slots().eventTime({ class: local.classNames?.eventTime }),
    more: slots().more({ class: local.classNames?.more }),
    morePanel: slots().morePanel({ class: local.classNames?.morePanel }),
    moreOverlay: slots().moreOverlay({ class: local.classNames?.moreOverlay }),
    nowLine: slots().nowLine({ class: local.classNames?.nowLine }),
    handle: slots().handle({ class: local.classNames?.handle }),
    menu: slots().menu({ class: local.classNames?.menu }),
    menuPopover: slots().menuPopover({ class: local.classNames?.menuPopover }),
  });
  const customHeader = local.renderHeader;
  const defaults = {
    header: (api: SchedulerHeaderApi) => (
      <Show when={() => local.toolbar !== false}>{() => <SchedulerHeader api={api} classNames={classes()} density={local.density} />}</Show>
    ),
  };
  return (
    <SchedulerPrimitive
      {...(rest as SchedulerPrimitiveProps<T>)}
      data-slot="scheduler"
      data-density={local.density ?? "default"}
      class={"rv-Scheduler " + slots().base({ class: [local.classNames?.base, local.class].filter(Boolean).join(" ") })}
      classNames={classes()}
      visibleLanes={visibleLanes()}
      renderHeader={customHeader ?? defaults.header}
    />
  );
}

function SchedulerHeader(props: { api: SchedulerHeaderApi; classNames: CdkClasses; density: SchedulerVariants["density"] }): JSX.Element {
  const api = props.api;
  return (
    <div class={props.classNames.toolbar}>
      <div class="scheduler__navigation">
        <ButtonGroup size="sm" variant="tertiary">
          <Button isIconOnly aria-label={api.labels.previous()} onPress={() => api.previous()}>
            <Icon icon={ChevronLeft} />
          </Button>
          <Button isIconOnly aria-label={api.labels.next()} onPress={() => api.next()}>
            <Icon icon={ChevronRight} />
          </Button>
        </ButtonGroup>
        <Button size="sm" variant="secondary" onPress={() => api.today()}>
          <Icon icon={CalendarDays} />
          {api.labels.today()}
        </Button>
      </div>
      <h2 class={props.classNames.title}>{api.title()}</h2>
      <Segment
        size={props.density === "compact" ? "sm" : "md"}
        selectedKey={api.view()}
        onSelectionChange={(key) => api.setView(key as "month" | "week" | "day")}
        aria-label={api.labels.viewSwitch()}
      >
        <Segment.Item id="month">{api.labels.month()}</Segment.Item>
        <Segment.Item id="week">{api.labels.week()}</Segment.Item>
        <Segment.Item id="day">{api.labels.day()}</Segment.Item>
      </Segment>
    </div>
  );
}
