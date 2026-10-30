// Solid's synchronous renderer emits `"$$f"` for unresolved Suspense. Re-render only those trees asynchronously.
import { catchError, createComponent, type Component, type JSX } from "solid-js";
import { generateHydrationScript, renderToString, renderToStringAsync, ssr } from "solid-js/web";
import type { ServerAdapter } from "@rivetjs/bridge/adapter";
import { slotProp } from "./slot.ts";

export const adapter: ServerAdapter<Component<any>> = {
  name: "solid",
  head(ctx) {
    // Bridge core calls head once per page. No process-global guard: concurrent pages each need the script.
    // Solid 1.9 web/types/index selects client.d.ts, whose stub omits server options.
    return (generateHydrationScript as (options: { nonce?: string; eventNames: string[] }) => string)({ nonce: ctx.nonce, eventNames: [] });
  },
  render(component, props, slots, ctx) {
    let failure: unknown;
    let failed = false;
    const fail = (error: unknown) => {
      failed = true;
      failure = error;
    };
    const tree = () =>
      catchError(() => {
        const values = { ...props };
        for (const [name, mark] of Object.entries(slots)) values[slotProp(name)] = ssr(mark.html) as unknown as JSX.Element;
        return createComponent(component, values);
      }, fail);
    const options = { renderId: ctx.id, nonce: ctx.nonce, onError: fail };
    const html = renderToString(tree, options);
    if (failed) throw failure;
    // Solid 1.9 serializes a pending Suspense boundary as this sentinel. Pinned by the SSR regression test.
    return html.includes('="$$f"')
      ? renderToStringAsync(tree, options).then((resolved) => {
          // Solid serializes rejected resources instead of rejecting its render promise.
          if (failed) throw failure;
          return resolved;
        })
      : html;
  },
};
