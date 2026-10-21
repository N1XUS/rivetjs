// Types of deferred loaders (`load(fn, { defer: true })`), checked by `tsc -p libs/router` (typecheck gate): the data is a
// `Deferred<T>` (not unwrapped like a promise), its value is checked for serializability, plain loaders are unchanged, and
// boundaries (`Async` / `resource`) infer the value type from it.
import { expectTypeOf, test } from "vitest";
import type { Deferred, DataOf, LayoutProps, NotSerializable, PageProps } from "../index.ts";
import { load } from "../shared/server-exports.ts";
import { Async, resource } from "@rivetjs/runtime/server";

const deferredLoader = load(async () => ({ title: "t", at: new Date(0) }), { defer: true });
const syncDeferred = load(() => ({ n: 1 }), { defer: true });
const plain = load(async () => ({ title: "t" }));
const plainOff = load(() => 1, { defer: false });
const bad = load(async () => ({ run: (): number => 1 }), { defer: true });

test("deferred loader types (checked by tsc)", () => {
  expectTypeOf<DataOf<typeof deferredLoader>>().toEqualTypeOf<Deferred<{ title: string; at: Date }>>();
  expectTypeOf<DataOf<typeof syncDeferred>>().toEqualTypeOf<Deferred<{ n: number }>>();
  expectTypeOf<DataOf<typeof plain>>().toEqualTypeOf<{ title: string }>();
  expectTypeOf<DataOf<typeof plainOff>>().toEqualTypeOf<number>();
  expectTypeOf<DataOf<typeof bad>>().toEqualTypeOf<NotSerializable<Deferred<{ run: () => number }>>>();
  expectTypeOf<PageProps<typeof deferredLoader>["data"]>().toEqualTypeOf<Deferred<{ title: string; at: Date }>>();
  expectTypeOf<LayoutProps<typeof syncDeferred>["data"]>().toEqualTypeOf<() => Deferred<{ n: number }>>();
  // A boundary's `load` / a resource fetcher returning the handle: the child / resource gets the value (never called here).
  const handle = {} as Deferred<{ n: number }>;
  const boundaries = () => [
    Async({ load: () => handle, children: (value) => (expectTypeOf(value).toEqualTypeOf<{ n: number }>(), null) }),
    expectTypeOf(resource(() => handle)()).toEqualTypeOf<{ n: number } | undefined>(),
  ];
  expectTypeOf(boundaries).toBeFunction();
  expectTypeOf<Awaited<Deferred<{ n: number }>>>().toEqualTypeOf<{ n: number }>();
  // @ts-expect-error the options object only takes `defer`
  load(() => 1, { lazy: true });
});
