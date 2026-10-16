import { generateHydrationScript, renderToStream } from "@solidjs/web";
import { App } from "./App";

/** Renders the app subtree (awaiting the stream = fully settled HTML incl. serialized data). */
export async function render(): Promise<{ head: string; html: string }> {
  const html = await renderToStream(() => <App />);
  return { head: generateHydrationScript(), html };
}
