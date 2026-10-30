import { render } from "svelte/server";
import type { Component } from "svelte";
import type { IslandRender, ServerAdapter } from "@rivetjs/bridge/adapter";
import { nativeHead } from "@rivetjs/bridge/head";
import { withSlots } from "./holes.ts";

type Output = { body: string; head: string };
function finish(output: Output, id: string, nonce?: string): string | IslandRender {
  if (!output.head) return output.body;
  const { head, rest } = nativeHead("svelte", id, output.head, nonce);
  return head ? { html: rest + output.body, head } : rest + output.body;
}

export const adapter: ServerAdapter<Component<Record<string, unknown>>> = {
  name: "svelte",
  render(component, props, slots, ctx) {
    const output = render(component, { props: withSlots(props, slots), idPrefix: ctx.id, ...(ctx.nonce ? { csp: { nonce: ctx.nonce } } : {}) });
    try {
      // Svelte 5.57's RenderResult is always thenable; property access preserves native sync SSR.
      return finish(output, ctx.id, ctx.nonce);
    } catch (error) {
      // The documented await_invalid error means this render requires Svelte's asynchronous path.
      if (error instanceof Error && error.name === "Svelte error" && error.message.split("\n", 1)[0] === "await_invalid")
        return Promise.resolve(output).then((result) => finish(result, ctx.id, ctx.nonce));
      throw error;
    }
  },
};
