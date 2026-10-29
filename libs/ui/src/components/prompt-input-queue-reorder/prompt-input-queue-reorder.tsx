// Rivet addition: drag reordering for the `PromptInput` queue (`values` + `onReorder` + `axis` on the list, `value` on a
// row; API shape scoped from public docs of commercial UI kits (`Queue.List onReorder`), independent implementation on
// `@rivetjs/cdk/drag-drop`, as `@rivetjs/ui/kanban`).
// - Own subpath (`@rivetjs/ui/prompt-input-queue-reorder`), not a `Queue.List` prop: a queue that does not reorder ships
//   none of this code nor the drag-drop components / engine (a prop branch needs a dynamic import, whose Vite preload
//   helper alone grew every composer frame by ~1.2 KB).
// - List = cdk `DropList` with the `Queue.List` markup (`.prompt-input__queue-list`, `role="list"`), `data-reorderable`,
//   `data-axis`, `orientation` vertical / horizontal from `axis`, `lockAxis` = `axis`; Item = cdk `Drag` with the
//   `Queue.Item` markup (`data` = `value`): the whole row drags (`Queue.Item.Handle` stays presentational, as Pro's). A
//   drop calls `onReorder(values)` with the reordered copy of `values`; the app stores it (keyed `For`: the rows move).
// - Keyboard (Rivet addition, Pro documents none): rows are focusable; Alt+ArrowUp / Alt+ArrowDown (Alt+ArrowLeft /
//   Alt+ArrowRight on `axis="x"`) move the focused row by one, focus stays on it.
import { Drag, DropList } from "@rivetjs/cdk/drag-drop";
import type { DragDrop } from "@rivetjs/cdk/drag-drop";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { splitLive } from "../../utils/live.tsx";

// The `promptInputVariants` slot classes as literals (styles come with `PromptInput.Queue`): importing the tv module here
// made it a module shared with the composer chunk, which moved it into the common runtime chunk of every composer page.
const LIST = "prompt-input__queue-list";
const ROW = "prompt-input__queue-item";
const withClass = (base: string, cls: string | undefined) => (cls ? base + " " + cls : base);
const ITEM = '[data-slot="prompt-input-queue-item"]';

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

interface PromptInputQueueReorderListProps<T = unknown> extends DivProps {
  /** The queued entries in row order. */
  values: readonly T[];
  /** Called with the reordered copy of `values` after a drag (or Alt+Arrow) move. */
  onReorder: (values: T[]) => void;
  /** Reorder axis. @default "y" */
  axis?: "x" | "y";
}

interface PromptInputQueueReorderItemProps<T = unknown> extends DivProps {
  /** This row's entry of the list's `values` (the drag data). */
  value?: T;
}

interface ReorderContext {
  canMove: (from: number, to: number) => boolean;
  move: (from: number, to: number) => void;
  axis: "x" | "y";
}

const QueueReorderContext = createContext<ReorderContext>({ canMove: () => false, move: () => {}, axis: "y" });

/** `values` with the entry at `from` moved to `to`. */
const moved = <T,>(values: readonly T[], from: number, to: number): T[] => {
  const next = values.slice();
  next.splice(to, 0, next.splice(from, 1)[0]!);
  return next;
};

/** `PromptInput.Queue.List` that reorders its rows (cdk `DropList`). */
function PromptInputQueueReorderList<T>(props: PromptInputQueueReorderListProps<T>): JSX.Element {
  const [local, rest] = splitLive(props, ["class", "children", "values", "onReorder", "axis"]);
  const axis = local.axis === "x" ? "x" : "y";
  const canMove = (from: number, to: number): boolean => {
    const length = local.values?.length ?? 0;
    return from !== to && from >= 0 && to >= 0 && from < length && to < length;
  };
  const move = (from: number, to: number): void => {
    if (canMove(from, to)) local.onReorder(moved(local.values, from, to));
  };
  return (
    <DropList
      {...(rest as object)}
      class={withClass(LIST, local.class)}
      role="list"
      data-slot="prompt-input-queue-list"
      data-reorderable="true"
      data-axis={axis}
      orientation={axis === "x" ? "horizontal" : "vertical"}
      lockAxis={axis}
      onDropped={(event: DragDrop<unknown>) => move(event.previousIndex, event.currentIndex)}
    >
      <Provider token={QueueReorderContext} value={{ canMove, move, axis }}>
        {local.children}
      </Provider>
    </DropList>
  );
}

/** `PromptInput.Queue.Item` that drags (cdk `Drag`); put the `PromptInput.Queue.Item.*` parts inside. */
function PromptInputQueueReorderItem<T>(props: PromptInputQueueReorderItemProps<T>): JSX.Element {
  const context = useContext(QueueReorderContext);
  const [local, rest] = splitLive(props, ["class", "children", "value"]);
  const [back, forward] = context.axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
  return (
    <Drag
      {...(rest as object)}
      data={local.value}
      class={withClass(ROW, local.class)}
      role="listitem"
      tabIndex={0}
      aria-keyshortcuts={`Alt+${back} Alt+${forward}`}
      data-slot="prompt-input-queue-item"
      onKeyDown={(event: KeyboardEvent) => {
        const row = event.currentTarget as HTMLElement;
        const list = row.parentElement;
        if (!list || !event.altKey || event.target !== row || (event.key !== back && event.key !== forward)) return;
        const rowsOf = () => [...list.children].filter((el) => el.matches(ITEM)) as HTMLElement[];
        const from = rowsOf().indexOf(row);
        const to = from + (event.key === back ? -1 : 1);
        if (!context.canMove(from, to)) return;
        event.preventDefault();
        // The move re-inserts the focused row (the browser drops its focus). The store write flushes after this handler, so
        // refocus in the next task: the row now at the target index.
        setTimeout(() => {
          context.move(from, to);
          const target = row.isConnected ? row : rowsOf()[to];
          if (target && target !== target.ownerDocument.activeElement) target.focus();
        });
      }}
    >
      {local.children}
    </Drag>
  );
}

export { PromptInputQueueReorderList, PromptInputQueueReorderItem };
export type { PromptInputQueueReorderListProps, PromptInputQueueReorderItemProps };
