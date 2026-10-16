// Suspense / transition fixtures (DOM and server targets).
import { signal, type Signal } from "@rivetjs/reactivity";
import { Async, ErrorBoundary, Suspense } from "@rivetjs/runtime/dom";

/** A deferred promise per key, resolved by the test. */
export interface Gate<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}
export function gate<T>(): Gate<T> {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((a, b) => ((resolve = a), (reject = b)));
  return { promise, resolve, reject };
}
export const log: string[] = [];

export function Pair(props: { a: Promise<string>; b: Promise<string> }) {
  return (
    <main>
      <Suspense fallback={() => <p class="wait">loading</p>}>
        {() => (
          <>
            <Async load={() => props.a} fallback={() => <i>a…</i>}>
              {(value: string) => <b class="a">{value}</b>}
            </Async>
            <Async load={() => props.b}>{(value: string) => <b class="b">{value}</b>}</Async>
          </>
        )}
      </Suspense>
    </main>
  );
}

/** `load` reads `id` (reload in place); `pending` shows a transition's state. */
export function Reload(props: { id: Signal<number>; loads: Record<number, Promise<string>>; pending?: Signal<boolean>; suspense?: boolean }) {
  const count = signal(0);
  const part = () => (
    <Async load={() => props.loads[props.id()]!} fallback={() => <i class="fallback">…</i>}>
      {(value: string) => (
        <span class="value">
          {value}
          <button onClick={() => count.update((n) => n + 1)}>{count()}</button>
        </span>
      )}
    </Async>
  );
  return (
    <section>
      <em class="pending">{props.pending?.() ? "yes" : "no"}</em>
      {props.suspense ? <Suspense fallback={() => <p class="wait">loading</p>}>{part}</Suspense> : part()}
    </section>
  );
}

/** Two in-place reloads under one transition. */
export function Two(props: { id: Signal<number>; a: Record<number, Promise<string>>; b: Record<number, Promise<string>> }) {
  return (
    <div>
      <Async load={() => props.a[props.id()]!} fallback={() => <i>a…</i>}>
        {(value: string) => <b class="a">{value}</b>}
      </Async>
      <Async load={() => props.b[props.id()]!} fallback={() => <i>b…</i>}>
        {(value: string) => <b class="b">{value}</b>}
      </Async>
    </div>
  );
}

export function Failing(props: { a: Promise<string>; b: Promise<string>; inside: boolean }) {
  const body = () => (
    <>
      <Async load={() => props.a}>{(value: string) => <b class="a">{value}</b>}</Async>
      <Async load={() => props.b}>{(value: string) => <b class="b">{value}</b>}</Async>
    </>
  );
  const caught = (error: unknown) => <p class="caught">{String((error as Error).message)}</p>;
  return props.inside ? (
    <Suspense fallback={() => <p class="wait">loading</p>}>
      {() => (
        <>
          <ErrorBoundary fallback={caught}>{() => <Async load={() => props.a}>{(value: string) => <b class="a">{value}</b>}</Async>}</ErrorBoundary>
          <Async load={() => props.b}>{(value: string) => <b class="b">{value}</b>}</Async>
        </>
      )}
    </Suspense>
  ) : (
    <ErrorBoundary fallback={caught}>{() => <Suspense fallback={() => <p class="wait">loading</p>}>{body}</Suspense>}</ErrorBoundary>
  );
}

export function Nested(props: { outer: Promise<string>; inner: Promise<string> }) {
  return (
    <Suspense fallback={() => <p class="outer-wait">outer</p>}>
      {() => (
        <div>
          <Async load={() => props.outer}>{(value: string) => <b class="outer">{value}</b>}</Async>
          <Suspense fallback={() => <p class="inner-wait">inner</p>}>
            {() => <Async load={() => props.inner}>{(value: string) => <b class="inner">{value}</b>}</Async>}
          </Suspense>
        </div>
      )}
    </Suspense>
  );
}

export function Sync() {
  return (
    <Suspense fallback={() => <p class="wait">loading</p>}>
      {() => <Async load={() => "now"}>{(value: string) => <b>{value}</b>}</Async>}
    </Suspense>
  );
}
