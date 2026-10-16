// Multi-core serving for the node adapter (`start({ workers })`, loaded only when `workers` > 1): the primary forks
// `workers` processes running the same script; each worker runs `start()` with one worker, and the primary hands out
// connections (node:cluster round robin) or, with `reusePort`, each worker binds its own socket and the kernel
// balances (Linux / FreeBSD). The primary loads no build and renders nothing. `revalidate()` reaches every worker:
// the worker that calls it drops its own pages and the primary relays the target to the others (IPC).
import cluster, { type Worker } from "node:cluster";
import type { PrimaryServing, ServerServing } from "./node.ts";

// `server/route-cache.ts`: the local drop (registered at module load) and the hook its `revalidate()` calls after it.
const LOCAL = Symbol.for("rivet.revalidate.local");
const BROADCAST = Symbol.for("rivet.revalidate.broadcast");
type Target = { readonly path?: string; readonly tag?: string };
type Message = { readonly type?: unknown; readonly target?: unknown };
/** A `revalidate()` target from IPC: `{ path?: string, tag?: string }`, at least one. */
const targetOf = (value: unknown): Target | undefined => {
  if (value === null || typeof value !== "object") return undefined;
  const { path, tag } = value as Record<string, unknown>;
  if ((path !== undefined && typeof path !== "string") || (tag !== undefined && typeof tag !== "string") || (path === undefined && tag === undefined))
    return undefined;
  return { path: path as string | undefined, tag: tag as string | undefined };
};
const global = globalThis as unknown as Record<symbol, ((target: Target) => unknown) | undefined>;

/** In a worker: `run()` (one-worker `start`), then IPC: relay `revalidate()`, drain + exit on the primary's close. */
export async function worker(run: () => Promise<ServerServing>): Promise<ServerServing> {
  const serving = await run();
  // The local drop already happened: a closed IPC channel only means the other workers keep theirs.
  global[BROADCAST] = (target) => {
    if (process.connected) process.send?.({ type: "rivet:revalidate", target }, undefined, undefined, () => {});
  };
  const stop = () =>
    void serving.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  process.on("message", (message: Message) => {
    if (message?.type === "rivet:revalidate") {
      const target = targetOf(message.target);
      if (target)
        try {
          global[LOCAL]?.(target);
        } catch {
          // A malformed path: nothing to drop here.
        }
    } else if (message?.type === "rivet:close") stop();
  });
  // The primary went away (crash, kill -9): finish what is in flight, then exit.
  process.once("disconnect", stop);
  return serving;
}

/** In the primary: fork `count` workers, restart crashed ones, relay revalidations; resolves once all listen. */
export function primary(count: number, grace: number, log: (error: unknown) => void): Promise<PrimaryServing> {
  let closing = false;
  // Replacements only once every first worker listens: a worker failing at start rejects `start()` instead.
  let started = false;
  const crashes: number[] = [];
  const live = new Set<Worker>();
  let url = "";
  const fork = (): Promise<void> => {
    const child = cluster.fork();
    live.add(child);
    child.on("message", (message: Message) => {
      if (message?.type !== "rivet:revalidate") return;
      const target = targetOf(message.target);
      if (!target) return;
      for (const other of live) if (other !== child && other.isConnected()) other.send({ type: "rivet:revalidate", target }, undefined, () => {});
    });
    child.once("exit", (code, signal) => {
      live.delete(child);
      if (closing || !started) return;
      // A crashed worker is replaced, unless workers keep crashing (5 in 10 s): then the primary stops forking.
      const now = Date.now();
      crashes.push(now);
      while (crashes[0]! < now - 10_000) crashes.shift();
      if (crashes.length > 5) {
        log(new Error(`rivet: workers keep exiting (last: ${signal ?? code}); not restarting`));
        // Nothing serves any more: exit, so the process manager / orchestrator restarts the whole server.
        if (live.size === 0) process.exit(1);
        return;
      }
      log(new Error(`rivet: worker ${child.process.pid} exited (${signal ?? code}); starting another`));
      void fork().catch(log);
    });
    return new Promise((done, fail) => {
      child.once("listening", (address) => {
        const host =
          address.address === undefined || address.address === null ? "127.0.0.1" : address.addressType === 6 ? `[${address.address}]` : address.address;
        url ||= `http://${host}:${address.port}`;
        done();
      });
      child.once("exit", (code) => fail(new Error(`rivet: worker exited (${code}) before listening`)));
    });
  };
  const stopAll = () => {
    closing = true;
    for (const child of live) child.process.kill("SIGTERM");
  };
  return Promise.all(Array.from({ length: count }, fork)).then(
    () => {
      started = true;
      let closed: Promise<void> | null = null;
      return {
        url,
        workers: count,
        close: () =>
          (closed ??= (async () => {
            closing = true;
            await Promise.all(
              [...live].map(
                (child) =>
                  new Promise<void>((done) => {
                    if (child.isDead()) return done();
                    child.once("exit", () => done());
                    // Drain (the worker's own `grace`), then force.
                    const force = setTimeout(() => child.process.kill("SIGKILL"), grace + 2_000);
                    force.unref();
                    if (child.isConnected()) child.send({ type: "rivet:close" });
                    else child.process.kill("SIGTERM");
                  }),
              ),
            );
          })()),
      };
    },
    (error: unknown) => {
      // A worker failed before listening (bad build, port taken): stop the others, `start()` rejects.
      stopAll();
      throw error;
    },
  );
}

/** `cluster.isPrimary` (true outside a cluster). */
export const isPrimary = (): boolean => cluster.isPrimary;
