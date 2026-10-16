import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

export const head = { title: "Theme" };

export default function Home() {
  const theme = signal<"light" | "dark">("light");
  // Restore once in the browser (localStorage does not exist on the server).
  clientEffect(
    () => {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") theme.set(saved);
    },
    { when: "load" },
  );
  // Apply and save on every change.
  clientEffect(
    () => {
      document.documentElement.dataset.theme = theme();
      localStorage.setItem("theme", theme());
    },
    { when: "load" },
  );
  return (
    <main class="p-6">
      <button id="theme" type="button" onClick={() => theme.update((t) => (t === "light" ? "dark" : "light"))}>
        Theme: {theme()}
      </button>
    </main>
  );
}
