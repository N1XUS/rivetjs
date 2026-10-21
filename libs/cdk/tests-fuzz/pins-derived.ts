// Resume-fuzz findings on the cdk story app built with the derived resume model (`RIVET_RESUME_MODEL=derived`, own
// build `dist-fuzz-derived`; `./resume-fuzz.test.ts` picks this set under that env). Triage of lane M2-R5
// (2026-10-20, one run of shards 1/3 to 3/3, `docs/benchmarks/2026-10-20-derived-r5.md`), narrowed by lane DERIVED-C
// (2026-10-21: cold press port, cold hover, UNKEYED adopt, unrecorded build pass; pins that passed in its two full runs
// after those fixes were deleted — 118 → 59 + 4, `docs/benchmarks/2026-10-21-derived-c.md`): every pin is `design: true`
// with an empty match (route + kind only) — the derived client is experimental and these are its known gaps, grouped by
// root cause below; replace a group's pins with narrow ones (or delete them) as the gap closes. Never reuse
// `./pins.ts` here: those describe the serialized model.
import type { FuzzPin } from "@rivetjs/testing/fuzz";

/** Root causes (spec `docs/design/specs/2026-10-18-structural-resume-design.md` §3.4 "As built", gaps). */
const PRESS =
  "derived cold press (left after DERIVED-C's port of dom-resume's cold-press replay + cold hover): mostly `data-hovered` on the first press target / its neighbours after the click (a hover the synthetic enter does not reach: pointer moved between elements before the adopt), measured-layout styles (carousel / masonry), date-field segments after a held key";
const RECREATE =
  "derived adopt (after DERIVED-C: UNKEYED units adopt, build passes run outside the unit — 24 of 25 `recreated` findings gone): what is left is mostly later-step DOM differences on the now adopted collection pages (`useId` counters of browser-created collection parts, hover / focus-visible after keys, roving tabindex) and five units still rendered in the browser";
const MOUNT =
  "a mount-time browser effect (or a browser-only attribute) of a client render the resumed page has not run — the serialized pins' MOUNT_EFFECT / design rows, unpinned per route here";
const ADOPTED =
  "a page root that rendered in the browser before DERIVED-C (UNKEYED) now adopts: the later steps compare, and browser-created collection parts number their `useId`s after the adopted ones (`#4-news` vs `#3-news`), plus hover / roving tabindex after clicks";
const BASE =
  "found at base dcc93d7ac too (DERIVED-C fuzz before / after, unchanged): `/dom-data` (DOM-backed data) is not a derived-model route yet; `/deferred-loader` + `/shell-loader` (deferred holes) resume since DERIVED-C2 streamed holes (pins deleted; `/shell-loader` is fuzzed without the shell cache, which rejects derived documents); `/shell-replay` resumes too (0 findings × 4, pins deleted); `/shell-provider` (PPR-T57) stays: its `Async` sits in a component's children slot under a `Provider`, which DERIVED-C2 streamed holes do not adopt (C2 gap: nested `Async` built after the synchronous part) — the browser re-runs the content with the deferred handle as `{}` (`reading 'map'`), DERIVED-C3";
const GROUPS = { PRESS, RECREATE, MOUNT, ADOPTED, BASE } as const;

const pin = (route: string, kind: FuzzPin["kind"], group: keyof typeof GROUPS): FuzzPin => ({
  route,
  kind,
  match: "",
  owner: "runtime",
  note: GROUPS[group] + " (M2-R5 triage, narrowed DERIVED-C)",
  design: true,
});

export const pins: FuzzPin[] = [
  pin("/shell-provider", "recreated", "BASE"),
  pin("/shell-provider", "mismatch", "BASE"),
  pin("/shell-provider", "page-error", "BASE"),
  pin("/dom-data", "load", "BASE"),
  pin("/dom-data", "mismatch", "BASE"),
  pin("/tag-group", "mismatch", "ADOPTED"),
  pin("/autocomplete", "mismatch", "RECREATE"),
  pin("/button", "mismatch", "PRESS"),
  pin("/button-render", "mismatch", "PRESS"),
  pin("/buttons", "mismatch", "PRESS"),
  pin("/calendar", "mismatch", "PRESS"),
  pin("/carousel", "load", "MOUNT"),
  pin("/carousel", "mismatch", "PRESS"),
  pin("/color", "mismatch", "RECREATE"),
  pin("/combobox", "mismatch", "PRESS"),
  pin("/date-picker", "mismatch", "PRESS"),
  pin("/disclosure", "mismatch", "PRESS"),
  pin("/dom-events-collections", "mismatch", "RECREATE"),
  pin("/dom-events-dates", "mismatch", "PRESS"),
  pin("/dom-events-forms", "mismatch", "RECREATE"),
  pin("/dom-events-overlays", "load", "MOUNT"),
  pin("/forms", "mismatch", "PRESS"),
  pin("/grid-list", "load", "MOUNT"),
  pin("/grid-list", "mismatch", "RECREATE"),
  pin("/lazy-rows", "mismatch", "RECREATE"),
  pin("/lightbox", "recreated", "RECREATE"),
  pin("/links", "mismatch", "RECREATE"),
  pin("/list-data", "mismatch", "RECREATE"),
  pin("/listbox", "mismatch", "RECREATE"),
  pin("/live-props", "mismatch", "RECREATE"),
  pin("/masonry-expand", "mismatch", "PRESS"),
  pin("/masonry-measured", "load", "MOUNT"),
  pin("/masonry-measured", "mismatch", "PRESS"),
  pin("/modal-open", "load", "MOUNT"),
  pin("/number-field", "mismatch", "RECREATE"),
  pin("/preview-trigger", "mismatch", "PRESS"),
  pin("/progress", "mismatch", "PRESS"),
  pin("/radio-group", "mismatch", "PRESS"),
  pin("/region-state-repro", "recreated", "RECREATE"),
  pin("/render-resumed", "load", "MOUNT"),
  pin("/render-resumed", "mismatch", "RECREATE"),
  pin("/resizable", "load", "MOUNT"),
  pin("/scheduler", "mismatch", "PRESS"),
  pin("/scheduler-zone", "load", "MOUNT"),
  pin("/scroll-area", "load", "MOUNT"),
  pin("/scroll-area-cold", "mismatch", "RECREATE"),
  pin("/scroll-area-cold", "recreated", "RECREATE"),
  pin("/select", "mismatch", "RECREATE"),
  pin("/select-autofocus", "load", "MOUNT"),
  pin("/select-autofocus", "mismatch", "RECREATE"),
  pin("/selection-indicator", "mismatch", "PRESS"),
  pin("/selection-indicator-groups", "load", "MOUNT"),
  pin("/selection-indicator-groups", "mismatch", "RECREATE"),
  pin("/sidebar", "mismatch", "PRESS"),
  pin("/sidebar-extensions", "mismatch", "PRESS"),
  pin("/table", "load", "MOUNT"),
  pin("/table", "mismatch", "RECREATE"),
  pin("/tabs", "load", "MOUNT"),
  pin("/tabs", "mismatch", "RECREATE"),
  pin("/text-field", "mismatch", "PRESS"),
  pin("/toast", "mismatch", "PRESS"),
  pin("/toggle-button-group", "mismatch", "RECREATE"),
  pin("/tree", "mismatch", "RECREATE"),
  pin("/virtualized-collections", "load", "MOUNT"),
  pin("/virtualized-collections", "mismatch", "RECREATE"),
];
