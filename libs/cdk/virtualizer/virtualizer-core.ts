// Ported from React Spectrum (react-stately/src/virtualizer/Virtualizer.ts), Apache-2.0, © Adobe.
// Rivet: no jsdom test-environment branch in getVisibleLayoutInfos (always the overscanned rect); view keys
// counted per instance. Exported from `@rivetjs/cdk/virtualizer` as `VirtualizerEngine` (the name
// `Virtualizer` is the component there).
import type { Key } from "../collections/index.ts";
import type { Collection } from "./collection.ts";
import type { Layout } from "./layout.ts";
import type { LayoutInfo } from "./layout-info.ts";
import { OverscanManager } from "./overscan-manager.ts";
import type { Point } from "./point.ts";
import { Rect } from "./rect.ts";
import { ChildView, type ReusableView, RootView } from "./reusable-view.ts";
import { type ScrollAnchor, ScrollAnchorTracker } from "./scroll-anchor.ts";
import { Size } from "./size.ts";
import type { InvalidationContext, Mutable, VirtualizerDelegate, VirtualizerRenderOptions } from "./types.ts";
import { isSetEqual } from "./utils.ts";

export interface VirtualizerOptions<T extends object, V> {
  delegate: VirtualizerDelegate<T, V>;
  collection: Collection<T>;
  layout: Layout<T>;
}

/**
 * Renders a scrollable collection using customizable layouts: only visible views exist, reused as the user
 * scrolls. Layouts compute what is visible and where (LayoutInfo); the delegate renders each view.
 */
export class Virtualizer<T extends object, V> {
  /** The virtualizer delegate, used to create and configure views. */
  delegate: VirtualizerDelegate<T, V>;
  /** The current content of the virtualizer. */
  readonly collection: Collection<T>;
  /** The layout object that determines the visible views. */
  readonly layout: Layout<T>;
  /** The size of the scrollable content. */
  readonly contentSize: Size;
  /** The currently visible rectangle. */
  readonly visibleRect: Rect;
  /** The size of the virtualizer scroll view. */
  readonly size: Size;
  /** The set of persisted keys that are always present in the DOM, even if not currently in view. */
  readonly persistedKeys: Set<Key>;

  private _visibleViews: Map<Key, ChildView<T, V>>;
  private _renderedContent: WeakMap<T, V>;
  private _rootView: RootView<T, V>;
  private _isScrolling: boolean;
  private _invalidationContext: InvalidationContext;
  private _overscanManager: OverscanManager;
  private _scrollAnchor: ScrollAnchorTracker;
  private _viewKey = 0;

  constructor(options: VirtualizerOptions<T, V>) {
    this.delegate = options.delegate;
    this.collection = options.collection;
    this.layout = options.layout;
    this.contentSize = new Size();
    this.visibleRect = new Rect();
    this.size = new Size();
    this.persistedKeys = new Set();
    this._visibleViews = new Map();
    this._renderedContent = new WeakMap();
    this._rootView = new RootView(this);
    this._isScrolling = false;
    this._invalidationContext = {};
    this._overscanManager = new OverscanManager();
    this._scrollAnchor = new ScrollAnchorTracker();
  }

  /** @private Next ReusableView key. */
  _nextViewKey(): number {
    return ++this._viewKey;
  }

  /** Returns whether the given key, or an ancestor, is persisted. */
  isPersistedKey(key: Key): boolean {
    if (this.persistedKeys.has(key)) return true;
    // Check if the key is an ancestor of any of the persisted keys.
    for (let k of this.persistedKeys) {
      while (k != null) {
        const layoutInfo = this.layout.getLayoutInfo(k);
        if (!layoutInfo || layoutInfo.parentKey == null) break;
        k = layoutInfo.parentKey;
        if (k === key) return true;
      }
    }
    return false;
  }

  private getParentView(layoutInfo: LayoutInfo): ReusableView<T, V> | undefined {
    return layoutInfo.parentKey != null ? this._visibleViews.get(layoutInfo.parentKey) : this._rootView;
  }

  private getReusableView(layoutInfo: LayoutInfo): ChildView<T, V> {
    const parentView = this.getParentView(layoutInfo)!;
    const view = parentView.getReusableView(layoutInfo.type);
    view.layoutInfo = layoutInfo;
    this._renderView(view);
    return view;
  }

  private _renderView(reusableView: ReusableView<T, V>): void {
    if (reusableView.layoutInfo) {
      const { type, key, content } = reusableView.layoutInfo;
      reusableView.content = content || this.collection.getItem(key);
      reusableView.rendered = this._renderContent(type, reusableView.content);
    }
  }

  private _renderContent(type: string, content: T | null): V {
    const cached = content != null ? this._renderedContent.get(content) : null;
    if (cached != null) return cached;
    const rendered = this.delegate.renderView(type, content);
    if (content) this._renderedContent.set(content, rendered);
    return rendered;
  }

  /** Returns the key for the item view currently at the given point. */
  keyAtPoint(point: Point): Key | null {
    const rect = new Rect(point.x, point.y, 1, 1);
    const layoutInfos = rect.area === 0 ? [] : this.layout.getVisibleLayoutInfos(rect);
    // Layouts may return persisted keys too: find the first one that actually intersects.
    for (const layoutInfo of layoutInfos) if (layoutInfo.rect.intersects(rect)) return layoutInfo.key;
    return null;
  }

  private relayout(context: InvalidationContext = {}): void {
    const anchorInfo = this.layout.UNSTABLE_getScrollAnchorInfo?.(context.layoutOptions) ?? null;

    // Capture the scroll anchor from current (pre-layout) view positions; none on first render.
    let anchor: ScrollAnchor | null = null;
    if (anchorInfo) {
      const preLayoutInfos: [Key, LayoutInfo][] = [];
      for (const [key, view] of this._visibleViews) {
        const layoutInfo = this.layout.getLayoutInfo(key) ?? view.layoutInfo;
        if (layoutInfo) preLayoutInfos.push([key, layoutInfo]);
      }
      anchor = this._scrollAnchor.captureBeforeLayout(anchorInfo, preLayoutInfos, this.visibleRect);
    }

    const previousContentSize = this.contentSize;
    const previousVisibleRect = this.visibleRect;

    this.layout.update(context);

    const rawContentSize = this.layout.getContentSize();
    (this as Mutable<this>).contentSize = new Size(rawContentSize.width, rawContentSize.height);

    const target = this._scrollAnchor.resolveAfterLayout({
      anchorInfo,
      anchor,
      postLayoutInfos: anchorInfo ? this.getVisibleLayoutInfos() : new Map(),
      previousVisibleRect,
      previousContentSize,
      contentSize: this.contentSize,
      itemSizeChanged: context.itemSizeChanged ?? false,
      isScrolling: this._isScrolling,
      getLayoutInfo: (key: Key) => this.layout.getLayoutInfo(key),
    });

    if (target) {
      // Queues a new render cycle; skip updateSubviews (it would position views against the old rect).
      this.delegate.setVisibleRect(target);
      return;
    }

    // Constrain scroll position. If the content changed, scroll to the top.
    const visibleRect = this.visibleRect;
    let contentOffsetX = context.contentChanged ? 0 : visibleRect.x;
    let contentOffsetY = context.contentChanged ? 0 : visibleRect.y;
    contentOffsetX = Math.max(0, Math.min(this.contentSize.width - visibleRect.width, contentOffsetX));
    contentOffsetY = Math.max(0, Math.min(this.contentSize.height - visibleRect.height, contentOffsetY));

    if (contentOffsetX !== visibleRect.x || contentOffsetY !== visibleRect.y) {
      // If the offset changed, trigger a new re-render.
      this.delegate.setVisibleRect(new Rect(contentOffsetX, contentOffsetY, visibleRect.width, visibleRect.height));
    } else {
      this.updateSubviews();
    }
  }

  getVisibleLayoutInfos(): Map<Key, LayoutInfo> {
    const rect = this._overscanManager.getOverscannedRect();
    const map = new Map<Key, LayoutInfo>();
    for (const layoutInfo of this.layout.getVisibleLayoutInfos(rect)) map.set(layoutInfo.key, layoutInfo);
    return map;
  }

  private updateSubviews(): void {
    const visibleLayoutInfos = this.getVisibleLayoutInfos();

    const removed = new Set<ChildView<T, V>>();
    for (const [key, view] of this._visibleViews) {
      const layoutInfo = visibleLayoutInfos.get(key);
      // If a view's parent changed, treat it as a delete and re-create in the new parent.
      if (!layoutInfo || view.parent !== this.getParentView(layoutInfo)) {
        this._visibleViews.delete(key);
        view.parent.reuseChild(view);
        removed.add(view); // Defer removing in case we reuse this view.
      }
    }

    for (const [key, layoutInfo] of visibleLayoutInfos) {
      let view = this._visibleViews.get(key);
      if (!view) {
        view = this.getReusableView(layoutInfo);
        view.parent.children.add(view);
        this._visibleViews.set(key, view);
        removed.delete(view);
      } else {
        view.layoutInfo = layoutInfo;
        const item = this.collection.getItem(layoutInfo.key);
        if (view.content !== item) {
          if (view.content != null) this._renderedContent.delete(view.content);
          this._renderView(view);
        }
      }
    }

    // Views left in `removed` were not reused: remove them, and clear the reuse queue (FIFO order would
    // otherwise hurt later reuse).
    for (const view of removed) {
      view.parent.children.delete(view);
      view.parent.reusableViews.clear();
    }

    // Reordering DOM nodes is costly: deferred until scrolling stops (order matters for assistive technology,
    // not for the absolutely positioned visual order). Layout infos are in topological order.
    if (!this._isScrolling) {
      for (const key of visibleLayoutInfos.keys()) {
        const view = this._visibleViews.get(key)!;
        view.parent.children.delete(view);
        view.parent.children.add(view);
      }
    }
  }

  /** Performs layout and updates visible views as needed. */
  render(opts: VirtualizerRenderOptions<T>): ReusableView<T, V>[] {
    const mutableThis: Mutable<this> = this;
    let needsLayout = false;
    let offsetChanged = false;
    let sizeChanged = false;
    let widthChanged = false;
    let heightChanged = false;
    let itemSizeChanged = false;
    let layoutOptionsChanged = false;
    let needsUpdate = false;

    if (opts.collection !== this.collection) {
      mutableThis.collection = opts.collection;
      needsLayout = true;
    }

    if (opts.layout !== this.layout || this.layout.virtualizer !== this) {
      if (this.layout) this.layout.virtualizer = null;
      opts.layout.virtualizer = this;
      mutableThis.layout = opts.layout;
      this._scrollAnchor.reset();
      needsLayout = true;
    }

    if (opts.persistedKeys && !isSetEqual(opts.persistedKeys, this.persistedKeys)) {
      mutableThis.persistedKeys = opts.persistedKeys;
      needsUpdate = true;
    }

    if (!this.visibleRect.equals(opts.visibleRect) || !this.size.equals(opts.size)) {
      this._overscanManager.setVisibleRect(opts.visibleRect);

      // Scroll position + layout size of the scroll view (not the visibleRect, whose size may change during
      // window scrolling).
      const oldRect = new Rect(this.visibleRect.x, this.visibleRect.y, this.size.width, this.size.height);
      const newRect = new Rect(opts.visibleRect.x, opts.visibleRect.y, opts.size.width, opts.size.height);
      if (this.layout.shouldInvalidate(newRect, oldRect)) {
        offsetChanged = !opts.visibleRect.pointEquals(this.visibleRect);
        sizeChanged = !this.size.equals(opts.size);
        widthChanged = this.size.width !== opts.size.width;
        heightChanged = this.size.height !== opts.size.height;
        needsLayout = true;
      } else {
        needsUpdate = true;
      }

      mutableThis.visibleRect = opts.visibleRect;
      mutableThis.size = opts.size;
    }

    if (opts.invalidationContext !== this._invalidationContext) {
      if (opts.invalidationContext) {
        sizeChanged ||= opts.invalidationContext.sizeChanged || false;
        widthChanged ||= opts.invalidationContext.widthChanged || false;
        heightChanged ||= opts.invalidationContext.heightChanged || false;
        offsetChanged ||= opts.invalidationContext.offsetChanged || false;
        itemSizeChanged ||= opts.invalidationContext.itemSizeChanged || false;
        layoutOptionsChanged ||=
          opts.invalidationContext.layoutOptions != null &&
          this._invalidationContext.layoutOptions != null &&
          opts.invalidationContext.layoutOptions !== this._invalidationContext.layoutOptions &&
          this.layout.shouldInvalidateLayoutOptions(opts.invalidationContext.layoutOptions, this._invalidationContext.layoutOptions);
        needsLayout ||= itemSizeChanged || sizeChanged || offsetChanged || layoutOptionsChanged;
      }
      this._invalidationContext = opts.invalidationContext;
    }

    if (opts.isScrolling !== this._isScrolling) {
      this._isScrolling = opts.isScrolling;
      // Update to fix the DOM order after scrolling.
      if (!opts.isScrolling) needsUpdate = true;
    }

    if (needsLayout) {
      this.relayout({
        offsetChanged,
        sizeChanged,
        widthChanged,
        heightChanged,
        itemSizeChanged,
        layoutOptionsChanged,
        layoutOptions: this._invalidationContext.layoutOptions,
      });
    } else if (needsUpdate) {
      this.updateSubviews();
    }

    return Array.from(this._rootView.children);
  }

  getVisibleView(key: Key): ReusableView<T, V> | undefined {
    return this._visibleViews.get(key);
  }

  invalidate(context: InvalidationContext): void {
    this.delegate.invalidate(context);
  }

  updateItemSize(key: Key, size: Size): void {
    if (!this.layout.updateItemSize) return;
    if (this.layout.updateItemSize(key, size)) this.invalidate({ itemSizeChanged: true });
  }
}
