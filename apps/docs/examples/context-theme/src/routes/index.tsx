import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { Card, ThemeContext, type Theme } from "../components/theme.tsx";

export const head = { title: "Context theme" };

// #region demo
export default function Page() {
  const theme = signal<Theme>("light");
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <button
        id="toggle"
        type="button"
        class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
        onClick={() => theme.update((t) => (t === "light" ? "dark" : "light"))}
      >
        Toggle theme
      </button>
      {/* Everything inside the Provider can read `theme` with useContext. */}
      <Provider token={ThemeContext} value={theme}>
        <div id="cards" class="grid gap-2">
          <Card title="First card" />
          <Card title="Second card" />
        </div>
      </Provider>
    </div>
  );
}
// #endregion
