# @rivetjs/cdk/announcer
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Server-rendered live regions (exist before the first announcement) + React Aria live announcer.

## Entry points
- `./announcer` -> `index.tsx`: `<Announcer class?>` (regions for `announce()` of `@rivetjs/cdk/a11y`), `<LiveAnnouncerRegions class?>` (regions adopted by `@rivetjs/cdk/live-announcer`)
- `./live-announcer` -> `live-announcer.ts`: `announce(message, assertiveness="assertive", timeout)`, `clearAnnouncer(assertiveness?)`, `destroyAnnouncer()`, `announcerOptions` (`{ immediate }`), type `Assertiveness`

## Layout
- `index.tsx` - two region components, hidden via `visuallyHidden` from `../a11y/index.ts`
- `live-announcer.ts` - react-aria live announcer (one node per message, removed after `timeout`)
- `announce-lazy.ts` - `announceAssertive(message)`: the `import()` target of lazy callers (cdk Button pending state). A dynamic import of `live-announcer.ts` itself (statically shared by number-field / combobox / table / grid / spinbutton) made rolldown build its namespace object (`__exportAll` → `rolldown-runtime` chunk, +1 request on every Button page); the lazy entry is its own chunk with real export names (ZERO UI-JS2)
- used by: story layouts `tests/app/src/routes/_layout.tsx`, `tests-components/app/src/routes/_layout.tsx`
- tests: `tests/browser/smoke.test.ts` (Announcer SSR markup); live-announcer has no direct test
- docs examples: `apps/cdk-docs/examples/{announce-basic,live-announcer}/`

## Upstream
- `live-announcer.ts`: `@react-aria/live-announcer` (Apache-2.0). Deviation: regions created on first `announce()` (no import-time globals); server-rendered `<LiveAnnouncerRegions/>` adopted when present (no 100 ms creation delay)
- `index.tsx`: Rivet-own

## Rules / invariants
- place `<Announcer/>` / `<LiveAnnouncerRegions/>` once in the root layout: screen readers ignore regions created together with their content
- `<Announcer/>` markup: wrapper `data-rv-announcers=""`, children `data-rv-announcer="polite|assertive"` + `aria-live` + `aria-atomic="true"` (selectors read by `../a11y/index.ts` `region()`)
- `<LiveAnnouncerRegions/>`: wrapper `data-live-announcer="true"`, two `role="log"` children (assertive first, polite) with `aria-relevant="additions"`
- hiding is inline style only; `class` adds the user's class, never replaces the hiding
- no import-time DOM work; `live-announcer.ts` browser only
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/browser/smoke.test.ts`

## Gotchas
- two incompatible announcers: Angular-style `a11y` `announce` (polite default, single message) vs react-aria `live-announcer` `announce` (assertive default, log) - each needs its own region component
- Angular CDK `LiveAnnouncer` class is a third one (`../a11y/live-announcer.ts`, `cdk-live-announcer-element`)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../a11y/CLAUDE.md](../a11y/CLAUDE.md)
- `apps/cdk-docs/content/foundations/announcements.md`
