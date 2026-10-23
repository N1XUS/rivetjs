// Rivet-authored Scheduler slots; not vendored from HeroUI. See TWEAKS.md.
import "../../../out/dropdown.css";
import "../../../out/menu.css";
import "../../../out/scheduler.css";
import type {VariantProps} from "tailwind-variants";
import {tv} from "../../utils/tv.ts";

export const schedulerVariants = tv({
  slots: {
    base: "scheduler",
    toolbar: "scheduler__toolbar",
    title: "scheduler__title",
    grid: "scheduler__grid",
    header: "scheduler__header",
    cell: "scheduler__cell",
    slot: "scheduler__slot",
    allDay: "scheduler__all-day",
    event: "scheduler__event",
    eventTitle: "scheduler__event-title",
    eventTime: "scheduler__event-time",
    more: "scheduler__more",
    morePanel: "scheduler__more-panel",
    moreOverlay: "scheduler__more-overlay",
    nowLine: "scheduler__now-line",
    handle: "scheduler__handle",
    menu: "menu dropdown__menu scheduler__menu",
    menuPopover: "dropdown__popover scheduler__menu-popover",
  },
  variants: {
    variant: {default: {}, secondary: {base: "scheduler--secondary"}},
    density: {
      compact: {base: "scheduler--compact", morePanel: "scheduler--compact", menu: "scheduler--compact", menuPopover: "scheduler--compact"},
      default: {},
      comfortable: {base: "scheduler--comfortable", morePanel: "scheduler--comfortable", menu: "scheduler--comfortable", menuPopover: "scheduler--comfortable"},
    },
  },
  defaultVariants: {variant: "default", density: "default"},
});
export type SchedulerVariants = VariantProps<typeof schedulerVariants>;
