# Choose and combine components

## Select by purpose

Use styled `@rivetjs/ui` when the existing look/variants fit. Use headless `@rivetjs/cdk` for a bespoke visual treatment or a lower-level behavior. The CDK supplies behavior and state hooks; the application supplies layout and complete visual states. Semantic HTML is appropriate for ordinary content regions. Neither a component count nor visual complexity makes a screen better.

| Need | Consider | Selection criterion |
| --- | --- | --- |
| Navigate to a location | Link or semantic anchor | Navigation should retain href, new-tab and no-JS behavior |
| Perform an action | Button; Toolbar for related controls | Keep one dominant action per action group |
| Show one object's summary | Card/Surface with title, content, optional footer | A meaningful object/section boundary, not a decorative wrapper for every item |
| Compare repeated structured data | Table or DataGrid | Use DataGrid when its editing/selection/interaction features are needed; verify feature support |
| Switch peer views within a context | Tabs | Related views; use route navigation for independent locations |
| Reveal optional content in place | Disclosure/Accordion | Content remains in reading order; not for required content hidden by default |
| Choose from a small known set | RadioGroup, Segment, Select | Visibility, number of choices, and space available |
| Choose from a searchable set | ComboBox/Autocomplete composition | Verify the particular input, collection, filtering and focus wiring |
| Change a binary preference | Switch or Checkbox | Switch for immediate on/off; checkbox for selecting/agreeing in a form |
| Edit with surrounding context | Drawer or contextual aside | Keep the current task visible and preserve draft state |
| Complete a focused interruption | Modal/AlertDialog | Modal for a focused task; AlertDialog for consequential confirmation |
| Display supplementary content | Popover/Tooltip | Tooltip for short help; popover for richer contextual interaction |
| Inform about an outcome | Inline message/Alert, optionally Toast | Persistent information belongs inline; transient confirmation may use toast |

The table routes decisions, not prop spellings. UI and CDK subpaths differ: e.g. UI `combo-box`/`list-box` versus CDK `combobox`/`listbox`. Use the installed package's exports and examples.

## Preserve component anatomy

Compound roots establish state/context; triggers, labels, content and items consume it. Keep required relationships and place parts under their documented provider/root. Start from a real Rivet example, then adapt content and layout.

- Cards: `Card.Header` groups `Card.Title` and `Card.Description`, `Card.Content` holds content, `Card.Footer` holds related actions. Omit unnecessary parts.
- Fields: combine an explicit `Label`, the appropriate field/control, optional `Description`, and `FieldError` according to that field's anatomy. Required information should not exist only in placeholder text or tooltips.
- Selection: keep trigger/value/indicator/popover/collection parts in their supported structure. Give each item a stable identity and searchable text where required.
- Overlays: preserve backdrop/container/dialog/title/close relationships. Content must remain inside its interaction context; a visually correct panel with missing dialog semantics is incomplete.
- Custom-styled anchors can use `buttonVariants`/`linkVariants`, but CSS classes do not provide the component's interactive behavior. Use the correct native semantics for the task.

Avoid nested interactive targets: an entire clickable card with nested buttons, a button inside an anchor, or a row whose selection and action both fire. Separate the primary target and secondary controls. Event propagation hacks do not fix ambiguous semantics.

## Compose common regions

**Collection page:** heading + main create action → labeled search/filter controls → result count and collection → pagination. Show bulk actions only when selection exists; `ActionBar` or `Toolbar` may fit. Align filters and table columns to the same content edges. Provide initial-empty and filtered-empty states separately.

**Settings page:** heading/description → grouped `Fieldset` sections → controls/help/errors → save feedback/actions. Group related rows within a section with consistent spacing or separators; `CellSwitch`, `CellSelect` and `CellSlider` are full-row settings cells. Do not wrap every preference in a card. Choose either explicit save or immediate updates for a region and make that behavior visible.

**Detail/edit page:** summary and status → related content sections → contextual actions. Use a drawer for short contextual edits, a page for long/deep edits, and inline editing for small well-bounded values. Destructive actions belong near the affected object with clear labels and proportionate confirmation.

**Dashboard:** lead with metrics that support a decision, then the trend or collection needed to act. `Kpi`, `KpiGroup`, `Widget`, `NumberValue`, `TrendChip`, and the chart exports may fit; `ItemCard` / `ItemCardGroup` for settings rows, `Timeline` for activity history. Every chart needs a readable explanation or data alternative; meaningful units, time range and empty states matter more than decorative chart variety.

**Command picker:** `Command` (`@rivetjs/ui/command`) is the modal palette: a search field filtering grouped commands with virtual focus, Enter to run, Escape to clear then close; put extra search words in each item's `textValue`. For an inline picker, compose a labeled search field with `Autocomplete` + `Menu`. A command menu and a value-selecting list box are different tasks. Add pending, no-match, error and clear-query behavior; do not write a manual arrow-key loop. For actions on a right click, use `ContextMenu`.

## Reuse at the pattern boundary

Extract a repeated region when content, behavior and styling form a stable pattern (page header, labeled field row, filter toolbar). Prefer wrappers that expose domain-relevant choices and forward native/component props. Preserve live props with `splitProps`/`mergeProps`; use `Content` for renderable values. Avoid a universal wrapper with dozens of layout flags or a separate wrapper for every instance.

When composing CDK, style its actual `rv-*` classes and documented `data-*`/ARIA states. Supply idle, hover, pressed, focus-visible, selected, disabled, invalid and pending treatments as applicable. Do not remove its behavior-critical inline styles, roles or keyboard handling.
