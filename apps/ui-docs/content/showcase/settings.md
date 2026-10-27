---
title: Settings
description: "Account settings in tabs: a validated profile form, notification switches, theme cards, two-step sign-in and a destructive confirmation."
template: guide
status: experimental
related:
  [components/tabs, components/form, components/switch, components/radio-button-group, components/alert-dialog, components/item-card-group, components/fieldset]
---

A shop owner's settings, split into [Tabs](/components/tabs/). Panels are render functions, so only the open one exists; their state lives in signals above the tabs and survives switching.

::example{id=showcase-settings}

- Profile: a [Form](/components/form/) (saved confirmation: a success [Alert](/components/alert/) in a polite status region) with a required name, a shop address in an [InputGroup](/components/input-group/) with a `validate` rule, a bio with a live character count in its [Description](/components/description/), and a [NativeSelect](/components/native-select/) time zone. The Save button sits above the fields, so an error line that appears or clears never moves it under the pointer. Field ids go on the `TextField` (they land on the input and keep the label wired).
- Notifications: an [ItemCardGroup](/components/item-card-group/) of [ItemCards](/components/item-card/) with a [Switch](/components/switch/) in each action slot (the rows are their own component, so the group's children are one element), plus a [Fieldset](/components/fieldset/) with a [Segment](/components/segment/) for the order email frequency and a [Description](/components/description/) summary that follows both.
- Appearance: theme cards on a [RadioButtonGroup](/components/radio-button-group/) and a density Segment in a Fieldset.
- Account: an ItemCardGroup with the two-step sign-in switch (its description follows its state) and the password row, and a danger card whose [AlertDialog](/components/alert-dialog/) asks before closing the shop; closing shows a danger Alert.
