import { generateHydrationScript, renderToStringAsync } from "solid-js/web";
import { App } from "./App";

/** Renders the app subtree (awaiting the stream = fully settled HTML incl. serialized data). */
export async function render(): Promise<{ head: string; html: string }> {
  const html = await renderToStringAsync(() => <App />);
  return { head: generateHydrationScript(), html };
}
