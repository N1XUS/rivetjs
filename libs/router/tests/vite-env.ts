// Vite sets process.env.NODE_ENV the first time it resolves a config in a process (dev server:
// "development", build: "production") and keeps it for the rest of the process. A test file that
// runs both would otherwise build "production" output with the dev runtime (or serve dev in
// production mode), depending on test order. Each Vite run gets its own NODE_ENV, then the previous
// value comes back.

/** Set NODE_ENV; the returned function restores the previous value. */
export function nodeEnv(env: "development" | "production"): () => void {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  return () => {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  };
}

/** Run `fn` (a Vite build) under `env`. */
export async function withNodeEnv<T>(env: "development" | "production", fn: () => Promise<T>): Promise<T> {
  const restore = nodeEnv(env);
  try {
    return await fn();
  } finally {
    restore();
  }
}

/** Server HTML without the derived resume boundary markup (`<!--bN-->` / `<!--/b-->` comments, `data-b="N"`): asserts on
 *  the page's own markup stay independent of which components are boundaries. Text / region markers stay. */
export const bare = (html: string): string => html.replace(/<!--\/?b\d*-->/g, "").replace(/ data-b="\d+"/g, "");
