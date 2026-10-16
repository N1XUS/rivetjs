import { signal } from "@rivetjs/reactivity";
import { clientEffect, clientEvent } from "@rivetjs/runtime/dom";

export const head = { title: "Dark mode toggle" };

type Choice = "system" | "light" | "dark";

// #region demo
export default function ThemePage() {
  // The server cannot know the saved choice, so it renders "system".
  const choice = signal<Choice>("system");

  // In the browser: read the saved choice once the page has loaded.
  clientEffect(
    () => {
      try {
        const saved = localStorage.getItem("theme");
        if (saved === "light" || saved === "dark") choice.set(saved);
      } catch {
        /* Storage blocked: keep "system". */
      }
    },
    { when: "load" },
  );

  // Follow the operating system while the choice is "system".
  clientEvent("media:(prefers-color-scheme: dark)", "change", (event: MediaQueryListEvent) => {
    if (choice() === "system") document.documentElement.dataset.theme = event.matches ? "dark" : "light";
  });

  return (
    <div class="p-6">
      <button
        id="theme"
        type="button"
        class="rounded-md border border-slate-300 px-4 py-2 font-semibold dark:border-slate-600"
        onClick={() => {
          const next: Choice = choice() === "system" ? "light" : choice() === "light" ? "dark" : "system";
          choice.set(next);
          const dark = next === "dark" || (next === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
          document.documentElement.dataset.theme = dark ? "dark" : "light";
          try {
            if (next === "system") localStorage.removeItem("theme");
            else localStorage.setItem("theme", next);
          } catch {
            /* Storage blocked: the choice lasts until the page reloads. */
          }
        }}
      >
        Theme: {choice()}
      </button>
      <p class="mt-4 text-slate-600 dark:text-slate-300">This text changes colour with the theme.</p>
    </div>
  );
}
// #endregion
