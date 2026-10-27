---
title: Timeline
description: "A read-only chronology: activity feeds, audit trails, release logs and milestones on a start or centred rail."
template: reference
status: experimental
related: [components/stepper, components/card, components/chip]
---

`Timeline` is for read-only chronology: activity feeds, audit trails, incident history, release logs and milestone roadmaps. Use [Stepper](/components/stepper/) when the user moves through a known sequence. The timeline owns only the layout: an `ol` of `li` events with a rail (marker + connector) and content; put semantic HTML and other components (Card, Chip, Avatar) in `Timeline.Content`. Pure markup and CSS: no script.

## Usage

```tsx
import { Timeline } from "@rivetjs/ui/timeline";
```

::example{id=timeline-basic}

## Anatomy

```tsx
import { Timeline } from "@rivetjs/ui/timeline";

export default function Anatomy() {
  return (
    <Timeline aria-label="History">
      <Timeline.Item>
        <Timeline.Rail>
          <Timeline.Marker />
          <Timeline.Connector />
        </Timeline.Rail>
        <Timeline.Content>
          <article>
            <h3>Event title</h3>
            <time dateTime="2026-05-22">May 22, 2026</time>
            <p>Event details</p>
          </article>
        </Timeline.Content>
      </Timeline.Item>
    </Timeline>
  );
}
```

`Timeline.Rail` is optional: an item without one renders a default rail (dot marker + connector), hidden by CSS when you add your own. A rail without a `Timeline.Marker` gets a default dot. The last item's connector is hidden (`force` keeps it). Alternate sides come from the item position (CSS), so no index is needed.

## Centered Milestones

`axis="center"` puts the rail in the middle; `placement` sets the content side (`end`, `start`, `alternate`), an item's `side` overrides it.

::example{id=timeline-centered-milestones}

## Studio Review

::example{id=timeline-studio-review}

## Compact Log

::example{id=timeline-compact-log}

## Incident Response

::example{id=timeline-incident-response}

## Version History

::example{id=timeline-version-history}

## Repository Activity

::example{id=timeline-repository-activity}

## Split Content

Two `Timeline.Content` parts with `side="start"` / `side="end"` share one item on a centred axis.

::example{id=timeline-split-content}

## Styling Reference

### CSS Classes

- `.timeline` - The list. Axis `.timeline--start` / `--center`, content side `.timeline--placement-end` / `-start` / `-alternate`, size `.timeline--sm` / `--md` / `--lg`, density `.timeline--comfortable` / `--compact`.
- `.timeline__item` - One event.
- `.timeline__rail` (`.timeline__rail--default` for the generated one), `.timeline__marker` (`.timeline__marker--dot` when empty), `.timeline__connector` - The rail.
- `.timeline__content` - Event content.

### CSS Variables

- `--timeline-marker-size` - Marker box (sm 1.25rem, md 1.5rem, lg 2rem); also the rail column width.
- `--timeline-gap` - Space between events (comfortable 1.5rem, compact 0.75rem).
- `--timeline-tone`, `--timeline-tone-soft`, `--timeline-tone-foreground` - Marker colours, set from the status.

### Data Attributes

- `[data-slot]`: `timeline`, `timeline-item`, `timeline-rail`, `timeline-marker`, `timeline-connector`, `timeline-content`.
- `[data-status]` on items / markers: `default`, `current`, `success`, `warning`, `danger`, `muted`.
- `[data-side]` (`start` / `end`) on items / content, `[data-align]` (`start` / `center`) on items, `[data-force]` on connectors, `[data-axis]` / `[data-item-align]` on the root.

## API Reference

### Timeline

| Prop        | Type                              | Default         | Description                                       |
| ----------- | --------------------------------- | --------------- | ------------------------------------------------- |
| `axis`      | `"start" \| "center"`             | `"start"`       | Rail position                                     |
| `placement` | `"start" \| "end" \| "alternate"` | `"end"`         | Content side on a centred axis                    |
| `size`      | `"sm" \| "md" \| "lg"`            | `"md"`          | Marker and text size                              |
| `density`   | `"compact" \| "comfortable"`      | `"comfortable"` | Space between events                              |
| `itemAlign` | `"start" \| "center"`             | `"start"`       | Default vertical alignment of content (data attr) |
| `class`     | `string`                          | -               | Additional CSS classes                            |

Also takes `ol` props.

### Timeline.Item

| Prop     | Type                                                                      | Default     | Description                                       |
| -------- | ------------------------------------------------------------------------- | ----------- | ------------------------------------------------- |
| `status` | `"default" \| "current" \| "success" \| "warning" \| "danger" \| "muted"` | `"default"` | Marker tone; `current` sets `aria-current="true"` |
| `align`  | `"start" \| "center"`                                                     | -           | Content alignment against the marker              |
| `side`   | `"start" \| "end"`                                                        | -           | Content side on a centred axis                    |

Also takes `li` props.

### Timeline.Marker

`status` (tone override) and `span` props; empty markers are decorative (`aria-hidden`).

### Timeline.Connector

`force` (render on the last item too) and `span` props; always `aria-hidden`.

### Timeline.Content

`side` (`"start" | "end"`) and `div` props.

### useTimelineItem

Inside a `Timeline.Item`: `{ status, align, side }`, the item's own props (`undefined` = inherited).

## Accessibility

An ordered list (`ol` / `li`): screen readers announce the number of events. Label the timeline (`aria-label`), use `time` elements with `dateTime` for dates. Connectors and empty markers are hidden from assistive technology; markers with content (an icon) should not carry meaning the text does not repeat.

## Related Components

- [Stepper](/components/stepper/): A sequence the user moves through.
- [Card](/components/card/), [Chip](/components/chip/), [Avatar](/components/avatar/): Event content.
