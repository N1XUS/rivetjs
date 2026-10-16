---
title: Mail
description: "An inbox in resizable panes: folders that collapse to an icon rail, a searchable message list, a reading pane, delete confirmation and compose."
template: guide
status: experimental
related: [components/resizable, components/alert-dialog, components/modal, components/form, components/search-field, components/segment]
---

A small studio's inbox with invented people and messages.

::example{id=showcase-mail}

- Three [Resizable](/components/resizable/) panes from 768 px: folders, the message list and the reading pane. Drag a handle (or focus it and use the arrow keys) to resize; drag the folder pane past its minimum, press Enter on its handle or use the panel button to collapse it to an icon rail. `useDefaultLayout` keeps the sizes in `localStorage`, and the rail state follows the stored layout on reload.
- Below 768 px one pane shows at a time: a [NativeSelect](/components/native-select/) picks the folder and a back button returns from a message to the list. The handles hide and the visible pane takes the full width (a media query in the example's `styles.css`).
- Delete (toolbar button, or Delete / Backspace on a focused row) asks first in an [AlertDialog](/components/alert-dialog/) that names the conversation, with focus on Cancel; Escape or a backdrop click cancels. Confirming moves it to Trash (in Trash: removes it for good), opens the next message and announces it in the status line.
- The list is a keyed `For` over a derived accessor (folder, the unread [Segment](/components/segment/) and the [SearchField](/components/search-field/) query). Read, starred and moved state live in small signals next to the static messages, so rows keep their nodes when you open, star or archive one.
- Compose opens a [Modal](/components/modal/) with a [Form](/components/form/): required fields and the email type are checked by the browser, and [FieldError](/components/field-error/) shows the messages. Reply opens it with the address and subject filled in. Sending files the message under Sent and announces it in a status line.
