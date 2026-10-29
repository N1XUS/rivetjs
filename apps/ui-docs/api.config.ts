// API reference of the ui docs: the @rivetjs/ui component subpaths (TypeDoc input, `npx nx run ui-docs:api`).
import type { ApiEntryConfig, ApiPackage } from "@rivetjs/docs-kit/tools/app.ts";

/** Documented entry points: import specifier → source file (relative to libs/) and where it runs. One per shipped component subpath. */
export const entries: ApiEntryConfig[] = [
  {
    entry: "@rivetjs/ui/scheduler",
    file: "ui/src/components/scheduler/index.ts",
    runsOn: "both",
    summary: "Scheduler: month, week and day event layout, editing, range selection, custom headers and context menus.",
  },
  {
    entry: "@rivetjs/ui/surface",
    file: "ui/src/components/surface/index.ts",
    runsOn: "both",
    summary: "Surface: the base surface (background + shadow tokens) other components sit on.",
  },
  {
    entry: "@rivetjs/ui/card",
    file: "ui/src/components/card/index.ts",
    runsOn: "both",
    summary: "Card with Header, Title, Description, Content and Footer parts.",
  },
  {
    entry: "@rivetjs/ui/separator",
    file: "ui/src/components/separator/index.ts",
    runsOn: "both",
    summary: "Separator on the cdk Separator (hr, or a vertical role=separator).",
  },
  { entry: "@rivetjs/ui/header", file: "ui/src/components/header/index.ts", runsOn: "both", summary: "Header: section header text on the cdk Header." },
  {
    entry: "@rivetjs/ui/label",
    file: "ui/src/components/label/index.ts",
    runsOn: "both",
    summary: "Label on the cdk Label, with required / invalid / disabled modifiers.",
  },
  {
    entry: "@rivetjs/ui/description",
    file: "ui/src/components/description/index.ts",
    runsOn: "both",
    summary: "Description: field help text (cdk Text, slot description).",
  },
  {
    entry: "@rivetjs/ui/error-message",
    file: "ui/src/components/error-message/index.ts",
    runsOn: "both",
    summary: "ErrorMessage: field error text (cdk Text, slot errorMessage).",
  },
  {
    entry: "@rivetjs/ui/field-error",
    file: "ui/src/components/field-error/index.ts",
    runsOn: "both",
    summary: "FieldError: a field's validation errors, shown while invalid (cdk FieldError).",
  },
  {
    entry: "@rivetjs/ui/kbd",
    file: "ui/src/components/kbd/index.ts",
    runsOn: "both",
    summary: "Kbd: keyboard keys and shortcuts, with key symbols and names.",
  },
  { entry: "@rivetjs/ui/spinner", file: "ui/src/components/spinner/index.ts", runsOn: "both", summary: "Spinner: a loading indicator (role=status)." },
  {
    entry: "@rivetjs/ui/skeleton",
    file: "ui/src/components/skeleton/index.ts",
    runsOn: "both",
    summary: "Skeleton: a loading placeholder with shimmer or pulse.",
  },
  {
    entry: "@rivetjs/ui/empty-state",
    file: "ui/src/components/empty-state/index.ts",
    runsOn: "both",
    summary: "EmptyState: a placeholder for empty lists and searches; optional media, title, description and actions parts.",
  },
  {
    entry: "@rivetjs/ui/data-grid",
    file: "ui/src/components/data-grid/index.ts",
    runsOn: "both",
    summary:
      "DataGrid: a data-driven grid with sorting, selection, resizing, pinning, tree rows, reordering and virtualization (Rivet addition on @rivetjs/cdk/data-grid).",
  },
  {
    entry: "@rivetjs/ui/carousel",
    file: "ui/src/components/carousel/index.ts",
    runsOn: "both",
    summary: "Carousel: a slide show with buttons, dots, thumbnails, autoplay and drag (Rivet addition on @rivetjs/cdk/carousel).",
  },
  {
    entry: "@rivetjs/ui/lightbox",
    file: "ui/src/components/lightbox/index.ts",
    runsOn: "both",
    summary:
      "Lightbox: a full-screen viewer for images, video, embeds and PDF with zoom, captions, thumbnails and more (Rivet addition on @rivetjs/cdk/lightbox).",
  },
  {
    entry: "@rivetjs/ui/badge",
    file: "ui/src/components/badge/index.ts",
    runsOn: "both",
    summary: "Badge: a count or status marker pinned to a corner of its anchor.",
  },
  { entry: "@rivetjs/ui/chip", file: "ui/src/components/chip/index.ts", runsOn: "both", summary: "Chip: a small inline label with color, size and variant." },
  {
    entry: "@rivetjs/ui/alert",
    file: "ui/src/components/alert/index.ts",
    runsOn: "both",
    summary: "Alert: a status message with Indicator, Content, Title and Description parts.",
  },
  {
    entry: "@rivetjs/ui/typography",
    file: "ui/src/components/typography/index.ts",
    runsOn: "both",
    summary: "Typography: the type scale (Heading, Paragraph, Code, Prose).",
  },
  { entry: "@rivetjs/ui/link", file: "ui/src/components/link/index.ts", runsOn: "both", summary: "Link on the cdk Link, with an optional trailing icon." },
  {
    entry: "@rivetjs/ui/button",
    file: "ui/src/components/button/index.ts",
    runsOn: "both",
    summary: "Button on the cdk Button: variants, sizes, icon-only, render props.",
  },
  {
    entry: "@rivetjs/ui/button-group",
    file: "ui/src/components/button-group/index.ts",
    runsOn: "both",
    summary: "ButtonGroup: buttons sharing size, variant and disabled state (cdk Group).",
  },
  {
    entry: "@rivetjs/ui/toggle-button",
    file: "ui/src/components/toggle-button/index.ts",
    runsOn: "both",
    summary: "ToggleButton on the cdk ToggleButton (aria-pressed, two-way isSelected).",
  },
  {
    entry: "@rivetjs/ui/toggle-button-group",
    file: "ui/src/components/toggle-button-group/index.ts",
    runsOn: "both",
    summary: "ToggleButtonGroup on the cdk ToggleButtonGroup (single or multiple selection, arrow keys).",
  },
  {
    entry: "@rivetjs/ui/segment",
    file: "ui/src/components/segment/index.ts",
    runsOn: "both",
    summary: "Segment (Rivet addition): segmented control on the cdk ToggleButtonGroup (single selection) with a gliding SelectionIndicator.",
  },
  {
    entry: "@rivetjs/ui/close-button",
    file: "ui/src/components/close-button/index.ts",
    runsOn: "both",
    summary: "CloseButton: an icon-only close button on the cdk Button.",
  },
  {
    entry: "@rivetjs/ui/avatar",
    file: "ui/src/components/avatar/index.ts",
    runsOn: "both",
    summary: "Avatar: an image with a fallback, on a port of the Radix avatar primitive.",
  },
  {
    entry: "@rivetjs/ui/avatar-group",
    file: "ui/src/components/avatar-group/index.ts",
    runsOn: "both",
    summary: "AvatarGroup: stacked avatars with a max and a +N count.",
  },
  {
    entry: "@rivetjs/ui/progress-bar",
    file: "ui/src/components/progress-bar/index.ts",
    runsOn: "both",
    summary: "ProgressBar on the cdk ProgressBar (determinate or indeterminate).",
  },
  {
    entry: "@rivetjs/ui/progress-circle",
    file: "ui/src/components/progress-circle/index.ts",
    runsOn: "both",
    summary: "ProgressCircle: a circular progress indicator on the cdk ProgressBar.",
  },
  { entry: "@rivetjs/ui/meter", file: "ui/src/components/meter/index.ts", runsOn: "both", summary: "Meter on the cdk Meter (role=meter)." },
  {
    entry: "@rivetjs/ui/resizable",
    file: "ui/src/components/resizable/index.ts",
    runsOn: "both",
    summary:
      "Resizable (Rivet addition): shadcn/ui ResizablePanelGroup / ResizablePanel / ResizableHandle (+ ResizableIndicator, handle types line / drag / pill / handle, separator-token variants) on the cdk resizable, Rivet UI look.",
  },
  {
    entry: "@rivetjs/ui/scroll-area",
    file: "ui/src/components/scroll-area/index.ts",
    runsOn: "both",
    summary: "ScrollArea (Rivet addition): Radix ScrollArea behaviour from the cdk with overlay scrollbars, sizes, variants and a ScrollShadow fade.",
  },
  {
    entry: "@rivetjs/ui/scroll-shadow",
    file: "ui/src/components/scroll-shadow/index.ts",
    runsOn: "both",
    summary: "ScrollShadow: fades the scrolled-away edges of a scroll container (CSS scroll-driven, attribute fallback).",
  },
  {
    entry: "@rivetjs/ui/popover",
    file: "ui/src/components/popover/index.ts",
    runsOn: "both",
    summary: "Popover: Trigger, Content, Dialog, Heading and Arrow on the cdk DialogTrigger / Popover / Dialog.",
  },
  {
    entry: "@rivetjs/ui/tooltip",
    file: "ui/src/components/tooltip/index.ts",
    runsOn: "both",
    summary: "Tooltip: Trigger, Content and Arrow on the cdk TooltipTrigger / Tooltip (hover + focus, warmup).",
  },
  {
    entry: "@rivetjs/ui/input",
    file: "ui/src/components/input/index.ts",
    runsOn: "both",
    summary: "Input: single-line text input on the cdk Input (primary / secondary, full width; TextField variant).",
  },
  {
    entry: "@rivetjs/ui/textarea",
    file: "ui/src/components/textarea/index.ts",
    runsOn: "both",
    summary: "TextArea: multiline text input on the cdk TextArea (primary / secondary, full width; TextField variant).",
  },
  {
    entry: "@rivetjs/ui/textfield",
    file: "ui/src/components/textfield/index.ts",
    runsOn: "both",
    summary: "TextField on the cdk TextField: label, Input / TextArea, description, field error; variant context.",
  },
  {
    entry: "@rivetjs/ui/form",
    file: "ui/src/components/form/index.ts",
    runsOn: "both",
    summary: "Form on the cdk Form (validation behaviour, server errors).",
  },
  {
    entry: "@rivetjs/ui/fieldset",
    file: "ui/src/components/fieldset/index.ts",
    runsOn: "both",
    summary: "Fieldset with Legend, Group and Actions parts; a disabled fieldset disables the cdk components inside.",
  },
  {
    entry: "@rivetjs/ui/breadcrumbs",
    file: "ui/src/components/breadcrumbs/index.ts",
    runsOn: "both",
    summary: "Breadcrumbs: Item links on the cdk Breadcrumbs / Breadcrumb (current page, separators).",
  },
  {
    entry: "@rivetjs/ui/toolbar",
    file: "ui/src/components/toolbar/index.ts",
    runsOn: "both",
    summary: "Toolbar: container of controls with arrow-key navigation on the cdk Toolbar.",
  },
  {
    entry: "@rivetjs/ui/action-bar",
    file: "ui/src/components/action-bar/index.ts",
    runsOn: "both",
    summary: "ActionBar (Rivet addition): floating bottom toolbar for bulk actions on a selection; Prefix (live count), Content, Suffix on the ui Toolbar.",
  },
  {
    entry: "@rivetjs/ui/morph",
    file: "ui/src/components/morph/index.ts",
    runsOn: "both",
    summary:
      "Morph (Rivet addition): a pill that morphs into a panel and back (house motion, eight directions, primary / secondary), focus in and back, Escape / outside close.",
  },
  {
    entry: "@rivetjs/ui/item-morph",
    file: "ui/src/components/item-morph/index.ts",
    runsOn: "both",
    summary:
      "ItemMorph (Rivet addition): iOS-style item preview — a ListBox / GridList / Menu item lifts into a panel on a long press, right click, press or Shift+F10 and morphs back.",
  },
  {
    entry: "@rivetjs/ui/rating",
    file: "ui/src/components/rating/index.ts",
    runsOn: "both",
    summary: "Rating (Rivet addition): star (or any lucide icon) rating on native radios, or a read-only fractional display; render function per item.",
  },
  {
    entry: "@rivetjs/ui/trend-chip",
    file: "ui/src/components/trend-chip/index.ts",
    runsOn: "both",
    summary:
      "TrendChip (Rivet addition): direction of a change with a lucide icon and a good / bad colour (inverted for lower-is-better), prefix / suffix, custom indicator.",
  },
  {
    entry: "@rivetjs/ui/kpi",
    file: "ui/src/components/kpi/index.ts",
    runsOn: "both",
    summary: "Kpi (Rivet addition): metric card with title, icon, formatted value, trend, progress, description, chart, actions and footer slots.",
  },
  {
    entry: "@rivetjs/ui/cell-switch",
    file: "ui/src/components/cell-switch/index.ts",
    runsOn: "both",
    summary: "CellSwitch (Rivet addition): a settings-row switch; the whole row toggles.",
  },
  {
    entry: "@rivetjs/ui/hover-card",
    file: "ui/src/components/hover-card/index.ts",
    runsOn: "both",
    summary: "HoverCard (Rivet addition): a preview card on hover, keyboard focus or long press.",
  },
  {
    entry: "@rivetjs/ui/emoji-reaction-button",
    file: "ui/src/components/emoji-reaction-button/index.ts",
    runsOn: "both",
    summary: "EmojiReactionButton (Rivet addition): an emoji + count reaction toggle, sizes, read-only.",
  },
  {
    entry: "@rivetjs/ui/context-menu",
    file: "ui/src/components/context-menu/index.ts",
    runsOn: "both",
    summary: "ContextMenu (Rivet addition): a right-click / long-press menu at the pointer on the Dropdown parts.",
  },
  {
    entry: "@rivetjs/ui/command",
    file: "ui/src/components/command/index.ts",
    runsOn: "both",
    summary: "Command (Rivet addition): a modal command palette; search field filtering grouped commands, sizes, backdrops.",
  },
  {
    entry: "@rivetjs/ui/list-view",
    file: "ui/src/components/list-view/index.ts",
    runsOn: "both",
    summary:
      "ListView (Rivet addition): a single-column interactive list on GridList (variants, selection checkboxes, row actions, empty state, virtualization).",
  },
  {
    entry: "@rivetjs/ui/file-tree",
    file: "ui/src/components/file-tree/index.ts",
    runsOn: "both",
    summary: "FileTree (Rivet addition): a file / folder tree on Tree (sizes, guide lines, icons, custom indicator, selection).",
  },
  {
    entry: "@rivetjs/ui/pressable-feedback",
    file: "ui/src/components/pressable-feedback/index.ts",
    runsOn: "both",
    summary: "PressableFeedback (Rivet addition): a pressable with highlight, ripple, hold-to-confirm and progress feedback layers.",
  },
  {
    entry: "@rivetjs/ui/holo-card",
    file: "ui/src/components/holo-card/index.ts",
    runsOn: "both",
    summary: "HoloCard (Rivet addition): a 3D tilting card with a pointer-tracked holographic glare (CSS variables, CSS tilt).",
  },
  {
    entry: "@rivetjs/ui/floating-toc",
    file: "ui/src/components/floating-toc/index.ts",
    runsOn: "both",
    summary: "FloatingToc (Rivet addition): section bars that open a floating list of sections on hover or press.",
  },
  {
    entry: "@rivetjs/ui/cell-color-picker",
    file: "ui/src/components/cell-color-picker/index.ts",
    runsOn: "both",
    summary: "CellColorPicker (Rivet addition): a settings-row ColorPicker (label, hex value, swatch, popover).",
  },
  {
    entry: "@rivetjs/ui/drop-zone",
    file: "ui/src/components/drop-zone/index.ts",
    runsOn: "both",
    summary: "DropZone (Rivet addition): a drag-and-drop / paste / browse upload area with a file list (format badge, progress, retry, remove).",
  },
  {
    entry: "@rivetjs/ui/kpi-group",
    file: "ui/src/components/kpi-group/index.ts",
    runsOn: "both",
    summary: "KpiGroup (Rivet addition): KPI cards on one shared surface, horizontal or vertical, with separators.",
  },
  {
    entry: "@rivetjs/ui/number-value",
    file: "ui/src/components/number-value/index.ts",
    runsOn: "both",
    summary: "NumberValue (Rivet addition): locale-aware formatted number (currency, percent, unit, compact, sign) with prefix / suffix.",
  },
  {
    entry: "@rivetjs/ui/widget",
    file: "ui/src/components/widget/index.ts",
    runsOn: "both",
    summary: "Widget (Rivet addition): dashboard container with header, legend, raised content area and footer.",
  },
  {
    entry: "@rivetjs/ui/description-list",
    file: "ui/src/components/description-list/index.ts",
    runsOn: "both",
    summary: "DescriptionList (Rivet addition): key / value rows (order summaries, totals, specs) with an emphasized total row.",
  },
  {
    entry: "@rivetjs/ui/feature-list",
    file: "ui/src/components/feature-list/index.ts",
    runsOn: "both",
    summary: "FeatureList (Rivet addition): perks / plan features with a leading lucide icon (check by default).",
  },
  {
    entry: "@rivetjs/ui/status",
    file: "ui/src/components/status/index.ts",
    runsOn: "both",
    summary: "Status (Rivet addition): status / presence / unread dot in the semantic colours, three sizes, optional CSS pulse.",
  },
  {
    entry: "@rivetjs/ui/qr-code",
    file: "ui/src/components/qr-code/index.ts",
    runsOn: "both",
    summary:
      "QRCode (Rivet addition): QR code from a value (server-rendered SVG), square / dots / rounded shapes, gradient presets, centred icon, loading placeholder + shimmer.",
  },
  {
    entry: "@rivetjs/ui/item-card",
    file: "ui/src/components/item-card/index.ts",
    runsOn: "both",
    summary: "ItemCard (Rivet addition): list row card with icon, title, description and a trailing action.",
  },
  {
    entry: "@rivetjs/ui/item-card-group",
    file: "ui/src/components/item-card-group/index.ts",
    runsOn: "both",
    summary: "ItemCardGroup (Rivet addition): item cards as a divided list or a grid, with a section header.",
  },
  {
    entry: "@rivetjs/ui/timeline",
    file: "ui/src/components/timeline/index.ts",
    runsOn: "both",
    summary: "Timeline (Rivet addition): read-only chronology on a start or centred rail with status markers.",
  },
  {
    entry: "@rivetjs/ui/chart",
    file: "ui/src/components/chart/index.ts",
    runsOn: "both",
    summary:
      "Charts (Rivet addition): area, line, bar (grouped, stacked, horizontal), donut and sparkline charts rendered on the server, gaps for missing values, dots, CSS-only tooltips.",
  },
  {
    entry: "@rivetjs/ui/chart-tooltip",
    file: "ui/src/components/chart-tooltip/index.ts",
    runsOn: "both",
    summary: "ChartTooltip (Rivet addition): tooltip parts (header, items, indicator, label, value) for custom chart tooltips.",
  },
  {
    entry: "@rivetjs/ui/pie-chart",
    file: "ui/src/components/pie-chart/index.ts",
    runsOn: "both",
    summary: "PieChart (Rivet addition): pie and donut rings rendered on the server with labels, legend and CSS-only tooltips.",
  },
  {
    entry: "@rivetjs/ui/radar-chart",
    file: "ui/src/components/radar-chart/index.ts",
    runsOn: "both",
    summary: "RadarChart (Rivet addition): polygon or circle grid radar with one or more series, server-rendered.",
  },
  {
    entry: "@rivetjs/ui/radial-chart",
    file: "ui/src/components/radial-chart/index.ts",
    runsOn: "both",
    summary: "RadialChart (Rivet addition): concentric progress rings with track, legend and centre content.",
  },
  {
    entry: "@rivetjs/ui/composed-chart",
    file: "ui/src/components/composed-chart/index.ts",
    runsOn: "both",
    summary: "ComposedChart (Rivet addition): bar, line and area series on one cartesian frame.",
  },
  {
    entry: "@rivetjs/ui/kanban",
    file: "ui/src/components/kanban/index.ts",
    runsOn: "both",
    summary: "Kanban (Rivet addition): board of columns and draggable cards on cdk DropList / Drag, with createKanban state.",
  },
  {
    entry: "@rivetjs/ui/navbar",
    file: "ui/src/components/navbar/index.ts",
    runsOn: "both",
    summary: "Navbar (Rivet addition): responsive top bar with brand, items, mobile menu, zero-JS hide on scroll and router integration.",
  },
  {
    entry: "@rivetjs/ui/sidebar",
    file: "ui/src/components/sidebar/index.ts",
    runsOn: "both",
    summary:
      "Sidebar (Rivet addition): the shadcn/ui Sidebar parts from @rivetjs/cdk/sidebar with the Rivet UI look; collapsible, cookie-persisted, a swipeable sheet on mobile.",
  },
  {
    entry: "@rivetjs/ui/app-layout",
    file: "ui/src/components/app-layout/index.ts",
    runsOn: "both",
    summary:
      "AppLayout (Rivet addition): app shell of sidebar, sticky navbar, main, aside, toolbar and footer; resizable, persisted panels and a mobile aside sheet.",
  },
  {
    entry: "@rivetjs/ui/masonry",
    file: "ui/src/components/masonry/index.ts",
    runsOn: "both",
    summary:
      "Masonry + Bento (Rivet additions): masonry columns and span tiles on @rivetjs/cdk/masonry; server-exact placement, measured / virtualized modes, keys, selection.",
  },
  {
    entry: "@rivetjs/ui/compare",
    file: "ui/src/components/compare/index.ts",
    runsOn: "both",
    summary:
      "Compare (Rivet addition): before / after layers with a draggable divider (round handle, labels) on @rivetjs/cdk/compare; keys, drag anywhere, vertical.",
  },
  {
    entry: "@rivetjs/ui/stepper",
    file: "ui/src/components/stepper/index.ts",
    runsOn: "both",
    summary: "Stepper (Rivet addition): progress through numbered steps with indicators, titles, descriptions and separators on @rivetjs/cdk/stepper.",
  },
  {
    entry: "@rivetjs/ui/modal",
    file: "ui/src/components/modal/index.ts",
    runsOn: "both",
    summary:
      "Modal: Trigger, Backdrop, Container, Dialog, Header, Icon, Heading, Body, Footer and CloseTrigger on the cdk DialogTrigger / ModalOverlay / Modal / Dialog; useOverlayState.",
  },
  {
    entry: "@rivetjs/ui/input-group",
    file: "ui/src/components/input-group/index.ts",
    runsOn: "both",
    summary: "InputGroup with Prefix, Input, TextArea and Suffix parts on the cdk Group.",
  },
  {
    entry: "@rivetjs/ui/search-field",
    file: "ui/src/components/search-field/index.ts",
    runsOn: "both",
    summary: "SearchField with Group, SearchIcon, Input and ClearButton parts on the cdk SearchField.",
  },
  {
    entry: "@rivetjs/ui/number-field",
    file: "ui/src/components/number-field/index.ts",
    runsOn: "both",
    summary: "NumberField with Group, Input, IncrementButton and DecrementButton parts on the cdk NumberField.",
  },
  {
    entry: "@rivetjs/ui/number-stepper",
    file: "ui/src/components/number-stepper/index.ts",
    runsOn: "both",
    summary: "NumberStepper (Rivet addition): pill stepper on the cdk NumberField; Group, Value (animated display), Decrement / Increment buttons.",
  },
  {
    entry: "@rivetjs/ui/list-box",
    file: "ui/src/components/list-box/index.ts",
    runsOn: "both",
    summary: "ListBox: options with an item indicator and sections on the cdk ListBox.",
  },
  {
    entry: "@rivetjs/ui/list-box-item",
    file: "ui/src/components/list-box-item/index.ts",
    runsOn: "both",
    summary: "ListBoxItem: an option of a ListBox (+ Indicator) on the cdk ListBoxItem.",
  },
  {
    entry: "@rivetjs/ui/list-box-section",
    file: "ui/src/components/list-box-section/index.ts",
    runsOn: "both",
    summary: "ListBoxSection: a group of ListBox options on the cdk ListBoxSection.",
  },
  {
    entry: "@rivetjs/ui/tag",
    file: "ui/src/components/tag/index.ts",
    runsOn: "both",
    summary: "Tag: a tag of a TagGroup with an optional remove button, on the cdk Tag.",
  },
  {
    entry: "@rivetjs/ui/tag-group",
    file: "ui/src/components/tag-group/index.ts",
    runsOn: "both",
    summary: "TagGroup: a focusable, selectable list of tags on the cdk TagGroup / TagList.",
  },
  {
    entry: "@rivetjs/ui/alert-dialog",
    file: "ui/src/components/alert-dialog/index.ts",
    runsOn: "both",
    summary:
      "AlertDialog: Trigger, Backdrop, Container, Dialog (role alertdialog), Header, Heading, Body, Footer, Icon (status) and CloseTrigger on the cdk DialogTrigger / ModalOverlay / Modal / Dialog.",
  },
  {
    entry: "@rivetjs/ui/drawer",
    file: "ui/src/components/drawer/index.ts",
    runsOn: "both",
    summary:
      "Drawer: Trigger, Backdrop, Content (placement), Dialog (drag to dismiss on cdk motion), Header, Heading, Body, Footer, Handle and CloseTrigger on the cdk DialogTrigger / ModalOverlay / Modal / Dialog.",
  },
  {
    entry: "@rivetjs/ui/sheet",
    file: "ui/src/components/sheet/index.ts",
    runsOn: "both",
    summary: "Sheet (Rivet addition): draggable edge sheet with snap points, nested and non-modal sheets on the cdk overlay layer + @rivetjs/cdk/sheet-motion.",
  },
  {
    entry: "@rivetjs/ui/calendar",
    file: "ui/src/components/calendar/index.ts",
    runsOn: "both",
    summary: "Calendar: month grid with navigation, cells, indicators and the year picker parts.",
  },
  {
    entry: "@rivetjs/ui/calendar-year-picker",
    file: "ui/src/components/calendar-year-picker/index.ts",
    runsOn: "both",
    summary: "CalendarYearPicker: year picker trigger + year grid parts for Calendar / RangeCalendar.",
  },
  { entry: "@rivetjs/ui/menu", file: "ui/src/components/menu/index.ts", runsOn: "both", summary: "Menu: styled classes on the cdk Menu." },
  {
    entry: "@rivetjs/ui/menu-item",
    file: "ui/src/components/menu-item/index.ts",
    runsOn: "both",
    summary: "MenuItem: cdk MenuItem with selection / submenu indicators.",
  },
  {
    entry: "@rivetjs/ui/menu-section",
    file: "ui/src/components/menu-section/index.ts",
    runsOn: "both",
    summary: "MenuSection: cdk MenuSection with its styled class.",
  },
  {
    entry: "@rivetjs/ui/dropdown",
    file: "ui/src/components/dropdown/index.ts",
    runsOn: "both",
    summary: "Dropdown: cdk MenuTrigger + Button + Popover + Menu with the dropdown slots.",
  },
  {
    entry: "@rivetjs/ui/input-otp",
    file: "ui/src/components/input-otp/index.ts",
    runsOn: "both",
    summary: "InputOTP with Group, Slot and Separator parts (in-tree input-otp port).",
  },
  {
    entry: "@rivetjs/ui/range-calendar",
    file: "ui/src/components/range-calendar/index.ts",
    runsOn: "both",
    summary: "RangeCalendar: month grid for selecting a date range, with navigation, cell buttons, indicators and the year picker parts.",
  },
  {
    entry: "@rivetjs/ui/toast",
    file: "ui/src/components/toast/index.ts",
    runsOn: "both",
    summary:
      "Toast: Provider (stacked region on the cdk ToastRegion), Content, Indicator, Title, Description, ActionButton, CloseButton; ToastQueue + toast() helpers (variants, promise, update).",
  },
  {
    entry: "@rivetjs/ui/checkbox",
    file: "ui/src/components/checkbox/index.ts",
    runsOn: "both",
    summary: "Checkbox with Control, Indicator and Content parts on the cdk CheckboxField / CheckboxButton.",
  },
  {
    entry: "@rivetjs/ui/checkbox-group",
    file: "ui/src/components/checkbox-group/index.ts",
    runsOn: "both",
    summary: "CheckboxGroup on the cdk CheckboxGroup.",
  },
  {
    entry: "@rivetjs/ui/checkbox-button-group",
    file: "ui/src/components/checkbox-button-group/index.ts",
    runsOn: "both",
    summary: "CheckboxButtonGroup (Rivet addition): checkbox group as selectable cards; Item, Indicator, ItemIcon, ItemContent; flex / grid layout.",
  },
  {
    entry: "@rivetjs/ui/radio",
    file: "ui/src/components/radio/index.ts",
    runsOn: "both",
    summary: "Radio with Content, Control and Indicator parts on the cdk RadioField / RadioButton.",
  },
  {
    entry: "@rivetjs/ui/radio-group",
    file: "ui/src/components/radio-group/index.ts",
    runsOn: "both",
    summary: "RadioGroup on the cdk RadioGroup (compound form).",
  },
  {
    entry: "@rivetjs/ui/radio-button-group",
    file: "ui/src/components/radio-button-group/index.ts",
    runsOn: "both",
    summary: "RadioButtonGroup (Rivet addition): radio group as selectable cards; Item, Indicator, ItemIcon, ItemContent; flex / grid layout.",
  },
  {
    entry: "@rivetjs/ui/switch",
    file: "ui/src/components/switch/index.ts",
    runsOn: "both",
    summary: "Switch with Control, Thumb, Icon and Content parts on the cdk SwitchField / SwitchButton.",
  },
  {
    entry: "@rivetjs/ui/switch-group",
    file: "ui/src/components/switch-group/index.ts",
    runsOn: "both",
    summary: "SwitchGroup with Items: a layout group for Switches.",
  },
  {
    entry: "@rivetjs/ui/date-input-group",
    file: "ui/src/components/date-input-group/index.ts",
    runsOn: "both",
    summary: "DateInputGroup: segmented date / time input group with prefix, input container and suffix parts.",
  },
  {
    entry: "@rivetjs/ui/date-field",
    file: "ui/src/components/date-field/index.ts",
    runsOn: "both",
    summary: "DateField: segmented date input field on DateInputGroup parts.",
  },
  {
    entry: "@rivetjs/ui/time-field",
    file: "ui/src/components/time-field/index.ts",
    runsOn: "both",
    summary: "TimeField: segmented time input field on DateInputGroup parts.",
  },
  {
    entry: "@rivetjs/ui/date-picker",
    file: "ui/src/components/date-picker/index.ts",
    runsOn: "both",
    summary: "DatePicker: date field with a calendar popover — root, trigger, trigger indicator and popover parts.",
  },
  {
    entry: "@rivetjs/ui/date-range-picker",
    file: "ui/src/components/date-range-picker/index.ts",
    runsOn: "both",
    summary: "DateRangePicker: start / end date fields with a range calendar popover — root, trigger, indicator, range separator and popover parts.",
  },
  {
    entry: "@rivetjs/ui/select",
    file: "ui/src/components/select/index.ts",
    runsOn: "both",
    summary: "Select: Trigger / Value / Indicator / ClearButton / Popover on the cdk Select parts form.",
  },
  {
    entry: "@rivetjs/ui/native-select",
    file: "ui/src/components/native-select/index.ts",
    runsOn: "both",
    summary: "NativeSelect (Rivet addition): styled real <select> field on the cdk TextField + NativeSelect; Trigger, Indicator, Option, OptGroup.",
  },
  {
    entry: "@rivetjs/ui/cell-select",
    file: "ui/src/components/cell-select/index.ts",
    runsOn: "both",
    summary: "CellSelect (Rivet addition): settings-row select on the cdk Select parts; Trigger (the cell), Label, Value, Indicator, Popover.",
  },
  {
    entry: "@rivetjs/ui/inline-select",
    file: "ui/src/components/inline-select/index.ts",
    runsOn: "both",
    summary:
      "InlineSelect (Rivet addition): inline dropdown on the cdk Select parts (team switchers, sentence pickers, breadcrumb switchers); Trigger, Value, Indicator, Popover.",
  },
  {
    entry: "@rivetjs/ui/disclosure",
    file: "ui/src/components/disclosure/index.ts",
    runsOn: "both",
    summary: "Disclosure: Heading, Trigger, Content, Body and Indicator on the cdk Disclosure / DisclosurePanel.",
  },
  {
    entry: "@rivetjs/ui/combo-box",
    file: "ui/src/components/combo-box/index.ts",
    runsOn: "both",
    summary: "ComboBox: InputGroup / Value / Trigger / Popover on the cdk ComboBox; Input takes its variant.",
  },
  {
    entry: "@rivetjs/ui/slider",
    file: "ui/src/components/slider/index.ts",
    runsOn: "both",
    summary: "Slider with Output, Track, Fill, Thumb and Marks parts on the cdk Slider.",
  },
  {
    entry: "@rivetjs/ui/cell-slider",
    file: "ui/src/components/cell-slider/index.ts",
    runsOn: "both",
    summary: "CellSlider (Rivet addition): settings-cell slider on the cdk Slider; Label, Output, Track (whole cell), Fill, Thumb.",
  },
  {
    entry: "@rivetjs/ui/disclosure-group",
    file: "ui/src/components/disclosure-group/index.ts",
    runsOn: "both",
    summary: "DisclosureGroup: the cdk DisclosureGroup (single / multiple expansion, expandedKeys signal) + useDisclosureGroupNavigation (previous / next).",
  },
  {
    entry: "@rivetjs/ui/autocomplete",
    file: "ui/src/components/autocomplete/index.ts",
    runsOn: "both",
    summary: "Autocomplete: a Select whose popover filters the options with a search field (cdk Select + Autocomplete).",
  },
  {
    entry: "@rivetjs/ui/accordion",
    file: "ui/src/components/accordion/index.ts",
    runsOn: "both",
    summary:
      "Accordion: Item, Heading, Trigger, Panel, Body and Indicator on the cdk DisclosureGroup / Disclosure / DisclosurePanel (surface variant, hideSeparator).",
  },
  {
    entry: "@rivetjs/ui/pagination",
    file: "ui/src/components/pagination/index.ts",
    runsOn: "both",
    summary: "Pagination: nav landmark with Summary / Content / Item / Link / Previous / Next / Ellipsis parts (links are cdk Buttons).",
  },
  {
    entry: "@rivetjs/ui/color-swatch",
    file: "ui/src/components/color-swatch/index.ts",
    runsOn: "both",
    summary: "ColorSwatch: accessible preview of a color value.",
  },
  {
    entry: "@rivetjs/ui/color-area",
    file: "ui/src/components/color-area/index.ts",
    runsOn: "both",
    summary: "ColorArea: 2D gradient area picking two channels of a color, with its thumb.",
  },
  {
    entry: "@rivetjs/ui/color-slider",
    file: "ui/src/components/color-slider/index.ts",
    runsOn: "both",
    summary: "ColorSlider: one-channel color slider — root, output, track and thumb parts.",
  },
  {
    entry: "@rivetjs/ui/color-input-group",
    file: "ui/src/components/color-input-group/index.ts",
    runsOn: "both",
    summary: "ColorInputGroup: color input group with prefix, input and suffix parts.",
  },
  {
    entry: "@rivetjs/ui/color-field",
    file: "ui/src/components/color-field/index.ts",
    runsOn: "both",
    summary: "ColorField: hex or single-channel color input field on ColorInputGroup parts.",
  },
  {
    entry: "@rivetjs/ui/color-swatch-picker",
    file: "ui/src/components/color-swatch-picker/index.ts",
    runsOn: "both",
    summary: "ColorSwatchPicker: listbox of preset color swatches — root, item, swatch and indicator parts.",
  },
  {
    entry: "@rivetjs/ui/color-picker",
    file: "ui/src/components/color-picker/index.ts",
    runsOn: "both",
    summary: "ColorPicker: one color value shared by a trigger and the color parts in its popover — root, trigger and popover.",
  },
  {
    entry: "@rivetjs/ui/table",
    file: "ui/src/components/table/index.ts",
    runsOn: "both",
    summary: "Table: Root / ScrollContainer / Content (cdk Table) / Header / Column / Body / Row / Cell + sortable header, resizing and load-more parts.",
  },
  {
    entry: "@rivetjs/ui/table-tanstack",
    file: "ui/src/table-tanstack/index.ts",
    runsOn: "both",
    summary: "TanStack Table v9 adapter: createTable on signals, flexRender / FlexRender, sort descriptor bridge (optional peer @tanstack/table-core).",
  },
  {
    entry: "@rivetjs/ui/tabs",
    file: "ui/src/components/tabs/index.ts",
    runsOn: "both",
    summary:
      "Tabs: ListContainer (scroll shadow + scroll buttons), List, Tab, Indicator (SelectionIndicator), Separator and Panel on the cdk Tabs / TabList / Tab / TabPanel (primary / secondary, align).",
  },
  {
    entry: "@rivetjs/ui/text-shimmer",
    file: "ui/src/components/text-shimmer/index.ts",
    runsOn: "both",
    summary: "TextShimmer (Rivet addition): a GPU-composited light sweep over a short status label; currentColor, isActive, reduced motion = solid text.",
  },
  {
    entry: "@rivetjs/ui/chat-loader",
    file: "ui/src/components/chat-loader/index.ts",
    runsOn: "both",
    summary:
      "ChatLoader (Rivet addition): Dots, Pulse, Spinner and Skeleton (SkeletonAvatar / SkeletonBlock / SkeletonLine) placeholders for a pending assistant turn.",
  },
  {
    entry: "@rivetjs/ui/chain-of-thought",
    file: "ui/src/components/chain-of-thought/index.ts",
    runsOn: "both",
    summary:
      "ChainOfThought (Rivet addition): collapsible reasoning / agent trace on the ui Disclosure; Trigger (shimmers while isStreaming), Content, Steps, Step (status, icon).",
  },
  {
    entry: "@rivetjs/ui/chat-message",
    file: "ui/src/components/chat-message/index.ts",
    runsOn: "both",
    summary: "ChatMessage (Rivet addition): Assistant / User turn layouts with Avatar, Body, Bubble, Content, Actions and Meta.",
  },
  {
    entry: "@rivetjs/ui/chat-message-actions",
    file: "ui/src/components/chat-message-actions/index.ts",
    runsOn: "both",
    summary: "ChatMessageActions (Rivet addition): message action row; Action (ghost icon Button) and Copy (clipboard + check feedback).",
  },
  {
    entry: "@rivetjs/ui/code-block",
    file: "ui/src/components/code-block/index.ts",
    runsOn: "both",
    summary:
      "CodeBlock (Rivet addition): server-highlighted code (@rivetjs/cdk/highlight) with Header, Language label, Code (accessor-friendly) and CopyButton.",
  },
  {
    entry: "@rivetjs/ui/markdown",
    file: "ui/src/components/markdown/index.ts",
    runsOn: "both",
    summary:
      "Markdown (Rivet addition): safe Markdown (AST from @rivetjs/cdk/markdown, no innerHTML) with keyed blocks for streaming, mark repair and caret; fenced code as CodeBlock.",
  },
  {
    entry: "@rivetjs/ui/chat-source",
    file: "ui/src/components/chat-source/index.ts",
    runsOn: "both",
    summary:
      "ChatSource / ChatSources (Rivet addition): citation pills with favicon or initial, hover preview (ui Tooltip), documents, a Disclosure source list and stacked Favicons.",
  },
  {
    entry: "@rivetjs/ui/chat-tool",
    file: "ui/src/components/chat-tool/index.ts",
    runsOn: "both",
    summary:
      "ChatTool / ChatToolGroup (Rivet addition): tool calls by state (input-streaming … requires-action) on the ui Disclosure; preset or composable Trigger, StatusIcon, Args, Result, Error, Approval.",
  },
  {
    entry: "@rivetjs/ui/chat-list-view",
    file: "ui/src/components/chat-list-view/index.ts",
    runsOn: "both",
    summary:
      "ChatListView (Rivet addition): conversation history list; Item (button or link, isCurrent), Icon, ItemContent, Title, Preview, Meta, Section; compact variant.",
  },
  {
    entry: "@rivetjs/ui/prompt-suggestion",
    file: "ui/src/components/prompt-suggestion/index.ts",
    runsOn: "both",
    summary: "PromptSuggestion (Rivet addition): starter prompts as pills or cards; Header, Title, Description, Items, Item and card parts.",
  },
  {
    entry: "@rivetjs/ui/prompt-input",
    file: "ui/src/components/prompt-input/index.ts",
    runsOn: "both",
    summary:
      "PromptInput (Rivet addition): chat composer; autosizing TextArea (Enter sends), Toolbar, Action (tooltip), Send / Stop by status, layouts stacked / compact / inline, Attachments, Footer, Queue.",
  },
  {
    entry: "@rivetjs/ui/prompt-input-tokens",
    file: "ui/src/components/prompt-input-tokens/index.ts",
    runsOn: "both",
    summary:
      "PromptInput token input (Rivet addition): usePromptInputTokens (triggers @ /, allowsSpaces, value), Tokens, TokenInput (textarea + mirror, atomic tokens), TokenSuggestions / TokenSuggestion (list autocomplete), Token.",
  },
  {
    entry: "@rivetjs/ui/chat-conversation",
    file: "ui/src/components/chat-conversation/index.ts",
    runsOn: "both",
    summary:
      "ChatConversation (Rivet addition): CSS stick-to-bottom role=log scroller (column-reverse), Content, ScrollAnchor and a ScrollButton shown away from the bottom.",
  },
  {
    entry: "@rivetjs/ui/chat-attachment",
    file: "ui/src/components/chat-attachment/index.ts",
    runsOn: "both",
    summary:
      "ChatAttachment (Rivet addition): file / media chips (kind inferred, size formatted, Remove), ChatAttachmentGroup, ChatAttachmentInput (Trigger, Dropzone render onto PromptInput.Shell).",
  },
];

export const packages: ApiPackage[] = [
  {
    name: "@rivetjs/ui",
    title: "@rivetjs/ui",
    summary: "Rivet UI: styled compound components on @rivetjs/cdk, its own stylesheet, Tailwind v4.",
  },
];
