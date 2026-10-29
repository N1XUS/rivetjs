// Rivet addition (no HeroUI v3.2.6 counterpart): a drag-and-drop board on `@rivetjs/cdk/drag-drop`; feature set inspired by
// commercial UI kits' public Kanban docs, independent implementation (see `kanban.tsx`).
import {
  KanbanCard,
  KanbanCardContent,
  KanbanCardList,
  KanbanColumn,
  KanbanColumnActions,
  KanbanColumnBody,
  KanbanColumnCount,
  KanbanColumnHeader,
  KanbanColumnIndicator,
  KanbanColumnTitle,
  KanbanDragHandle,
  KanbanDropIndicator,
  KanbanRoot,
  KanbanScrollShadow,
} from "./kanban.tsx";
import type { KanbanComposerProps } from "./kanban-composer.tsx";
import type { KanbanCardListProps, KanbanCardProps, KanbanColumnIndicatorProps, KanbanDropIndicatorProps, KanbanRootProps } from "./kanban.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Kanban = Object.assign(KanbanRoot, {
  Root: KanbanRoot,
  Column: KanbanColumn,
  ColumnHeader: KanbanColumnHeader,
  ColumnIndicator: KanbanColumnIndicator,
  ColumnTitle: KanbanColumnTitle,
  ColumnCount: KanbanColumnCount,
  ColumnActions: KanbanColumnActions,
  ColumnBody: KanbanColumnBody,
  ScrollShadow: KanbanScrollShadow,
  CardList: KanbanCardList,
  Card: KanbanCard,
  CardContent: KanbanCardContent,
  DragHandle: KanbanDragHandle,
  DropIndicator: KanbanDropIndicator,
});

export type Kanban = {
  Props: KanbanRootProps;
  RootProps: KanbanRootProps;
  ColumnIndicatorProps: KanbanColumnIndicatorProps;
  CardListProps: KanbanCardListProps;
  CardProps: KanbanCardProps;
  DropIndicatorProps: KanbanDropIndicatorProps;
  ComposerProps: KanbanComposerProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  KanbanContext,
  KanbanListContext,
  KanbanRoot,
  KanbanColumn,
  KanbanColumnHeader,
  KanbanColumnIndicator,
  KanbanColumnTitle,
  KanbanColumnCount,
  KanbanColumnActions,
  KanbanColumnBody,
  KanbanScrollShadow,
  KanbanCardList,
  KanbanCard,
  KanbanCardContent,
  KanbanDragHandle,
  KanbanDropIndicator,
  createKanban,
} from "./kanban.tsx";
export { KanbanComposer } from "./kanban-composer.tsx";
export type { KanbanComposerProps } from "./kanban-composer.tsx";
export { KANBAN_MESSAGES } from "./messages.ts";
export type {
  KanbanCardMove,
  KanbanContextValue,
  KanbanListContextValue,
  KanbanMessages,
  KanbanRootProps,
  KanbanRootProps as KanbanProps,
  KanbanColumnIndicatorProps,
  KanbanCardListProps,
  KanbanCardProps,
  KanbanDropIndicatorProps,
  KanbanOptions,
  Kanban as KanbanBoard,
  KanbanDivProps,
} from "./kanban.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { kanbanVariants } from "../../../styles/src/components/kanban/index.ts";

export type { KanbanVariants } from "../../../styles/src/components/kanban/index.ts";
