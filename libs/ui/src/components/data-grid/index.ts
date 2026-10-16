// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 OSS has no data grid). Feature set inspired by HeroUI Pro's public
// DataGrid docs; independent implementation. Behaviour = `@rivetjs/cdk/data-grid`; look = vendored HeroUI OSS table classes.
import { DataGrid } from "./data-grid.tsx";
import type { DataGridProps } from "./data-grid.tsx";

/* -------------------------------------------------------------------------------------------------
 * Component (not compound: data + columns, as HeroUI Pro)
 * -----------------------------------------------------------------------------------------------*/
export { DataGrid };

export type { DataGridProps };

/* -------------------------------------------------------------------------------------------------
 * cdk types used by column definitions and callbacks
 * -----------------------------------------------------------------------------------------------*/
export type {
  DataGridCheckboxState,
  DataGridColumn,
  DataGridHeaderInfo,
  DataGridReorderEvent,
  DataGridRow,
  DataGridStrings,
  Key as DataGridKey,
  Selection as DataGridSelection,
  SortDescriptor as DataGridSortDescriptor,
  SortDirection as DataGridSortDirection,
} from "@rivetjs/cdk/data-grid";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { dataGridVariants } from "../../../styles/src/components/data-grid/index.ts";

export type { DataGridVariants } from "../../../styles/src/components/data-grid/index.ts";
