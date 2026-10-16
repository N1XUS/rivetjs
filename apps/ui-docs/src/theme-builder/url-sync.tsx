// The builder's one load-time effect, in a leaf module: a resumed page fetches and runs it at load, and a resume
// chunk evaluates the module its symbol comes from (and needs the chunks of what it captures). Inside
// ThemeBuilder.tsx — or capturing its `values` computed — it imported the whole preview: every @rivetjs/ui
// component, ~320 KB br before the first input.
import type { Signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { ThemeMode } from "@rivetjs/ui/theme";
import { parseQuery, toQuery, type BuilderValues } from "./state.ts";

/** First run: read the URL (and the site's mode) into the signals; later runs: keep the URL in sync (replaceState). */
export function syncUrl(
  ready: Signal<boolean>,
  lightness: Signal<number>,
  chroma: Signal<number>,
  hue: Signal<number>,
  base: Signal<number>,
  radius: Signal<string>,
  formRadius: Signal<string>,
  vibrant: Signal<boolean>,
  mode: Signal<ThemeMode>,
): void {
  clientEffect(() => {
    if (!ready()) {
      const v = parseQuery(location.search);
      lightness.set(v.lightness);
      chroma.set(v.chroma);
      hue.set(v.hue);
      base.set(v.base);
      radius.set(v.radius);
      formRadius.set(v.formRadius);
      vibrant.set(v.vibrant);
      mode.set(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
      ready.set(true);
      return;
    }
    const query = toQuery({
      lightness: lightness(),
      chroma: chroma(),
      hue: hue(),
      base: base(),
      radius: radius() as BuilderValues["radius"],
      formRadius: formRadius() as BuilderValues["formRadius"],
      vibrant: vibrant(),
    });
    if (query !== location.search) history.replaceState(history.state, "", location.pathname + query + location.hash);
  });
}
