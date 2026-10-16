// Server-rendered live regions, so they exist before the first announcement (screen readers ignore
// regions created together with their content). Place once in the root layout.
// - `<Announcer/>`: regions of `announce()` from `@rivetjs/cdk/a11y` (Angular LiveAnnouncer style).
// - `<LiveAnnouncerRegions/>`: regions adopted by `announce()` from `@rivetjs/cdk/live-announcer`
//   (react-aria style: `role="log"`, one node per message).
// Hidden by inline styles (`visuallyHidden`); `class` adds a class of your own.

import { visuallyHidden } from "../a11y/index.ts";

/** Polite + assertive live regions (empty, visually hidden). */
export function Announcer(props: { class?: string }) {
  const hidden = props.class;
  return (
    <div data-rv-announcers="">
      <div data-rv-announcer="polite" aria-live="polite" aria-atomic="true" class={hidden} style={visuallyHidden}></div>
      <div data-rv-announcer="assertive" aria-live="assertive" aria-atomic="true" class={hidden} style={visuallyHidden}></div>
    </div>
  );
}

/** react-aria live announcer regions (assertive + polite logs), visually hidden. */
export function LiveAnnouncerRegions(props: { class?: string }) {
  return (
    <div data-live-announcer="true" class={props.class} style={visuallyHidden}>
      <div role="log" aria-live="assertive" aria-relevant="additions"></div>
      <div role="log" aria-live="polite" aria-relevant="additions"></div>
    </div>
  );
}
