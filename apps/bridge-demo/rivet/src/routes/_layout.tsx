// The shell in Rivet: sidebar nav (router links, active state kept across client navigation) and the top bar; the
// user menu is a React island hydrated at idle.
import "@rivetjs/bridge-react/types";
import type { LayoutProps } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";
import { NAV } from "../../../data.ts";
import { UserMenu } from "../../../components/UserMenu.react.tsx";

const PREFETCH = import.meta.env.BD_PREFETCH === "off" ? ("none" as const) : undefined;

export default function Layout({ children }: LayoutProps) {
  return (
    <div class="shell">
      <nav class="side" aria-label="Main">
        <strong>Ops</strong>
        {NAV.map((item) => (
          <Link to={item.href as "/"} active prefetch={PREFETCH}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div>
        <header class="top">
          <span>Acme Ops</span>
          <UserMenu client={import.meta.env.BD_ALL_LOAD === "1" ? "load" : "idle"} name="Dana Kim" />
        </header>
        {children}
      </div>
    </div>
  );
}
