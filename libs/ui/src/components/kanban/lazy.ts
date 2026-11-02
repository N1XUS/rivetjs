// Rivet addition: the kanban chunk loaders (keyboard moves, selection). One shared in-flight / settled promise per chunk;
// a rejected load (failed chunk fetch) is forgotten, so the next event retries instead of reusing the rejection.

export interface RetryableLoad<T> {
  (): Promise<T>;
  /** A load started and has not failed (in flight or done). */
  pending(): boolean;
}

export function retryableLoad<T>(load: () => Promise<T>): RetryableLoad<T> {
  let promise: Promise<T> | undefined;
  const get = (() =>
    (promise ??= load().catch((error: unknown) => {
      promise = undefined;
      throw error;
    }))) as RetryableLoad<T>;
  get.pending = () => promise !== undefined;
  return get;
}
