// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no kanban). Feature set scoped from public docs of commercial UI kits
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
// - Keyboard moves (SHOWCASE-1 2026-10-27; the cdk drag-drop port has no keyboard drag): `Kanban onCardMove` turns every
//   `.Card` into a focusable card (`tabindex=0`, `aria-describedby` = the board's visually hidden instructions) and the
//   root handles Space / Enter (pick up, drop), arrows (move), Escape (cancel) with one delegated `keydown`
//   (`keyboard.ts`, loaded on the first handled key: a sync guard here calls `preventDefault`, so boards without
//   `onCardMove` ship none of it; texts in `messages.ts`; state in DOM attributes, announcements through the cdk live announcer). `createKanban().onCardMove`
//   plugs in directly. `.CardList` writes `data-kanban-column`, `.Card` `data-kanban-key` (String of their `data`).
// - `KanbanComposer` (`kanban-composer.tsx`): the "add a card" row (ghost trigger → inline TextField form): its own export,
//   not a compound part, so a board without one loads no Button / TextField code (measured +33 KB gz on kanban-basic as a part).
// - Context `KanbanContext` `{ keyboard, describedBy, describedBySelection }` (plain data) from the root to its cards.
// - Card selection (KANBAN-SELECT 2026-10-29; public kit docs: `.CardList` `selectionMode`, cards `data-selected`): a `.CardList`
//   with `selectionMode` "single" / "multiple" is a cdk GridList over its rendered cards: `role="grid"` (+
//   `aria-multiselectable`), cards `role="row"` with a `role="gridcell"` wrapper (`display: contents`), `aria-selected`,
//   roving `tabindex`, `data-key` / `data-collection`. State = a `@rivetjs/cdk/collections/list-state` `ListState`
//   without items (the DOM is the collection) over `createMultipleSelectionState`; the handlers (`selection.ts`: the
//   `@rivetjs/cdk/grid-list/behaviour` port delegated on the list element) load on the list's first event, so boards
//   without `selectionMode` ship none of it (a sync guard holds the handled keys meanwhile). Keys and pointer semantics
//   are RAC GridList's: Space / Enter / click select (`selectionBehavior` toggle / replace,
//   Shift / Mod ranges), arrows / Home / End / PageUp / PageDown move focus. Selection happens on press up (RAC
//   GridList with drag and drop) and a press that moved past 4px (a drag) never selects. With board keyboard moves
//   (`onCardMove`) Enter belongs to the move (pick up / drop) and every key of a picked-up card too; Space selects, the
//   cards are described by `messages.selectionInstructions`. A card leaving a list (moved / removed) clears its focused
//   key there (`onCleanup`), so the list stays tabbable; its key stays in that list's selection (react-stately: no pruning).
// - `KanbanListContext` `{ state }` (null outside a selectable list) from a selectable `.CardList` to its cards.
import { DragHandle as DragHandlePrimitive, DragPlaceholder, DropList, DropListGroup, Drag } from "@rivetjs/cdk/drag-drop";
import type { DragDrop, DragHandleProps as DragHandlePrimitiveProps, DragProps, DropListGroupProps, DropListProps } from "@rivetjs/cdk/drag-drop";
import { resumedId } from "@rivetjs/cdk/id";
import { Icon } from "@rivetjs/kit/icon";
import type { ListState } from "@rivetjs/cdk/collections/list-state";
import type { Key, Selection, SelectionBehavior, SelectionMode } from "@rivetjs/cdk/collections/types";
import { isFocusedKey, NOT_SELECTED, selectionOf } from "@rivetjs/cdk/selection/keyed";
import { createMultipleSelectionState, setFocusedKey } from "@rivetjs/cdk/selection/state";
import { createContext, onCleanup, signal, untrack, useContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { GripVertical } from "lucide";

import type { KanbanVariants } from "../../../styles/src/components/kanban/index.ts";
import { kanbanVariants } from "../../../styles/src/components/kanban/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { ScrollShadowRoot } from "../scroll-shadow/scroll-shadow.tsx";
import type { ScrollShadowRootProps } from "../scroll-shadow/scroll-shadow.tsx";
import type { KanbanCardMove } from "./keyboard.ts";
import type { KanbanListEvent, KanbanSelectableList } from "./selection.ts";
import { KANBAN_MESSAGES } from "./messages.ts";
import type { KanbanMessages } from "./messages.ts";

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
interface KanbanContextValue {
  /** Cards are focusable and move with the keyboard (the root has `onCardMove`). */
  keyboard?: boolean;
  /** Id of the board's keyboard instructions (`aria-describedby` of every card). */
  describedBy?: string;
  /** Id of the instructions of cards in a selectable `.CardList` (Enter picks up there). */
  describedBySelection?: string;
}

const KanbanContext = createContext<KanbanContextValue>({});

interface KanbanRootProps extends DropListGroupProps, KanbanVariants {
  /**
   * Keyboard moves: a focused card is picked up with Space / Enter, moved with the arrow keys, dropped with Space / Enter
   * and put back with Escape; every step calls this with the target (`createKanban().onCardMove`). Read once.
   */
  onCardMove?: (move: KanbanCardMove) => void;
  /** Screen reader texts of keyboard moves (English defaults). */
  messages?: Partial<KanbanMessages>;
}

const CARD = '[data-slot="kanban-card"]';
// The keyboard move logic, loaded on the first handled key (boards without `onCardMove` never load it), then called
// synchronously.
let keyboard: typeof import("./keyboard.ts") | undefined;
let loading: Promise<typeof import("./keyboard.ts")> | undefined;
const MOVE_KEY = /^( |Enter|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/;

const KanbanRoot = (props: KanbanRootProps): JSX.Element => {
  const { size, class: cls, children, onCardMove, messages, ...rest } = props;
  if (!onCardMove)
    return (
      <DropListGroup {...rest} class={slotsFor(size).base({ class: cls })} data-size={size ?? "md"} data-slot="kanban">
        {children}
      </DropListGroup>
    );
  const describedBy = resumedId();
  const describedBySelection = resumedId();
  const context: KanbanContextValue = { keyboard: true, describedBy, describedBySelection };
  return (
    <DropListGroup
      {...rest}
      class={slotsFor(size).base({ class: cls })}
      data-size={size ?? "md"}
      data-slot="kanban"
      onKeyDown={(event: KeyboardEvent) => {
        const root = event.currentTarget as HTMLElement;
        const target = event.target as HTMLElement;
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !MOVE_KEY.test(event.key) || !target.matches?.(CARD)) return;
        // Space / Enter pick up or drop; Escape / arrows only while this card is picked up (or while the first key's
        // module load is pending: that key may be the pick-up).
        if (event.key !== " " && event.key !== "Enter" && root.dataset.kanbanGrabbed !== target.dataset.kanbanKey && !(loading && !keyboard)) return;
        event.preventDefault();
        const key = event.key;
        if (keyboard) keyboard.kanbanKey(root, target, key, onCardMove, messages);
        // In order: every key queued during the load runs after it, first to last.
        else
          void (loading ??= import("./keyboard.ts")).then((m) => {
            keyboard = m;
            m.kanbanKey(root, target, key, onCardMove, messages);
          });
      }}
      onFocusOut={(event: FocusEvent) => {
        // A picked-up card that loses focus (Tab, click elsewhere) is dropped where it is.
        const root = event.currentTarget as HTMLElement;
        const key = root.dataset.kanbanGrabbed;
        if (!key || root.dataset.kanbanMoving !== undefined || (event.relatedTarget as HTMLElement | null)?.dataset?.kanbanKey === key) return;
        delete root.dataset.kanbanGrabbed;
        delete root.dataset.kanbanFrom;
        root.querySelector(`[data-kanban-key="${CSS.escape(key)}"]`)?.removeAttribute("data-grabbed");
      }}
    >
      <Provider token={KanbanContext} value={context}>
        {children as never}
      </Provider>
      <span id={describedBy} hidden>
        {messages?.instructions ?? KANBAN_MESSAGES.instructions}
      </span>
      <span id={describedBySelection} hidden>
        {messages?.selectionInstructions ?? KANBAN_MESSAGES.selectionInstructions}
      </span>
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
  /** Card selection (RAC GridList semantics; keys = the cards' `data` as strings). @default "none" */
  selectionMode?: SelectionMode;
  /** How multiple selection behaves: `"toggle"` (each press toggles) or `"replace"` (a press replaces, Shift / Mod extend). @default "toggle" */
  selectionBehavior?: SelectionBehavior;
  /** The selected card keys: a signal (two-way) or a value (controlled). */
  selectedKeys?: Signal<Selection> | "all" | Iterable<Key>;
  /** The initially selected card keys (uncontrolled). */
  defaultSelectedKeys?: "all" | Iterable<Key>;
  /** Called when the selection changes. */
  onSelectionChange?: (keys: Selection) => void;
  /** Card keys that cannot be selected or focused. */
  disabledKeys?: Iterable<Key>;
  /** Whether the last selected card cannot be deselected. */
  disallowEmptySelection?: boolean;
  /** Whether Escape clears the selection. @default "clearSelection" */
  escapeKeyBehavior?: "clearSelection" | "none";
  /** Called when a card is actioned (Enter without board keyboard moves, a press with `selectionBehavior="replace"`). */
  onAction?: (key: Key) => void;
}

/** What a selectable `.CardList` gives its cards (null: the list has no selection). */
interface KanbanListContextValue {
  state: ListState;
}

const KanbanListContext = createContext<KanbanListContextValue | null>(null);

const BOARD = '[data-slot="kanban"]';
const isSignal = (value: unknown): value is Signal<Selection> => typeof value === "function" && typeof (value as Signal<Selection>).set === "function";
const toSelection = (value: "all" | Iterable<Key> | undefined): Selection => (value === "all" ? "all" : new Set(value ?? []));
// `@rivetjs/cdk/selection/selectable-collection` `selectableCollectionKeys` (inlined: that module is the lazy half).
const NAV_KEYS = "ArrowDown ArrowUp ArrowLeft ArrowRight Home End PageUp PageDown";
const SELECT_KEY = /^( |Enter|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/;
// The selection handlers, loaded on a selectable list's first event (boards without `selectionMode` never load them),
// then called synchronously. Events during the load run after it, in order, through a proxy that keeps `currentTarget`.
let selection: typeof import("./selection.ts") | undefined;
let selectionLoading: Promise<typeof import("./selection.ts")> | undefined;
function listEvent(type: KanbanListEvent, e: Event, board: KanbanSelectableList): void {
  const list = e.currentTarget as HTMLElement;
  if (selection) return selection.kanbanListEvent(type, e, list, board);
  const event = new Proxy(e, {
    get: (target, name) => {
      if (name === "currentTarget") return list;
      const value = Reflect.get(target, name) as unknown;
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
  void (selectionLoading ??= import("./selection.ts")).then((m) => {
    selection = m;
    m.kanbanListEvent(type, event, list, board);
  });
}

const KanbanCardList = <T,>(props: KanbanCardListProps<T>): JSX.Element => {
  const {
    class: cls,
    children,
    renderEmptyState,
    selectionMode,
    selectionBehavior,
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
    disabledKeys,
    disallowEmptySelection,
    escapeKeyBehavior,
    onAction,
    ...rest
  } = props;
  const data = rest.data as unknown;
  const column = typeof data === "function" ? () => String((data as () => unknown)()) : data === undefined ? undefined : String(data);
  const empty = renderEmptyState ? (
    <div class={S.empty()} data-slot="kanban-empty">
      {renderEmptyState()}
    </div>
  ) : null;
  if (!selectionMode || selectionMode === "none")
    return (
      <DropList {...(rest as DropListProps<T>)} class={composeSlotClassName(S.cardList, cls)} data-slot="kanban-card-list" data-kanban-column={column as never}>
        {children}
        {empty}
      </DropList>
    );
  const board = useContext(KanbanContext);
  const keys = disabledKeys ? new Set(disabledKeys) : new Set<Key>();
  const state: ListState = {
    id: resumedId(),
    selectionState: createMultipleSelectionState({
      selectionMode,
      selectionBehavior,
      // A signal is two-way; a value (live: re-read) is controlled.
      selectedKeys: selectedKeys == null || isSignal(selectedKeys) ? selectedKeys : () => toSelection(props.selectedKeys as "all" | Iterable<Key>),
      defaultSelectedKeys,
      onSelectionChange,
      disabledKeys: keys,
      disallowEmptySelection,
    }),
    disabledKeys: keys,
    items: undefined,
    children: undefined,
    collection: undefined,
    filter: undefined,
    suppressTextValueWarning: true,
    layoutDelegate: undefined,
  };
  const sel = state.selectionState;
  // `@rivetjs/cdk/grid-list/behaviour` `gridListShared` (RAC GridList with drag and drop: select on press up).
  const shared = { id: state.id, onAction, linkBehavior: "action" as const, keyboardNavigationBehavior: "arrow" as const, shouldSelectOnPressUp: true };
  const list: KanbanSelectableList = { state, shared, escapeKeyBehavior, onAction };
  const context: KanbanListContextValue = { state };
  // Board keyboard moves own Enter (pick up / drop) and every key of the picked-up card.
  const moving = (e: KeyboardEvent): boolean => {
    const card = (e.target as Element).closest?.<HTMLElement>(CARD);
    return !!board.keyboard && !!card && (e.key === "Enter" || card.closest<HTMLElement>(BOARD)?.dataset.kanbanGrabbed === card.dataset.kanbanKey);
  };
  return (
    <DropList
      {...(rest as DropListProps<T>)}
      class={composeSlotClassName(S.cardList, cls)}
      data-slot="kanban-card-list"
      data-kanban-column={column as never}
      role="grid"
      aria-multiselectable={selectionMode === "multiple" ? "true" : undefined}
      tabIndex={(() => (sel.focusedKey() == null ? 0 : -1)) as never}
      data-collection={state.id}
      data-selection-mode={selectionMode}
      data-rk={NAV_KEYS}
      onKeyDown={(e: KeyboardEvent) => {
        if (moving(e)) return;
        // While the handlers load: hold the keys they handle (no scroll, no board pick-up on Space).
        const target = e.target as Element;
        if (!selection && SELECT_KEY.test(e.key) && (target === e.currentTarget || target.matches(CARD))) e.preventDefault();
        listEvent("keydown", e, list);
      }}
      onKeyUp={(e: KeyboardEvent) => {
        if (!moving(e)) listEvent("keyup", e, list);
      }}
      onFocusIn={(e: FocusEvent) => listEvent("focusin", e, list)}
      onFocusOut={(e: FocusEvent) => listEvent("focusout", e, list)}
      onMouseDown={(e: MouseEvent) => listEvent("mousedown", e, list)}
      onPointerDown={(e: PointerEvent) => listEvent("pointerdown", e, list)}
      onPointerUp={(e: PointerEvent) => listEvent("pointerup", e, list)}
      onPointerCancel={(e: PointerEvent) => listEvent("pointercancel", e, list)}
      onClick={(e: MouseEvent) => listEvent("click", e, list)}
    >
      <Provider token={KanbanListContext} value={context}>
        {children as never}
      </Provider>
      {empty}
    </DropList>
  );
};

interface KanbanCardProps<T = string> extends DragProps<T> {
  /** Accessible name of the card (`aria-label` on the drag element; `role="group"`, or `"row"` in a selectable list). */
  textValue?: string;
}

const KanbanCard = <T,>(props: KanbanCardProps<T>): JSX.Element => {
  const { class: cls, children, textValue, ...rest } = props;
  const board = useContext(KanbanContext);
  const list = useContext(KanbanListContext);
  const data = rest.data as unknown;
  const key = typeof data === "function" ? () => String((data as () => unknown)()) : data === undefined ? undefined : String(data);
  if (!list)
    return (
      <Drag
        role={textValue ? "group" : undefined}
        aria-label={textValue}
        tabIndex={board.keyboard ? 0 : undefined}
        aria-describedby={board.keyboard ? board.describedBy : undefined}
        {...(rest as DragProps<T>)}
        class={composeSlotClassName(S.card, cls)}
        data-slot="kanban-card"
        data-kanban-key={key as never}
      >
        {children}
      </Drag>
    );
  const { state } = list;
  const sel = state.selectionState;
  const keyOf = () => (typeof key === "function" ? key() : (key ?? ""));
  const disabled = () => state.disabledKeys.has(keyOf());
  const selected = () => !disabled() && selectionOf(sel, keyOf()) !== NOT_SELECTED;
  // A card that leaves this list (moved to another column, removed) is no longer its focused row.
  onCleanup(() => {
    if (untrack(sel.focusedKey) === untrack(keyOf)) setFocusedKey(sel, null);
  });
  return (
    <Drag
      role="row"
      aria-label={textValue}
      aria-describedby={board.keyboard ? board.describedBySelection : undefined}
      {...(rest as DragProps<T>)}
      tabIndex={(() => (isFocusedKey(sel, keyOf()) ? 0 : -1)) as never}
      aria-selected={(() => (disabled() ? undefined : selected() ? "true" : "false")) as never}
      aria-disabled={(() => (disabled() ? "true" : undefined)) as never}
      class={composeSlotClassName(S.card, cls)}
      data-slot="kanban-card"
      data-kanban-key={key as never}
      data-key={key as never}
      data-collection={state.id}
      data-selected={(() => (selected() ? "true" : undefined)) as never}
    >
      <div role="gridcell" aria-colindex={1} style={{ display: "contents" }}>
        {children}
      </div>
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
  /** `Kanban onCardMove` (keyboard moves): `move(key, column, index)`. */
  onCardMove: (move: KanbanCardMove) => void;
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
  const onCardMove = (request: KanbanCardMove) => move(request.key, request.column, request.index);
  return { items, itemsOf, move, onDropped, onCardMove };
}

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
};
export type {
  KanbanCardMove,
  KanbanContextValue,
  KanbanListContextValue,
  KanbanMessages,
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
