// @rivetjs/bridge-vue/client — hydrate/create a Vue app and retain one shallow reactive full prop snapshot.
import { createApp, createSSRApp, h, shallowReactive, Suspense, nextTick, type App, type Component } from "vue";
import { islandRecovered, type ClientAdapter } from "@rivetjs/bridge/adapter";
import { discardNativeHead, withNativeHead } from "@rivetjs/bridge/head-client";
import type { VueAdapterOptions } from "./options.ts";
import { withSlots } from "./slot.ts";

export type { VueAdapterOptions } from "./options.ts";
export interface VueHandle {
  readonly app: App;
  readonly props: Record<string, unknown>;
}

export function createAdapter(options: VueAdapterOptions = {}) {
  function start(
    hydrate: boolean,
    root: Element,
    component: Component,
    snapshot: Record<string, unknown>,
    slots: Record<string, Node[] | null>,
    ctx: { id: string },
  ): VueHandle | Promise<VueHandle> {
    const props = shallowReactive({ ...snapshot });
    const functions = withSlots(Object.keys(slots), slots);
    let resolveReady: (() => void) | undefined, rejectReady: ((error: unknown) => void) | undefined;
    let resolved = false,
      mounting = false,
      pending = false;
    let failure: { error: unknown } | undefined;
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      try {
        app.unmount();
      } catch {
        /* preserve the original initialization failure */
      }
    };
    const app = (hydrate ? createSSRApp : createApp)({
      render: () =>
        h(
          Suspense,
          {
            onResolve() {
              resolved = true;
              resolveReady?.();
            },
          },
          { default: () => h(component, { ...props }, functions) },
        ),
    });
    options.setup?.(app);
    app.config.idPrefix = ctx.id;
    app.config.throwUnhandledErrorInProduction = true;
    const report = app.config.errorHandler;
    app.config.errorHandler = (error, instance, info) => {
      try {
        report?.(error, instance, info);
      } catch (reported) {
        error = reported;
      }
      if (mounting || pending) {
        failure ??= { error };
        if (!mounting) rejectReady?.(error);
        return;
      }
      throw error;
    };
    // Vue exposes hydration diagnostics through warnHandler in development. Production repairs mismatches internally
    // without a public recovery callback; do not patch global console methods to infer recoveries.
    const warn = app.config.warnHandler;
    let recovered = false;
    app.config.warnHandler = (message, instance, trace) => {
      if (!recovered && /Hydration[\s\S]*mismatch/i.test(message)) {
        recovered = true;
        islandRecovered("vue", ctx.id, new Error(message), root);
      }
      warn?.(message, instance, trace);
    };
    const mount = (): VueHandle | Promise<VueHandle> => {
      // hydrateSuspense does not emit onPending. Prepare readiness before mount and use public onResolve to keep
      // ordinary synchronous trees synchronous, while actual async setup waits for its component handlers/effects.
      const ready = new Promise<void>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      mounting = pending = true;
      try {
        app.mount(root);
      } catch (error) {
        pending = false;
        dispose();
        throw error;
      } finally {
        mounting = false;
      }
      if (failure) {
        pending = false;
        dispose();
        throw failure.error;
      }
      const handle = { app, props };
      if (resolved) {
        pending = false;
        resolveReady = rejectReady = undefined;
        return handle;
      }
      return ready
        .then(async () => {
          await nextTick();
          if (failure) throw failure.error;
          pending = false;
          resolveReady = rejectReady = undefined;
          return handle;
        })
        .catch((error: unknown) => {
          pending = false;
          dispose();
          throw error;
        });
    };
    try {
      const result = hydrate ? withNativeHead("vue", ctx.id, mount) : mount();
      // The native-head cursor guard runs after mount returns (or its async readiness resolves). It must receive the
      // same cleanup as an app initialization failure, including failures outside the callback's own try/catch.
      return result instanceof Promise
        ? result.catch((error: unknown) => {
            dispose();
            throw error;
          })
        : result;
    } catch (error) {
      dispose();
      throw error;
    }
  }
  return {
    hydrate(root, component, props, slots, ctx) {
      return start(true, root, component, props, slots, ctx);
    },
    mount(root, component, props, slots, ctx) {
      discardNativeHead("vue", ctx.id);
      return start(false, root, component, props, slots, ctx);
    },
    update(handle, snapshot) {
      for (const key of Object.keys(handle.props)) if (!Object.prototype.hasOwnProperty.call(snapshot, key)) delete handle.props[key];
      Object.assign(handle.props, snapshot);
    },
    unmount(handle) {
      handle.app.unmount();
    },
  } satisfies ClientAdapter<Component, VueHandle>;
}

export const adapter = createAdapter();
