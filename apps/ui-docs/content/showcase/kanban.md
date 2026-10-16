---
title: Kanban
description: "A launch board: task cards sorted and moved between three connected drop lists, with move buttons for keyboard users and per-column add forms."
template: guide
status: experimental
related: [components/chip, components/avatar-group, components/progress-bar, components/button]
---

An invented team's launch board. Drag and drop comes from `@rivetjs/cdk/drag-drop`, the Angular CDK port; the cards are styled with `@rivetjs/ui`.

::example{id=showcase-kanban}

- A `DropListGroup` connects the three `DropList`s; each card is a `Drag` carrying its task id as `data`. `onDropped` moves the id between the column arrays (`previousContainer.data` → `container.data`, `previousIndex` → `currentIndex`) and the keyed `For` rows follow. Nothing drag-related loads until the board scrolls into view; the first press then starts the drag synchronously.
- The CDK state classes are styled in `styles.css`: a tilted preview with the overlay shadow that straightens as it drops into its slot, a faded placeholder, animated sorting, a tinted receiving list (no transitions under reduced motion). The sorting transition also animates the cards that make room when a card enters a column, and the cards that close the gap it leaves.
- Dragging needs a pointer, so every card also has move buttons ([Button](/components/button/) with an `aria-label` naming the target column), and a polite status line announces each move.
- The header shows the team as an [AvatarGroup](/components/avatar-group/) and the share of done tasks as a [ProgressBar](/components/progress-bar/). Columns stack below 768 px.
