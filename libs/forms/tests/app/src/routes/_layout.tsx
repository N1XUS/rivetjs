import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  return (
    <main>
      <nav>
        <a href="/">Forms</a> <a href="/signup">Sign up</a> <a href="/wizard">Wizard</a> <a href="/order">Order</a>
      </nav>
      {children}
    </main>
  );
}
