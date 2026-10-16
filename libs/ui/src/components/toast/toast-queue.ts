// Ported from HeroUI v3.2.6 packages/react/src/components/toast/toast-queue.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `react-aria-components/Toast` `UNSTABLE_ToastQueue` → `@rivetjs/cdk/state/toast` `ToastQueue` (react-stately port: same
//   `visibleToasts` / `subscribe` / `add` / `close` / `clear` / `pauseAll` / `resumeAll`, private `updateVisibleToasts`); its
//   `Timer` already guards against a second timeout (Rivet deviation), the `guardTimer` wrap stays for parity.
// - `ReactNode` → Rivet `Content`; `ButtonProps` → `@rivetjs/ui/button` props.
// - Queue `name` (Rivet, `ToastQueueOptions.name`): a server-rendered `<Toast.Provider>` finds its queue on a resumed page by name
//   (cdk `ToastRegion` wake event). `toastQueue` (the `toast()` queue) is named `"toast"`, a `new ToastQueue()` defaults to the cdk
//   default `"default"`: several queues on one page need distinct names. Queues must live at module level (a component-local queue
//   is another instance in the browser).
// - Exit-aware queues register themselves (`exitAwareQueueOf`): the provider finds the queue a cdk region mirrors (the region's
//   `visibleToasts` is the queue's array) without capturing the instance in a resumable closure.
import type { ToastOptions as StatelyToastOptions } from "@rivetjs/cdk/state/toast";
import { ToastQueue as ToastQueuePrimitive } from "@rivetjs/cdk/state/toast";
import type { Content } from "@rivetjs/runtime/jsx-runtime";

import type { ButtonRootProps as ButtonProps } from "../button/index.ts";

import { DEFAULT_EXIT_DURATION, DEFAULT_RAC_MAX_VISIBLE_TOAST, DEFAULT_TOAST_TIMEOUT } from "./constants.ts";

/* ------------------------------------------------------------------------------------------------
 * Toast Queue Options
 * --------------------------------------------------------------------------------------------- */
export interface ToastQueueOptions {
  /**
   * How long a closing toast stays mounted for its exit animation, in
   * milliseconds. Set to 0 to remove toasts immediately.
   * @default 300
   */
  exitDuration?: number;
  /**
   * The maximum number of toasts to display at a time (visual only).
   * @default 3
   */
  maxVisibleToasts?: number;
  // Wraps state updates (e.g. document.startViewTransition()).
  wrapUpdate?: (fn: () => void) => void;
  /**
   * Rivet: the name a server-rendered `<Toast.Provider queue>` finds this queue by on a resumed page. Several queues on one
   * page need distinct names.
   * @default "default"
   */
  name?: string;
}

/* ------------------------------------------------------------------------------------------------
 * Toast Queue
 * --------------------------------------------------------------------------------------------- */
// The underlying react-stately queue passed to ToastRegion (not the HeroUI wrapper).
export type StatelyToastQueue<T extends object = ToastContentValue> = ToastQueuePrimitive<T>;

// Runtime shape of react-stately's unexported Timer. Neither resume() nor reset() guards against an already-running timeout, which guardTimer() compensates for.
type StatelyTimer = {
  pause(): void;
  reset(delay: number): void;
  resume(): void;
  timerId?: ReturnType<typeof setTimeout> | null;
};

// Monotonic clock: Date.now() can jump on wall-clock adjustments.
const now: () => number = typeof performance !== "undefined" && typeof performance.now === "function" ? () => performance.now() : () => Date.now();

// Already-wrapped timers; a WeakSet avoids mutating possibly frozen objects.
const guardedTimers = new WeakSet<StatelyTimer>();

// Replica of react-stately's Timer for timers attached by updateToast().
// The shape must match: React Aria calls reset() on timer identity change and the queue's pauseAll/resumeAll duck-type toast.timer.
class ManagedToastTimer {
  timerId: ReturnType<typeof setTimeout> | null | undefined;
  private startTime: number | null = null;
  private remaining: number;
  private readonly callback: () => void;

  constructor(callback: () => void, delay: number) {
    this.remaining = delay;
    this.callback = callback;
  }

  reset(delay: number): void {
    this.remaining = delay;
    this.resume();
  }

  pause(): void {
    if (this.timerId == null) {
      return;
    }

    clearTimeout(this.timerId);
    this.timerId = null;
    this.remaining -= now() - (this.startTime ?? now());
  }

  resume(): void {
    if (this.remaining <= 0) {
      return;
    }

    this.startTime = now();
    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.remaining = 0;
      this.callback();
    }, this.remaining);
  }
}

// Rivet: live exit-aware queues (module-level queues in an app; see `exitAwareQueueOf`).
const exitAwareQueues = new Set<ExitAwareToastQueue<object>>();

// A react-stately ToastQueue that keeps closing toasts mounted for exitDuration (so CSS exit animations can play), supports in-place updates, and centralizes timer pausing. Every close path funnels through close().
class ExitAwareToastQueue<T extends object> extends ToastQueuePrimitive<T> {
  private static didWarnMissingNotify = false;

  private readonly exitDuration: number;
  private exitTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private exitingSnapshot: ReadonlySet<string> = new Set();
  private exitSubscriptions = new Set<() => void>();
  private suspensions = new Set<string>();
  // True while clear() drains the queue; close() then defers snapshot rebuilds and subscriber notifications so they happen once per batch.
  private isBatchingExits = false;

  constructor(options: { maxVisibleToasts?: number; wrapUpdate?: (fn: () => void) => void; name?: string }, exitDuration: number = DEFAULT_EXIT_DURATION) {
    super(options);
    this.exitDuration = exitDuration;
    exitAwareQueues.add(this as unknown as ExitAwareToastQueue<object>);
  }

  // Sources form a set, not a refcount: timers pause once when the set becomes non-empty and resume once when it empties.
  suspendTimers(source: string): void {
    const wasEmpty = this.suspensions.size === 0;

    this.suspensions.add(source);

    if (wasEmpty) {
      super.pauseAll();
    }
  }

  resumeTimers(source: string): void {
    this.suspensions.delete(source);

    // Pass through on an empty set so userland resumeAll() keeps its "kick the timers" semantics (safe via the per-timer running guard).
    if (this.suspensions.size === 0) {
      super.resumeAll();
    }
  }

  override pauseAll(): void {
    this.suspendTimers("external");
  }

  override resumeAll(): void {
    this.resumeTimers("external");
  }

  // React Aria starts timers itself (useToast calls timer.reset on mount).
  // The wrap parks a timer while suspended and stops a resume-while-running from scheduling a second, orphaned timeout.
  private guardTimer(timer: StatelyTimer): void {
    if (guardedTimers.has(timer)) {
      return;
    }

    guardedTimers.add(timer);

    const originalResume = timer.resume.bind(timer);
    const originalReset = timer.reset.bind(timer);

    timer.resume = () => {
      if (this.suspensions.size > 0 || timer.timerId != null) {
        return;
      }

      originalResume();
    };

    // reset() ends with resume(), but it does not clear a running timeout first,
    // so the guard above would refuse to start the new delay and the old one would
    // stick. Pausing makes reset mean "restart on this delay" in every case.
    timer.reset = (delay: number) => {
      timer.pause();
      originalReset(delay);
    };
  }

  override add(content: T, options?: StatelyToastOptions): string {
    const key = super.add(content, options);
    const timer = this.visibleToasts.find((t) => t.key === key)?.timer as StatelyTimer | undefined;

    if (timer) {
      this.guardTimer(timer);
    }

    return key;
  }

  // Updates a toast in place: same key, same DOM node, same stack position.
  // options.timeout replaces the countdown (0 = persistent); omitting it keeps the current countdown. Returns false when the key is unknown or the toast is animating out.
  updateToast(key: string, content: T, options?: { onClose?: () => void; timeout?: number }): boolean {
    if (this.exitTimers.has(key)) {
      return false;
    }

    const queuedToast = this.visibleToasts.find((t) => t.key === key);

    if (!queuedToast) {
      return false;
    }

    queuedToast.content = content;

    if (options && "onClose" in options) {
      queuedToast.onClose = options.onClose;
    }

    if (options?.timeout !== undefined) {
      // A fresh timer identity makes React Aria's [timer, timeout] effect restart the countdown.
      (queuedToast.timer as StatelyTimer | undefined)?.pause();
      queuedToast.timeout = options.timeout;

      if (options.timeout > 0) {
        const timer = new ManagedToastTimer(() => this.close(key), options.timeout);

        this.guardTimer(timer);
        // Stately's Timer type is unexported and nominally typed.
        queuedToast.timer = timer as unknown as typeof queuedToast.timer;
      } else {
        queuedToast.timer = undefined;
      }
    }

    // Rivet: the region mirrors `visibleToasts` into a signal on every queue notification, so a mutation alone would not
    // re-render. updateVisibleToasts is TypeScript-private but a plain method at runtime; stately has no "update" action.
    const notify = (this as unknown as { updateVisibleToasts?: unknown }).updateVisibleToasts;

    if (typeof notify === "function") {
      (notify as (action: "add") => void).call(this, "add");
    } else {
      // Unstable API drifted. Best effort: a fresh exiting snapshot still re-renders the provider, which re-renders the mutated content.
      if (!ExitAwareToastQueue.didWarnMissingNotify) {
        ExitAwareToastQueue.didWarnMissingNotify = true;
        // eslint-disable-next-line no-console
        console.warn("[HeroUI Toast] react-stately no longer exposes updateVisibleToasts; " + "toast updates fall back to a partial re-render.");
      }

      this.exitingSnapshot = new Set(this.exitTimers.keys());
      this.notifyExitSubscribers();
    }

    return true;
  }

  // Stable snapshot of the keys currently in their exit animation.
  getExitingKeys = (): ReadonlySet<string> => this.exitingSnapshot;

  // Subscribe to exiting-key changes (for useSyncExternalStore).
  subscribeExiting = (fn: () => void): (() => void) => {
    this.exitSubscriptions.add(fn);

    return () => {
      this.exitSubscriptions.delete(fn);
    };
  };

  private notifyExitSubscribers(): void {
    for (const fn of this.exitSubscriptions) {
      fn();
    }
  }

  override close(key: string): void {
    const queuedToast = this.visibleToasts.find((t) => t.key === key);

    // Already exiting or already removed.
    if (this.exitTimers.has(key) || !queuedToast) {
      return;
    }

    const canAnimate = this.exitDuration > 0 && typeof window !== "undefined" && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    if (!canAnimate) {
      super.close(key);

      return;
    }

    // Fire onClose at dismissal, not at removal: super.close() runs after the exit animation and would delay the callback by exitDuration.
    // Nulling it on the queued toast keeps super.close() from re-firing it.
    const onClose = queuedToast.onClose;

    queuedToast.onClose = undefined;

    this.exitTimers.set(
      key,
      setTimeout(() => {
        // Rebuild the snapshot before super.close notifies React so no render sees the toast as exiting after removal.
        this.exitTimers.delete(key);
        this.exitingSnapshot = new Set(this.exitTimers.keys());
        super.close(key);

        if (!this.isBatchingExits) {
          this.notifyExitSubscribers();
        }
      }, this.exitDuration),
    );

    if (!this.isBatchingExits) {
      this.exitingSnapshot = new Set(this.exitTimers.keys());
      this.notifyExitSubscribers();
    }

    onClose?.();
  }

  override clear(): void {
    // Route through close() so exits animate and each onClose fires (stately's clear() does neither). Batching defers the snapshot rebuild and subscriber notification to a single flush at the end.
    this.isBatchingExits = true;

    try {
      for (const t of [...this.visibleToasts]) {
        this.close(t.key);
      }
    } finally {
      this.isBatchingExits = false;
      this.exitingSnapshot = new Set(this.exitTimers.keys());
      this.notifyExitSubscribers();
    }
  }

  // Releases pending exit timeouts, subscriptions, suspension state, and running timers, for HMR and test teardown. The queue stays usable.
  destroy(): void {
    for (const timeoutId of this.exitTimers.values()) {
      clearTimeout(timeoutId);
    }

    this.exitTimers.clear();
    this.exitingSnapshot = new Set();
    this.exitSubscriptions.clear();
    this.suspensions.clear();

    for (const t of this.visibleToasts) {
      (t.timer as StatelyTimer | undefined)?.pause();
    }
  }
}

export type { ExitAwareToastQueue };
export const isExitAwareToastQueue = <T extends object>(queue: ToastQueuePrimitive<T>): queue is ExitAwareToastQueue<T> => queue instanceof ExitAwareToastQueue;

/**
 * Rivet: the exit-aware queue whose current `visibleToasts` array is `visibleToasts` (a cdk region mirrors the queue's array
 * into its state), or `null` for a foreign react-stately queue (instant removal, as upstream).
 * @internal
 */
export const exitAwareQueueOf = <T extends object>(visibleToasts: readonly unknown[]): ExitAwareToastQueue<T> | null => {
  for (const queue of exitAwareQueues) {
    if (queue.visibleToasts === visibleToasts) {
      return queue as unknown as ExitAwareToastQueue<T>;
    }
  }

  return null;
};

// Manages toast state outside React so toasts can be triggered from anywhere.
export class ToastQueue<T extends object = ToastContentValue> {
  private queue: ExitAwareToastQueue<T>;
  readonly maxVisibleToasts?: number;

  constructor(options?: ToastQueueOptions) {
    this.maxVisibleToasts = options?.maxVisibleToasts;

    this.queue = new ExitAwareToastQueue<T>(
      {
        // The stately queue keeps every toast; maxVisibleToasts is applied visually by the provider.
        maxVisibleToasts: DEFAULT_RAC_MAX_VISIBLE_TOAST,
        wrapUpdate: options?.wrapUpdate,
        name: options?.name,
      },
      options?.exitDuration ?? DEFAULT_EXIT_DURATION,
    );
  }

  // Adds a toast and returns its key; explicit timeout 0 keeps it open.
  add(content: T, options?: StatelyToastOptions): string {
    return this.queue.add(content, {
      ...options,
      timeout: options?.timeout ?? DEFAULT_TOAST_TIMEOUT,
    });
  }

  close(key: string): void {
    this.queue.close(key);
  }

  // Updates a toast in place, preserving its stack position. timeout restarts the countdown (0 keeps it open); omit it to keep the current countdown. Returns false if the toast no longer exists.
  update(key: string, content: T, options?: { onClose?: () => void; timeout?: number }): boolean {
    return this.queue.updateToast(key, content, options);
  }

  pauseAll(): void {
    this.queue.pauseAll();
  }

  resumeAll(): void {
    this.queue.resumeAll();
  }

  // Closes all toasts; each animates out and fires its onClose.
  clear(): void {
    this.queue.clear();
  }

  subscribe(fn: () => void): () => void {
    return this.queue.subscribe(fn);
  }

  // The currently rendered toasts, newest first.
  get visibleToasts() {
    return this.queue.visibleToasts;
  }

  // The underlying react-stately queue consumed by ToastRegion.
  getQueue(): ToastQueuePrimitive<T> {
    return this.queue;
  }

  // Releases pending timeouts, subscriptions, and running timers, for HMR and test teardown.
  destroy(): void {
    this.queue.destroy();
  }
}

/* ------------------------------------------------------------------------------------------------
 * Toast Queue Instance
 * --------------------------------------------------------------------------------------------- */

export interface ToastContentValue {
  // null hides the indicator.
  indicator?: Content | undefined;
  title?: Content | undefined;
  description?: Content | undefined;
  variant?: "default" | "accent" | "success" | "warning" | "danger" | undefined;
  actionProps?: ButtonProps | undefined;
  // Shows a spinner in place of the indicator.
  isLoading?: boolean | undefined;
}

export interface ToastOptions {
  description?: Content;
  // null hides the indicator.
  indicator?: Content;
  variant?: ToastContentValue["variant"];
  actionProps?: ButtonProps;
  // Shows a spinner in place of the indicator.
  isLoading?: boolean;
  /**
   * Auto-dismiss timeout in milliseconds; 0 keeps the toast open.
   * @default 4000
   */
  timeout?: number;
  // Called when the toast is dismissed; the exit animation may still be playing.
  onClose?: () => void;
}

export interface ToastPromiseOptions<T = unknown> {
  loading: Content;
  success: ((data: T) => Content) | Content;
  error: ((error: Error) => Content) | Content;
}

function createToastFunction(queue: ToastQueue<ToastContentValue>) {
  const createContent = (message: Content, options?: ToastOptions): ToastContentValue => ({
    title: message,
    description: options?.description,
    indicator: options?.indicator,
    variant: options?.variant || "default",
    actionProps: options?.actionProps,
    isLoading: options?.isLoading,
  });

  const createAddOptions = (options?: ToastOptions) => ({
    timeout: options?.timeout ?? DEFAULT_TOAST_TIMEOUT,
    onClose: options?.onClose,
  });

  // update() distinguishes an absent key from an explicit undefined: it keeps the
  // current countdown and the current onClose for anything the caller left out. So
  // only forward keys that were actually passed, rather than resolving defaults the
  // way createAddOptions does.
  const createUpdateOptions = (options?: ToastOptions) => ({
    ...(options && "timeout" in options ? { timeout: options.timeout } : null),
    ...(options && "onClose" in options ? { onClose: options.onClose } : null),
  });

  const toastFn = (message: Content, options?: ToastOptions): string => {
    return queue.add(createContent(message, options), createAddOptions(options));
  };

  toastFn.success = (message: Content, options?: Omit<ToastOptions, "variant">): string => {
    return toastFn(message, { ...options, variant: "success" });
  };

  toastFn.danger = (message: Content, options?: Omit<ToastOptions, "variant">): string => {
    return toastFn(message, { ...options, variant: "danger" });
  };

  // Maps to the accent variant.
  toastFn.info = (message: Content, options?: Omit<ToastOptions, "variant">): string => {
    return toastFn(message, { ...options, variant: "accent" });
  };

  toastFn.warning = (message: Content, options?: Omit<ToastOptions, "variant">): string => {
    return toastFn(message, { ...options, variant: "warning" });
  };

  // Updates a toast in place (same key, same stack position); falls back to a new toast when the id no longer exists.
  // Omitting timeout keeps the existing countdown; omitting onClose keeps the existing handler.
  toastFn.update = (id: string, message: Content, options?: ToastOptions): string => {
    const content = createContent(message, options);

    if (queue.update(id, content, createUpdateOptions(options))) {
      return id;
    }

    // A brand new toast has nothing to inherit, so it resolves the defaults instead.
    return queue.add(content, createAddOptions(options));
  };

  // Shows a loading toast that settles in place when the promise resolves or rejects; the auto-dismiss countdown starts at that point.
  toastFn.promise = <T>(promise: Promise<T> | (() => Promise<T>), options: ToastPromiseOptions<T>): string => {
    const promiseFn = typeof promise === "function" ? promise() : promise;
    const loadingId = queue.add(createContent(options.loading, { isLoading: true }), { timeout: 0 });

    promiseFn
      .then((data) => {
        const message = typeof options.success === "function" ? (options.success as (data: T) => Content)(data) : options.success;

        // The loading toast was added persistent, so settling has to start the
        // countdown explicitly now that an omitted timeout is inherited.
        return toastFn.update(loadingId, message, {
          isLoading: false,
          timeout: DEFAULT_TOAST_TIMEOUT,
          variant: "success",
        });
      })
      .catch((error: Error) => {
        const message = typeof options.error === "function" ? (options.error as (error: Error) => Content)(error) : options.error;

        return toastFn.update(loadingId, message, {
          isLoading: false,
          timeout: DEFAULT_TOAST_TIMEOUT,
          variant: "danger",
        });
      });

    return loadingId;
  };

  toastFn.getQueue = () => queue.getQueue();
  toastFn.close = (key: string) => queue.close(key);
  toastFn.pauseAll = () => queue.pauseAll();
  toastFn.resumeAll = () => queue.resumeAll();
  toastFn.clear = () => queue.clear();

  return toastFn;
}

// Rivet: named, so a server-rendered `<Toast.Provider>` without `queue` finds it on a resumed page.
const toastQueue = new ToastQueue<ToastContentValue>({ name: "toast" });

// Global helper bound to the default queue used by <Toast.Provider>.
export const toast = createToastFunction(toastQueue);
export { toastQueue };
