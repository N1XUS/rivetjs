import { createContext, useContext, signal, type Signal } from "@rivetjs/reactivity";

export type Theme = "light" | "dark";

// #region demo
/** The context holds a signal, so every reader sees changes. The default is used when no Provider is above. */
export const ThemeContext = createContext<Signal<Theme>>(signal<Theme>("light"));

/** A card deep in the tree. It reads the theme from context instead of from props. */
export function Card({ title }: { title: string }) {
  const theme = useContext(ThemeContext);
  return (
    <article class={theme() === "dark" ? "rounded-lg bg-slate-800 p-3 text-white" : "rounded-lg bg-slate-100 p-3 text-slate-900"}>
      <h2 class="font-semibold">{title}</h2>
      <p class="card-theme">Theme: {theme()}</p>
    </article>
  );
}
// #endregion
