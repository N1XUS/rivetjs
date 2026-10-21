import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import type { User } from "../session.ts";
import { UserMenu } from "./UserMenu.tsx";

const NAV = ["politics", "economy", "climate", "science", "health"];

/** The editorial lane's layout (`lanes/rivet/src/routes/_layout.tsx`) + a user menu in the header. */
export function Chrome({ user, children }: { user: User | null; children?: JSX.Element }) {
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
        <UserMenu user={user} />
      </header>
      {children}
      <footer class="site">
        <p>The Daily Fixture · benchmark fixture content</p>
      </footer>
    </>
  );
}
