// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no kanban). Feature set inspired by HeroUI Pro's public Kanban docs
// (a drag-and-drop board: `.Column`, `.ColumnHeader` with `.ColumnIndicator` / `.ColumnTitle` / `.ColumnCount` /
// `.ColumnActions`, `.ColumnBody`, `.ScrollShadow`, `.CardList` with `renderEmptyState`, `.Card` with `.CardContent`,
// `.DragHandle`, `.DropIndicator`; sizes sm / md / lg; a board data hook); independent implementation, Rivet-authored styles.
// - Drag and drop = `@rivetjs/cdk/drag-drop` (the Angular CDK port, as in the `showcase-kanban` demo): root = `DropListGroup`
//   (every `.CardList` in it is connected), `.CardList` = `DropList` (`data` = the column id), `.Card` = `Drag` (`data` = the
//   card key). Nothing drag-related loads before the first press (cdk lazy instances, `preload = "visible"`).
// - `createKanban({ initialItems, getKey, getColumn, setColumn })` keeps the board as one signal of items and returns
//   `itemsOf(column)` (for a keyed `For`) and `onDropped` (pass to every `.CardList`): it moves the card to the drop index
//   of the target column and writes its column with `setColumn`.
// - `.CardList` renders `renderEmptyState()` once; CSS shows it while the list has no `.kanban__card` (`:has()`), so an
//   emptied column needs no script.
// - Context `rv-ui-kanban` `{ size }` (plain data).
import { DragHandle as DragHandlePrimitive, DragPlaceholder, DropList, DropListGroup, Drag } from "@rivetjs/cdk/drag-drop";
import type { DragDrop, DragHandleProps as DragHandlePrimitiveProps, DragProps, DropListGroupProps, DropListProps } from "@rivetjs/cdk/drag-drop";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { GripVertical } from "lucide";

import type { KanbanVariants } from "../../../styles/src/components/kanban/index.ts";
import { kanbanVariants } from "../../../styles/src/components/kanban/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { ScrollShadowRoot } from "../scroll-shadow/scroll-shadow.tsx";
import type { ScrollShadowRootProps } from "../scroll-shadow/scroll-shadow.tsx";

type DivProps = Omit<JSX.IntrinsicElements["div"], "children" | "class"> & { class?: string; children?: Content };
type SectionProps = Omit<JSX.IntrinsicElements["section"], "children" | "class"> & { class?: string; children?: Content };
type HeaderProps = Omit<JSX.IntrinsicElements["header"], "children" | "class"> & { class?: string; children?: Content };
type HeadingProps = Omit<JSX.IntrinsicElements["h3"], "children" | "class"> & { class?: string; children?: Content };
type SpanProps = Omit<JSX.IntrinsicElements["span"], "children" | "class"> & { class?: string; children?: Content };

const SLOTS: Record<string, ReturnType<typeof kanbanVariants>> = {};
const slotsFor = (size: KanbanVariants["size"]) => (SLOTS[String(size)] ??= kanbanVariants({ size }));
const S = slotsFor("md");

/* -------------------------------------------------------------------------------------------------
 * Kanban Root
 * -----------------------------------------------------------------------------------------------*/
interface KanbanRootProps extends DropListGroupProps, KanbanVariants {}

const KanbanRoot = (props: KanbanRootProps): JSX.Element => {
  const { size, class: cls, children, ...rest } = props;
  return (
    <DropListGroup {...rest} class={slotsFor(size).base({ class: cls })} data-size={size ?? "md"} data-slot="kanban">
      {children}
    </DropListGroup>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Column parts
 * -----------------------------------------------------------------------------------------------*/
const KanbanColumn = (props: SectionProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <section class={composeSlotClassName(S.column, cls)} data-slot="kanban-column" {...rest}>
      {children}
    </section>
  );
};

const KanbanColumnHeader = (props: HeaderProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <header class={composeSlotClassName(S.columnHeader, cls)} data-slot="kanban-column-header" {...rest}>
      {children}
    </header>
  );
};

interface KanbanColumnIndicatorProps extends SpanProps {
  /** Dot / icon colour (any CSS colour). */
  color?: string;
}

const KanbanColumnIndicator = (props: KanbanColumnIndicatorProps): JSX.Element => {
  const { class: cls, children, color, style, ...rest } = props;
  return (
    <span
      aria-hidden="true"
      class={composeSlotClassName(S.columnIndicator, cls)}
      data-slot="kanban-column-indicator"
      data-icon={children == null ? undefined : ""}
      {...rest}
      style={{ ...(color ? { "--kanban-column-color": color } : {}), ...((style as object | undefined) ?? {}) }}
    >
      {children}
    </span>
  );
};

const KanbanColumnTitle = (props: HeadingProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <h3 class={composeSlotClassName(S.columnTitle, cls)} data-slot="kanban-column-title" {...rest}>
      {children}
    </h3>
  );
};

const KanbanColumnCount = (props: SpanProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <span class={composeSlotClassName(S.columnCount, cls)} data-slot="kanban-column-count" {...rest}>
      {children}
    </span>
  );
};

const KanbanColumnActions = (props: DivProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <div class={composeSlotClassName(S.columnActions, cls)} data-slot="kanban-column-actions" {...rest}>
      {children}
    </div>
  );
};

const KanbanColumnBody = (props: DivProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <div class={composeSlotClassName(S.columnBody, cls)} data-slot="kanban-column-body" {...rest}>
      {children}
    </div>
  );
};

const KanbanScrollShadow = (props: ScrollShadowRootProps): JSX.Element => {
  const { class: cls, ...rest } = props as ScrollShadowRootProps & { class?: string };
  return <ScrollShadowRoot {...(rest as ScrollShadowRootProps)} class={composeSlotClassName(S.scrollShadow, cls as string | undefined) as never} />;
};

/* -------------------------------------------------------------------------------------------------
 * Card list / card
 * -----------------------------------------------------------------------------------------------*/
interface KanbanCardListProps<T = string> extends DropListProps<T> {
  /** Shown while the list has no cards (CSS `:has()`, rendered once). */
  renderEmptyState?: () => Content;
}

const KanbanCardList = <T,>(props: KanbanCardListProps<T>): JSX.Element => {
  const { class: cls, children, renderEmptyState, ...rest } = props;
  return (
    <DropList {...(rest as DropListProps<T>)} class={composeSlotClassName(S.cardList, cls)} data-slot="kanban-card-list">
      {children}
      {renderEmptyState ? (
        <div class={S.empty()} data-slot="kanban-empty">
          {renderEmptyState()}
        </div>
      ) : null}
    </DropList>
  );
};

interface KanbanCardProps<T = string> extends DragProps<T> {
  /** Accessible name of the card (`role="group"` + `aria-label` on the drag element). */
  textValue?: string;
}

const KanbanCard = <T,>(props: KanbanCardProps<T>): JSX.Element => {
  const { class: cls, children, textValue, ...rest } = props;
  return (
    <Drag
      role={textValue ? "group" : undefined}
      aria-label={textValue}
      {...(rest as DragProps<T>)}
      class={composeSlotClassName(S.card, cls)}
      data-slot="kanban-card"
    >
      {children}
    </Drag>
  );
};

const KanbanCardContent = (props: DivProps): JSX.Element => {
  const { class: cls, children, ...rest } = props;
  return (
    <div class={composeSlotClassName(S.cardContent, cls)} data-slot="kanban-card-content" {...rest}>
      {children}
    </div>
  );
};

interface KanbanDragHandleProps extends DragHandlePrimitiveProps {
  /** Name of the default grip icon (the handle itself is not focusable, so its name sits on the `role="img"` icon). @default "Drag" */
  "aria-label"?: string;
}

/** A grip that starts the drag (the rest of the card then does not). Default content: a labelled lucide GripVertical. */
const KanbanDragHandle = (props: KanbanDragHandleProps): JSX.Element => {
  const { class: cls, children, "aria-label": label, ...rest } = props;
  return (
    <DragHandlePrimitive {...rest} class={composeSlotClassName(S.dragHandle, cls)}>
      {children ?? <Icon icon={GripVertical} size={16} aria-label={label ?? "Drag"} />}
    </DragHandlePrimitive>
  );
};

interface KanbanDropIndicatorProps {
  /** Height of the drop slot in px (`--kanban-drop-height`; default: CSS 64px). */
  height?: number;
  class?: string;
  children?: Content;
}

/** The slot shown where a dragged card will land (cdk `DragPlaceholder`); put it inside a `.Card`. */
const KanbanDropIndicator = (props: KanbanDropIndicatorProps): JSX.Element => (
  <DragPlaceholder>
    <div
      class={composeSlotClassName(S.dropIndicator, props.class)}
      data-slot="kanban-drop-indicator"
      style={props.height == null ? undefined : { "--kanban-drop-height": `${props.height}px` }}
    >
      {props.children}
    </div>
  </DragPlaceholder>
);

/* -------------------------------------------------------------------------------------------------
 * Board data
 * -----------------------------------------------------------------------------------------------*/
interface KanbanOptions<T> {
  /** The cards (a plain array, or your own signal to share the board state). */
  initialItems: T[] | Signal<T[]>;
  /** Stable card key (`Drag` `data`). */
  getKey: (item: T) => string;
  /** The column id of a card. */
  getColumn: (item: T) => string;
  /** The card moved to `column`: return the updated card. */
  setColumn: (item: T, column: string) => T;
  /** After a drop: the moved card, its column and its index there. */
  onMove?: (item: T, column: string, index: number) => void;
}

interface Kanban<T> {
  items: Signal<T[]>;
  /** The cards of one column, in board order. */
  itemsOf: (column: string) => T[];
  /** Moves a card (by key) to `index` within `column`. */
  move: (key: string, column: string, index: number) => void;
  /** `.CardList` `onDropped`. */
  onDropped: (event: DragDrop<string, string, string>) => void;
}

function createKanban<T>(options: KanbanOptions<T>): Kanban<T> {
  const items = (typeof options.initialItems === "function" ? options.initialItems : signal(options.initialItems)) as Signal<T[]>;
  const itemsOf = (column: string) => items().filter((item) => options.getColumn(item) === column);
  const move = (key: string, column: string, index: number) => {
    const all = items();
    const from = all.findIndex((item) => options.getKey(item) === key);
    if (from < 0) return;
    const rest = all.slice(0, from).concat(all.slice(from + 1));
    const moved = options.setColumn(all[from]!, column);
    const target = rest.filter((item) => options.getColumn(item) === column);
    const clamped = Math.max(0, Math.min(index, target.length));
    const at = clamped < target.length ? rest.indexOf(target[clamped]!) : target.length ? rest.indexOf(target[target.length - 1]!) + 1 : rest.length;
    rest.splice(at, 0, moved);
    items.set(rest);
    options.onMove?.(moved, column, clamped);
  };
  const onDropped = (event: DragDrop<string, string, string>) => move(event.item.data, event.container.data, event.currentIndex);
  return { items, itemsOf, move, onDropped };
}

export {
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
};
export type {
  KanbanRootProps,
  KanbanColumnIndicatorProps,
  KanbanCardListProps,
  KanbanCardProps,
  KanbanDropIndicatorProps,
  KanbanDragHandleProps,
  KanbanOptions,
  Kanban,
  DivProps as KanbanDivProps,
};
