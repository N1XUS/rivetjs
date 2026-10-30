// Explicit payload release keeps streaming stylesheet ordering tests independent of timer speed.
let resolve: (() => void) | undefined;
let pending: Promise<void> = Promise.resolve();
export function hold(): void {
  pending = new Promise<void>((done) => {
    resolve = done;
  });
}
export function gate(): Promise<void> {
  return pending;
}
export function release(): void {
  resolve?.();
  resolve = undefined;
}
