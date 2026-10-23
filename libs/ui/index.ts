// @rivetjs/ui — 1:1 port of HeroUI v3.2.6 (Apache-2.0, © 2025 NextUI Inc.) on @rivetjs/cdk. Barrel; prefer subpaths.
// Same sections as upstream `packages/react/src/index.ts` (components, hooks, utils); unported names: CLAUDE.md "Known diffs".

//  ===================================
//  Components
//  ===================================
export * from "./src/components/surface/index.ts";
export * from "./src/components/card/index.ts";
export * from "./src/components/separator/index.ts";
export * from "./src/components/header/index.ts";
export * from "./src/components/label/index.ts";
export * from "./src/components/description/index.ts";
export * from "./src/components/error-message/index.ts";
export * from "./src/components/field-error/index.ts";
export * from "./src/components/kbd/index.ts";
export * from "./src/components/spinner/index.ts";
export * from "./src/components/skeleton/index.ts";
export * from "./src/components/empty-state/index.ts";
export * from "./src/components/badge/index.ts";
export * from "./src/components/chip/index.ts";
export * from "./src/components/alert/index.ts";
export * from "./src/components/typography/index.ts";
export * from "./src/components/link/index.ts";
export * from "./src/components/button/index.ts";
export * from "./src/components/button-group/index.ts";
export * from "./src/components/toggle-button/index.ts";
export * from "./src/components/toggle-button-group/index.ts";
export * from "./src/components/close-button/index.ts";
export * from "./src/components/avatar/index.ts";
export * from "./src/components/avatar-group/index.ts";
export * from "./src/components/progress-bar/index.ts";
export * from "./src/components/progress-circle/index.ts";
export * from "./src/components/meter/index.ts";
// Rivet addition (no HeroUI counterpart): Radix ScrollArea behaviour (@rivetjs/cdk/scroll-area), HeroUI look.
export * from "./src/components/scroll-area/index.ts";
export * from "./src/components/scroll-shadow/index.ts";
export * from "./src/components/popover/index.ts";
// Rivet addition (no HeroUI counterpart): shadcn/ui Sidebar behaviour, HeroUI look.
export * from "./src/components/sidebar/index.ts";
// Rivet addition (no HeroUI counterpart): embla-carousel behaviour (@rivetjs/cdk/carousel), HeroUI look.
export * from "./src/components/carousel/index.ts";
// Rivet addition (no HeroUI counterpart): yet-another-react-lightbox behaviour (@rivetjs/cdk/lightbox), HeroUI look.
export * from "./src/components/lightbox/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): @rivetjs/cdk/data-grid behaviour, HeroUI table look.
export * from "./src/components/data-grid/index.ts";
// Rivet addition (no HeroUI counterpart; feature set inspired by HeroUI Pro's public docs): Angular CDK stepper behaviour (@rivetjs/cdk/stepper), HeroUI look.
export * from "./src/components/stepper/index.ts";
// Rivet addition (no HeroUI counterpart; feature set inspired by HeroUI Pro's public docs): app scaffold on @rivetjs/ui/sidebar.
export * from "./src/components/app-layout/index.ts";
// Rivet addition (no HeroUI counterpart): shadcn/ui Resizable API on react-resizable-panels behaviour (@rivetjs/cdk/resizable), HeroUI look.
export * from "./src/components/resizable/index.ts";
export * from "./src/components/tooltip/index.ts";
export * from "./src/components/input/index.ts";
export * from "./src/components/textarea/index.ts";
export * from "./src/components/textfield/index.ts";
export * from "./src/components/form/index.ts";
export * from "./src/components/fieldset/index.ts";
export * from "./src/components/breadcrumbs/index.ts";
export * from "./src/components/toolbar/index.ts";
export * from "./src/components/list-box/index.ts";
export * from "./src/components/list-box-item/index.ts";
export * from "./src/components/list-box-section/index.ts";
export * from "./src/components/tag/index.ts";
export * from "./src/components/tag-group/index.ts";
export * from "./src/components/modal/index.ts";

//  ===================================
//  Hooks
//  ===================================
export * from "./src/hooks/use-overlay-state.tsx";
export * from "./src/components/input-group/index.ts";
export * from "./src/components/search-field/index.ts";
export * from "./src/components/number-field/index.ts";
export * from "./src/components/alert-dialog/index.ts";
export * from "./src/components/calendar/index.ts";
export * from "./src/components/calendar-year-picker/index.ts";
export * from "./src/components/drawer/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): drag / snap sheet on @rivetjs/cdk/sheet-motion.
export * from "./src/components/sheet/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): responsive top bar, zero-JS hide on scroll.
export * from "./src/components/navbar/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): floating selection toolbar on the ui Toolbar.
export * from "./src/components/action-bar/index.ts";
export * from "./src/components/menu/index.ts";
export * from "./src/components/menu-item/index.ts";
export * from "./src/components/menu-section/index.ts";
export * from "./src/components/dropdown/index.ts";
export * from "./src/components/range-calendar/index.ts";
export * from "./src/components/input-otp/index.ts";
export * from "./src/components/date-input-group/index.ts";
export * from "./src/components/date-field/index.ts";
export * from "./src/components/time-field/index.ts";
export * from "./src/components/toast/index.ts";
export * from "./src/components/checkbox/index.ts";
export * from "./src/components/checkbox-group/index.ts";
export * from "./src/components/radio/index.ts";
export * from "./src/components/radio-group/index.ts";
export * from "./src/components/switch/index.ts";
export * from "./src/components/switch-group/index.ts";
export * from "./src/components/select/index.ts";
export * from "./src/components/date-picker/index.ts";
export * from "./src/components/date-range-picker/index.ts";
export * from "./src/components/slider/index.ts";
export * from "./src/components/disclosure/index.ts";
export * from "./src/components/combo-box/index.ts";
export * from "./src/components/color-swatch/index.ts";
export * from "./src/components/color-area/index.ts";
export * from "./src/components/color-slider/index.ts";
export * from "./src/components/color-input-group/index.ts";
export * from "./src/components/color-field/index.ts";
export * from "./src/components/color-swatch-picker/index.ts";
export * from "./src/components/color-picker/index.ts";
export * from "./src/components/disclosure-group/index.ts";
export * from "./src/components/autocomplete/index.ts";
export * from "./src/components/accordion/index.ts";
export * from "./src/components/pagination/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): inline dropdown on the @rivetjs/cdk/select parts form.
export * from "./src/components/inline-select/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): settings-row select on the @rivetjs/cdk/select parts form.
export * from "./src/components/cell-select/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): settings-cell slider on @rivetjs/cdk/slider.
export * from "./src/components/cell-slider/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): pill number stepper with an animated value on @rivetjs/cdk/number-field.
export * from "./src/components/number-stepper/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): radio group as selectable cards on @rivetjs/cdk/radio-group RadioGroup + RadioField / RadioButton.
export * from "./src/components/radio-button-group/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): checkbox group as selectable cards on @rivetjs/cdk/checkbox CheckboxGroup + CheckboxField / CheckboxButton.
export * from "./src/components/checkbox-button-group/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): styled native <select> field on @rivetjs/cdk/text-field + @rivetjs/cdk/native-select.
export * from "./src/components/native-select/index.ts";
// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): segmented control on @rivetjs/cdk/toggle-button-group + SelectionIndicator.
export * from "./src/components/segment/index.ts";
export * from "./src/components/table/index.ts";
export * from "./src/components/tabs/index.ts";

// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public MorphButton docs): pill / button that morphs into a panel on @rivetjs/cdk/morph.
export * from "./src/components/morph/index.ts";
// Rivet addition (no HeroUI / HeroUI Pro counterpart): before / after comparison with a draggable divider (@rivetjs/cdk/compare).
export * from "./src/components/compare/index.ts";
// Rivet addition (no HeroUI / HeroUI Pro counterpart): Masonry (Pinterest columns) + Bento (span tiles) grids (@rivetjs/cdk/masonry).
export * from "./src/components/masonry/index.ts";
// Rivet addition (no HeroUI counterpart): iOS context-menu style item preview — a ListBox / GridList / Menu item lifts into a panel on a long press (@rivetjs/cdk/morph/item).
export * from "./src/components/item-morph/index.ts";
// Rivet addition (no HeroUI counterpart): TimeField + popover of iOS-style looped wheel drums (@rivetjs/cdk/time-wheels).
export * from "./src/components/time-picker/index.ts";

// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): star rating, read-only or native radios.
export * from "./src/components/rating/index.ts";

// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): change indicator chip.
export * from "./src/components/trend-chip/index.ts";

// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): metric card.
export * from "./src/components/kpi/index.ts";

// Rivet addition (no HeroUI OSS counterpart; feature set inspired by HeroUI Pro's public docs): data-driven SVG / HTML charts, CSS-only tooltips.
export * from "./src/components/chart/index.ts";

// Rivet additions (no HeroUI OSS counterpart; feature sets inspired by HeroUI Pro's public AI docs; independent implementations): AI chat components.
export * from "./src/components/text-shimmer/index.ts";
export * from "./src/components/chat-loader/index.ts";
export * from "./src/components/chat-message/index.ts";
export * from "./src/components/chat-message-actions/index.ts";
export * from "./src/components/prompt-suggestion/index.ts";
export * from "./src/components/chat-list-view/index.ts";
export * from "./src/components/code-block/index.ts";
export * from "./src/components/markdown/index.ts";
export * from "./src/components/chain-of-thought/index.ts";
export * from "./src/components/chat-source/index.ts";
export * from "./src/components/chat-tool/index.ts";
export * from "./src/components/chat-conversation/index.ts";
export * from "./src/components/chat-attachment/index.ts";
export * from "./src/components/prompt-input/index.ts";

//  ===================================
//  Utils
//  ===================================
export * from "./src/utils/dom.tsx";
export { tv, cn, type VariantProps } from "tailwind-variants";

export * from "./src/components/scheduler/index.ts";
