// Ported from react-stately (packages/react-stately/src/toast/useToastState.ts: useToastState,
// useToastQueue, ToastQueue, Timer), Apache-2.0, © Adobe.
// Rivet:
// - `useToastQueue(queue)` → `createToastQueueState(queue)`: subscribes (owned: unsubscribes on owner
//   cleanup) and returns the ToastState with `visibleToasts` as a signal accessor; `useToastState(props)`
//   → `createToastState(props)` = `createToastQueueState(new ToastQueue(props))`.
// - `ToastQueue` is used directly (browser module singleton, as the original's recommended global queue).
//   A queue carries a `name` (default "default") so a server-rendered `<ToastRegion queue>` finds it on a
//   resumed page: while no region subscribes, every update also dispatches `TOAST_QUEUE_EVENT` on
//   `document` (detail: the queue) inside `wrapUpdate`; the region's resumable `clientEvent` connects on
//   it (its chunk loads on the first toast).
// Deviation: `Timer.reset` clears a running countdown and `Timer.resume` is a no-op while running (the
//   original starts a second `setTimeout`, so a toast whose region resumes timers twice closes twice).
import { getOwner, onCleanup, signal } from "@rivetjs/reactivity";

export type ToastAction = "add" | "remove" | "clear";

/** Event dispatched on `document` by a queue update while no region subscribes (detail: the queue). */
export const TOAST_QUEUE_EVENT = "rv-toast-queue";

export interface ToastStateProps {
  /** The maximum number of toasts to display at a time. */
  maxVisibleToasts?: number;
  /** Function to wrap updates in (i.e. document.startViewTransition()). */
  wrapUpdate?: (fn: () => void, action: ToastAction) => void;
  /** Rivet: name a server-rendered `<ToastRegion>` uses to find this queue on a resumed page. @default "default" */
  name?: string;
}

export interface ToastOptions {
  /** Handler that is called when the toast is closed, either by the user or after a timeout. */
  onClose?: () => void;
  /** A timeout to automatically close the toast after, in milliseconds. */
  timeout?: number;
}

export interface QueuedToast<T> extends ToastOptions {
  /** The content of the toast. */
  content: T;
  /** A unique key for the toast. */
  key: string;
  /** A timer for the toast, if a timeout was set. */
  timer?: Timer;
}

export interface ToastState<T> {
  /** Adds a new toast to the queue. */
  add(content: T, options?: ToastOptions): string;
  /** Closes a toast. */
  close(key: string): void;
  /** Pauses the timers for all visible toasts. */
  pauseAll(): void;
  /** Resumes the timers for all visible toasts. */
  resumeAll(): void;
  /** The visible toasts (Rivet: a signal accessor). */
  visibleToasts: () => QueuedToast<T>[];
}

/**
 * Provides state management for a toast queue. Toasts display brief, temporary notifications
 * of actions, errors, or other events in an application.
 */
export function createToastState<T>(props: ToastStateProps = {}): ToastState<T> {
  const { maxVisibleToasts = 1, wrapUpdate, name } = props;
  return createToastQueueState(new ToastQueue<T>({ maxVisibleToasts, wrapUpdate, name }));
}

/** Subscribes to a provided toast queue and provides methods to update it. */
export function createToastQueueState<T>(queue: ToastQueue<T>): ToastState<T> {
  const visibleToasts = signal<QueuedToast<T>[]>(queue.visibleToasts);
  const unsubscribe = queue.subscribe(() => visibleToasts.set(queue.visibleToasts));
  if (getOwner()) onCleanup(unsubscribe);
  return {
    visibleToasts,
    add: (content, options) => queue.add(content, options),
    close: (key) => queue.close(key),
    pauseAll: () => queue.pauseAll(),
    resumeAll: () => queue.resumeAll(),
  };
}

/** A ToastQueue manages the order of toasts. */
export class ToastQueue<T> {
  private queue: QueuedToast<T>[] = [];
  private subscriptions: Set<() => void> = new Set();
  private maxVisibleToasts: number;
  private wrapUpdate?: (fn: () => void, action: ToastAction) => void;
  /** Rivet: name a server-rendered `<ToastRegion>` uses to find this queue. */
  readonly name: string;
  /** The currently visible toasts. */
  visibleToasts: QueuedToast<T>[] = [];

  constructor(options?: ToastStateProps) {
    this.maxVisibleToasts = options?.maxVisibleToasts ?? Infinity;
    this.wrapUpdate = options?.wrapUpdate;
    this.name = options?.name ?? "default";
  }

  private runWithWrapUpdate(fn: () => void, action: ToastAction): void {
    if (this.wrapUpdate) this.wrapUpdate(fn, action);
    else fn();
  }

  /** Subscribes to updates to the visible toasts. */
  subscribe(fn: () => void): () => void {
    this.subscriptions.add(fn);
    return () => this.subscriptions.delete(fn);
  }

  /** Adds a new toast to the queue. */
  add(content: T, options: ToastOptions = {}): string {
    const toastKey = "_" + Math.random().toString(36).slice(2);
    const toast: QueuedToast<T> = {
      ...options,
      content,
      key: toastKey,
      timer: options.timeout ? new Timer(() => this.close(toastKey), options.timeout) : undefined,
    };
    this.queue.unshift(toast);
    this.updateVisibleToasts("add");
    return toastKey;
  }

  /** Closes a toast. */
  close(key: string): void {
    const index = this.queue.findIndex((t) => t.key === key);
    if (index >= 0) {
      this.queue[index]!.onClose?.();
      this.queue.splice(index, 1);
    }
    this.updateVisibleToasts("remove");
  }

  private updateVisibleToasts(action: ToastAction): void {
    this.visibleToasts = this.queue.slice(0, this.maxVisibleToasts);
    this.runWithWrapUpdate(() => {
      // Rivet: no region connected yet (resumed page) → wake the server-rendered regions.
      if (this.subscriptions.size === 0 && typeof document !== "undefined" && this.visibleToasts.length > 0)
        document.dispatchEvent(new CustomEvent(TOAST_QUEUE_EVENT, { detail: this }));
      for (const fn of [...this.subscriptions]) fn();
    }, action);
  }

  /** Pauses the timers for all visible toasts. */
  pauseAll(): void {
    for (const toast of this.visibleToasts) toast.timer?.pause();
  }

  /** Resumes the timers for all visible toasts. */
  resumeAll(): void {
    for (const toast of this.visibleToasts) toast.timer?.resume();
  }

  clear(): void {
    this.queue = [];
    this.updateVisibleToasts("clear");
  }
}

/** A pausable countdown. */
export class Timer {
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private startTime: number | null = null;
  private remaining: number;
  private callback: () => void;

  constructor(callback: () => void, delay: number) {
    this.remaining = delay;
    this.callback = callback;
  }

  reset(delay: number): void {
    if (this.timerId != null) clearTimeout(this.timerId);
    this.timerId = null;
    this.remaining = delay;
    this.resume();
  }

  pause(): void {
    if (this.timerId == null) return;
    clearTimeout(this.timerId);
    this.timerId = null;
    this.remaining -= Date.now() - this.startTime!;
  }

  resume(): void {
    if (this.remaining <= 0 || this.timerId != null) return;
    this.startTime = Date.now();
    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.remaining = 0;
      this.callback();
    }, this.remaining);
  }
}
