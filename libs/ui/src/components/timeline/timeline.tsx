// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no timeline). Feature set inspired by HeroUI Pro's public Timeline
// docs (read-only chronology: `ol` of `li` events; rail with marker + connector; start or centered axis with content side /
// alternate; sizes; density; status tones; `aria-current` on the current event); independent implementation,
// Rivet-authored styles on HeroUI tokens.
// - No JS, no child inspection: an item always renders a default rail (marker + connector) that CSS hides when the item has
//   its own `Timeline.Rail`; a rail renders a default marker that CSS hides when it has its own `Timeline.Marker`; the last
//   item's connector is hidden by CSS (`force` keeps it). Alternate sides come from `:nth-child` (no item index needed).
// - Status / side / align inherit by CSS (`data-*` on the item, overridable on a marker / content part); `useTimelineItem()`
//   reads the item's own props (`status`, `align`, `side`; `undefined` = inherited from the root).
// - Empty markers are decorative (`aria-hidden`); connectors are always `aria-hidden`.
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { TimelineVariants } from "../../../styles/src/components/timeline/index.ts";
import { timelineVariants } from "../../../styles/src/components/timeline/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = timelineVariants();

type TimelineStatus = "default" | "current" | "success" | "warning" | "danger" | "muted";
type TimelineSide = "start" | "end";
type TimelineAlign = "start" | "center";

interface TimelineRootProps extends Omit<JSX.IntrinsicElements["ol"], "class">, TimelineVariants {
  /** Default vertical alignment of item content against its marker. @default "start" */
  itemAlign?: TimelineAlign;
  class?: string;
}

const TimelineRoot = (props: TimelineRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "axis", "placement", "size", "density", "itemAlign"]);
  return (
    <ol
      class={timelineVariants({ axis: local.axis, placement: local.placement, size: local.size, density: local.density }).base({ class: local.class })}
      data-slot="timeline"
      data-axis={local.axis ?? "start"}
      data-item-align={local.itemAlign ?? "start"}
      {...rest}
    >
      {local.children}
    </ol>
  );
};

interface TimelineItemContextValue {
  readonly status?: TimelineStatus;
  readonly align?: TimelineAlign;
  readonly side?: TimelineSide;
}
const TimelineItemContext = createContext<TimelineItemContextValue>({});

/** The enclosing `Timeline.Item`'s own `status` / `align` / `side` (`undefined` = inherited from the root). */
const useTimelineItem = (): TimelineItemContextValue => useContext(TimelineItemContext);

interface TimelineItemProps extends Omit<JSX.IntrinsicElements["li"], "class"> {
  /** Marker tone; `current` also sets `aria-current="true"`. @default "default" */
  status?: TimelineStatus;
  /** Vertical alignment of the content (default: the root's `itemAlign`). */
  align?: TimelineAlign;
  /** Content side on a centered axis (default: the root's `placement`). */
  side?: TimelineSide;
  class?: string;
}

const TimelineItem = (props: TimelineItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "status", "align", "side"]);
  const ctx: TimelineItemContextValue = {
    get status() {
      return local.status;
    },
    get align() {
      return local.align;
    },
    get side() {
      return local.side;
    },
  };
  return (
    <Provider token={TimelineItemContext} value={ctx}>
      <li
        class={composeSlotClassName(SLOTS.item, local.class)}
        data-slot="timeline-item"
        data-status={local.status ?? "default"}
        data-align={local.align}
        data-side={local.side}
        aria-current={local.status === "current" ? "true" : undefined}
        {...rest}
      >
        <span aria-hidden="true" class="timeline__rail timeline__rail--default" data-slot="timeline-rail">
          <span class="timeline__marker timeline__marker--dot" data-slot="timeline-marker" />
          <span class={SLOTS.connector()} data-slot="timeline-connector" />
        </span>
        {local.children}
      </li>
    </Provider>
  );
};

type SpanProps = Omit<JSX.IntrinsicElements["span"], "class"> & { class?: string };

const TimelineRail = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <span class={composeSlotClassName(SLOTS.rail, local.class)} data-slot="timeline-rail" {...rest}>
      <span aria-hidden="true" class="timeline__marker timeline__marker--dot timeline__marker--default" data-slot="timeline-marker" />
      {local.children}
    </span>
  );
};

interface TimelineMarkerProps extends SpanProps {
  /** Tone override (default: the item's status). */
  status?: TimelineStatus;
}

const TimelineMarker = (props: TimelineMarkerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "status"]);
  const empty = local.children === undefined || local.children === null;
  return (
    <span
      class={composeSlotClassName(SLOTS.marker, empty ? `timeline__marker--dot${local.class ? " " + local.class : ""}` : local.class)}
      data-slot="timeline-marker"
      data-status={local.status}
      aria-hidden={empty ? "true" : undefined}
      {...rest}
    >
      {local.children}
    </span>
  );
};

interface TimelineConnectorProps extends SpanProps {
  /** Render the connector on the last item too. */
  force?: boolean;
}

const TimelineConnector = (props: TimelineConnectorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "force"]);
  return (
    <span
      aria-hidden="true"
      class={composeSlotClassName(SLOTS.connector, local.class)}
      data-slot="timeline-connector"
      data-force={local.force ? "" : undefined}
      {...rest}
    />
  );
};

interface TimelineContentProps extends Omit<JSX.IntrinsicElements["div"], "class"> {
  /** Side on a centered axis (default: the item's side). */
  side?: TimelineSide;
  class?: string;
}

const TimelineContent = (props: TimelineContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "side"]);
  return (
    <div class={composeSlotClassName(SLOTS.content, local.class)} data-slot="timeline-content" data-side={local.side} {...rest}>
      {local.children}
    </div>
  );
};

export { TimelineRoot, TimelineItem, TimelineRail, TimelineMarker, TimelineConnector, TimelineContent, useTimelineItem };
export type {
  TimelineRootProps,
  TimelineItemProps,
  SpanProps as TimelineRailProps,
  TimelineMarkerProps,
  TimelineConnectorProps,
  TimelineContentProps,
  TimelineStatus,
  TimelineSide,
  TimelineAlign,
  TimelineItemContextValue,
};
