// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 OSS has no data grid). Feature set inspired by HeroUI Pro's public
// DataGrid docs (part / prop names); independent implementation — no Pro source, styles, class names or demo code.
// Behaviour = `@rivetjs/cdk/data-grid` (ARIA grid / treegrid, keyboard navigation, selection, sorting, resizing, pinning,
// tree rows, reordering, virtualization, client filter / pagination); look = the vendored HeroUI OSS `table*` classes +
// Rivet-authored `data-grid*` classes (`styles/components/data-grid.css`) on HeroUI tokens.
// Rivet:
// - Not compound (as Pro): `data` + `columns`; every cdk prop passes through (the cdk prop docs apply).
// - Pro `className` / `contentClassName` / `scrollContainerClassName` / `footerClassName` → `class` / `contentClass` /
//   `scrollContainerClass` / `footerClass` (Rivet class props); the slot classes are prepended.
// - `variant` (`primary` default / `secondary`) = the vendored table variants.
// - Defaults: HeroUI checkbox look for the selection column (lucide `Check` / `Minus`), lucide `ChevronUp` sort indicator
//   (turns for descending), `ChevronRight` expand toggle (turns when expanded), `GripVertical` drag handle, a `Spinner` as
//   `loadMoreContent`. Each is replaceable through the cdk `render*` props.
// - Motion: CSS transitions only (indicator / chevron turns, sort-indicator fade), all `motion-reduce:transition-none`.
// - Resumable: columns with `cell` / `header` functions must be component-local (inline arrows: the compiler registers them);
//   module-level column arrays of plain data are fine. `data` is serialized once with the grid state on resume.
// - Read once at mount (as the cdk grid): `variant` / class props are not live; `data` / `columns` / `filter` / `page` /
//   `pageSize` / `isLoadingMore` / `disabledKeys` stay live through the cdk.
import { DataGrid as DataGridPrimitive } from "@rivetjs/cdk/data-grid";
import type { DataGridProps as DataGridPrimitiveProps } from "@rivetjs/cdk/data-grid";
import { Icon } from "@rivetjs/kit/icon";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { Check, ChevronRight, ChevronUp, GripVertical, Minus } from "lucide";

import type { DataGridVariants } from "../../../styles/src/components/data-grid/index.ts";
import { dataGridVariants } from "../../../styles/src/components/data-grid/index.ts";
import { Spinner } from "../spinner/index.ts";

const cx = (a: string, b: string | undefined) => (b ? `${a} ${b}` : a);
const SLOTS: Record<string, ReturnType<typeof dataGridVariants>> = {};
const slotsFor = (variant: DataGridVariant) => (SLOTS[variant] ??= dataGridVariants({ variant }));

type DataGridVariant = NonNullable<DataGridVariants["variant"]>;

/* -------------------------------------------------------------------------------------------------
 * DataGrid
 * -----------------------------------------------------------------------------------------------*/
interface DataGridProps<T> extends DataGridPrimitiveProps<T> {
  /** Visual variant: `primary` (surface card on a secondary background, default) or `secondary` (flat rows). */
  variant?: DataGridVariant | undefined;
}

function DataGrid<T>(props: DataGridProps<T>): JSX.Element {
  // Class strings resolved here (plain locals): a JSX prop reading `slots` would become a live getter capturing the tv
  // slot functions, which do not serialize on resume.
  const slots = slotsFor(props.variant ?? "primary");
  const rootClass = cx(slots.base(), props.class);
  const scrollClass = cx(slots.scrollContainer(), props.scrollContainerClass);
  const contentClass = cx(slots.content(), props.contentClass);
  const headerClass = cx(slots.header(), props.headerClass);
  const columnClass = cx(slots.column(), props.columnClass);
  const bodyClass = cx(slots.body(), props.bodyClass);
  const rowClass = cx(slots.row(), props.rowClass);
  const cellClass = cx(slots.cell(), props.cellClass);
  const footerClass = cx(slots.footer(), props.footerClass);
  const checkboxClass = cx(slots.checkbox(), props.checkboxClass);
  const resizerClass = cx(slots.columnResizer(), props.resizerClass);
  const expandClass = cx(slots.expandButton(), props.expandButtonClass);
  const dragClass = cx(slots.dragHandle(), props.dragHandleClass);
  const emptyClass = cx(slots.empty(), props.emptyClass);
  const loadMoreClass = cx(slots.loadMore(), props.loadMoreClass);
  const dropClass = cx(slots.dropIndicator(), props.dropIndicatorClass);
  const loadMoreContentClass = slots.loadMoreContent();
  const loadMore = props.onLoadMore
    ? (props.loadMoreContent ?? (
        <div class={loadMoreContentClass}>
          <Spinner size="sm" />
        </div>
      ))
    : undefined;
  const renderCheckbox = props.renderCheckbox;
  const renderSortIndicator = props.renderSortIndicator;
  const renderExpandIcon = props.renderExpandIcon;
  const renderDragHandle = props.renderDragHandle;
  return (
    <DataGridPrimitive<T>
      {...props}
      data-slot="data-grid"
      class={rootClass}
      scrollContainerClass={scrollClass}
      contentClass={contentClass}
      headerClass={headerClass}
      columnClass={columnClass}
      bodyClass={bodyClass}
      rowClass={rowClass}
      cellClass={cellClass}
      footerClass={footerClass}
      checkboxClass={checkboxClass}
      resizerClass={resizerClass}
      expandButtonClass={expandClass}
      dragHandleClass={dragClass}
      emptyClass={emptyClass}
      loadMoreClass={loadMoreClass}
      dropIndicatorClass={dropClass}
      loadMoreContent={loadMore}
      renderCheckbox={
        renderCheckbox ??
        ((state) => (
          <span class="checkbox__control" data-slot="checkbox-control">
            <span aria-hidden="true" class="checkbox__indicator" data-slot="checkbox-indicator">
              {state.isIndeterminate() ? (
                <Icon aria-hidden="true" data-slot="checkbox-default-indicator--indeterminate" icon={Minus} role="presentation" stroke-width={3} />
              ) : (
                <Icon
                  aria-hidden="true"
                  data-slot="checkbox-default-indicator--checkmark"
                  icon={Check}
                  role="presentation"
                  stroke-dasharray={24}
                  stroke-dashoffset={state.isSelected() ? 48 : 72}
                />
              )}
            </span>
          </span>
        ))
      }
      renderSortIndicator={
        renderSortIndicator ??
        ((direction) => (
          <span aria-hidden="true" class="table__sortable-column-indicator data-grid__sort-indicator" data-direction={direction()}>
            <Icon aria-hidden="true" icon={ChevronUp} />
          </span>
        ))
      }
      renderExpandIcon={renderExpandIcon ?? (() => <Icon aria-hidden="true" icon={ChevronRight} />)}
      renderDragHandle={renderDragHandle ?? (() => <Icon aria-hidden="true" icon={GripVertical} />)}
    />
  );
}

export { DataGrid };
export type { DataGridProps };
