import { load, type LayoutProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";
import { UserMenu } from "../../components/UserMenu.tsx";
import { session } from "../../session.ts";

const NAV = ["politics", "economy", "climate", "science", "health"];

// shellc (PPR-T3B): the `shell` layout for the cached-loader variant (same hole: the deferred user menu behind
// `<Async fallback>`); see `../shell/_layout.tsx`.
export const loader = load(async (event) => ({ user: session(event) }), { defer: true });

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
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
        <Async load={() => data()} fallback={() => <span class="user-wait">…</span>}>
          {(value) => <UserMenu user={value.user} />}
        </Async>
      </header>
      {children}
      <footer class="site">
        <p>The Daily Fixture · benchmark fixture content</p>
      </footer>
    </>
  );
}
