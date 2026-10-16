---
title: Music
description: "A music player screen with a library sidebar, a scrolling album row, a track list with likes and a player bar with seek and volume sliders."
template: guide
status: experimental
related: [components/slider, components/toggle-button, components/button]
---

An invented streaming app. The player keeps time with a timer; no audio plays.

::example{id=showcase-music}

- Album covers go through the compiler's image pipeline (`?image` + `Picture`), so each one ships responsive sizes. They are AI-generated sample images.
- The album row is a horizontally scrolling list with scroll snapping; the page itself never scrolls sideways. Below 768 px the library sidebar hides and the player bar keeps only the main controls.
- The album page shows the picked album: its texts update in place and the track list is one keyed `For`, so picking another album swaps every row (created in the browser) while likes stay in one signal. The playing row is highlighted wherever you browse.
- The player bar reads one `playing` signal (album + index) and a `position` signal. Play starts an interval from the handler and keeps its id in a signal; the seek bar is a [Slider](/components/slider/) bound two-way to `position`, so dragging it seeks. Shuffle and repeat are [ToggleButtons](/components/toggle-button/) with two-way `isSelected` signals.
- A polite status line announces what plays; like buttons are icon-only [Buttons](/components/button/) with a label naming the song and `aria-pressed={() => liked().includes(key)}`, so each one follows the shared `liked` signal.
