// Server-target testing helper (`@rivetjs/runtime/testing/server`). Nothing in the runtime imports it.
import { renderToString as render, type RenderOptions, type ServerValue } from "@rivetjs/runtime/server";

/** `renderToString` that always resolves: sync output, Async children and failures all go through the Promise. */
export async function renderToString(factory: () => ServerValue, options?: RenderOptions): Promise<string> {
  return render(factory, options);
}
