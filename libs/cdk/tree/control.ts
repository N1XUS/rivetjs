// Ported from Angular CDK tree (src/cdk/tree/control/tree-control.ts, base-tree-control.ts,
// flat-tree-control.ts, nested-tree-control.ts), MIT, © Google LLC.
//
// Tree controls (deprecated upstream in favour of `levelAccessor` / `childrenAccessor`, still public):
// expansion state of a tree's data nodes in a multi-selection `SelectionModel`, with recursive
// expand / collapse for flat (level-based) and nested (children-based) trees.
// Rivet:
// - `Observable<T[]>` children → any subscribable (`{ subscribe(fn) }`); RxJS `take(1)` +
//   `filter(Boolean)` → the first truthy emission only.
// - Constructor parameter properties → explicit fields (strip-only TypeScript).
import { SelectionModel } from "../collections/selection-model.ts";
import type { Subscribable } from "./tree-key-manager.ts";

/** Children of a data node: an array, a subscribable stream of arrays, or nothing. */
export type TreeChildren<T> = Subscribable<T[]> | T[] | undefined | null;

const isSubscribable = <T>(value: unknown): value is Subscribable<T> =>
  value != null && typeof value === "object" && typeof (value as Subscribable<T>).subscribe === "function";

/**
 * Tree control interface. User can implement TreeControl to expand/collapse dataNodes in the tree.
 * The CdkTree uses this TreeControl to expand/collapse a node; it can also be used outside a tree.
 *
 * @deprecated Use one of levelAccessor or childrenAccessor instead.
 */
export interface TreeControl<T, K = T> {
  /** The saved tree nodes data for `expandAll` action. */
  dataNodes: T[];
  /** The expansion model */
  expansionModel: SelectionModel<K>;
  /** Whether the data node is expanded or collapsed. Return true if it's expanded. */
  isExpanded(dataNode: T): boolean;
  /** Get all descendants of a data node */
  getDescendants(dataNode: T): any[];
  /** Expand or collapse data node */
  toggle(dataNode: T): void;
  /** Expand one data node */
  expand(dataNode: T): void;
  /** Collapse one data node */
  collapse(dataNode: T): void;
  /** Expand all the dataNodes in the tree */
  expandAll(): void;
  /** Collapse all the dataNodes in the tree */
  collapseAll(): void;
  /** Toggle a data node by expand/collapse it and all its descendants */
  toggleDescendants(dataNode: T): void;
  /** Expand a data node and all its descendants */
  expandDescendants(dataNode: T): void;
  /** Collapse a data node and all its descendants */
  collapseDescendants(dataNode: T): void;
  /** Get depth of a given data node, return the level number. This is for flat tree node. */
  readonly getLevel: (dataNode: T) => number;
  /** Whether the data node is expandable. Returns true if expandable. This is for flat tree node. */
  readonly isExpandable: (dataNode: T) => boolean;
  /** Gets a stream that emits whenever the given data node's children change. */
  readonly getChildren: (dataNode: T) => TreeChildren<T>;
}

/**
 * Base tree control. It has basic toggle/expand/collapse operations on a single data node.
 *
 * @deprecated Use one of levelAccessor or childrenAccessor.
 */
export abstract class BaseTreeControl<T, K = T> implements TreeControl<T, K> {
  /** Gets a list of descendent data nodes of a subtree rooted at given data node recursively. */
  abstract getDescendants(dataNode: T): T[];

  /** Expands all data nodes in the tree. */
  abstract expandAll(): void;

  /** Saved data node for `expandAll` action. */
  dataNodes!: T[];

  /** A selection model with multi-selection to track expansion status. */
  expansionModel: SelectionModel<K> = new SelectionModel<K>(true);

  /** Returns the identifier by which a dataNode should be tracked, should its reference change. */
  trackBy?: (dataNode: T) => K;

  /** Get depth of a given data node, return the level number. This is for flat tree node. */
  getLevel!: (dataNode: T) => number;

  /** Whether the data node is expandable. Returns true if expandable. This is for flat tree node. */
  isExpandable!: (dataNode: T) => boolean;

  /** Gets a stream that emits whenever the given data node's children change. */
  getChildren!: (dataNode: T) => TreeChildren<T>;

  /** Toggles one single data node's expanded/collapsed state. */
  toggle(dataNode: T): void {
    this.expansionModel.toggle(this._trackByValue(dataNode));
  }

  /** Expands one single data node. */
  expand(dataNode: T): void {
    this.expansionModel.select(this._trackByValue(dataNode));
  }

  /** Collapses one single data node. */
  collapse(dataNode: T): void {
    this.expansionModel.deselect(this._trackByValue(dataNode));
  }

  /** Whether a given data node is expanded or not. Returns true if the data node is expanded. */
  isExpanded(dataNode: T): boolean {
    return this.expansionModel.isSelected(this._trackByValue(dataNode));
  }

  /** Toggles a subtree rooted at `node` recursively. */
  toggleDescendants(dataNode: T): void {
    if (this.expansionModel.isSelected(this._trackByValue(dataNode))) this.collapseDescendants(dataNode);
    else this.expandDescendants(dataNode);
  }

  /** Collapse all dataNodes in the tree. */
  collapseAll(): void {
    this.expansionModel.clear();
  }

  /** Expands a subtree rooted at given data node recursively. */
  expandDescendants(dataNode: T): void {
    const toBeProcessed = [dataNode];
    toBeProcessed.push(...this.getDescendants(dataNode));
    this.expansionModel.select(...toBeProcessed.map((value) => this._trackByValue(value)));
  }

  /** Collapses a subtree rooted at given data node recursively. */
  collapseDescendants(dataNode: T): void {
    const toBeProcessed = [dataNode];
    toBeProcessed.push(...this.getDescendants(dataNode));
    this.expansionModel.deselect(...toBeProcessed.map((value) => this._trackByValue(value)));
  }

  protected _trackByValue(value: T | K): K {
    return this.trackBy ? this.trackBy(value as T) : (value as K);
  }
}

/** Optional set of configuration that can be provided to the FlatTreeControl. */
export interface FlatTreeControlOptions<T, K> {
  trackBy?: (dataNode: T) => K;
}

/**
 * Flat tree control. Able to expand/collapse a subtree recursively for flattened tree.
 *
 * @deprecated Use one of levelAccessor or childrenAccessor instead.
 */
export class FlatTreeControl<T, K = T> extends BaseTreeControl<T, K> {
  options?: FlatTreeControlOptions<T, K> | undefined;

  /** Construct with flat tree data node functions getLevel and isExpandable. */
  constructor(getLevel: (dataNode: T) => number, isExpandable: (dataNode: T) => boolean, options?: FlatTreeControlOptions<T, K>) {
    super();
    this.getLevel = getLevel;
    this.isExpandable = isExpandable;
    this.options = options;

    if (this.options) this.trackBy = this.options.trackBy;
  }

  /**
   * Gets a list of the data node's subtree of descendent data nodes. The `dataNodes` of the
   * TreeControl must be flattened tree nodes with correct levels.
   */
  getDescendants(dataNode: T): T[] {
    const startIndex = this.dataNodes.indexOf(dataNode);
    const results: T[] = [];

    // Descendants have a greater level than the node; an equal level is a sibling, a smaller one a
    // sibling of an ancestor.
    for (let i = startIndex + 1; i < this.dataNodes.length && this.getLevel(dataNode) < this.getLevel(this.dataNodes[i]!); i++) {
      results.push(this.dataNodes[i]!);
    }
    return results;
  }

  /** Expands all data nodes in the tree (`dataNodes` must be all flattened data nodes). */
  expandAll(): void {
    this.expansionModel.select(...this.dataNodes.map((node) => this._trackByValue(node)));
  }
}

/** Optional set of configuration that can be provided to the NestedTreeControl. */
export interface NestedTreeControlOptions<T, K> {
  /** Function to determine if the provided node is expandable. */
  isExpandable?: (dataNode: T) => boolean;
  trackBy?: (dataNode: T) => K;
}

/**
 * Nested tree control. Able to expand/collapse a subtree recursively for NestedNode type.
 *
 * @deprecated Use one of levelAccessor or childrenAccessor instead.
 */
export class NestedTreeControl<T, K = T> extends BaseTreeControl<T, K> {
  options?: NestedTreeControlOptions<T, K> | undefined;

  /** Construct with nested tree function getChildren. */
  constructor(getChildren: (dataNode: T) => TreeChildren<T>, options?: NestedTreeControlOptions<T, K>) {
    super();
    this.getChildren = getChildren;
    this.options = options;

    if (this.options) this.trackBy = this.options.trackBy;
    if (this.options?.isExpandable) this.isExpandable = this.options.isExpandable;
  }

  /** Expands all dataNodes in the tree (`dataNodes` must be all root level data nodes). */
  expandAll(): void {
    this.expansionModel.clear();
    const allNodes = this.dataNodes.reduce((accumulator: T[], dataNode) => [...accumulator, ...this.getDescendants(dataNode), dataNode], []);
    this.expansionModel.select(...allNodes.map((node) => this._trackByValue(node)));
  }

  /** Gets a list of descendant dataNodes of a subtree rooted at given data node recursively. */
  getDescendants(dataNode: T): T[] {
    const descendants: T[] = [];
    this._getDescendants(descendants, dataNode);
    // Remove the node itself
    return descendants.splice(1);
  }

  /** A helper function to get descendants recursively. */
  protected _getDescendants(descendants: T[], dataNode: T): void {
    descendants.push(dataNode);
    const childrenNodes = this.getChildren(dataNode);
    if (Array.isArray(childrenNodes)) {
      childrenNodes.forEach((child: T) => this._getDescendants(descendants, child));
    } else if (isSubscribable<T[]>(childrenNodes)) {
      // take(1) + filter(Boolean): the first truthy emission.
      let done = false;
      let sync = true;
      let subscription: ReturnType<Subscribable<T[]>["subscribe"]> = undefined;
      const unsubscribe = () => (typeof subscription === "function" ? subscription() : subscription?.unsubscribe());
      subscription = childrenNodes.subscribe((children) => {
        if (done || !children) return;
        done = true;
        if (!sync) unsubscribe();
        for (const child of children) this._getDescendants(descendants, child);
      });
      sync = false;
      if (done) unsubscribe();
    }
  }
}
