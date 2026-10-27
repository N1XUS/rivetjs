---
title: Kanban
description: "A launch board on the ui Kanban: cards dragged (mouse, touch) or moved by keyboard between columns, per-column composers, a progress bar."
template: guide
status: experimental
related: [components/kanban, components/chip, components/avatar-group, components/progress-bar]
---

An invented team's launch board, built on [Kanban](/components/kanban/) (drag and drop from `@rivetjs/cdk/drag-drop`, the Angular CDK port, underneath).

::example{id=showcase-kanban}

- `createKanban` keeps the tasks in one signal; every `Kanban.CardList` gets `onDropped` and a keyed `For` over `itemsOf(column)`. Drag a card with the mouse or a finger, within a column or to another one. Nothing drag-related loads until the first press.
- `onCardMove={board.onCardMove}` adds [keyboard moves](/components/kanban/#keyboard-moves): focus a card, press Space to pick it up, the arrow keys to move it, Space to drop it or Escape to put it back. Each step is announced.
- Each column ends with a `KanbanComposer`: the trigger opens an inline title field; Enter adds the task, Escape closes it.
- The header shows the team as an [AvatarGroup](/components/avatar-group/) and the share of done tasks as a [ProgressBar](/components/progress-bar/). Below 768 px the board scrolls sideways, one column at a time.
