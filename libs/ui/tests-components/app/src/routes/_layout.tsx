import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  return (
    <main>
      <nav aria-label="Stories">
        <a href="/">Index</a> <a href="/card">Card</a> <a href="/resume">Resume</a>
      </nav>
      {children}
    </main>
  );
}
