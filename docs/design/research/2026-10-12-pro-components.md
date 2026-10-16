# Pro components — what 2026 kits ship, what Rivet needs (2026-10-12)

Lane ROADMAP (research only). User directive: "We need Pro ui components. Judge from nowadays realities what we actually need, check other frameworks, they already provide some proposals." Output feeds [`ROADMAP.md`](../../../ROADMAP.md) §2 / §3.

- Method: public catalogue pages read 2026-10-11/12 through the in-app browser (pattern analysis only: names, groupings, counts; no code, CSS or demo content copied). Pages read: shadcn/ui components + blocks + registry directory, HeroUI Pro components, Nuxt UI components, MUI X overview, Ant Design ProComponents, Mantine packages, AI Elements, assistant-ui, Ionic components, PrimeBlocks, Tremor. Tailwind Plus UI Blocks = login wall → category list from public marketing pages / prior knowledge. Other kits (Radix Themes, Park UI / Ark UI, Flowbite Pro, Untitled UI, Konsta UI, Framework7, Quasar, TanStack, cmdk, Sonner, react-day-picker, Uploadthing / FilePond, Tiptap / Lexical / Plate, dnd-kit, Recharts / ECharts / visx) from prior knowledge (cutoff 2026-06) — marked `(k)` where a claim rests on it.
- Rivet status source: `HERO-AUDIT.md` (scratchpad, 2026-10-11: HeroUI OSS 81/86, Pro 23 done / 18 partial / 25 missing), `libs/ui/src/components/` + `libs/cdk/` listings at HEAD, ui-docs showcases (auth, chat, dashboard, kanban, mail, music, pricing, settings, storefront ×3).
- Rules applied: clean-room for every HeroUI-Pro-inspired item (public names / anatomy only); cdk headless, ui = HeroUI look tweaked (UI-IDENTITY R1–R6); icons lucide; no React dependency; zero-cost per subpath; Pro-L rulings 2026-10-11 (kanban = component from showcase, agenda = malva port, emoji picker no, rich text not now, map no).

## 1. Surveyed kits (what their "pro" tier is in 2026)

| Kit | Model | Pro / blocks scope (2026) | Signal for us |
| --- | --- | --- | --- |
| shadcn/ui | free, copy-in + registry CLI | 70 core components now incl. **AI chat primitives in core** (Attachment, Bubble, Message, Message Scroller, Questionnaire, Marker) + `@shadcn/helpers` for AI SDK / TanStack AI + forms adapters (RHF / TanStack Form / Formisch); blocks = dashboard-01, sidebar-01…16, login / signup; **435 community registries** in the CLI directory | distribution (registry + MCP + skills) is the moat; AI chat is table stakes, not Pro |
| HeroUI Pro | paid, React | 66 pages: AI chat (13), charts (5 + KPI / trend), data-grid, app-layout / sidebar / navbar / sheet, cell editors, kanban, agenda, emoji picker, rich text, map, command, context menu, drop zone, file tree, timeline | our 1:1 reference; 23 / 18 / 25 status |
| Nuxt UI v4 | **free MIT (Pro merged into OSS)** | 125+ components: Layout (App, Sidebar, Splitter), Form (FileUpload, InputTags, InputRating, PinInput, ColorPicker, InputDate / Time), Data (Timeline, Tree, Marquee, Empty), Navigation (CommandPalette w/ Fuse.js, Stepper), Overlay (ContextMenu, Slideover, Toast), **Page** sections (Hero, CTA, Feature, Logos, Pricing Plans / Table, Blog, Changelog, AuthForm), **Dashboard** (Group / Navbar / Panel / Sidebar / Search / Toolbar / ResizeHandle), **AI Chat** (Message(s), Palette, Prompt, Reasoning, Shimmer, Tool), **Editor** (Tiptap; drag handle, emoji + mention menus, toolbar) | closest analogue (framework-owned UI kit); paid tier now free → "Pro" = baseline |
| MUI X | open core (MIT / Pro / Premium) | Data Grid (editing, server-side data, pinning, grouping, pivoting, aggregation, Excel export), Date / Time Pickers (range = Pro), Charts (bar / line / pie / scatter / heatmap / funnel / sankey), Tree View (drag reorder = Pro), **Scheduler (new)** | paid value = grid depth + range pickers + scheduler |
| Ant ProComponents | free | ProLayout (menu + breadcrumbs), PageContainer, ProCard / StatisticCard / CheckCard, ProForm + Schema Form + StepsForm + Query / LightFilter + Modal / Drawer form + LoginForm, ProTable / EditableProTable / DragSortTable (request-driven), ProList, ProDescriptions, ProSkeleton | CRUD-in-a-box: request-driven table + filter form is the most-used admin pattern |
| Mantine 8/9 | free | extension packages: dates, charts (Recharts), notifications, spotlight, dropzone, tiptap, carousel, lightbox, modals manager, nprogress, code-highlight, form | separate opt-in packages = our subpath model |
| Tailwind Plus | paid, markup | UI Blocks: Application UI (shells, headings, lists, tables, forms, feedback, nav, overlays, command palettes), Marketing (hero, features, pricing, CTA, testimonials, logo clouds, FAQ, footers, blog, 404), Ecommerce (product lists / overviews / quickviews, cart, checkout, order history, reviews, filters); templates (k) | blocks are layout + content, not behaviour |
| PrimeBlocks | paid, Tailwind | 490+ blocks; same 3 groups as Tailwind Plus (app shells, dashboard, stats, command menu, slide-over, notification; marketing; ecommerce) | confirms the 3-group block taxonomy |
| Tremor | free (Vercel) | 35+ dashboard components (Recharts + Radix): area / bar / line / donut / combo charts, spark charts, bar list, tracker, category bar, progress circle, date range picker, range slider w/ bins, multi-logic filter; 250+ blocks | dashboards = charts + filters + micro-viz |
| AI Elements (Vercel) | free, shadcn registry | 48 components: chat (conversation, message, prompt-input, attachments, reasoning, chain-of-thought, sources, inline-citation, tool, confirmation, queue, plan, task, checkpoint, context, model-selector, suggestion, shimmer), **agent / IDE** (artifact, code-block, file-tree, terminal, test-results, stack-trace, sandbox, web-preview, commit, schema-display, environment-variables, jsx-preview), **voice** (speech-input, transcription, audio-player, mic / voice selector, persona), **workflow canvas** (canvas, node, edge, connection, controls, panel, toolbar) | AI kits grew from chat into agent consoles + node editors |
| assistant-ui | OSS + cloud | headless chat runtime (threads, branching, attachments, tool UIs) for React / React Native / Ink / Vue; heat graph, safe content frame | runtime adapters (AI SDK, LangGraph) matter more than markup |
| Radix Themes / Park UI / Ark UI (k) | free | Radix Themes: styled primitives only, no Pro. Ark UI (Zag): date / color picker, file upload, tags input, pin input, signature pad, QR code, tour, floating panel, timer, splitter | headless breadth incl. tour / file upload / tags input |
| Flowbite Pro / Untitled UI (k) | paid | Flowbite: admin dashboard, app / marketing / ecommerce blocks, Figma. Untitled UI React: OSS components + paid pages / dashboards; file uploader, date range, tag inputs, charts | same taxonomy; Figma parity is a sales point |
| Ionic 8 / Konsta / Framework7 / Quasar (k + Ionic page) | free | Ionic: action sheet, alert, nav stack + router outlet, tabs, menu, modal sheets w/ breakpoints, refresher, infinite scroll, sliding items (swipe actions), reorder, searchbar, segment, picker wheels, FAB, toast, iOS / MD modes, Capacitor; Konsta: iOS / Material Tailwind skins; Framework7: full app shell + router; Quasar: build targets (SPA / PWA / Capacitor / Electron) | mobile app kit = separate category, no Rivet answer today |
| Libraries (k) | free | TanStack Table / Virtual / Form (headless engines, framework adapters), cmdk (command menu), Sonner (toasts), react-day-picker, Uploadthing / FilePond (upload + server), Tiptap / Lexical / Plate / ProseMirror (editors), dnd-kit (sortable / kanban), Recharts / ECharts / visx / Chart.js | engines people already know; adapters cheaper than ports |

## 2. Need matrix

Columns: **Ship** = how many of 13 kit families above ship it (shadcn, HeroUI Pro, Nuxt UI, MUI X, Ant Pro, Mantine, Tailwind Plus, PrimeBlocks, Tremor, AI Elements / assistant-ui, Ark / Park, Flowbite / Untitled, Ionic family). **Have** = Rivet today (cdk / ui / showcase). **Gap** S ≤ ½ day, M ≈ 1–3 days, L ≥ 1 week. **P** = P0 next wave · P1 soon after · P2 when asked · P3 idea / no.

### (a) Application shells + navigation

| Item | Others ship | Ship | Have | Gap | Deps (cdk) | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sidebar / app shell | shadcn sidebar-01…16, Nuxt Dashboard*, Ant ProLayout, Tailwind / Prime shells, HeroUI Pro app-layout | 9 | ui `sidebar`, `app-layout`, `navbar`, `sheet`, `resizable` (17 + 13 demos); 7 Pro sections missing | S | sidebar, resizable | P1 | done core; add Inset Dashboard / Docs Site / Client-Side Routing sections + dashboard block |
| Command palette | cmdk, shadcn Command, Nuxt CommandPalette, Mantine Spotlight, Tailwind / Prime command menus, HeroUI Pro command | 8 | none (cdk autocomplete + modal exist; docs sites have own search modal) | M | autocomplete, modal, collections, keyboard | **P0** | every app + docs site; ⌘K is expected UX |
| Breadcrumbs | all | 10 | ui `breadcrumbs` | — | — | — | done |
| Settings layouts | Tailwind / Prime form layouts, shadcn blocks (k) | 5 | `showcase-settings` | S | — | P1 | ship as block |
| Floating TOC / scroll spy | HeroUI Pro floating-toc, Nuxt PageAnchors / PageAside | 3 | docs-kit own TOC | M | overlay, observers | P2 | docs + long pages |
| Tour / onboarding | Ark Tour, Mantine (k), shadcn registry | 3 | none | M | overlay, focus | P2 | SaaS onboarding; low frequency |

### (b) Data

| Item | Others ship | Ship | Have | Gap | Deps | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Data grid core (sort, select, resize, pin, virtual, expand, reorder) | MUI X, HeroUI Pro, Ant ProTable, TanStack Table, Mantine (k) | 7 | cdk + ui `data-grid` (1k mount 60 ms, 10k virtual 18 ms) | — | data-grid | — | done; ahead of HeroUI on perf |
| Data-table toolbar: faceted filters, column visibility, search, pagination, server-side rows (`request`), URL-synced state | shadcn data-table, Ant ProTable + QueryFilter, MUI X server data, Tremor filters | 6 | none (grid has no filter / toolbar model; no `request` loader binding) | M–L | data-grid, select, popover, router loaders | **P0** | the #1 admin pattern (CRUD list); loaders make it SSR-first |
| Inline cell editing + validation | MUI X, Ant EditableProTable, HeroUI Pro cell-* | 4 | ui `cell-select`, `cell-slider`; no edit mode in grid | M | data-grid, forms | P1 | back-office apps |
| Virtualizer in ListBox / Table / Autocomplete | RAC, MUI X, Nuxt Listbox / ScrollArea virtualization | 5 | cdk `virtualizer` standalone; ui table / list-box / autocomplete partial | M | virtualizer, collections | **P0** | closes 3 HERO-AUDIT partials; large lists are routine |
| Grouping / aggregation / pivot / export | MUI X Premium, Ant (k) | 2 | none | L | data-grid | P3 | enterprise niche; idea |
| Tree view | MUI X, Nuxt Tree, Ark, HeroUI Pro file-tree, AI Elements file-tree | 5 | cdk `tree`, `navigation-tree`; no ui `tree` | S–M | tree, drag-drop | P1 | file browsers, settings trees, agent consoles |
| Timeline | Nuxt Timeline, HeroUI Pro, Ant (k), Tailwind feeds | 5 | none (stepper patterns) | S | — | P1 | activity feeds, order tracking |
| Description list / stats / KPI | Ant ProDescriptions + StatisticCard, Tailwind / Prime stats, Tremor, HeroUI Pro kpi | 6 | ui `kpi`, `trend-chip` (partial); no description list | S | — | P1 | detail pages |
| Infinite scroll / load more | Ionic, RAC LoadMore, Nuxt (k) | 4 | cdk table LoadMore; no generic | S | observers | P1 | feeds + mobile |
| Masonry / bento | — (Rivet-own) | 1 | cdk + ui `masonry`, `bento` | — | — | — | done 2026-10-11 |

### (c) Input / forms

| Item | Others ship | Ship | Have | Gap | Deps | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| File upload / drop zone (preview, progress, multiple, paste) | Nuxt FileUpload, Mantine dropzone, Ark FileUpload, Uploadthing / FilePond, HeroUI Pro drop-zone, Untitled | 7 | cdk `file-trigger`, `drag-drop`; no drop zone / upload list | M | drag-drop, file-trigger, forms | **P0** | every SaaS form; pairs with server actions (`@rivetjs/forms`) |
| Tags input (free text + suggestions) | Nuxt InputTags, Ark TagsInput, Mantine TagsInput (k), Untitled | 5 | cdk `tag-group` + `combobox` (no combined input) | S–M | tag-group, combobox | P1 | filters, labels |
| OTP / PIN | shadcn, Nuxt, Ark, Mantine, HeroUI | 6 | ui `input-otp` | — | — | — | done |
| Phone input (country + format) | registry kits, Untitled (k) | 2 | none | M | select, number | P2 | needs metadata dataset (libphonenumber licence / size) |
| Currency / number | MUI (k), Mantine NumberInput | 4 | cdk + ui `number-field`, `number-stepper` (Intl currency) | — | — | — | done |
| Multi-step wizard | Ant StepsForm, shadcn blocks, Tailwind | 4 | ui `stepper` + `@rivetjs/forms` | S | stepper, forms | P1 | recipe + example, not a component |
| Schema / form builder | Ant Schema Form, ProForm layouts | 2 | `@rivetjs/forms` (Standard Schema) | M | forms | P2 | generation from schema = DX win, not a component gap |
| Date / time / range pickers | all | 10 | cdk + ui date-picker, date-range-picker, time-field, time-picker, calendar, range-calendar, wheel-picker | S | — | P1 | done; presets (Tremor / MUI shortcuts) missing |
| Color picker | Nuxt, Ark, Mantine, HeroUI | 6 | ui color-* (7 components) | — | — | — | done |
| Rating / segment / cells | HeroUI Pro, Nuxt InputRating | 3 | ui `rating` (10/11), `segment`, `cell-*` | S | — | P1 | finish Pro sections |
| Signature pad / QR | Ark | 1 | none | S | — | P3 | idea |

### (d) Feedback / overlays

| Item | Others ship | Ship | Have | Gap | Deps | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Toasts (stack, promise, actions) | Sonner, shadcn, Nuxt, Mantine notifications, Ionic | 9 | ui `toast` (promise, stacking, queues) | — | — | — | done |
| Confirm dialog (imperative `confirm()`) | Mantine modals manager, Ant (k), Ionic alert | 4 | ui `alert-dialog` (declarative only) | S | overlay-service | P1 | `await confirm({…})` cuts boilerplate |
| Context menu | shadcn, Nuxt, HeroUI Pro, Radix | 6 | none (cdk menu + item-morph long-press triggers) | S–M | menu, interactions | **P0** | file lists, grids, kanban cards |
| Hover card / preview | shadcn, HeroUI Pro, Radix | 4 | cdk `preview-trigger` (no ui) | S | preview-trigger, popover | **P0** | user / link previews; tiny gap |
| Slide-over / sheet / drawer | all | 10 | ui `sheet`, `drawer` | — | — | — | done |
| Progress bar for navigation (nprogress) | Mantine nprogress, Nuxt (k) | 3 | none (router has transitions) | S | router | P2 | perceived perf on slow loaders |

### (e) Dashboards + charts

| Item | Others ship | Ship | Have | Gap | Deps | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chart primitives: area / bar / line / pie + stacked / grouped / horizontal / dashed / dots / nested donut / labels | Tremor, MUI X, Mantine charts, shadcn Chart, HeroUI Pro ×5, Nuxt (via templates) | 8 | ui `chart` one page (own SVG `chart-math.ts`, 4 demos) | M | — (own engine, server-rendered SVG) | **P0** | every dashboard; server-SVG charts with 0 JS until hover is a selling point vs Recharts hydration |
| Chart tooltip / legend / formatters (compound) | shadcn ChartTooltip, HeroUI Pro, Tremor | 5 | basic | S | popover | **P0** | part of the chart wave |
| KPI cards / KPI group / sparklines | Tremor spark charts, HeroUI Pro kpi / kpi-group, Tailwind stats | 5 | ui `kpi`, `trend-chip`, chart Sparkline (partial) | S | — | P1 | finish Pro sections |
| Radar / radial / composed / scatter | MUI X, HeroUI Pro, Recharts | 4 | none | M | chart-math | P2 | less frequent |
| Heatmap / tracker / bar list / category bar | MUI X heatmap, Tremor tracker + bar list, assistant-ui heat graph | 3 | none | S–M | chart-math | P2 | status pages, activity grids |
| Funnel / sankey / geo | MUI X (k), ECharts | 2 | none | L | — | P3 | ECharts adapter cheaper; map = no (ruling) |
| Dashboard block (shell + KPIs + chart + table) | shadcn dashboard-01, Tremor blocks, Prime, Nuxt Dashboard | 6 | `showcase-dashboard` | S | — | P1 | block once charts + table toolbar land |

### (f) AI

| Item | Others ship | Ship | Have | Gap | Deps | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chat UI (conversation, message, prompt input, attachments, suggestions, loader, sources, code block, markdown, tool, chain of thought) | AI Elements, shadcn core, Nuxt Chat*, assistant-ui, HeroUI Pro (13) | 5 | 14 ui AI dirs (all 13 Pro chat pages done or partial) | S | — | P1 | done; 2 sections left (Agent Trace Streaming, Review Composer) |
| Streaming transport adapter (AI SDK UI stream / TanStack AI / OpenAI-compatible SSE) → signals | shadcn helpers (AI SDK, TanStack AI), Nuxt (AI SDK), assistant-ui runtimes | 4 | none (chat components take data; no `createChat` over a stream) | M | reactivity, router actions | **P0** | without it the chat kit is a mockup; server actions + streaming SSR are our strength |
| Stick-to-bottom message scroller | shadcn Message Scroller, AI Elements conversation | 3 | ui `chat-conversation` (check behaviour) | S | scroll-area | P1 | verify + document |
| Tool approval / confirmation, queue, plan / task, checkpoint, context (token) meter, model selector, inline citation, questionnaire | AI Elements, shadcn Questionnaire | 2 | partial (chat-tool, chat-source) | M | — | P1 | agent UIs in 2026 are approval-driven |
| Agent console (artifact, terminal, file tree, test results, stack trace, web preview, sandbox) | AI Elements | 1 | code-block, file-tree missing | M | tree, code-block | P2 | coding-agent apps; niche but growing |
| Voice (speech input, transcription, audio player, mic selector) | AI Elements | 1 | none | M | — | P3 | idea |
| Workflow canvas (nodes / edges / pan-zoom) | AI Elements (React Flow), (k) n8n-likes | 1 | none | L | drag-drop, overlay | P3 | idea; big engine |

### (g) Auth / marketing / ecommerce blocks

| Item | Others ship | Ship | Have | Gap | Deps | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth (login, signup, reset, OTP, social) | shadcn login / signup, Nuxt AuthForm, Ant LoginForm, Tailwind / Prime sign-in | 7 | `showcase-auth` | S | forms | P1 | ship as blocks + server actions wired |
| Marketing sections (hero, features, logo cloud, CTA, pricing, testimonials, FAQ, footer, blog, changelog, 404) | Nuxt Page*, Tailwind Plus, PrimeBlocks, Flowbite, Untitled | 6 | `showcase-pricing`; homepage spec builds own sections | M | — | P1 | homepage + templates need them anyway (HOMEPAGE T-tasks); static zero-JS = our win |
| Ecommerce (product list / overview / quickview, cart, checkout, order history, reviews, filters) | Tailwind Plus, PrimeBlocks, Flowbite | 4 | `showcase-storefront`, `-product`, `-checkout` | S | — | P2 | blocks from existing showcases |
| Blocks distribution (`rivet add <block>` registry, MCP, skills) | shadcn CLI + 435 registries + MCP, Nuxt templates | 3 | `libs/mcp`, `skills/`, create-rivet templates; no add-block CLI | M | create-rivet, mcp | P1 | how blocks reach users (and AI agents) in 2026 |

### (h) Content

| Item | Others ship | Ship | Have | Gap | Deps | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rich text editor (toolbar, slash menu, drag handle, mentions, tables, collaboration) | Nuxt Editor (Tiptap), Mantine tiptap, HeroUI Pro, shadcn registry (prosekit, Plate) | 4 | none | L–XL | engine (ProseMirror vs own) | P2 (Later) | ruling: not now; user wants more than HeroUI's → own spec later |
| Mentions / emoji menu inside inputs | Nuxt EditorMention / EmojiMenu | 2 | none | M | combobox | P2 | comes with the editor |
| Emoji picker | HeroUI Pro, registries | 2 | none | L | dataset | P3 | ruling: no |
| Comments / threads | (k) Liveblocks, Velt | 1 | chat parts reusable | M | — | P3 | idea |
| Code block / markdown | AI Elements, HeroUI Pro, Nuxt (k) | 4 | ui `code-block`, `markdown` | — | — | — | done |

### (i) Scheduling

| Item | Others ship | Ship | Have | Gap | Deps | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Scheduler / agenda (month / week / day, drag, resize, select) | **MUI X Scheduler (new)**, HeroUI Pro agenda, (k) FullCalendar, Syncfusion | 3 | none; AGENDA lane spec [`2026-10-12-scheduler-design.md`](../specs/2026-10-12-scheduler-design.md) (malva port) | L | date, drag-drop, interactions/move, popover | P1 (in progress) | decided; server-final layout = differentiator |
| Resources / timeline view, recurrence | MUI X (k), FullCalendar premium | 2 | out of scope v1 | L | scheduler | P3 | idea |

### (j) Kanban / boards

| Item | Others ship | Ship | Have | Gap | Deps | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kanban (columns, cards, keyboard moves, sizes) | HeroUI Pro, dnd-kit examples, shadcn registry (k) | 3 | `showcase-kanban` on cdk drag-drop; no component | M | drag-drop | P1 | decided (UI-IDENTITY T40) |
| Sortable list / reorder | dnd-kit, Ionic reorder, Ant DragSortTable | 4 | cdk drag-drop, data-grid `onReorder` | — | — | — | done |

### (k) Mobile (Ionic alternative)

| Item | Others ship | Ship | Have | Gap | Deps | P | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| iOS / MD modes on the theme | Ionic, Konsta, Framework7, Quasar | 4 | `rivet` theme only (R6: no second theme) | M | ui tokens | **P0** | user 2026-10-12: "major gap we are not filling: ionic alternative"; modes are platform skins, not a second brand theme |
| App shell + nav stack (push / pop, swipe-back, tabs, menu) | Ionic nav / router outlet / tabs, Framework7 router | 3 | router + View Transitions; no stack | L | router, motion, interactions | **P0** | the core of an app kit |
| Sheets w/ breakpoints, action sheet, sliding items, refresher, infinite scroll, reorder, FAB, picker wheels, searchbar | Ionic, Konsta | 2 | ui sheet / drawer, cdk wheel-picker, search-field, drag-drop | M | motion, interactions | P0 (with shell) | gestures + Embla physics already house motion |
| Keyboard-aware inputs, safe areas, haptics, status bar | Ionic + Capacitor | 2 | none | M | — | P0 (with shell) | native feel |
| Native bridge + build target (Capacitor, `rivet build --target app`, create-rivet mobile template), PWA / offline | Ionic Capacitor, Quasar modes | 2 | static / csr adapters | M | router adapters, create-rivet | P0 (with shell) | distribution to stores |

## 3. P0 list (next wave)

1. **Command palette** (`@rivetjs/cdk/command` + ui `command`): fuzzy filter, groups, nested pages, async items, ⌘K; docs sites migrate to it.
2. **Data-table toolbar + server rows**: faceted filters, column visibility, search, pagination, URL state, `request` / router loader binding on `data-grid`; plus **Virtualizer wiring** in ListBox / Table / Autocomplete (3 HERO-AUDIT partials).
3. **File upload / drop zone**: drop zone, upload list with progress, paste, validation; forms + server-action upload helper.
4. **Context menu + hover card** (S–M; cdk parts exist).
5. **Chart wave**: chart split (area / bar / line / pie pages), stacked / grouped / horizontal / dashed / dots / nested donut / labels, compound tooltip + legend + formatters, on the own server-SVG engine.
6. **AI streaming adapter**: `createChat` over AI SDK UI-message stream / OpenAI-compatible SSE → signals, wired to the 14 chat components + router actions.
7. **Mobile kit** (`@rivetjs/mobile`, own lane; spec `2026-10-12-mobile-design.md`): modes, nav stack, tabs, sheets, sliding items, refresher, Capacitor target.

## 4. Findings

- "Pro" moved: Nuxt UI v4 made its paid tier free (dashboard, page sections, chat, editor); shadcn put AI chat primitives in core. What a 2026 user expects for free = our current Pro catalogue. Paid value left in the market: grid depth (MUI X Premium), scheduler, editor, and templates / blocks.
- Distribution beats component count: shadcn's registry (435 registries, MCP server, skills, "Open in v0") is how blocks reach users and AI agents. Rivet has `libs/mcp` + `skills/`; a `rivet add` block registry is the missing piece.
- AI kits widened from chat to agent consoles (terminal, test results, sandbox, file tree), approval flows (confirmation, queue, plan, checkpoint) and node canvases; the transport adapter (AI SDK / TanStack AI) is shipped next to the markup everywhere.
- Scheduling became table stakes in pro tiers (MUI X Scheduler new; HeroUI Pro agenda) → AGENDA lane is well-timed.
- Editors converge on Tiptap / ProseMirror (Nuxt, Mantine, HeroUI Pro (k)); emoji / mention menus ship as editor plug-ins, not standalone → consistent with "emoji picker no".
- Blocks taxonomy is stable across Tailwind Plus / PrimeBlocks / Flowbite: Application UI · Marketing · Ecommerce. Our 11 showcases already cover a third of it; packaging them as blocks is cheap.
- Rivet-specific edge to sell: server-rendered SVG charts and grids that are interactive without hydration (0 JS before input), server-final layouts (masonry, scheduler), live props everywhere.
