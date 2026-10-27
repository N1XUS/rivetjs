---
title: Mail
description: "An inbox: a contained sidebar that collapses to icons, a searchable message list with selection, a reading pane with a toolbar, toasts and compose."
template: guide
status: experimental
related: [components/sidebar, components/item-card-group, components/toolbar, components/toast, components/resizable, components/alert-dialog]
---

A small studio's inbox with invented people and messages.

::example{id=showcase-mail}

- Folders are a [Sidebar](/components/sidebar/#contained-in-a-panel) with `contained` on the provider, so it lives inside the bordered box: `collapsible="icon"` turns it into an icon rail (the list header's trigger, the rail edge, or Cmd/Ctrl+B), folder buttons show their tooltip while collapsed, and the inbox's unread count is a `Sidebar.MenuBadge`. Below 768 px it opens as a sheet.
- The message list and the reading pane are two [Resizable](/components/resizable/) panes from 768 px; `useDefaultLayout` keeps their sizes in `localStorage`. Below 768 px one pane shows at a time and a back button returns from a message to the list (a media query in the example's `styles.css`).
- The list is an [ItemCardGroupCollection](/components/item-card-group/#collection-mode) over a derived accessor (folder, the unread [Segment](/components/segment/) and the [SearchField](/components/search-field/) query): `selectionMode="single"` with `selectionBehavior="replace"`, so a click or the arrow keys open a message, and `isUnread` + `ItemCard.Indicator` mark unread mail. `renderEmptyState` shows an [EmptyState](/components/empty-state/) when nothing matches; the reading pane shows one while no message is open.
- The reading pane's actions are a [Toolbar](/components/toolbar/) (one tab stop, arrow keys between buttons): star is a [ToggleButton](/components/toggle-button/), then mark unread, archive and delete. Every action confirms with a [Toast](/components/toast/).
- Delete (toolbar button, or Delete / Backspace on a focused row) asks first in an [AlertDialog](/components/alert-dialog/) that names the conversation, with focus on Cancel; Escape or a backdrop click cancels. Confirming moves it to Trash (in Trash: removes it for good) and opens the next message.
- Compose opens a [Modal](/components/modal/) with a [Form](/components/form/): required fields and the email type are checked by the browser, and [FieldError](/components/field-error/) shows the messages. Reply opens it with the address and subject filled in. Sending files the message under Sent.
