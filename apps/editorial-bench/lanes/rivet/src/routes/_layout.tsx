import type { LayoutProps } from "@rivetjs/router";

export const head = { titleTemplate: "%s | The Daily Fixture" };

const NAV = ["politics", "economy", "climate", "science", "health"];

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <header class="site">
        <a class="brand" href="/">
          The Daily Fixture
        </a>
        <nav>
          {NAV.map((t) => (
            <a href={"/tags/" + t + "/"}>{t}</a>
          ))}
        </nav>
      </header>
      {children}
      <footer class="site">
        <p>The Daily Fixture · benchmark fixture content</p>
      </footer>
    </>
  );
}
