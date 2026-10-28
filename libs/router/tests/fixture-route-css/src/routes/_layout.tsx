import "../layout.css";
import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  return <div class="layout">{children}</div>;
}
