// resource() fixtures (DOM and server targets): run by ../resource.test.ts through the register hook.
import type { Signal } from "@rivetjs/reactivity";
import { ErrorBoundary, Suspense, resource } from "@rivetjs/runtime/dom";
import type { Resource, ResourceInfo } from "@rivetjs/runtime/dom";

/** A deferred promise, settled by the test. */
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
/** A fake API: each call is logged with its info; `answer` decides the result (a gate per call by default). */
export class Api {
  calls: { key: unknown; info: ResourceInfo<string> }[] = [];
  gates: Gate<string>[] = [];
  answer: ((key: unknown, info: ResourceInfo<string>) => string | Promise<string>) | null = null;
  load = (key: unknown, info: ResourceInfo<string>): string | Promise<string> => {
    this.calls.push({ key, info });
    if (this.answer) return this.answer(key, info);
    const g = gate<string>();
    this.gates.push(g);
    return g.promise;
  };
}

/** Shows the resource's state, loading flag and value; `ref` hands the resource to the test. */
export function Profile(props: { id: Signal<number | null>; api: Api; ref?: (r: Resource<string>) => void }) {
  const user = resource(
    () => props.id(),
    (id, info) => props.api.load(id, info),
  );
  props.ref?.(user);
  return (
    <p class="profile">
      <b>{user() ?? "-"}</b>
      <i>{user.state()}</i>
      <u>{user.loading() ? "loading" : "idle"}</u>
    </p>
  );
}

/** A Profile inside a Suspense (fallback `wait`). */
export function Waiting(props: { id: Signal<number | null>; api: Api; ref?: (r: Resource<string>) => void }) {
  return (
    <main>
      <Suspense fallback={() => <p class="wait">wait</p>}>{() => <Profile id={props.id} api={props.api} ref={props.ref} />}</Suspense>
    </main>
  );
}

/** Two resources in one Suspense; the second depends on the first (a dependent query). */
export function Chain(props: { api: Api; other: Api }) {
  return (
    <Suspense fallback={() => <p class="wait">wait</p>}>
      {() => {
        const first = resource((_: true, info) => props.api.load("first", info));
        const second = resource(
          () => first() && first() + "!",
          (key, info) => props.other.load(key, info),
        );
        return (
          <p>
            {first()}/{second()}
          </p>
        );
      }}
    </Suspense>
  );
}

/** Two sibling components in one Suspense, each with its own resource. */
export function Siblings(props: { a: Api; b: Api }) {
  const id1 = (() => 1) as unknown as Signal<number | null>;
  const id2 = (() => 2) as unknown as Signal<number | null>;
  return (
    <Suspense fallback={() => <p class="wait">wait</p>}>
      {() => (
        <>
          <Profile id={id1} api={props.a} />
          <Profile id={id2} api={props.b} />
        </>
      )}
    </Suspense>
  );
}

/** A failing load inside an ErrorBoundary. */
export function Failing(props: { api: Api }) {
  return (
    <ErrorBoundary fallback={(error) => <p class="caught">{(error as Error).message}</p>}>
      {() => (
        <Suspense fallback={() => <p class="wait">wait</p>}>
          {() => {
            const user = resource((_: true, info) => props.api.load("x", info));
            return <b>{user()}</b>;
          }}
        </Suspense>
      )}
    </ErrorBoundary>
  );
}

/** A read outside any Suspense, and an `ssr: false` resource. */
export function Unwaited(props: { api: Api; ssr?: boolean }) {
  const user = resource((_: true, info) => props.api.load("u", info), { ssr: props.ssr });
  return (
    <p>
      <b>{user() ?? "-"}</b>
      <i>{user.state()}</i>
    </p>
  );
}
