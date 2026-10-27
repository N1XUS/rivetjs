---
title: Music
description: "A music player: contained library sidebar, album cards in a scroll shadow, an interactive track list with likes, a player bar with sliders."
template: guide
status: experimental
related: [components/sidebar, components/item-card-group, components/scroll-shadow, components/card, components/slider, components/toggle-button]
---

An invented streaming app. The player keeps time with a timer; no audio plays.

::example{id=showcase-music}

- Album covers go through the compiler's image pipeline (`?image` + `Picture`), so each one ships responsive sizes. They are AI-generated sample images.
- The library is a [Sidebar](/components/sidebar/#contained-in-a-panel) contained in the top row: it collapses to an icon rail (tooltips on its buttons) and opens as a sheet below 768 px.
- The album row is a horizontal [ScrollShadow](/components/scroll-shadow/) of [Cards](/components/card/) with scroll snapping; the page itself never scrolls sideways. Each card's press target is a [ToggleButton](/components/toggle-button/) stretched over it, pressed for the open album.
- The album's tracks are an [ItemCardGroupCollection](/components/item-card-group/#collection-mode): arrow keys move between rows, Enter or a click plays (`onAction`), and the playing row is `isCurrent` wherever you browse, with an `ItemCard.Indicator` holding a [Status](/components/status/) dot that pulses while it plays. Each row's like is a ToggleButton (its own tab stop) whose `isSelected` follows the shared `liked` signal.
- The player bar reads one `playing` signal (album + index) and a `position` signal. Play starts an interval from the handler and keeps its id in a signal; the seek bar is a [Slider](/components/slider/) bound two-way to `position`, so dragging it seeks. Shuffle and repeat are ToggleButtons with two-way `isSelected` signals; a polite status line announces what plays.
