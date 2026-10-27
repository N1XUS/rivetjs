// Rivet addition (no HeroUI v3.2.6 counterpart): read-only chronology; feature set inspired by HeroUI Pro's public Timeline
// docs, independent implementation (see `timeline.tsx`).
import { TimelineConnector, TimelineContent, TimelineItem, TimelineMarker, TimelineRail, TimelineRoot } from "./timeline.tsx";
import type {
  TimelineConnectorProps,
  TimelineContentProps,
  TimelineItemProps,
  TimelineMarkerProps,
  TimelineRailProps,
  TimelineRootProps,
} from "./timeline.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Timeline = Object.assign(TimelineRoot, {
  Root: TimelineRoot,
  Item: TimelineItem,
  Rail: TimelineRail,
  Marker: TimelineMarker,
  Connector: TimelineConnector,
  Content: TimelineContent,
});

export type Timeline = {
  Props: TimelineRootProps;
  RootProps: TimelineRootProps;
  ItemProps: TimelineItemProps;
  RailProps: TimelineRailProps;
  MarkerProps: TimelineMarkerProps;
  ConnectorProps: TimelineConnectorProps;
  ContentProps: TimelineContentProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { TimelineRoot, TimelineItem, TimelineRail, TimelineMarker, TimelineConnector, TimelineContent, useTimelineItem } from "./timeline.tsx";
export type {
  TimelineRootProps,
  TimelineRootProps as TimelineProps,
  TimelineItemProps,
  TimelineRailProps,
  TimelineMarkerProps,
  TimelineConnectorProps,
  TimelineContentProps,
  TimelineStatus,
  TimelineSide,
  TimelineAlign,
  TimelineItemContextValue,
} from "./timeline.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { timelineVariants } from "../../../styles/src/components/timeline/index.ts";

export type { TimelineVariants } from "../../../styles/src/components/timeline/index.ts";
