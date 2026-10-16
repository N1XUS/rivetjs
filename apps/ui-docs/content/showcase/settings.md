---
title: Settings
description: "Account settings in tabs: a validated profile form, notification switches, theme cards, two-step sign-in and a destructive confirmation."
template: guide
status: experimental
related: [components/tabs, components/form, components/switch, components/radio-button-group, components/alert-dialog]
---

A shop owner's settings, split into [Tabs](/components/tabs/). Panels are render functions, so only the open one exists; their state lives in signals above the tabs and survives switching.

::example{id=showcase-settings}

- Profile: a [Form](/components/form/) with a required name, a shop address in an [InputGroup](/components/input-group/) with a `validate` rule, a bio with a live character count in its [Description](/components/description/), and a [NativeSelect](/components/native-select/) time zone. The Save button sits above the fields, so an error line that appears or clears never moves it under the pointer. Field ids go on the `TextField` (they land on the input and keep the label wired).
- Notifications: [Switch](/components/switch/) rows with a label and description on the left, plus a [Segment](/components/segment/) for the order email frequency and a summary that follows both.
- Appearance: theme cards on a [RadioButtonGroup](/components/radio-button-group/) and a density Segment.
- Account: a two-step sign-in switch whose description follows its state, and a danger card whose [AlertDialog](/components/alert-dialog/) asks before closing the shop.
