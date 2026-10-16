// Ported from React Spectrum (react-stately/src/virtualizer/ReusableView.ts), Apache-2.0, © Adobe.
// Rivet: the view key counter lives on the virtualizer (no module-level state).
import type { Key } from "../collections/index.ts";
import type { LayoutInfo } from "./layout-info.ts";
import type { Virtualizer } from "./virtualizer-core.ts";

/** `Virtualizer` creates instances of the `ReusableView` class to represent views currently being displayed. */
export class ReusableView<T extends object, V> {
  /** The Virtualizer this view is a part of. */
  virtualizer: Virtualizer<T, V>;
  /** The LayoutInfo this view is currently representing. */
  layoutInfo: LayoutInfo | null;
  /** The content currently being displayed by this view, set by the virtualizer. */
  content: T | null;
  rendered: V | null;
  viewType: string;
  key: Key;
  children: Set<ChildView<T, V>>;
  reusableViews: Map<string, ChildView<T, V>[]>;

  constructor(virtualizer: Virtualizer<T, V>, viewType: string) {
    this.virtualizer = virtualizer;
    this.key = virtualizer._nextViewKey();
    this.viewType = viewType;
    this.children = new Set();
    this.reusableViews = new Map();
    this.layoutInfo = null;
    this.content = null;
    this.rendered = null;
  }

  /** Prepares the view for reuse. Called just before the view is removed from the DOM. */
  prepareForReuse(): void {
    this.content = null;
    this.rendered = null;
    this.layoutInfo = null;
  }

  getReusableView(reuseType: string): ChildView<T, V> {
    // FIFO so that DOM order remains consistent during scrolling (cells of a reused row keep their order).
    const reusable = this.reusableViews.get(reuseType);
    return reusable && reusable.length > 0 ? reusable.shift()! : new ChildView<T, V>(this.virtualizer, this, reuseType);
  }

  reuseChild(child: ChildView<T, V>): void {
    child.prepareForReuse();
    let reusable = this.reusableViews.get(child.viewType);
    if (!reusable) {
      reusable = [];
      this.reusableViews.set(child.viewType, reusable);
    }
    reusable.push(child);
  }
}

export class RootView<T extends object, V> extends ReusableView<T, V> {
  constructor(virtualizer: Virtualizer<T, V>) {
    super(virtualizer, "root");
  }
}

export class ChildView<T extends object, V> extends ReusableView<T, V> {
  parent: ReusableView<T, V>;

  constructor(virtualizer: Virtualizer<T, V>, parent: ReusableView<T, V>, viewType: string) {
    super(virtualizer, viewType);
    this.parent = parent;
  }
}
