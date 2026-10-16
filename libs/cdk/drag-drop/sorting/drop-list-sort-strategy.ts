// Ported from Angular Components (src/cdk/drag-drop/sorting/drop-list-sort-strategy.ts), MIT, © Google LLC.
import type {DragRef} from '../drag-ref.ts';

/**
 * Function that is used to determine whether an item can be sorted into a particular index.
 * @docs-private
 */
export type SortPredicate<T> = (index: number, item: T) => boolean;

/**
 * Strategy used to sort and position items within a drop list.
 * @docs-private
 */
export interface DropListSortStrategy {
  start(items: readonly DragRef[]): void;
  sort(
    item: DragRef,
    pointerX: number,
    pointerY: number,
    pointerDelta: {x: number; y: number},
  ): {previousIndex: number; currentIndex: number} | null;
  enter(item: DragRef, pointerX: number, pointerY: number, index?: number): void;
  withItems(items: readonly DragRef[]): void;
  withSortPredicate(predicate: SortPredicate<DragRef>): void;
  withElementContainer(container: HTMLElement): void;
  reset(): void;
  getActiveItemsSnapshot(): readonly DragRef[];
  getItemIndex(item: DragRef): number;
  getItemAtIndex(index: number): DragRef | null;
  updateOnScroll(topDifference: number, leftDifference: number): void;
}
