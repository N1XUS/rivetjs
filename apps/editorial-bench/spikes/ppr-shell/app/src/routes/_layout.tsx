import type { LayoutProps } from "@rivetjs/router";

export const head = { titleTemplate: "%s | The Daily Fixture" };

export default function Layout({ children }: LayoutProps) {
  return <>{children}</>;
}
