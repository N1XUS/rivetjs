import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";

// #region demo
// The root layout wraps every page of the app.
export default function RootLayout({ children }: LayoutProps) {
  const cart = signal(0);
  return (
    <div class="p-4">
      <header class="flex items-center justify-between border-b border-slate-200 pb-2">
        <strong>My shop</strong>
        <button id="cart" type="button" class="rounded bg-teal-700 px-3 py-1 text-white" onClick={() => cart.update((n) => n + 1)}>
          Cart: {cart()}
        </button>
      </header>
      {/* The page (and any inner layout) renders here. */}
      <main class="pt-3">{children}</main>
    </div>
  );
}
// #endregion
