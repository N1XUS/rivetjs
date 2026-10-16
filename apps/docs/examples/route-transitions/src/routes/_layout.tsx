import type { LayoutProps } from "@rivetjs/router";
import { useNavigation } from "@rivetjs/router/client";

// #region demo
export default function Layout({ children }: LayoutProps) {
  // Navigation state: "idle" or "loading", plus where the user is going.
  const nav = useNavigation();
  return (
    <div class="mx-auto max-w-xl p-4">
      <header class="flex items-center justify-between">
        <a href="/" class="font-semibold">
          Photos
        </a>
        {/* Shown only while a slow navigation is pending (after a short delay). */}
        <span class="text-sm text-slate-500" hidden={nav().shown ? undefined : true}>
          Loading {nav().location?.pathname}…
        </span>
      </header>
      <main class="mt-4">{children}</main>
    </div>
  );
}
// #endregion
