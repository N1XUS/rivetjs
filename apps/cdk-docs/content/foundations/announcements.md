---
title: Announcements
description: Tell screen reader users about changes away from focus with announce(), server-rendered live regions, the React Aria announcer and Angular's LiveAnnouncer.
template: guide
status: experimental
related: [foundations/focus, foundations/a11y-services, components/combobox]
---

Some changes happen away from the keyboard focus: a draft was saved, a search found 12 results, a request failed. A live region reads them to screen reader users. `@rivetjs/cdk` has three announcers with the same job and different upstream shapes:

| Announcer | Module | Shape | Use it for |
| --- | --- | --- | --- |
| `announce(message, politeness?)` | `@rivetjs/cdk/a11y` | One region per politeness, one message at a time, polite by default | Most apps. The cdk components use it. |
| `announce(message, assertiveness?, timeout?)` | `@rivetjs/cdk/live-announcer` | React Aria: `role="log"` regions, one node per message, assertive by default | Code ported from React Aria; messages that should queue. |
| `LiveAnnouncer`, `CdkAriaLive` | `@rivetjs/cdk/a11y/live-announcer` | Angular CDK: one shared element, 100 ms delayed write, optional clear duration, a directive for "announce this element's text" | Code ported from Angular. |

Live regions must exist before their content changes, or screen readers often skip the first message. `<Announcer />` and `<LiveAnnouncerRegions />` from `@rivetjs/cdk/announcer` render them on the server.

::example{id=announce-basic}

```tsx title="src/routes/_layout.tsx"
import type { LayoutProps } from "@rivetjs/router";
import { Announcer } from "@rivetjs/cdk/announcer";

export default function Layout({ children }: LayoutProps) {
  return (
    <main>
      {children}
      <Announcer />
    </main>
  );
}
```

```tsx title="src/routes/draft.tsx"
import { announce } from "@rivetjs/cdk/a11y";

export default function Draft() {
  return (
    <button type="button" onClick={() => announce("Draft saved")}>
      Save draft
    </button>
  );
}
```

## announce from a11y

| Export | Does |
| --- | --- |
| `announce(message, politeness = "polite")` | Writes `message` to the `polite` or `assertive` region. The region is emptied first and filled after 50 ms, so the same message twice is read twice. Browser only. |
| `clearAnnouncements()` | Clears pending and shown messages, for example on a route change. |
| `visuallyHidden` | Style object for text only screen readers should read: `style={visuallyHidden}`. |
| `hideVisually(element)` | Applies the same styles through the CSSOM (CSP-safe). |
| `<Announcer class? />` | The two regions, server-rendered. `class` adds a class of your own. |

Without `<Announcer />`, the first `announce()` creates the regions itself (the first message may be lost).

### Anatomy

```html
<div data-rv-announcers="">
  <div data-rv-announcer="polite" aria-live="polite" aria-atomic="true" style="border:0;clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px;white-space:nowrap"></div>
  <div data-rv-announcer="assertive" aria-live="assertive" aria-atomic="true" style="…same…"></div>
</div>
```

The inline `style` hides the regions visually, not from screen readers; no stylesheet needed. With a strict CSP, allow inline style attributes (`style-src-attr 'unsafe-inline'`), or the regions show.

## React Aria live announcer

| Export | Does |
| --- | --- |
| `announce(message, assertiveness = "assertive", timeout = 7000)` | Appends a node with `message` to the assertive or polite log; removed after `timeout` ms. `message` may be `{ "aria-labelledby": id }`: the node becomes `role="img"` labelled by that element. |
| `clearAnnouncer(assertiveness?)` | Empties one log, or both. |
| `destroyAnnouncer()` | Removes created regions (empties adopted ones). |
| `announcerOptions.immediate` | Test hook: announce synchronously when the regions are created. |
| `<LiveAnnouncerRegions class? />` | Server-rendered regions (`@rivetjs/cdk/announcer`); `announce()` adopts them. |

```html
<div data-live-announcer="true" style="…visually hidden…">
  <div role="log" aria-live="assertive" aria-relevant="additions"></div>
  <div role="log" aria-live="polite" aria-relevant="additions"></div>
</div>
```

::example{id=live-announcer}

## Angular CDK LiveAnnouncer

| Export | Does |
| --- | --- |
| `new LiveAnnouncer(options?)` | Options: `politeness` and `duration` defaults, `liveElement` (use this element), `document`. Without `liveElement` it creates `<div class="cdk-live-announcer-element cdk-visually-hidden" aria-atomic="true" aria-live="polite" id="cdk-live-announcer-0">` at the end of `<body>`, removing stale ones. |
| `getLiveAnnouncer()` | The shared instance, created on first call. |
| `.announce(message, politeness?, duration?)` | Clears, sets `aria-live`, writes `message` after 100 ms; clears again after `duration` ms when given. Returns a promise resolved when written. `announce(message, duration)` also works. Open modals (`[aria-modal="true"]` in the overlay layer) get `aria-owns` pointing at the element, so it stays readable. |
| `.clear()`, `.destroy()` | Empty the element; remove it. |
| `new CdkAriaLive(element, politeness = "polite", duration?, announcer?)` | The `cdkAriaLive` directive: announces `element`'s text whenever it changes (a `MutationObserver`). Set `.politeness = "off"` to pause; `.destroy()` on unmount. |

::example{id=live-announcer-cdk}

## Polite or assertive

- `polite` waits until the screen reader finishes: results, saved, copied.
- `assertive` interrupts: errors that block the visitor. Use it rarely; note that the React Aria announcer defaults to it.

## Resumability

- All three are browser only: call them in handlers and client effects, never while rendering.
- `<Announcer />` and `<LiveAnnouncerRegions />` are static markup; nothing ships for them until the first `announce()`.
- `CdkAriaLive` needs a client effect (runtime boot at load) to observe its element.

## Common mistakes

- **No regions in the layout.** The first message may not be read.
- **Announcing what has focus.** A focused element is read anyway; announcing it too reads it twice.
- **Hiding text with `display: none`.** That hides it from screen readers too. Use `style={visuallyHidden}`.
- **Mixing announcers.** Pick one per app; two sets of regions read competing messages.

## Upstream

| API | Ported from | Deviations |
| --- | --- | --- |
| `announce` (`a11y`), `<Announcer />` | Rivet, in the style of Angular CDK `LiveAnnouncer` | Two regions (one per politeness); 50 ms delay. |
| `announce`, `clearAnnouncer`, `destroyAnnouncer` (`live-announcer`) | `@react-aria/live-announcer` | Regions are created on first use (no import-time globals) or adopted from `<LiveAnnouncerRegions />`, which also skips the 100 ms creation delay. |
| `LiveAnnouncer`, `CdkAriaLive` | `@angular/cdk/a11y` | Plain classes, options instead of injection tokens; messages are text only (no `SafeHtml`). |
