import "../layout.css";
import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  const text = signal("");
  return (
    <div class="layout">
      <button type="button" id="drawer" onClick={async () => text.set((await import("../drawer.ts")).drawerText())}>
        Drawer
      </button>
      <p id="drawer-text">{text()}</p>
      {children}
    </div>
  );
}
